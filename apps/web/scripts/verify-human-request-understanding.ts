/**
 * Phase 5.4 — human request understanding checks (generic, no brand if/else hacks).
 */
import { detectCategoryResult } from "../src/lib/ai/parser/category";
import { toHumanQuestions } from "../src/lib/request-brain/human-question-layer";
import { buildMarketPresentation } from "../src/lib/request-brain/market-presentation";
import type { QuestionCandidate } from "../src/lib/request-brain/types";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`PASS — ${name}${detail ? ` (${detail})` : ""}`);
  } else {
    failed += 1;
    console.log(`FAIL — ${name}${detail ? ` (${detail})` : ""}`);
  }
}

const cases: { text: string; expectCat: string; mustBeConfident?: boolean; mustNotCat?: string }[] = [
  { text: "dyson arıyorum", expectCat: "appliances", mustBeConfident: true, mustNotCat: "services" },
  { text: "dyson v15 sıfır lazım", expectCat: "appliances", mustBeConfident: true, mustNotCat: "services" },
  { text: "v15 bakıyom", expectCat: "services", mustBeConfident: false },
  { text: "c200 amg 2022 üstü 50bin km altı", expectCat: "automotive", mustBeConfident: true },
  { text: "2+1 ev lazım başakşehir kiralık", expectCat: "real-estate", mustBeConfident: true },
  { text: "5000 tane logolu kutu bastırcam", expectCat: "printing", mustBeConfident: true },
  { text: "heidelberg 74 ikinci el lazım", expectCat: "machinery", mustBeConfident: true },
  { text: "200 metre kare ofis boyatacam", expectCat: "services", mustBeConfident: true, mustNotCat: "real-estate" },
  { text: "bosch çamaşır makinesi lazım", expectCat: "appliances", mustBeConfident: true },
  { text: "lattego kahve makinesi", expectCat: "home-kitchen", mustBeConfident: true },
  { text: "urban plus bebek arabası", expectCat: "baby", mustBeConfident: true },
];

for (const c of cases) {
  const r = detectCategoryResult(c.text);
  check(
    `cat:${c.text}`,
    r.categoryId === c.expectCat &&
      (c.mustNotCat ? r.categoryId !== c.mustNotCat : true) &&
      (c.mustBeConfident == null || r.confident === c.mustBeConfident),
    `${r.categoryId} conf=${r.confident}`,
  );
}

const expertQ: QuestionCandidate = {
  fieldKey: "specs",
  label: "Teknik özellikler",
  reason: "test",
  publishImpact: 1,
  matchingImpact: 1,
  priceImpact: 1,
  confidenceImpact: 1,
  priorityScore: 1,
  inputType: "text",
};
const humanized = toHumanQuestions([expertQ], {
  strategy: "RETAIL_PRODUCT",
  requiredDynamicKeys: [],
  dynamicFields: [],
  maxVisible: 3,
});
check("expert specs hidden from primary questions", humanized.length === 0);

const insufficient = buildMarketPresentation({
  analysisStatus: "PRICE_INSUFFICIENT",
  market: null,
  previewError: null,
});
check(
  "insufficient market visible without fake range",
  insufficient.state === "INSUFFICIENT" && insufficient.rangeText == null,
);

console.log(`\nHuman understanding verify: ${passed}/${passed + failed}`);
if (failed > 0) {
  console.log("VERIFY HUMAN UNDERSTANDING: FAIL");
  process.exit(1);
}
console.log("VERIFY HUMAN UNDERSTANDING: PASS");
