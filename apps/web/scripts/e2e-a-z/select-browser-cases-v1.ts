/**
 * FAZ 2 SEÇİMİ — Faz 1 matrisinden ~30 temsilî vaka (2026-09-23).
 *
 * Seçim KURALLIDIR, elle değil: her kategoriden 2, her kapsam kapısından 1,
 * kategori-dışı meşru talepten 3, artı Türkçe-İngilizce karışık bir vaka.
 * Tarayıcı testi beklenen soruları BU dosyadan okur; böylece "ekrandaki soru
 * motorun sorusuyla aynı mı" ölçümü tek kaynaktan gelir.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve(process.cwd(), "../../reports/e2e-a-z-2026-09-23");
const rows = readFileSync(resolve(OUT_DIR, "matris.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));

const CATEGORIES = [
  "appliances",
  "technology",
  "automotive",
  "services",
  "health",
  "furniture",
  "machinery",
  "home-kitchen",
  "printing",
  "real-estate",
  "baby",
];
const GATES = [
  "unsupported-pharmacy",
  "unsupported-medical-advice",
  "unsupported-supply",
  "unsupported-removed-scope",
];

const wanted: string[] = [];
for (const c of CATEGORIES) wanted.push(`${c}__duzgun__urun`, `${c}__argo__tam`);
for (const g of GATES) wanted.push(`${g}__duzgun__urun`);
wanted.push(
  "out-of-category-legit__duzgun__urun",
  "out-of-category-legit__eksik__urun",
  "out-of-category-legit__argo__tam",
);
wanted.push("technology__karisik__urun");

const selected = wanted
  .map((id) => rows.find((r) => r.caseId === id))
  .filter(Boolean)
  .map((r) => ({
    caseId: r.caseId,
    bucketId: r.bucketId,
    text: r.text,
    expectedScope: r.detected.scope,
    expectedCategory: r.detected.categoryId,
    expectedOutOfScope: Boolean(r.readiness.outOfScopeNotice),
    expectedNotice: r.readiness.outOfScopeNotice,
    expectedQuestionKeys: r.questionsRound1.map((q: string) =>
      q.replace(/^.*\[/, "").replace(/\].*$/, ""),
    ),
    expectedQuestionLabels: r.questionsRound1.map((q: string) =>
      q.replace(/\[.*$/, ""),
    ),
    expectedQuestionPrompts: r.promptsRound1 ?? [],
    expectedCanReview: r.readiness.canReview,
  }));

const missing = wanted.filter((id) => !rows.some((r) => r.caseId === id));
if (missing.length) {
  console.log(`UYARI: matriste bulunamayan vaka: ${missing.join(", ")}`);
}

writeFileSync(
  resolve(OUT_DIR, "faz2-secim.json"),
  JSON.stringify(selected, null, 2),
  "utf8",
);
console.log(`FAZ 2 seçimi: ${selected.length} vaka yazıldı.`);
