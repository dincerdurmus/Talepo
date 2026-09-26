/**
 * TANINAN SEMT ADLARI — KÜRASYONLU LİSTE, ÖLÇÜMLE KÜRASYONLU HÂLE GELDİ
 * (2026-09-25).
 *
 * NEDEN VAR. Kullanıcı konumu çoğu zaman idari birim adıyla değil semt adıyla
 * yazar: "1000 adet kartvizit, mat selefonlu, Topkapı". `Topkapı` bir ilçe
 * değildir, bu yüzden ilçe yetkilisi onu hiç görmüyor ve konum metinde AÇIKÇA
 * yazılmışken konum sorusu soruluyordu — D-0030'un doğrudan ihlali.
 *
 * NEDEN KANONİK MAHALLE KÜTÜĞÜ KULLANILMADI — ÖLÇÜLDÜ VE REDDEDİLDİ.
 * İlk tasarım deponun kanonik `neighborhoods-by-district.json` dosyasından
 * türetiyordu: 31.922 kayıt, 15.995 tekil ad, bunların 12.112'si tek bir
 * (il, ilçe) çiftine çözülüyor. Kural şuydu: "tek anlamlı çözülen semt adı
 * cevaptır". Ölçüldü ve DÜŞTÜ. 15 tanınan semt adı üzerinde sonuç:
 *
 *   doğru 3 · SESSİZCE YANLIŞ İL 2 · çözülemez 10
 *     Nişantaşı → Erzurum/Şenkaya   (beklenen İstanbul/Şişli)
 *     Taksim    → Erzincan/Merkez   (beklenen İstanbul/Beyoğlu)
 *     Bostancı, Etiler, Levent, Ataköy, Kızılay, Alsancak… → BELİRSİZ
 *
 * Kök neden: **resmî kütükte tekil olmak, günlük Türkçede tekil olmak
 * değildir.** Ünlü metropol semtleri resmî mahalle adı OLMADIĞI için kütükte
 * yoktur ya da başka bir ilin kırsal mahallesiyle aynı addadır; o kırsal kayıt
 * tekil olduğu için yarışmayı kazanır. "Taksim'de matbaa arıyorum" talebi
 * Erzincan'a gidiyordu — bu, deponun 2026-08-26'da kapattığı "Araç kiralamak
 * istiyorum → Kastamonu/Araç" kusurunun aynısıdır. Kütükten türetme bu yüzden
 * TERK EDİLDİ; 408 KB'lık JSON'un istemci paketine girmesi de böylece
 * gerekmedi (ölçülmüştü: +131.322 bayt gzip).
 *
 * BU LİSTE KÜRASYONLUDUR VE ÖYLE ETİKETLENİR. Eksik bilgi — bir semt adının
 * GÜNLÜK KULLANIMDA hangi ilçeyi kastettiği — deponun hiçbir kaynağında yok;
 * kürasyon tam olarak o bilgiyi katar, var olan bir yetkiyi kopyalamaz. İlçe
 * ve il adları KOPYALANMAZ: her satır kanonik il/ilçe yetkisine
 * (`TURKEY_PROVINCES`) karşı doğrulanır ve eşleşmeyen satır modül yüklenirken
 * GÜRÜLTÜLÜ biçimde düşer, sessizce yok sayılmaz.
 *
 * KAPSAM SINIRI AÇIKTIR: liste ülke genelini iddia etmez. Metropol iş
 * hacminin yoğunlaştığı semtleri kapsar; listede olmayan bir semt adı konum
 * kanıtı ÜRETMEZ ve kullanıcıya konum sorusu sorulur — yani kapsam dışı olmak
 * yanlış cevap değil, soru demektir. Büyütmek ölçülmüş bir karardır.
 *
 * ADIN METİNDE YER OLARAK KULLANILDIĞI KANITI BU MODÜLÜN İŞİ DEĞİLDİR;
 * yapısal kapı `turkey-districts.ts` içindedir ve ilçe adlarıyla birebir aynı
 * kapıdır.
 */
import { TURKEY_PROVINCES } from "@/lib/geo/turkey-districts";

export type SemtRow = {
  /** Günlük kullanımdaki semt adı. */
  semt: string;
  il: string;
  ilce: string;
};

