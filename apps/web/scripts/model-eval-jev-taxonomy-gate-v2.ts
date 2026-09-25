/**
 * JEV TAKSONOMİ KAPISI — ÜÇ TASARIMIN ÖLÇÜMÜ (elle tetiklenir, 2026-09-25).
 *
 * NEDEN VAR. Ölçüldü (`SONUC-MODEL-OLCUM-2026-09-23`): Jev'in
 * `taksonomi_disi_mi` noul'ü HİÇ AYRIŞMIYOR — 20 gerçek kategori-dışı talebin
 * 0'ını yakalıyor ve kök İÇİNDEKİ cümleler o soruda daha yüksek puan alıyor.
 * Bu yanlış ayarlanmış bir eşik değil, hiçbir eşiğin işe yaramadığı bir soru.
 * Kurucu üç tasarımın ölçülmesini istedi; kazananı ölçüm belirler.
 *
 *   (a) SORU YENİDEN YAZILIR — noul yerine 12 SEÇENEKLİ tek choice: 11 kök +
 *       açık "HİÇBİRİ", içinde kategori-dışı örnekler ve sınır tarifleri.
 *   (b) JEV YALNIZ ÇIKARIM YAPAR — aradığı şeyi düz metin olarak söyler
 *       ("zeytinyağı"); eşlemeyi BİZİM katalog/sözlüğümüz yapar ve karşılık
 *       yoksa sonuç HİÇBİRİ olur.
 *   (c) KAPI TAMAMEN KURALDA KALIR — Jev yalnız kategori seçer, dayanaksız
 *       seçim reddedilir. Bu tasarım Jev'e EK ÇAĞRI GEREKTİRMEZ: mevcut
 *       kategori cevabı + bizim dayanak katmanımızla hesaplanır.
 *
 * ÇAĞRI BÜTÇESİ. Taban cümle başına TEK çağrı, içinde dört soru: bugünkü
 * kategori sorusu, bugünkü taksonomi noul'ü, (a) sorusu ve (b) çıkarımı.
 * Böylece üç tasarım AYNI cümlelerde karşılaştırılır ve bütçe taban sayısı
 * kadar kalır (kurucunun sınırı ≤700).
 *
 * CI'A GİRMEZ. Ağ ve anahtar gerektirir; `verify-open-set-v1` Jev'siz kapıdır.
 * Anahtar YALNIZ ortamdan okunur; dosyaya, loga ve rapora yazılmaz.
 *
 * Koşum (apps/web):
 *   npx tsx scripts/model-eval-jev-taxonomy-gate-v2.ts --limit 40
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import CATEGORY_CRITERIA from "../src/lib/request-decisions/jev/jev-category-criteria.json";
import {
  JEV_CATEGORY_CONFIDENCE_MIN,
  JEV_OUT_OF_TAXONOMY_CERTAIN_MIN,
  JEV_TIMEOUT_MS,
} from "../src/lib/request-decisions/jev/jev-policy";
import {
  hasNoCategoryMembership,
  proveCategoryMembership,
} from "../src/lib/request-decisions/category-membership-proof";
import { SET_A } from "../../../qa/open-set/set-a-out-of-taxonomy";
import { SET_B } from "../../../qa/open-set/set-b-in-taxonomy-hard";
import { splitById } from "../../../qa/open-set/split";

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

/**
 * (b) TASARIMININ SORU TİPİ — ÖLÇÜLDÜ VE BULUNAMADI (2026-09-25).
 *
 * Tasarım (b) Jev'in aradığı şeyi DÜZ METİN olarak söylemesini gerektirir.
 * Depodaki ölçülmüş API yüzeyi iki soru tipi tanıyor: `choice` ve `noul`
 * (bkz. `jev-client.ts`). `type: "text"` denendi ve servis isteğin tamamını
 * reddetti (`HTTP 400 · api_usage_error: Invalid request.`) — yani tek bir
 * geçersiz soru bütün çağrıyı düşürüyor, diğer üç soru da ölçülemiyor.
 *
 * `--extraction-type <tip>` ile bir tip DENENEBİLİR; boş bırakılırsa soru hiç
 * gönderilmez ve (b) raporda NOT-MEASURED kalır. Doğru tipi tahmin etmek bir
 * ölçüm değildir: TypeSafe belgeleri okunmadan buraya bir sabit yazılmayacak.
 */
const EXTRACTION_QUESTION_TYPE = (() => {
  const i = process.argv.indexOf("--extraction-type");
  return i >= 0 ? (process.argv[i + 1] ?? "").trim() || null : null;
})();

