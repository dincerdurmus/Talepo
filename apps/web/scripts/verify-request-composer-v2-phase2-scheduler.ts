/**
 * Phase 2 verifier — question scheduler, entity roles, publish readiness, scenarios.
 */
import assert from "node:assert/strict";

import { syncFromText } from "../src/lib/request-composer/sync";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import {
  selectFocusedQuestions,
  scheduleComposerQuestions,
} from "../src/lib/request-composer/v2/focused-questions";
import {
  isInvalidBrandCandidate,
  isInvalidModelCandidate,
  sanitizeFactRoles,
} from "../src/lib/request-composer/v2/entity-roles";
import { computeComposerPublishReadiness } from "../src/lib/request-composer/v2/publish-readiness";
import { isFieldSatisfied } from "../src/lib/request-composer/v2/question-scheduler";

function factsMap(text: string) {
  const { state } = syncFromText(null, text);
  const facts = buildUnderstoodFacts(state);
  const byKey = Object.fromEntries(facts.map((f) => [f.key, f.displayValue]));
  return { state, facts, byKey, categoryId: state.categoryId };
}

function scheduleFor(text: string, values: Record<string, string> = {}) {
  const { state } = syncFromText(null, text);
  const hybrid = resolveHybridQuestions(state);
  const needType =
    state.fields.needType?.kind === "VALUE"
      ? String(state.fields.needType.value ?? "")
      : null;
  const locCity = state.understanding.location?.city?.value?.trim();
  const locDistrict = state.understanding.location?.district?.value?.trim();
  const reComplete =
    state.categoryId === "real-estate"
      ? Boolean(locCity && locDistrict)
      : undefined;
  return scheduleComposerQuestions({
    categoryId: state.categoryId ?? "technology",
    needType,
    candidates: hybrid.candidates,
    values: {
      quantity: values.quantity,
      city: values.city ?? locCity,
      budget: values.budget,
      delivery: values.delivery,
      ...values,
    },
    realEstateLocationComplete: values.city?.includes("/")
      ? true
      : reComplete,
  });
}

let failed = 0;
let passed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(error);
  }
}

check("entity: category word is not brand", () => {
  assert.equal(isInvalidBrandCandidate("matbaa"), true);
  assert.equal(isInvalidBrandCandidate("Arçelik"), false);
});

check("entity: quantity phrase is not model", () => {
  assert.equal(
    isInvalidModelCandidate({
      model: "5000 broşür",
      brand: null,
      productType: "broşür",
    }),
    true,
  );
});

check("entity: brand≠model dedupe", () => {
  const cleaned = sanitizeFactRoles({
    brand: "Arçelik",
    model: "Arçelik",
    productType: "Televizyon",
  });
  assert.equal(cleaned.model, null);
});

check("scheduler: max 3 visible, more critical remain", () => {
  const schedule = scheduleFor("Arçelik 55 inç televizyon arıyorum");
  assert.ok(schedule.visible.length <= 3);
  assert.ok(
    schedule.remainingCriticalCount + schedule.remainingOptionalCount >=
      schedule.visible.length,
  );
  assert.equal(schedule.canEnterReview, false);
});

check("scheduler: answered quantity not re-asked (printing)", () => {
  const schedule = scheduleFor("Matbaa için 5000 broşür baskısı istiyorum", {
    quantity: "5000",
  });
  assert.ok(!schedule.visible.some((q) => q.fieldKey === "quantity"));
  assert.ok(
    !schedule.blockingFieldKeys.includes("quantity") ||
      schedule.blockingFieldKeys.filter((k) => k === "quantity").length === 0,
  );
});

check("scheduler: RE without city cannot review", () => {
  const schedule = scheduleFor("Kiralık 3+1 daire arıyorum");
  const readiness = computeComposerPublishReadiness({
    hasUsableText: true,
    schedule,
    categoryId: "real-estate",
    realEstateLocationComplete: false,
  });
  assert.equal(readiness.canReview, false);
  assert.ok(
    schedule.blockingFieldKeys.includes("city") ||
      readiness.blockingLabels.some((l) => /il|konum|ilçe/i.test(l)),
  );
});

