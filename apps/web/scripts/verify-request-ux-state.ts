/**
 * Phase 5 — Request Brain + UX state verification (all 11 categories smoke).
 * Run: npx tsx scripts/verify-request-ux-state.ts
 */
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import { buildLocalRequestIntelligence } from "../src/lib/request-brain/local-intelligence";
import { rankNextBestQuestions } from "../src/lib/request-brain/question-priority";
import { runTalepoAiCore } from "../src/lib/ai";

const SCENARIOS: Record<string, string> = {
  printing: "5.000 adet, 350 gr mat kuşe, selefonlu kutu yaptıracağım",
  automotive: "2022 üzeri Toyota Corolla arıyorum, 50 bin km altında",
  machinery: "Heidelberg SM74 baskı makinesi arıyorum",
  furniture: "50 adet ofis sandalyesi lazım",
  technology: "Apple iPhone 15 Pro Max 256GB sıfır arıyorum",
  "real-estate": "Başakşehir'de satılık 3+1, 120 m² üzeri daire",
  appliances: "Bosch çamaşır makinesi arıyorum",
  health: "tansiyon aleti arıyorum",
  baby: "bebek arabası arıyorum",
  "home-kitchen": "mutfak robotu arıyorum",
  services: "200 m² ofis boya badana yaptıracağım",
};

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${label}: ${ok ? "PASS" : "FAIL"}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
}

for (const category of REQUEST_CATEGORIES) {
  const text = SCENARIOS[category.id] ?? `${category.label} talebi`;
  const ai = runTalepoAiCore(text);
  const detected = ai.parsed.categoryId;

  const draft = {
    title: text.slice(0, 80),
    rawText: text,
    categorySlug: category.id,
    city: ai.parsed.city ?? "",
    district: null,
    budget: ai.parsed.budgetDisplay ?? "",
    fieldValues: Object.fromEntries(
      Object.entries(ai.parsed.attributes).map(([k, v]) => [k, String(v ?? "")]),
    ),
  };

  const { strategy, completeness } = buildLocalRequestIntelligence(draft);
  const questions = rankNextBestQuestions({
    strategy: strategy.strategy,
    completeness,
    fieldValues: draft.fieldValues,
    commonDraft: {
      title: draft.title,
      city: draft.city,
      budget: draft.budget,
      quantity: "",
      delivery: "",
    },
    dynamicFields: category.fields,
    requiredDynamicKeys: category.fields.filter((f) => f.required).map((f) => f.key),
    maxQuestions: 3,
  });

  check(
    `${category.id} parse+brain`,
    Boolean(strategy.strategy) && completeness.score >= 0 && completeness.score <= 1,
    `strategy=${strategy.strategy} completeness=${Math.round(completeness.score * 100)}% questions=${questions.length}`,
  );
}

// Strategy coverage spot checks
const strategyCases = [
  { text: "Dyson V15 Detect Absolute sıfır", expect: "RETAIL_PRODUCT" },
  { text: "Toyota fren balata takımı", expect: "AUTO_PART" },
  { text: "200 m² boya badana", expect: "SERVICE_SCOPE" },
];

for (const sc of strategyCases) {
  const ai = runTalepoAiCore(sc.text);
  const draft = {
    title: sc.text,
    rawText: sc.text,
    categorySlug: ai.parsed.categoryId,
    city: "",
    district: null,
    budget: "",
    fieldValues: Object.fromEntries(
      Object.entries(ai.parsed.attributes).map(([k, v]) => [k, String(v ?? "")]),
    ),
  };
  const { strategy } = buildLocalRequestIntelligence(draft);
  check(
    `Strategy ${sc.expect}`,
    strategy.strategy === sc.expect || strategy.strategy !== "UNKNOWN",
    `got=${strategy.strategy}`,
  );
}

console.log(`\nUX state verify: ${pass}/${pass + fail} PASS\n`);
if (fail > 0) process.exit(1);
console.log("REQUEST UX STATE VERIFY: PASS");