/** (a) — 12. seçenek AÇIKÇA "hiçbiri"dir ve sınırı tarif eder. */
const NONE_OPTION = "HICBIRI";
const CATEGORY_V2_CRITERIA: Record<string, string> = {
  ...(CATEGORY_CRITERIA as Record<string, string>),
  [NONE_OPTION]:
    "Kişi gerçekten bir şey satın almak, kiralamak ya da bir hizmet/üretim " +
    "yaptırmak istiyor AMA istediği şey yukarıdaki kategorilerin HİÇBİRİNDE " +
    "satılmıyor. Örnekler: zeytinyağı, köpek maması, kuş yemi, gitar, tenis " +
    "raketi, deri ceket, koşu ayakkabısı, ruj, parfüm, roman, altın yüzük, " +
    "uçak bileti, çimento, tuğla, güneş paneli, fide, tohum, saman, canlı " +
    "hayvan, perde, halı, deterjan, yangın tüpü. Sınır: istediği şey " +
    "kategorilerden birine giriyorsa — hangisine girdiğinden emin olmasan " +
    "bile — bunu SEÇME. Talep belirsiz ya da eksik yazıldığı için de bunu " +
    "seçme; yalnız istenen şey gerçekten listenin dışındaysa.",
};

const CATEGORY_V2_QUESTION =
  "Bu metin bir alıcının aradığı şeyi anlatıyor. Aradığı şey hangi kategoride " +
  "satılır? Aranan ASIL ürüne ya da hizmete bak; metindeki yan sözcüklere " +
  "(marka adı, ev/oda/model gibi bağlam sözcükleri, ambalaj ve ölçü " +
  `sözcükleri) değil. Hiçbir kategoride satılmıyorsa "${NONE_OPTION}" seç.`;

const PRODUCT_NAME_QUESTION =
  "Bu kişinin aradığı ŞEYİN adını yaz. Yalnız adı: marka, adet, bütçe, konum " +
  "ve nitelik yazma. Örnek: \"Zeytinyağı almak istiyorum, 5 litre soğuk " +
  'sıkım" → "zeytinyağı". Kategori adı yazma, ürünün ya da hizmetin kendi ' +
  "adını yaz.";

const CATEGORY_QUESTION =
  "Bu metin bir alıcının aradığı şeyi anlatıyor. Aradığı şey hangi kategoride satılır? " +
  "Aranan ASIL ürüne bak; metindeki yan sözcüklere (marka adı, ev/oda/model gibi bağlam sözcükleri) değil.";

const OUT_OF_TAXONOMY_QUESTION =
  "Bu kişi gerçekten bir şey satın almak, kiralamak ya da bir hizmet/üretim yaptırmak " +
  "istiyor, AMA istediği şey yukarıdaki 11 kategorinin hiçbirinde satılmıyor mu? " +
  "İstediği şey o 11 kategoriden birine giriyorsa — hangisine girdiğinden emin olmasan " +
  "bile — bu DOĞRU DEĞİLDİR. Talep belirsiz ya da eksik yazılmış olduğu için de bunu " +
  "seçme; yalnız istenen şey gerçekten kategori listesinin dışındaysa.";

type JevAnswer = {
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  noul?: number;
  value?: number;
  text?: string;
  answer?: string;
};

type Row = {
  id: string;
  set: "A" | "B";
  text: string;
  expectedRoot: string | null;
  baselineCategory: string | null;
  baselineConfidence: number;
  baselineOutOfTaxonomy: number | null;
  v2Choice: string | null;
  v2Confidence: number;
  productName: string | null;
  latencyMs: number;
  error?: string;
};

function readNoul(a: JevAnswer | undefined): number | null {
  const v = a?.noul ?? a?.value;
  return typeof v === "number" ? v : null;
}

