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
import { listAllProfiles } from "../src/lib/request-composer/v2/question-profiles";

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

/**
 * PROFİL ALANLARI DA SINANIR — KAPININ ESKİ KÖR NOKTASI (2026-08-29).
 *
 * Bu doğrulayıcı bugüne kadar yalnız elle yazılmış CRITICAL_CONTROL_KEYS
 * kümesini dolaşıyordu. Soru profillerinden gelen alanlar hiç sınanmadığı
 * için, kanonik seçenek taşıyan 34 kritik alanın seçeneksiz text_fallback'e
 * düşmesi 128 yeşil kapının altında görünmez kalmıştı.
 *
 * Aşağıdaki tarama iki şeyi birlikte ölçer: seçenekler kontrol yüzeyine
 * ULAŞIR ve cevap evreni KAPANMAZ. İkisinden biri olmadan kapı yeşil olmaz.
 */
for (const def of listAllProfiles()) {
  if (!def.quickChoices?.length) continue;
  const cat = (def.categories ?? ["technology"])[0]!;
  const id = `${cat}/${def.fieldKey}`;
  const ctrl = resolveQuestionControl({
    categoryId: cat,
    fieldKey: def.fieldKey,
    importance: def.importance,
    allowUnknown: Boolean(def.allowUnknown),
    allowDontCare: Boolean(def.allowDontCare),
    isRealEstate: cat === "real-estate",
    productType: (def.whenProductTypes ?? [])[0] ?? null,
    needType: (def.whenNeedTypes ?? [])[0] ?? null,
    profileChoices: def.quickChoices,
  });

  check(`profile ${id}: kanonik seçenek kontrol yüzeyine ulaşır`, () => {
    assert.ok(
      ctrl.options.length > 0,
      `${id} → ${ctrl.controlType} / options=0`,
    );
  });

  /*
   * ÖZEL KAYIT KONTROLLERİ HER ZAMAN ÖNCELİKLİDİR.
   *
   * `printing/quantity` (number_presets), `printing/printSize` (dimensions)
   * ve `machinery/condition` (kilitli single_choice) seçeneklerini kaydın
   * KENDİ dalından alır; profil listesiyle birebir aynı olmaları beklenmez.
   * Onlarda ölçülen şey kimliğin değişmemesidir, profil eşitliği değil.
   */
  const SPECIAL_CONTROLS = new Set([
    "money_range",
    "location_picker",
    "date_or_deadline",
    "searchable_entity",
    "dimensions",
    "number_presets",
    "multi_choice",
    "yes_no",
  ]);
  const registryOwned =
    SPECIAL_CONTROLS.has(ctrl.controlType) || def.fieldKey === "condition";

  if (!registryOwned) {
    check(`profile ${id}: seçenek sırası ve etiketi korunur`, () => {
      assert.deepEqual(
        ctrl.options.map((o) => [o.label, o.value]),
        def.quickChoices!.map((o) => [o.label, o.value]),
      );
    });
  }

  check(`profile ${id}: seçenekler tekrar etmez`, () => {
    assert.equal(
      new Set(ctrl.options.map((o) => o.value)).size,
      ctrl.options.length,
    );
  });

  /*
   * `machinery/condition` kaydın KENDİ özel dalından gelir ve bilerek
   * kilitlidir (allowCustom: false). Bu ürün kararı profil düzeltmesiyle
   * değiştirilmez; bu yüzden serbest cevap şartından muaf tutulur ve
   * kilidi ayrıca doğrulanır.
   */
  if (def.fieldKey === "condition") {
    check(`profile ${id}: mevcut kilitli davranış korunur`, () => {
      assert.equal(ctrl.controlType, "single_choice");
      assert.equal(ctrl.allowCustom, false);
    });
    continue;
  }

  check(`profile ${id}: serbest cevap yolu kapanmaz`, () => {
    const escape =
      ctrl.allowCustom === true ||
      [...ctrl.options, ...ctrl.softOptions].some((o) => o.opensCustom);
    assert.ok(escape, `${id} listede olmayan cevabı yazma yolunu kaybetti`);
  });

  check(`profile ${id}: kaçış cevabı seçeneklere karışmaz`, () => {
    assert.ok(
      !ctrl.options.some((o) => o.soft || /^fark\s*etmez$/i.test(o.label)),
    );
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
