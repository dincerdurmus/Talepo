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
import { JEV_OUT_OF_TAXONOMY_CHOICE, JEV_TIMEOUT_MS } from "./jev-policy";

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
  /**
   * Taksonomi seçimi: 11 kökten biri ya da `HICBIRI`. Servis cevap veremediyse
   * null. Eski `outOfTaxonomy` NOUL'ü ölçüldü ve terk edildi (bkz. jev-policy).
   */
  taxonomyChoice: string | null;
  taxonomyChoiceConfidence: number;
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
 * TAKSONOMİ SEÇİMİ — NOUL'ÜN YERİNİ ALDI (2026-09-25, ölçülerek).
 *
 * Eski soru bir `noul`dü ve ölçüldü: 11 kökün dışından 77 gerçek talepte
 * yakalama 0/77, emin-ama-yanlış 17. Sorun eşikte değildi — soru hiç
 * ayrışmıyordu. Yerine 12 SEÇENEKLİ tek choice kondu: 11 kök + açıkça tarif
 * edilmiş `HICBIRI`. Aynı cümlelerde yakalama %90,9'a çıktı ve B kümesinde
 * doğru kök oranı DÜŞMEDİ (82/84 → 83/84). Ölçüm:
 * `model-eval-jev-taxonomy-gate-v2`, eşik gerekçesi `jev-policy.ts`.
 *
 * `HICBIRI` ÖLÇÜTÜ, SEÇENEĞİN AÇIKLAMASININ KENDİSİDİR. Açıklama elle
 * yazılmıştır ve bilerek ÖRNEK taşır: ölçüldü (V1→V2, 2026-09-21) — soyut
 * tarif yetmiyor, sınır örnekle öğreniliyor. 11 kökün açıklamaları ise
 * taksonomiden ÜRETİLİR ve elle düzenlenmez.
 */
const OUT_OF_TAXONOMY_OPTION_CRITERIA =
  "Kişi gerçekten bir şey satın almak, kiralamak ya da bir hizmet/üretim " +
  "yaptırmak istiyor AMA istediği şey yukarıdaki kategorilerin HİÇBİRİNDE " +
  "satılmıyor. Örnekler: zeytinyağı, köpek maması, kuş yemi, gitar, tenis " +
  "raketi, deri ceket, koşu ayakkabısı, ruj, parfüm, roman, altın yüzük, " +
  "uçak bileti, çimento, tuğla, güneş paneli, fide, tohum, saman, canlı " +
  "hayvan, perde, halı, deterjan, yangın tüpü. Sınır: istediği şey " +
  "kategorilerden birine giriyorsa — hangisine girdiğinden emin olmasan " +
  "bile — bunu SEÇME. Talep belirsiz ya da eksik yazıldığı için de bunu " +
  "seçme; yalnız istenen şey gerçekten listenin dışındaysa.";

const TAXONOMY_CHOICE_QUESTION =
  "Bu metin bir alıcının aradığı şeyi anlatıyor. Aradığı şey hangi kategoride " +
  "satılır? Aranan ASIL ürüne ya da hizmete bak; metindeki yan sözcüklere " +
  "(marka adı, ev/oda/model gibi bağlam sözcükleri, ambalaj ve ölçü " +
  `sözcükleri) değil. Hiçbir kategoride satılmıyorsa "${JEV_OUT_OF_TAXONOMY_CHOICE}" seç.`;

const TAXONOMY_CHOICE_CRITERIA: Record<string, string> = {
  ...(CATEGORY_CRITERIA as Record<string, string>),
  [JEV_OUT_OF_TAXONOMY_CHOICE]: OUT_OF_TAXONOMY_OPTION_CRITERIA,
};

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
          taksonomi_secimi: {
            type: "choice",
            instructions: TAXONOMY_CHOICE_QUESTION,
            criteria: TAXONOMY_CHOICE_CRITERIA,
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
      taxonomyChoice: answers.taksonomi_secimi?.choice ?? null,
      taxonomyChoiceConfidence: answers.taksonomi_secimi?.confidence ?? 0,
      latencyMs: Date.now() - started,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