/**
 * Kürasyonlu satırlar. Her satır bir semt adının günlük kullanımda hangi
 * ilçeyi kastettiğini söyler; il/ilçe adları kanonik yetkiden doğrulanır.
 *
 * LİSTEYE GİRMEME ÖLÇÜTLERİ (bilerek dar tutuldu):
 *   - ad aynı zamanda bir il ya da ilçe adıysa girmez (Bahçelievler, Ulus,
 *     Aksaray, Bornova, Karşıyaka, Dikmen): kararı kanonik idari birim
 *     yetkisi verir — doğrulayıcı böyle bir satırı KIRMIZI sayar, çünkü
 *     listede durması iki yetki kurmak olurdu;
 *   - ad gündelik bir sözcük ya da ürün/nitelik sözcüğü olabiliyorsa girmez
 *     (Oran, Siteler dışındaki benzerleri): yanlış konum sessiz bir hatadır;
 *   - hangi ilçeye düştüğü tartışmalıysa girmez (Göztepe hem Kadıköy hem
 *     İzmir/Konak; Seyrantepe ve Ayazağa ilçe sınırında).
 */
const CURATED_SEMT_ROWS: readonly SemtRow[] = [
  /* İstanbul — Avrupa */
  { semt: "Topkapı", il: "İstanbul", ilce: "Fatih" },
  { semt: "Eminönü", il: "İstanbul", ilce: "Fatih" },
  { semt: "Sirkeci", il: "İstanbul", ilce: "Fatih" },
  { semt: "Laleli", il: "İstanbul", ilce: "Fatih" },
  { semt: "Sultanahmet", il: "İstanbul", ilce: "Fatih" },
  { semt: "Taksim", il: "İstanbul", ilce: "Beyoğlu" },
  { semt: "Karaköy", il: "İstanbul", ilce: "Beyoğlu" },
  { semt: "Galata", il: "İstanbul", ilce: "Beyoğlu" },
  { semt: "Şişhane", il: "İstanbul", ilce: "Beyoğlu" },
  { semt: "Nişantaşı", il: "İstanbul", ilce: "Şişli" },
  { semt: "Mecidiyeköy", il: "İstanbul", ilce: "Şişli" },
  { semt: "Osmanbey", il: "İstanbul", ilce: "Şişli" },
  { semt: "Harbiye", il: "İstanbul", ilce: "Şişli" },
  { semt: "Levent", il: "İstanbul", ilce: "Beşiktaş" },
  { semt: "Etiler", il: "İstanbul", ilce: "Beşiktaş" },
  { semt: "Maslak", il: "İstanbul", ilce: "Sarıyer" },
  { semt: "Ataköy", il: "İstanbul", ilce: "Bakırköy" },
  { semt: "Yeşilköy", il: "İstanbul", ilce: "Bakırköy" },
  { semt: "Florya", il: "İstanbul", ilce: "Bakırköy" },
  { semt: "Cevizlibağ", il: "İstanbul", ilce: "Zeytinburnu" },
  { semt: "Merter", il: "İstanbul", ilce: "Güngören" },
  { semt: "Şirinevler", il: "İstanbul", ilce: "Bahçelievler" },
  { semt: "Yenibosna", il: "İstanbul", ilce: "Bahçelievler" },
  { semt: "Halkalı", il: "İstanbul", ilce: "Küçükçekmece" },
  { semt: "Sefaköy", il: "İstanbul", ilce: "Küçükçekmece" },
  { semt: "İkitelli", il: "İstanbul", ilce: "Başakşehir" },
  /* İstanbul — Anadolu */
  { semt: "Bostancı", il: "İstanbul", ilce: "Kadıköy" },
  { semt: "Kozyatağı", il: "İstanbul", ilce: "Kadıköy" },
  { semt: "Acıbadem", il: "İstanbul", ilce: "Kadıköy" },
  { semt: "Altunizade", il: "İstanbul", ilce: "Üsküdar" },
  { semt: "Kısıklı", il: "İstanbul", ilce: "Üsküdar" },
  { semt: "Bulgurlu", il: "İstanbul", ilce: "Üsküdar" },
  { semt: "Kavacık", il: "İstanbul", ilce: "Beykoz" },
  { semt: "Kurtköy", il: "İstanbul", ilce: "Pendik" },
  /* Ankara */
  { semt: "Kızılay", il: "Ankara", ilce: "Çankaya" },
  { semt: "Balgat", il: "Ankara", ilce: "Çankaya" },
  { semt: "Çukurambar", il: "Ankara", ilce: "Çankaya" },
  { semt: "Söğütözü", il: "Ankara", ilce: "Çankaya" },
  { semt: "Bilkent", il: "Ankara", ilce: "Çankaya" },
  { semt: "Çayyolu", il: "Ankara", ilce: "Çankaya" },
  { semt: "Sıhhiye", il: "Ankara", ilce: "Altındağ" },
  { semt: "Siteler", il: "Ankara", ilce: "Altındağ" },
  { semt: "Ostim", il: "Ankara", ilce: "Yenimahalle" },
  { semt: "İvedik", il: "Ankara", ilce: "Yenimahalle" },
  { semt: "Batıkent", il: "Ankara", ilce: "Yenimahalle" },
  { semt: "Eryaman", il: "Ankara", ilce: "Etimesgut" },
  /* İzmir */
  { semt: "Alsancak", il: "İzmir", ilce: "Konak" },
  { semt: "Mavişehir", il: "İzmir", ilce: "Karşıyaka" },
  { semt: "Şirinyer", il: "İzmir", ilce: "Buca" },
  /* Bursa */
  { semt: "Görükle", il: "Bursa", ilce: "Nilüfer" },
  { semt: "Demirtaş", il: "Bursa", ilce: "Osmangazi" },
];

