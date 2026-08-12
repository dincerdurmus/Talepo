/**
 * B3.5 — Canonical request flow consistency.
 * Run: npx tsx scripts/verify-canonical-request-flow.ts
 */
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import {
  buildUnderstandingSummary,
  resolveSchemaCategory,
  safeDraftAttributes,
  seedFieldValuesFromUnderstanding,
  strategyResolutionFromUnderstanding,
} from "../src/lib/request-understanding/activation-bridge";
import { rankNextBestQuestions } from "../src/lib/request-brain/question-priority";
import { completenessFromUnderstanding } from "../src/lib/request-understanding/activation-bridge";
import { composeProfessionalDescription } from "../src/lib/ai/request-text-composer";
import { getCategoryById } from "../src/lib/request-category-engine";
import type { RequestUnderstandingResult } from "../src/lib/request-understanding/types";

type Fixture = {
  id: number;
  text: string;
  expectStrategy?: string | string[];
  expectIntent?: string;
  mustNotCategoryCertain?: string[];
  mustNotAsk?: string[];
  draftMustNotContain?: string[];
};

const fixtures: Fixture[] = [
  {
    id: 1,
    text: "2013 model c180 düşük km araç arıyorum",
    expectStrategy: "VEHICLE",
    expectIntent: "BUY",
    mustNotAsk: ["modelYear"],
    draftMustNotContain: ["amg", "otomatik", "benzin", "50.000", "hasarsız", "istanbul"],
  },
  {
    id: 2,
    text: "c180 parçası lazım",
    expectStrategy: "AUTO_PART",
    expectIntent: "PART",
    mustNotAsk: ["mileage", "fuel", "transmission"],
  },
  {
    id: 3,
    text: "c180 bakım yaptıracam",
    expectStrategy: ["SERVICE_SCOPE", "INDUSTRIAL_PARTS_SERVICE"],
    expectIntent: "SERVICE",
  },
  {
    id: 4,
    text: "dyson v15 sıfır",
    expectStrategy: ["RETAIL_PRODUCT", "USED_PRODUCT"],
  },
  {
    id: 5,
    text: "v15 bakıyom",
    mustNotCategoryCertain: ["services"],
  },
  {
    id: 6,
    text: "350gr kuşe 5bin kutu",
    expectStrategy: "CUSTOM_MANUFACTURING",
  },
  {
    id: 7,
    text: "200m2 ofis boyatacam",
    expectStrategy: "SERVICE_SCOPE",
    expectIntent: "SERVICE",
  },
  {
    id: 8,
    text: "başakşehir 2+1 kiralık ev",
    expectStrategy: "REAL_ESTATE_RENT",
    expectIntent: "RENT",
  },
];

let mismatchUi = 0;
let mismatchPreview = 0;
let repeatedQuestion = 0;
let lowConfCertain = 0;
let draftHallucination = 0;
let pass = 0;
let fail = 0;

function simulateUiState(r: RequestUnderstandingResult) {
  const schema = resolveSchemaCategory(r);
  const seeded = seedFieldValuesFromUnderstanding(r);
  const summary = buildUnderstandingSummary(r);
  const strategy = strategyResolutionFromUnderstanding(r);
  const completeness = completenessFromUnderstanding(r, seeded);
  const questions = rankNextBestQuestions({
    strategy: strategy.strategy,
    completeness,
    fieldValues: seeded,
    commonDraft: {
      title: summary.headline,
      city: r.location?.city?.value ?? "",
      budget: "",
      quantity: r.quantity?.value?.value != null ? String(r.quantity.value.value) : "",
      delivery: "",
    },
    dynamicFields: getCategoryById(schema.categoryId).fields,
    requiredDynamicKeys: [],
    maxQuestions: 5,
  }).filter((q) => {
    // same filter as useRequestBrain
    if (r.attributes.modelYear && q.fieldKey === "modelYear") return false;
    if (r.identity.model && q.fieldKey === "model") return false;
    if (r.preferences.mileagePreference && q.fieldKey === "mileage") return false;
    if (r.attributes.needType && q.fieldKey === "needType") return false;
    if (r.condition && q.fieldKey === "condition") return false;
    if (r.quantity && q.fieldKey === "quantity") return false;
    if (r.attributes.roomCount && q.fieldKey === "roomCount") return false;
    if (r.attributes.area && q.fieldKey === "area") return false;
    if (r.attributes.part && q.fieldKey === "part") return false;
    if (r.attributes.serviceType && q.fieldKey === "serviceType") return false;
    if (r.attributes.listingType && q.fieldKey === "listingType") return false;
    return true;
  });

  const draftAttrs = safeDraftAttributes(r, seeded);
  const draft = composeProfessionalDescription({
    categoryId: schema.categoryId,
    rawText: r.rawInput,
    attributes: draftAttrs,
    city: r.location?.city?.value,
    quantity: r.quantity?.value?.value,
    unit: r.quantity?.value?.unit,
    fieldValues: seeded,
  });

  return { schema, seeded, summary, strategy, questions, draft, draftAttrs };
}