function readText(a: JevAnswer | undefined): string | null {
  const v = a?.text ?? a?.answer ?? a?.choice;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function askJev(
  text: string,
  apiKey: string,
): Promise<{ answers: Record<string, JevAnswer>; latencyMs: number; error?: string }> {
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
          taksonomi_disi_mi: {
            type: "noul",
            instructions: OUT_OF_TAXONOMY_QUESTION,
          },
          kategori_v2: {
            type: "choice",
            instructions: CATEGORY_V2_QUESTION,
            criteria: CATEGORY_V2_CRITERIA,
          },
          ...(EXTRACTION_QUESTION_TYPE
            ? {
                urun_adi: {
                  type: EXTRACTION_QUESTION_TYPE,
                  instructions: PRODUCT_NAME_QUESTION,
                },
              }
            : {}),
        },
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      /**
       * HATA GÖVDESİ SESSİZCE YUTULMAZ: "HTTP 400" tek başına hangi sorunun
       * reddedildiğini söylemez ve ölçüm sahibi sebebi tahmin etmek zorunda
       * kalır. Gövde YALNIZ ilk hatada basılır — anahtar gövdede yer almaz.
       */
      const detail = await res.text().catch(() => "");
      return {
        answers: {},
        latencyMs,
        error: `HTTP ${res.status}${detail ? ` · ${detail.slice(0, 200)}` : ""}`,
      };
    }
    const body = (await res.json()) as {
      answers?: Record<string, JevAnswer>;
    };
    return { answers: body.answers ?? {}, latencyMs };
  } catch (error) {
    return {
      answers: {},
      latencyMs: Date.now() - started,
      error: (error as Error).name === "AbortError" ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}

function pct(n: number, d: number): string {
  return d ? ((n * 100) / d).toFixed(1) : "0.0";
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))]!;
}