function fold(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

/**
 * KANONİK YETKİYE KARŞI DOĞRULAMA — SESSİZ SAPMA YOK.
 *
 * Kürasyonlu bir satır il/ilçe adını yanlış yazarsa ya da kanonik veri
 * güncellenip bir ilçe adı değişirse satır sessizce yanlış konum üretmez;
 * indekse hiç girmez ve reddedilme gerekçesi ölçülebilir kalır
 * (`rejectedSemtRows()`), böylece doğrulayıcı kırmızı verir.
 */
type Built = {
  accepted: Map<string, SemtRow>;
  rejected: Array<{ row: SemtRow; why: string }>;
};

let built: Built | null = null;

/**
 * Doğrulama TEMBELDİR ve bu zorunludur: bu modül kanonik il/ilçe yetkisini
 * import eder, o modül de bu modülü (semt kanıtı için). Modül gövdesinde
 * çalışan bir döngü döngüsel yüklemede henüz kurulmamış veriyi okur. İlk
 * soruya kadar beklemek bağımlılık sırasını önemsiz kılar.
 */
function getBuilt(): Built {
  if (built) return built;
  const accepted = new Map<string, SemtRow>();
  const rejected: Array<{ row: SemtRow; why: string }> = [];

  for (const row of CURATED_SEMT_ROWS) {
    const province = TURKEY_PROVINCES.find((p) => fold(p.il) === fold(row.il));
    if (!province) {
      rejected.push({ row, why: "il kanonik listede yok" });
      continue;
    }
    const canonicalIlce = province.ilceler.find(
      (d) => fold(d) === fold(row.ilce),
    );
    if (!canonicalIlce) {
      rejected.push({ row, why: "ilçe o ilin kanonik ilçe listesinde yok" });
      continue;
    }
    const key = fold(row.semt);
    /* Semt adı bir il/ilçe adıysa karar kanonik yetkinin; satır alınmaz. */
    if (TURKEY_PROVINCES.some((p) => fold(p.il) === key)) {
      rejected.push({ row, why: "ad bir il adı — kanonik yetki karar verir" });
      continue;
    }
    if (TURKEY_PROVINCES.some((p) => p.ilceler.some((d) => fold(d) === key))) {
      rejected.push({ row, why: "ad bir ilçe adı — kanonik yetki karar verir" });
      continue;
    }
    if (accepted.has(key)) {
      rejected.push({ row, why: "aynı semt adı iki kez" });
      continue;
    }
    accepted.set(key, { semt: row.semt, il: province.il, ilce: canonicalIlce });
  }
  built = { accepted, rejected };
  return built;
}

/** Tanınan semt adı → (il, ilçe). Kanıt biçimi kapısı çağıranda durur. */
export function resolveWellKnownSemt(name: string): SemtRow | null {
  const key = fold(name);
  if (!key) return null;
  return getBuilt().accepted.get(key) ?? null;
}

/** Ölçüm için: kabul edilen satır sayısı. */
export function acceptedSemtCount(): number {
  return getBuilt().accepted.size;
}

/** Ölçüm için: kanonik yetkiyle çeliştiği için reddedilen satırlar. */
export function rejectedSemtRows(): ReadonlyArray<{
  row: SemtRow;
  why: string;
}> {
  return getBuilt().rejected;
}

/** Doğrulayıcı için: kürasyonlu satırların tamamı (ham, doğrulanmamış). */
export const CURATED_SEMT_INPUT = CURATED_SEMT_ROWS;
