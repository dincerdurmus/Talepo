/**
 * Verifier: critical composer fields must not resolve to text_fallback.
 */
import assert from "node:assert/strict";

import {
  assertCriticalControlNotTextFallback,
  CRITICAL_CONTROL_KEYS,
  resolveQuestionControl,
} from "../src/lib/request-composer/v2/question-control-registry";
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import { quantityPresets } from "../src/lib/request-composer/v2/option-providers";

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

const categories = REQUEST_CATEGORIES.filter(
  (c) => !(c as { system?: boolean }).system,
).map((c) => c.id);

for (const cat of categories) {
  for (const fieldKey of CRITICAL_CONTROL_KEYS) {
    check(`critical ${cat}/${fieldKey} ≠ text_fallback`, () => {
      const r = assertCriticalControlNotTextFallback({
        categoryId: cat,
        fieldKey,
        importance: "quote_critical",
        allowUnknown: true,
        allowDontCare: true,
        isRealEstate: cat === "real-estate",
      });
      assert.equal(r.ok, true, `${fieldKey} → ${r.controlType}`);
    });
  }
}

check("baby quantity presets", () => {
  const opts = quantityPresets({
    categoryId: "baby",
    fieldKey: "quantity",
  });
  assert.ok(opts.some((o) => o.value === "1 adet"));
  assert.ok(opts.some((o) => o.opensCustom));
  assert.ok(!opts.some((o) => o.label === "Kısaca yaz"));
});

check("printing quantity bulk presets", () => {
  const opts = quantityPresets({
    categoryId: "printing",
    fieldKey: "quantity",
  });
  assert.ok(opts.some((o) => /1000|1\.000|5000|5\.000|500/.test(o.label + o.value)));
});

check("budget is money_range", () => {
  const def = resolveQuestionControl({
    categoryId: "baby",
    fieldKey: "budget",
  });
  assert.equal(def.controlType, "money_range");
  assert.ok(def.options.some((o) => o.value === "open_to_offers"));
});

check("city is location_picker", () => {
  const def = resolveQuestionControl({
    categoryId: "baby",
    fieldKey: "city",
  });
  assert.equal(def.controlType, "location_picker");
  assert.ok(!def.softOptions.some((o) => o.value === "remote"));
});

// Kurucu (2026-08-23): "Uzaktan" yalnız uzaktan verilebilen hizmetlerde —
// temizlik gibi fiziksel hizmetlere asla sorulmaz.
check("services city: remote only for remote-eligible service types", () => {
  const fiziksel = resolveQuestionControl({
    categoryId: "services",
    fieldKey: "city",
    productType: "Ofis temizliği",
  });
  assert.ok(!fiziksel.softOptions.some((o) => o.value === "remote"));
  const uzaktan = resolveQuestionControl({
    categoryId: "services",
    fieldKey: "city",
    productType: "Logo tasarımı",
  });
  assert.ok(uzaktan.softOptions.some((o) => o.value === "remote"));
  const belirsiz = resolveQuestionControl({
    categoryId: "services",
    fieldKey: "city",
  });
  assert.ok(!belirsiz.softOptions.some((o) => o.value === "remote"));
});

check("delivery is date_or_deadline", () => {
  const def = resolveQuestionControl({
    categoryId: "baby",
    fieldKey: "delivery",
  });
  assert.equal(def.controlType, "date_or_deadline");
});

check("descriptive notes may text_fallback", () => {
  const def = resolveQuestionControl({
    categoryId: "services",
    fieldKey: "notes",
    importance: "optional",
  });
  assert.equal(def.controlType, "text_fallback");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
