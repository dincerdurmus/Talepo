/**
 * Soft location/budget review-display truth table.
 */
import assert from "node:assert/strict";

import {
  budgetDisplayLabel,
  filterReviewPreferences,
  filterReviewUncertainties,
  isCityDistrictComplete,
  locationDisplayLabel,
  resolveBudgetStatus,
  resolveLocationStatus,
} from "../src/lib/request-composer/v2/review-display";
import { isLocationSatisfiedForPublish } from "../src/lib/request-composer/v2/global-core-profile";
import { isFieldSatisfied } from "../src/lib/request-composer/v2/question-scheduler";

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(e);
  }
}

check("nationwide display + no city uncertain", () => {
  assert.equal(locationDisplayLabel("Türkiye geneli"), "Türkiye geneli");
  assert.equal(resolveLocationStatus({ cityValue: "Türkiye geneli" }), "nationwide");
  const uncertain = filterReviewUncertainties({
    items: [{ key: "city", label: "Şehir", tone: "check" }],
    cityValue: "Türkiye geneli",
  });
  assert.equal(uncertain.length, 0);
  const prefs = filterReviewPreferences({
    preferences: [
      { key: "city", label: "Şehir", value: "Fark etmez" },
      { key: "productType", label: "Ürün", value: "Bebek arabası" },
    ],
    location: "Türkiye geneli",
    budget: null,
  });
  assert.deepEqual(prefs, [
    { label: "Ürün", value: "Bebek arabası" },
  ]);
});

check("city_district requires il+ilçe", () => {
  assert.equal(isCityDistrictComplete("İstanbul"), false);
  assert.equal(isCityDistrictComplete("İstanbul / Kadıköy"), true);
  assert.equal(
    resolveLocationStatus({ cityValue: "İstanbul" }),
    "missing",
  );
  assert.equal(
    resolveLocationStatus({ cityValue: "İstanbul / Kadıköy" }),
    "city_district",
  );
  assert.equal(
    isFieldSatisfied({
      fieldKey: "city",
      state: { value: "İstanbul" },
      importance: "quote_critical",
      allowUnknown: true,
      allowDontCare: true,
    }),
    false,
  );
  assert.equal(
    isFieldSatisfied({
      fieldKey: "city",
      state: { value: "İstanbul / Kadıköy" },
      importance: "quote_critical",
      allowUnknown: true,
      allowDontCare: true,
    }),
    true,
  );
  assert.equal(
    isLocationSatisfiedForPublish({ cityValue: "İstanbul" }),
    false,
  );
  assert.equal(
    isLocationSatisfiedForPublish({ cityValue: "İstanbul / Kadıköy" }),
    true,
  );
});

check("budget soft statuses", () => {
  assert.equal(resolveBudgetStatus("Teklifleri görmek istiyorum"), "open_to_offers");
  assert.equal(budgetDisplayLabel("open_to_offers"), "Teklifleri görmek istiyorum");
  assert.equal(
    filterReviewUncertainties({
      items: [{ key: "budget", label: "Bütçe", tone: "unsure" }],
      budgetValue: "Teklifleri görmek istiyorum",
    }).length,
    0,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
