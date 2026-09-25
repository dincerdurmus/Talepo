/**
 * MODEL ÖLÇÜMÜ — VERİ KÜMESİ DIŞA AKTARIMI + KURAL TABAN ÇİZGİSİ.
 *
 * Bu betik ürün koduna hiçbir şey bağlamaz. Yaptığı tek şey, zaten depoda
 * olan iki zemin gerçeğini tek bir ölçüm formatında birleştirmek ve BUGÜNKÜ
 * kuralın (`understandRequest`) aynı girdilerdeki cevabını yanına yazmaktır.
 * Böylece model adayları, kuralın ölçüldüğü VAKALARIN AYNISINDA ölçülür —
 * ayrı bir örneklemde ölçülen bir kazanç, kazanç değildir.
 *
 * İKİ KAYNAK, İKİ AYRI TOHUM EVRENİ:
 *  - `brain-adversarial-corpus-v1` — 78 taban şablon × deterministik kaos
 *    varyantları. Tohum = `baseId`. Eğitim/doğrulama burada yapılır.
 *  - `reports/e2e-a-z-2026-09-23/matris.jsonl` — 16 kova × 5 üslup × 3
 *    yoğunluk. Tohum = `bucketId`. Bu küme EĞİTİME GİRMEZ; TR-EN, çoklu ürün
 *    ve kategori-dışı meşru eksenleri yalnız burada var.
 *
 * SIZINTI YASAĞI kayıt düzeyinde değil TOHUM düzeyinde uygulanır: aynı taban
 * cümlenin büyük harfli, diyakritiksiz ve typo'lu türevleri aynı tarafta
 * kalır. Bu dosya bölmeyi yapmaz, yalnız `seed` alanını taşır — bölme
 * eğitimi koşan tarafın işidir ve orada ölçülür.
 *
 * Koşum (apps/web):
 *   npx tsx scripts/model-eval-export-dataset-v1.ts
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { buildAdversarialCorpus } from "./fixtures/brain-adversarial-corpus-v1";
import { understandRequest } from "../src/lib/request-understanding/understand-request";

const REPO_ROOT = join(__dirname, "..", "..", "..");
export const MATRIS_PATH = join(REPO_ROOT, "reports", "e2e-a-z-2026-09-23", "matris.jsonl");
export const OUT_PATH = join(REPO_ROOT, "qa", "model-eval", "data", "dataset.jsonl");

/** Ölçüm eksenleri — kurucunun istediği yedi eksen, tek sözlük. */
export type Axis =
  | "duzgun"
  | "kisa"
  | "typo"
  | "diyakritiksiz"
  | "tr-en"
  | "coklu-urun"
  | "argo"
  | "kategori-disi-mesru";

/**
 * Korpus varyant adı → eksen. Varyantların çoğu "düzgün" ekseninin
 * gürültüsüzdür (büyük harf, fazladan boşluk, selam eki); onları ayrı eksen
 * saymak ekseni şişirir ve typo/diyakritik sinyalini seyreltir.
 */
const CORPUS_VARIANT_AXIS: Record<string, Axis> = {
  orijinal: "duzgun",
  kucuk: "duzgun",
  BUYUK: "duzgun",
  bosluk: "duzgun",
  selam: "duzgun",
  acil: "duzgun",
  butce: "duzgun",
  "any-marka": "duzgun",
  ascii: "diyakritiksiz",
  "ascii-kucuk": "diyakritiksiz",
  "duz-ascii": "diyakritiksiz",
  "any-marka-ascii": "diyakritiksiz",
  typo: "typo",
  "typo-ascii": "typo",
  konusma: "argo",
  fiilsiz: "kisa",
};

const MATRIS_STYLE_AXIS: Record<string, Axis> = {
  duzgun: "duzgun",
  eksik: "kisa",
  argo: "argo",
  karisik: "tr-en",
  coklu: "coklu-urun",
};

/** Matris kovası → zemin gerçeği kapsamı. Kategori kovaları SUPPORTED'dır. */
const MATRIS_BUCKET_SCOPE: Record<string, string> = {
  "unsupported-pharmacy": "UNSUPPORTED_PHARMACY",
  "unsupported-medical-advice": "UNSUPPORTED_MEDICAL_ADVICE",
  "unsupported-supply": "UNSUPPORTED_SUPPLY",
  "unsupported-removed-scope": "UNSUPPORTED_REMOVED_SCOPE",
};

/** Kategori iddiası olmayan kovalar: doğru cevap "kategori yok"tur. */
const MATRIS_NO_CATEGORY_BUCKETS = new Set([
  "out-of-category-legit",
  "unsupported-pharmacy",
  "unsupported-medical-advice",
  "unsupported-supply",
  "unsupported-removed-scope",
]);

