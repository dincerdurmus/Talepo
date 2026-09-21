/**
 * JEV İSTEMCİSİ — TypeSafe System One'a TEK çağrı, ÜÇ soru (2026-09-21).
 *
 * NEDEN TEK ÇAĞRI. Servis bir istekte birden çok soru kabul ediyor; kategori,
 * kapsam ve taksonomi-dışı ayrı ÇAĞRILAR olsaydı gecikme üçe katlanırdı.
 * Ayrı SORU olmaları şart (D-0029), ayrı çağrı olmaları değil.
 *
 * NEDEN SORU METİNLERİ BURADA SABİT. Ölçülen metinlerin ta kendileridir.
 * Değiştirilirse ölçüm geçersizleşir; değiştiren kişi 1077'yi yeniden koşmak
 * zorundadır. Kategori sorusunun metni Veyra ölçümüyle BİREBİR aynıdır.
 *
 * NEDEN AÇIKLAMALAR ELLE YAZILMADI. Ölçüldü (V1→V2, 2026-09-21): elle yazılan
 * kategori açıklamaları 77 hatanın 52'sini üretiyordu; açıklamalar Talepo
 * taksonomisinden üretilince doğruluk %92,7'den %96,9'a çıktı. Bu dosyanın
 * okuduğu `jev-category-criteria.json` o üretilmiş çıktıdır: 11 kökün her biri
 * için `data/taxonomy/<domain>` dosyalarından kök adı + alt başlıklar + örnek
 * yapraklar toplanarak yazıldı. ELLE DÜZENLENMEZ. Taksonomi değiştiğinde bu
 * dosya yeniden üretilmeli; üretici henüz depoya taşınmadı (Veyra tarafında
 * `jev-olcum/kategoriler-taksonomi.json` olarak koştu) — AÇIK İŞ.
 */
import CATEGORY_CRITERIA from "./jev-category-criteria.json";
import { JEV_TIMEOUT_MS } from "./jev-policy";

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export type JevDecisionBundle = {
  /** Seçilen kök kategori; servis cevap veremediyse null. */
  category: string | null;
  categoryConfidence: number;
  /** Olasılık dağılımının ilk–ikinci farkı; kalibrasyon kanıtı olarak taşınır. */
  categoryMargin: number;
  categoryRunnerUp: string | null;
  /** 0–1: talep Talepo'nun karşılamadığı üç türden biri mi. */
  outOfScope: number;
  /** 0–1: geçerli talep ama 11 kökten hiçbirinde satılmıyor mu. */
  outOfTaxonomy: number;
  latencyMs: number;
};

const OUT_OF_SCOPE_QUESTION =
  "Bu talep şu üçünden biri mi? (1) ilaç ya da eczane ürünü — ağrı kesici, antibiyotik, " +
  "vitamin hapı, şurup, merhem, reçeteli ya da reçetesiz her ilaç; (2) tıbbi tavsiye isteği — " +
  "hangi ilacı kullanmalıyım, bu belirti ne, doz ne olmalı; (3) kişinin KENDİ malını satmak " +
  "ya da kiraya vermek için ilan vermek istemesi. Kişi bunu yapmak için bir HİZMET arıyorsa " +
  "(emlakçı, danışman, nakliyeci, eksper) bu DOĞRU DEĞİLDİR, o bir hizmet talebidir. " +
  "Sıradan bir ürün ya da hizmet arayışı da DOĞRU DEĞİLDİR.";

/**
 * NEEDS_VERIFICATION: bu sorunun eşiği korpusla doğrulanmadı — korpusun 84
 * tabanının tamamı 11 kökün içinde, yani negatif örnek var, pozitif örnek yok.
 */
const OUT_OF_TAXONOMY_QUESTION =
  "Bu kişi gerçekten bir şey satın almak, kiralamak ya da bir hizmet/üretim yaptırmak " +
  "istiyor, AMA istediği şey yukarıdaki 11 kategorinin hiçbirinde satılmıyor mu? " +
  "İstediği şey o 11 kategoriden birine giriyorsa — hangisine girdiğinden emin olmasan " +
  "bile — bu DOĞRU DEĞİLDİR. Talep belirsiz ya da eksik yazılmış olduğu için de bunu " +
  "seçme; yalnız istenen şey gerçekten kategori listesinin dışındaysa.";

const CATEGORY_QUESTION =
  "Bu metin bir alıcının aradığı şeyi anlatıyor. Aradığı şey hangi kategoride satılır? " +
  "Aranan ASIL ürüne bak; metindeki yan sözcüklere (marka adı, ev/oda/model gibi bağlam sözcükleri) değil.";

type JevAnswer = {
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  noul?: number;
  value?: number;
};

function readNoul(a: JevAnswer | undefined): number {
  return a?.noul ?? a?.value ?? 0;
}

/**
 * Tek çağrı. Hata YUTULMAZ ama FIRLATILMAZ da: null döner ve çağıran yerleşik
 * sağlayıcıya düşer. Bir karar servisinin düşmesi talebin kaybolması değildir.
 */
export async function fetchJevDecisions(
  text: string,
  apiKey: string,
): Promise<JevDecisionBundle | null> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);
  try {
    const res = await fetch(JEV_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state: text,
        model: JEV_MODEL,
        questions: {
          kategori: {
            type: "choice",
            instructions: CATEGORY_QUESTION,
            criteria: CATEGORY_CRITERIA,
          },
          kapsam_disi_mi: { type: "noul", instructions: OUT_OF_SCOPE_QUESTION },
          taksonomi_disi_mi: {
            type: "noul",
            instructions: OUT_OF_TAXONOMY_QUESTION,
          },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { answers?: Record<string, JevAnswer> };
    const answers = body.answers ?? {};
    const kategori = answers.kategori;
    const sorted = Object.entries(kategori?.probabilities ?? {}).sort(
      (a, b) => b[1] - a[1],
    );
    return {
      category: kategori?.choice ?? null,
      categoryConfidence: kategori?.confidence ?? 0,
      categoryMargin: (sorted[0]?.[1] ?? 0) - (sorted[1]?.[1] ?? 0),
      categoryRunnerUp: sorted[1]?.[0] ?? null,
      outOfScope: readNoul(answers.kapsam_disi_mi),
      outOfTaxonomy: readNoul(answers.taksonomi_disi_mi),
      latencyMs: Date.now() - started,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