check("budget open_to_offers satisfies quote_critical", () => {
  assert.equal(
    isFieldSatisfied({
      fieldKey: "budget",
      state: { softStatus: "open_to_offers", value: "open_to_offers" },
      importance: "quote_critical",
      allowUnknown: true,
      allowDontCare: true,
    }),
    true,
  );
});

check("skip optional does not satisfy publish_required", () => {
  assert.equal(
    isFieldSatisfied({
      fieldKey: "city",
      state: {},
      importance: "publish_required",
      allowUnknown: false,
      allowDontCare: false,
      optionallySkipped: true,
    }),
    false,
  );
});

check("scenario: Arçelik TV facts", () => {
  const { byKey } = factsMap("Arçelik 55 inç televizyon arıyorum");
  assert.match(String(byKey.brand ?? ""), /Arçelik/i);
  assert.ok(!byKey.model || !/inç|televizyon/i.test(byKey.model));
  assert.ok(
    /televizyon|tv/i.test(String(byKey.productType ?? byKey.applianceType ?? "")),
  );
});

check("scenario: A55 D model kept", () => {
  const { byKey } = factsMap("Arçelik A55 D 55 inç televizyon arıyorum");
  assert.match(String(byKey.brand ?? ""), /Arçelik/i);
  assert.match(String(byKey.model ?? ""), /A55\s*D/i);
  assert.ok(!/Galaxy/i.test(String(byKey.model ?? "")));
});

check("scenario: matbaa no brand", () => {
  const { byKey, categoryId } = factsMap(
    "Matbaa için 5000 broşür baskısı istiyorum",
  );
  assert.ok(
    categoryId === "printing" ||
      /matbaa|baskı|print/i.test(categoryId ?? ""),
  );
  assert.ok(!byKey.brand || isInvalidBrandCandidate(byKey.brand));
  assert.ok(!byKey.model);
});

check("scenario: Heidelberg pump", () => {
  const { byKey } = factsMap(
    "Heidelberg SM 74 için nemlendirme pompası arıyorum",
  );
  assert.match(String(byKey.brand ?? ""), /Heidelberg/i);
  assert.match(String(byKey.model ?? ""), /SM\s*74/i);
});

check("scenario: RE with location", () => {
  const { byKey, categoryId, state } = factsMap(
    "Ankara Çankaya’da kiralık 3+1 daire arıyorum",
  );
  assert.equal(categoryId, "real-estate");
  const city =
    byKey.city ?? state.understanding.location?.city?.value ?? "";
  assert.match(String(city), /Ankara/i);
  assert.ok(!byKey.brand, `brand should be empty, got ${byKey.brand}`);
  assert.ok(!byKey.model, `model should be empty, got ${byKey.model}`);
  const schedule = scheduleFor(
    "Ankara Çankaya’da kiralık 3+1 daire arıyorum",
  );
  assert.ok(!schedule.blockingFieldKeys.includes("city"));
});

check("scenario: Clio facts", () => {
  const { byKey } = factsMap("2019 Renault Clio 1.5 dCi otomatik arıyorum");
  assert.match(String(byKey.brand ?? ""), /Renault/i);
  assert.match(String(byKey.model ?? ""), /Clio/i);
});

check("scenario: Bosch Serie 6", () => {
  const { byKey } = factsMap("Bosch Serie 6 çamaşır makinesi arıyorum");
  assert.match(String(byKey.brand ?? ""), /Bosch/i);
  // Serie 6 may be family — model must not be invented garbage
  if (byKey.model) {
    assert.ok(!/çamaşır|makine/i.test(byKey.model));
  }
});

check("focused selectVisible ≤ 3", () => {
  const { state } = syncFromText(
    null,
    "Arçelik 55 inç televizyon arıyorum",
  );
  const hybrid = resolveHybridQuestions(state);
  const focused = selectFocusedQuestions({
    candidates: hybrid.candidates,
    strategy: null,
    requiredDynamicKeys: [],
    dynamicFields: [],
    categoryId: state.categoryId ?? "technology",
    values: {},
    maxVisible: 3,
  });
  assert.ok(focused.length <= 3);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