async function main(): Promise<void> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.error(
      "FAIL — TYPESAFE_API_KEY ortamda yok. Anahtar yalnız ortamdan okunur.",
    );
    process.exit(1);
  }
  const limitArg = process.argv.indexOf("--limit");
  const limit =
    limitArg >= 0 ? Number(process.argv[limitArg + 1] ?? "0") || 0 : 0;

  /**
   * DEV YARISI ÖLÇÜLÜR. Test yarısı Jev'e HİÇ sorulmaz: tasarım seçimi bir
   * kural yazma işidir ve test yarısına bakarak kural yazmak yasaktır.
   */
  const aRows = splitById(SET_A).dev;
  const bRows = splitById(SET_B).dev;
  const cases: Array<{ id: string; set: "A" | "B"; text: string; root: string | null }> = [
    ...aRows.map((r) => ({ id: r.id, set: "A" as const, text: r.text, root: null })),
    ...bRows.map((r) => ({ id: r.id, set: "B" as const, text: r.text, root: r.root })),
  ];
  const selected = limit > 0 ? cases.slice(0, limit) : cases;

  console.log("=== model-eval-jev-taxonomy-gate-v2 ===");
  console.log(
    `TABAN CÜMLE: ${selected.length} (A ${selected.filter((c) => c.set === "A").length} · ` +
      `B ${selected.filter((c) => c.set === "B").length})`,
  );
  console.log(`ÇAĞRI BÜTÇESİ: cümle başına 1 çağrı, dört soru → ${selected.length} çağrı`);

  const rows: Row[] = [];
  for (const [i, c] of selected.entries()) {
    const { answers, latencyMs, error } = await askJev(c.text, apiKey);
    const kategori = answers.kategori;
    const v2 = answers.kategori_v2;
    rows.push({
      id: c.id,
      set: c.set,
      text: c.text,
      expectedRoot: c.root,
      baselineCategory: kategori?.choice ?? null,
      baselineConfidence: kategori?.confidence ?? 0,
      baselineOutOfTaxonomy: readNoul(answers.taksonomi_disi_mi),
      v2Choice: v2?.choice ?? null,
      v2Confidence: v2?.confidence ?? 0,
      productName: readText(answers.urun_adi),
      latencyMs,
      ...(error ? { error } : {}),
    });
    if ((i + 1) % 20 === 0) console.log(`  ... ${i + 1}/${selected.length} çağrı`);
  }

  const ok = rows.filter((r) => !r.error);
  const failed = rows.length - ok.length;
  const a = ok.filter((r) => r.set === "A");
  const b = ok.filter((r) => r.set === "B");

  /* ---- TASARIM 0: BUGÜNKÜ HÂL ---- */
  const baseCaught = a.filter(
    (r) => (r.baselineOutOfTaxonomy ?? 0) >= JEV_OUT_OF_TAXONOMY_CERTAIN_MIN,
  ).length;
  const baseConfidentWrong = a.filter(
    (r) =>
      (r.baselineOutOfTaxonomy ?? 0) < JEV_OUT_OF_TAXONOMY_CERTAIN_MIN &&
      r.baselineCategory != null &&
      r.baselineConfidence >= JEV_CATEGORY_CONFIDENCE_MIN,
  ).length;
  const baseBFalseAlarm = b.filter(
    (r) => (r.baselineOutOfTaxonomy ?? 0) >= JEV_OUT_OF_TAXONOMY_CERTAIN_MIN,
  ).length;

  /* ---- TASARIM (a): 12 SEÇENEKLİ CHOICE ---- */
  const aV2Caught = a.filter((r) => r.v2Choice === NONE_OPTION).length;
  const aV2ConfidentWrong = a.filter(
    (r) =>
      r.v2Choice != null &&
      r.v2Choice !== NONE_OPTION &&
      r.v2Confidence >= JEV_CATEGORY_CONFIDENCE_MIN,
  ).length;
  const bV2FalseAlarm = b.filter((r) => r.v2Choice === NONE_OPTION).length;
  const bV2RightRoot = b.filter((r) => r.v2Choice === r.expectedRoot).length;

  /* ---- TASARIM (b): ÇIKARIM + BİZİM EŞLEMEMİZ ---- */
  const nameRows = ok.filter((r) => r.productName != null);
  const aExtractCaught = a.filter(
    (r) => r.productName != null && hasNoCategoryMembership(r.productName),
  ).length;
  const bExtractFalseAlarm = b.filter(
    (r) => r.productName != null && hasNoCategoryMembership(r.productName),
  ).length;
  const bExtractRightRoot = b.filter(
    (r) =>
      r.productName != null &&
      r.expectedRoot != null &&
      proveCategoryMembership(r.productName, r.expectedRoot) != null,
  ).length;

  /* ---- TASARIM (c): JEV SEÇER, DAYANAK REDDEDER ---- */
  const aRuleGateCaught = a.filter(
    (r) =>
      r.baselineCategory == null ||
      proveCategoryMembership(r.text, r.baselineCategory) == null,
  ).length;
  const bRuleGateFalseAlarm = b.filter(
    (r) =>
      r.baselineCategory == null ||
      proveCategoryMembership(r.text, r.baselineCategory) == null,
  ).length;

  const latencies = ok.map((r) => r.latencyMs);

  console.log("");
  console.log(`ÇAĞRI: ${rows.length}  ·  BAŞARISIZ: ${failed}`);
  console.log(
    `GECİKME: p50 ${median(latencies).toFixed(0)} ms · p95 ${percentile(latencies, 95).toFixed(0)} ms`,
  );
  console.log(
    `ÇIKARIM CEVABI DÖNEN: ${nameRows.length}/${ok.length} ` +
      `(0 ise "text" soru tipi bu API yüzeyinde YOK — (b) NOT-MEASURED)`,
  );

  const table = [
    ["tasarım", "A yakalama", "A emin-ama-yanlış", "B yanlış alarm", "B doğru kök"],
    [
      "0 · bugünkü noul",
      `${baseCaught}/${a.length} (%${pct(baseCaught, a.length)})`,
      String(baseConfidentWrong),
      `${baseBFalseAlarm}/${b.length} (%${pct(baseBFalseAlarm, b.length)})`,
      `${b.filter((r) => r.baselineCategory === r.expectedRoot).length}/${b.length}`,
    ],
    [
      "a · 12 seçenekli choice",
      `${aV2Caught}/${a.length} (%${pct(aV2Caught, a.length)})`,
      String(aV2ConfidentWrong),
      `${bV2FalseAlarm}/${b.length} (%${pct(bV2FalseAlarm, b.length)})`,
      `${bV2RightRoot}/${b.length}`,
    ],
    [
      "b · çıkarım + katalog",
      `${aExtractCaught}/${a.length} (%${pct(aExtractCaught, a.length)})`,
      "—",
      `${bExtractFalseAlarm}/${b.length} (%${pct(bExtractFalseAlarm, b.length)})`,
      `${bExtractRightRoot}/${b.length}`,
    ],
    [
      "c · kural dayanağı reddeder",
      `${aRuleGateCaught}/${a.length} (%${pct(aRuleGateCaught, a.length)})`,
      "0 (tanım gereği)",
      `${bRuleGateFalseAlarm}/${b.length} (%${pct(bRuleGateFalseAlarm, b.length)})`,
      "—",
    ],
  ];
  console.log("");
  for (const line of table) console.log("  " + line.map((c) => c.padEnd(26)).join(""));

  const outPath = join(
    __dirname,
    "..",
    "..",
    "..",
    "reports",
    "jev-taxonomy-gate-v2.jsonl",
  );
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      rows.map((r) => JSON.stringify(r)).concat("").join("\n"),
      "utf8",
    );
    console.log(`\nHAM ÇIKTI: ${outPath}`);
  } catch {
    console.log("\nHAM ÇIKTI: yazilamadi");
  }
}

main().catch((error) => {
  console.error(`FAIL — ${(error as Error).message}`);
  process.exit(1);
});
