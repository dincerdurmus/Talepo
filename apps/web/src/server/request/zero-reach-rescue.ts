import { createSubsystemLogger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import type { ZeroMatchReason } from "@/server/request/fanout-telemetry";

/**
 * SIFIR ULAŞIM KURTARMASI — ALICIYA SÖYLENİR (2026-09-15).
 *
 * Ölçülen kusur: bir talep hiçbir tedarikçiye ulaşmadığında sistem bunu
 * BİLİYOR (`request.fanout.zero_match` olayı tam o anda yazılıyor) ama
 * kimseye SÖYLEMİYORDU. Alıcı talebini yayımlıyor, "teklif bekleniyor"
 * ekranına bakıyor ve bekliyor — oysa talebi hiç kimseye gitmemiş. En kötü
 * hâli: motor kategoriyi çözemediğinde (`unresolved`) kategori taraması
 * bilerek atlanıyor; şehir de girilmemişse geriye HİÇBİR kanal kalmıyor ve
 * talep sonsuza kadar görünmez kalıyor.
 *
 * Bu, iki güven sözleşmesini aynı anda bozuyordu: alıcı sessizce hiçbir şey
 * almıyor, para veren tedarikçi de görmesi gereken talebi hiç görmüyor.
 *
 * ÇÖZÜM SUÇLAMAZ, YOL GÖSTERİR. Dört sıfır-ulaşım sebebinin ÜÇÜ alıcının
 * düzeltebileceği bir eksikten doğar (kategori net değil, şehir yok);
 * DÖRDÜNCÜSÜ alıcının elinde değildir (o kategoride henüz tedarikçi yok).
 * Mesaj buna göre değişir: düzeltilebilir olanda ne yapılacağı yazılır,
 * düzeltilemeyende alıcı suçlanmaz ve aramanın sürdüğü söylenir.
 *
 * DÖNGÜ KAPANIR. Bildirim talebin düzenleme sayfasına bağlanır; kategori
 * düzeltildiğinde `updateRequest` dağıtımı yeniden koşar (2026-09-15'te
 * bağlandı). Yani alıcının tek dokunuşu talebi gerçekten tedarikçilere
 * ulaştırır.
 *
 * BİR TALEP İÇİN BİR KEZ. Fanout yeniden koşabilir (düzenleme, acil
 * hatırlatma); aynı uyarı tekrar tekrar yazılmaz.
 *
 * ANA AKIŞI KIRAMAZ. Çağıran non-blocking çağırır ve bu fonksiyon asla
 * fırlatmaz: talebin yayımlanması bir bildirim yazılamadı diye başarısız
 * olamaz.
 *
 * TESLİM SINIRI — METİN BUNA GÖRE YAZILIR (2026-09-16, Dinçer'in düzeltmesi).
 *
 * Talepo'da tedarikçiye talep GÖNDERİLMEZ. Dağıtımın yaptığı iki şey var:
 * `RequestMatch` satırı yazar (talep o firmanın `panel/talepler` listesinde
 * görünür hale gelir) ve panel içi `NEW_REQUEST_MATCH` bildirimi yazar.
 * Dışarı çıkan hiçbir kanal yoktur: `NEW_REQUEST_MATCH`
 * `EMAIL_CRITICAL_NOTIFICATION_TYPES` listesinde değildir, dağıtım zaten
 * `createNotification` yerine doğrudan `notification.createMany` kullanır ve
 * `EMAIL_PROVIDER` de tanımlı değildir. SMS ve push hiç yoktur.
 *
 * Bu yüzden buradaki metinler "iletiriz", "ulaştırırız", "göndeririz"
 * DEMEZ — o fiiller olmayan bir kanalı vaat eder ve bu modülün kapatmak
 * için yazıldığı kusurun ta kendisidir. Doğru ifade görünürlüktür:
 * talep firmaların listesine düşer, firma paneli açtığında görür.
 * Aynı sınır bu bildirimin KENDİSİ için de geçerlidir: alıcı da bunu ancak
 * panele girdiğinde okur.
 */

const log = createSubsystemLogger("request.zero-reach");

/** Aynı talep için ikinci kez yazılmasını engelleyen sabit başlık. */
const ZERO_REACH_TITLE = "Talebiniz henüz tedarikçilere görünmüyor";

type RescueCopy = { message: string; fixable: boolean };

function copyForReason(reason: ZeroMatchReason, title: string): RescueCopy {
  switch (reason) {
    case "system_category_and_no_city_input":
      return {
        fixable: true,
        message: `“${title}” talebiniz yayımlandı ama hangi alanda olduğunu netleştiremediğimiz için henüz hiçbir tedarikçinin talep listesinde görünmüyor. Talebi düzenleyip kategoriyi seçin ve şehir ekleyin; o alandaki firmaların listesine düşsün.`,
      };
    case "system_category_and_no_city_match":
      return {
        fixable: true,
        message: `“${title}” talebiniz yayımlandı ama hangi alanda olduğunu netleştiremediğimiz için henüz hiçbir tedarikçinin talep listesinde görünmüyor. Talebi düzenleyip kategoriyi seçin; o alandaki firmaların listesine düşsün.`,
      };
    case "no_category_companies_and_no_city_input":
      return {
        fixable: true,
        message: `“${title}” talebiniz yayımlandı ama bu alanda kayıtlı tedarikçi bulamadık; bu yüzden henüz kimsenin talep listesinde görünmüyor. Talebe şehir eklerseniz aynı şehirdeki firmaların listesinde de aranır.`,
      };
    case "no_category_companies_and_no_city_match":
      /* Alıcının elinde bir şey yok: bu kategoride henüz tedarikçi yok.
         Suçlayıcı bir dil kullanılmaz ve yanlış bir eylem önerilmez.
         "Yeni firma katılınca iletilecek" CÜMLESİ KALDIRILDI (2026-09-16):
         o işi yapacak tur (`match-backfill`) bugün hiçbir zamanlayıcı
         tarafından koşturulmuyor — bkz. aşağıdaki TESLİM SINIRI notu. */
      return {
        fixable: false,
        message: `“${title}” talebiniz yayımlandı. Bu alanda ve bu bölgede kayıtlı tedarikçi bulamadık; bu yüzden talebiniz henüz hiçbir firmanın talep listesinde görünmüyor.`,
      };
  }
}

export async function notifyZeroReach(input: {
  requestId: string;
  buyerUserId: string;
  requestTitle: string;
  reason: ZeroMatchReason;
}): Promise<{ notified: boolean; reason: string }> {
  try {
    const copy = copyForReason(input.reason, input.requestTitle);

    /**
     * TEKRAR ENGELİ SEBEBE BAĞLIDIR, YALNIZ BAŞLIĞA DEĞİL (2026-09-15).
     *
     * İlk hâlde engel sabit başlığa dayanıyordu ve bir talep için ömür boyu
     * tek bildirim yazılabiliyordu. Oysa sebep düzenlemeyle gerçekten
     * değişir: alıcı "kategoriyi seçin" denileni yapar, kategori çözülür ama
     * o kategoride tedarikçi yoktur; artık doğru tavsiye başkadır ve alıcı
     * hâlâ yaptığı işi yapmasını söyleyen eski bildirime bakar. Metin sebebe
     * birebir bağlı olduğu için METNİN KENDİSİ tekrar anahtarıdır: aynı
     * sebep ikinci kez yazılmaz, değişen sebep yazılır.
     */
    const existing = await prisma.notification.findFirst({
      where: {
        requestId: input.requestId,
        userId: input.buyerUserId,
        type: "GENERAL",
        title: ZERO_REACH_TITLE,
        message: copy.message,
      },
      select: { id: true },
    });
    if (existing) return { notified: false, reason: "already_notified" };

    await prisma.notification.create({
      data: {
        userId: input.buyerUserId,
        type: "GENERAL",
        title: ZERO_REACH_TITLE,
        message: copy.message,
        /* Düzeltilebilir durumda doğrudan düzenleme ekranına; değilse
           talebin kendisine. Yanlış yere göndermek, hiç göndermemekten kötü. */
        actionUrl: copy.fixable
          ? `/panel/taleplerim/${input.requestId}/duzenle`
          : `/panel/taleplerim/${input.requestId}`,
        requestId: input.requestId,
      },
    });

    log.info("request.zero_reach.notified", {
      outcome: "success",
      requestId: input.requestId,
      context: { reason: input.reason, fixable: copy.fixable },
    });
    return { notified: true, reason: input.reason };
  } catch (error) {
    log.warn("request.zero_reach.notify_failed", {
      outcome: "failure",
      requestId: input.requestId,
      context: {
        errorName: error instanceof Error ? error.name : "unknown",
      },
    });
    return { notified: false, reason: "error" };
  }
}

export const ZERO_REACH_NOTIFICATION_TITLE = ZERO_REACH_TITLE;