export type EvalRow = {
  id: string;
  source: "corpus" | "matris";
  /** Sızıntı bölmesi bu alanla yapılır — kayıt kimliğiyle değil. */
  seed: string;
  axis: Axis;
  text: string;
  /**
   * Kabul edilen kategori kümesi. Boş dizi iki AYRI şey demek olabilirdi, bu
   * yüzden ikisi ayrıldı: `goldCategoryFree` true ise korpus bu vakada
   * kategori iddiasını serbest bırakmıştır (ölçüm dışı); false ve dizi boşsa
   * doğru cevap "kategori YOK"tur ve yanlış kategori bir HATADIR.
   */
  goldCategories: string[];
  goldCategoryFree: boolean;
  goldScope: string;
  /** Bugünkü kural motorunun aynı girdideki cevabı. */
  rules: {
    category: string | null;
    categoryStatus: string;
    categoryConfidence: number;
    scope: string;
  };
};

type UnderstandShape = {
  category: { value: string | null; status: string; confidence: number };
  requestScope: { value: string };
};

/** Kanonik kapsam değeri DEMAND'dir; ölçüm sözlüğünde SUPPORTED olarak anılır. */
export function foldScope(rawScope: string): string {
  return rawScope.startsWith("UNSUPPORTED") ? rawScope : "SUPPORTED";
}

export function readRulesBaseline(text: string): EvalRow["rules"] {
  const u = understandRequest(text) as unknown as UnderstandShape;
  return {
    category: u.category?.value ?? null,
    categoryStatus: String(u.category?.status ?? "UNKNOWN"),
    categoryConfidence: Number(u.category?.confidence ?? 0),
    scope: foldScope(String(u.requestScope?.value ?? "DEMAND")),
  };
}

export function buildCorpusRows(): EvalRow[] {
  return buildAdversarialCorpus().map((c) => {
    const axis = CORPUS_VARIANT_AXIS[c.variant];
    if (!axis) throw new Error(`korpus varyantı eksene bağlanmamış: ${c.variant}`);
    return {
      id: `corpus:${c.id}`,
      source: "corpus" as const,
      seed: `corpus:${c.baseId}`,
      axis,
      text: c.input,
      goldCategories: [...c.expected.categories],
      // Korpusta boş kategori kümesi "iddia serbest" demektir (sözleşme
      // dosyanın başında yazılı); matristeki boş kümeden farklıdır.
      goldCategoryFree: c.expected.categories.length === 0,
      goldScope: c.expected.scope,
      rules: readRulesBaseline(c.input),
    };
  });
}

type MatrisRecord = { caseId: string; bucketId: string; style: string; text: string };

export function buildMatrisRows(path: string = MATRIS_PATH): EvalRow[] {
  if (!existsSync(path)) throw new Error("matris.jsonl bulunamadı — E2E raporu eksik");
  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/);
  return lines.map((line) => {
    const r = JSON.parse(line) as MatrisRecord;
    const styleAxis = MATRIS_STYLE_AXIS[r.style];
    if (!styleAxis) throw new Error(`matris üslubu eksene bağlanmamış: ${r.style}`);
    // Kategori-dışı meşru kova KENDİ ekseni: üslup ne olursa olsun ölçülen
    // şey "11 kategoriden birini emin biçimde uydurmamak"tır.
    const axis: Axis =
      r.bucketId === "out-of-category-legit" ? "kategori-disi-mesru" : styleAxis;
    const noCategory = MATRIS_NO_CATEGORY_BUCKETS.has(r.bucketId);
    return {
      id: `matris:${r.caseId}`,
      source: "matris" as const,
      seed: `matris:${r.bucketId}`,
      axis,
      text: r.text,
      goldCategories: noCategory ? [] : [r.bucketId],
      goldCategoryFree: false,
      goldScope: MATRIS_BUCKET_SCOPE[r.bucketId] ?? "SUPPORTED",
      rules: readRulesBaseline(r.text),
    };
  });
}

function main(): void {
  const rows = [...buildCorpusRows(), ...buildMatrisRows()];

  const seeds = new Set(rows.map((r) => r.seed));
  const axes = new Map<Axis, number>();
  for (const row of rows) axes.set(row.axis, (axes.get(row.axis) ?? 0) + 1);

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

  console.log(`VAKA: ${rows.length}`);
  console.log(`  korpus: ${rows.filter((r) => r.source === "corpus").length}`);
  console.log(`  matris: ${rows.filter((r) => r.source === "matris").length}`);
  console.log(`TOHUM: ${seeds.size}`);
  console.log("EKSEN:");
  for (const [axis, count] of [...axes].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${axis}: ${count}`);
  }
  console.log(`ÇIKTI: qa/model-eval/data/dataset.jsonl`);
}

if (require.main === module) main();