for (const f of fixtures) {
  const canonical = understandRequest(f.text);
  const ui = simulateUiState(canonical);
  const errors: string[] = [];

  // UI strategy must match canonical
  if (ui.strategy.strategy !== (canonical.strategy.value ?? "UNKNOWN")) {
    mismatchUi += 1;
    errors.push(
      `UI strategy mismatch canonical=${canonical.strategy.value} ui=${ui.strategy.strategy}`,
    );
  }

  // Preview strategy = canonical (server uses same understandRequest)
  const previewStrategy = canonical.strategy.value;
  if (previewStrategy !== ui.strategy.strategy) {
    mismatchPreview += 1;
    errors.push("preview/ui strategy mismatch");
  }

  if (f.expectStrategy) {
    const ok = Array.isArray(f.expectStrategy)
      ? f.expectStrategy.includes(String(canonical.strategy.value))
      : canonical.strategy.value === f.expectStrategy;
    if (!ok) errors.push(`strategy=${canonical.strategy.value}`);
  }
  if (f.expectIntent && canonical.intent.value !== f.expectIntent) {
    errors.push(`intent=${canonical.intent.value}`);
  }

  if (f.mustNotCategoryCertain) {
    for (const bad of f.mustNotCategoryCertain) {
      if (
        canonical.category.status === "CONFIDENT" &&
        canonical.category.value === bad
      ) {
        lowConfCertain += 1;
        errors.push(`confident ${bad}`);
      }
      if (
        ui.schema.displayLabelSafe &&
        ui.schema.categoryId === bad &&
        !canonical.category.value
      ) {
        lowConfCertain += 1;
        errors.push(`UI shows ${bad} as certain`);
      }
    }
  }

  // Tentative/unknown must not display as certain
  if (
    (canonical.category.status === "TENTATIVE" ||
      canonical.category.status === "UNKNOWN") &&
    ui.schema.displayLabelSafe
  ) {
    lowConfCertain += 1;
    errors.push("low-confidence category shown certain");
  }

  if (f.mustNotAsk) {
    for (const key of f.mustNotAsk) {
      if (ui.questions.some((q) => q.fieldKey === key)) {
        repeatedQuestion += 1;
        errors.push(`repeated question ${key}`);
      }
    }
  }

  const draftLower = ui.draft.toLocaleLowerCase("tr-TR");
  if (f.draftMustNotContain) {
    for (const banned of f.draftMustNotContain) {
      if (draftLower.includes(banned.toLocaleLowerCase("tr-TR"))) {
        // raw text may include user words — only fail if not in raw
        if (!f.text.toLocaleLowerCase("tr-TR").includes(banned.toLocaleLowerCase("tr-TR"))) {
          draftHallucination += 1;
          errors.push(`draft hallucinated "${banned}"`);
        }
      }
    }
  }

  // Inferred-only brand must not be in draftAttrs as invented certainty.
  // Catalog-unique model→brand (C180 → Mercedes-Benz) is allowed.
  if (
    canonical.identity.brand &&
    canonical.identity.brand.provenance === "INFERRED" &&
    canonical.identity.brand.source !== "FUTURE_KNOWLEDGE" &&
    ui.draftAttrs.brand &&
    !f.text
      .toLocaleLowerCase("tr-TR")
      .includes(String(canonical.identity.brand.value).toLocaleLowerCase("tr-TR"))
  ) {
    draftHallucination += 1;
    errors.push("inferred brand in draft attrs");
  }

  if (errors.length === 0) {
    pass += 1;
    console.log(`PASS #${f.id} — ${f.text}`);
  } else {
    fail += 1;
    console.log(`FAIL #${f.id} — ${f.text}\n  ${errors.join("; ")}`);
  }
}

console.log("\n========== CANONICAL REQUEST FLOW ==========");
console.log(`TOTAL: ${fixtures.length}`);
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
console.log(`CANONICAL/UI MISMATCH COUNT: ${mismatchUi}`);
console.log(`CANONICAL/PREVIEW STRATEGY MISMATCH: ${mismatchPreview}`);
console.log(`REPEATED QUESTION COUNT: ${repeatedQuestion}`);
console.log(`LOW-CONFIDENCE FACT SHOWN AS CERTAIN COUNT: ${lowConfCertain}`);
console.log(`DRAFT HALLUCINATION COUNT: ${draftHallucination}`);

const ok =
  fail === 0 &&
  mismatchUi === 0 &&
  mismatchPreview === 0 &&
  repeatedQuestion === 0 &&
  lowConfCertain === 0 &&
  draftHallucination === 0;

if (!ok) {
  console.log("\nVERIFY CANONICAL REQUEST FLOW: FAIL");
  process.exit(1);
}
console.log("\nVERIFY CANONICAL REQUEST FLOW: PASS");
