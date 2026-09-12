/**
 * Verifier: critical composer fields must not resolve to text_fallback.
 */
import assert from "node:assert/strict";

import {
  assertCriticalControlNotTextFallback,
  CRITICAL_CONTROL_KEYS,
  resolveQuestionControl,
} from "../src/lib/request-composer/v2/question-control-registry";
import {
  getCategoryById,
  getVisibleCategoryFields,
  REQUEST_CATEGORIES,
} from "../src/lib/request-category-engine";
import { detectAttributes } from "../src/lib/ai/parser/entity";
import {
  buildCanonicalRequestState,
  mapUnderstandingToFields,
  toResolverFieldBag,
} from "../src/lib/request-composer/build-state";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { getCategoryChildren } from "../src/lib/knowledge/browse";
import { resolveBrowseSemanticRole } from "../src/lib/request-composer/browse-semantic-role";
import {
  popularBrandOptions,
  quantityPresets,
} from "../src/lib/request-composer/v2/option-providers";
import {
  listAllProfiles,
  listProfilesForCategory,
} from "../src/lib/request-composer/v2/question-profiles";
import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";
import { globalCoreQuestionProfiles } from "../src/lib/request-composer/v2/global-core-profile";
import { scheduleNextQuestions } from "../src/lib/request-composer/v2/question-scheduler";
import { applyBrowseSelectionToState } from "../src/lib/request-composer/apply-browse";
import {
  createTextOnlyState,
  syncFromBrowse,
  syncFromText,
} from "../src/lib/request-composer/sync";
import { resolveBrowsePath } from "../src/lib/request-composer/resolve-browse-path";
import { seedFieldValuesFromUnderstanding } from "../src/lib/request-understanding/activation-bridge";
import { composeNaturalRequestText } from "../src/lib/request-composer/compose-text";

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

check("controlled popular services keep their own question contracts", () => {
  const expected: Record<string, string[]> = {
    "Boş ev temizliği": ["emptyHomeSize", "emptyHomeCondition", "emptyHomeSupplies"],
    "Boya badana": ["paintArea", "paintPrep", "paintSupply"],
    "Cam balkon": ["balconySize", "balconySystem", "balconyGlass"],
    "Kombi servisi": ["boilerBrand", "boilerServiceNeed", "boilerIssue", "boilerUrgency"],
    "Direksiyon dersi": ["drivingLicenseClass", "drivingLevel", "drivingSchedule"],
    "Duvar dekorasyon": ["wallDecorArea", "wallDecorType", "wallDecorPrep"],
    "Klima servisi": ["airConditionerBrand", "airConditionerNeed", "airConditionerIssue", "airConditionerType"],
    "Elektrikçi": ["electricalWork", "electricalPlace", "electricalUrgency"],
    "Parça eşya taşıma": ["partialMoveItems", "partialMoveFloors", "partialMoveDate"],
    "Ev dekorasyon": ["homeDecorScope", "homeDecorArea", "homeDecorDelivery"],
    "Ev temizliği": ["homeCleaningSize", "homeCleaningFrequency", "homeCleaningSupplies"],
    "Evden eve nakliyat": ["movingHomeSize", "movingFloors", "movingPacking", "movingDate"],
    "Fayans döşeme": ["tileArea", "tileSpace", "tileRemoval", "tileSupply"],
    "Halı yıkama / temizleme": ["carpetLoad", "carpetPickup", "carpetIssue"],
    "Koltuk yıkama / temizleme": ["upholsterySeatCount", "upholsteryOnSite", "upholsteryIssue", "upholsteryFabric"],
    "İç mimar": ["interiorDesignScope", "interiorDesignArea", "interiorDesignDelivery", "interiorDesignStyle"],
    "Grafik ve logo tasarımı": [],
    "Evde bakım desteği": ["homeCareSupportScope", "homeCareSchedule", "homeCareDuration", "homeCareStart"],
    "Ev yardımcısı / ev hizmetlisi": ["homeHelperScope", "homeHelperSchedule", "homeHelperDuration", "homeHelperStart"],
  };
  const serviceTypeField = getCategoryById("services")?.fields.find(
    (field) => field.key === "serviceType",
  );
  assert.deepEqual(
    serviceTypeField?.options?.map((option) => option.value),
    Object.keys(expected),
  );
  const allServiceQuestionKeys = new Set(Object.values(expected).flat());
  for (const [serviceType, expectedKeys] of Object.entries(expected)) {
    const parsed = understandRequest(`${serviceType} istiyorum`);
    assert.equal(parsed.category.value, "services", serviceType);
    assert.equal(parsed.attributes.serviceType?.value, serviceType, serviceType);
    const actual = listProfilesForCategory({
      categoryId: "services",
      needType: "service",
      productType: serviceType,
    })
      .map((profile) => profile.fieldKey)
      .filter((key) => allServiceQuestionKeys.has(key))
      .sort();
    assert.deepEqual(actual, [...expectedKeys].sort(), serviceType);
  }
});

check("printing families keep scoped manufacturing questions", () => {
  const expected: Record<string, { input: string; keys: string[] }> = {
    "Pizza kutusu": { input: "Pizza kutusu bastırmak istiyorum", keys: ["boxDimensions", "boxMaterial", "boxPrintCoverage", "boxDieLine", "boxDesignReady"] },
    "Rulo etiket": { input: "Rulo etiket bastırmak istiyorum", keys: ["labelDimensions", "labelMaterial", "labelAdhesive", "labelFormat", "labelDesignReady"] },
    Katalog: { input: "Katalog bastırmak istiyorum", keys: ["publicationFormat", "publicationPageCount", "publicationBinding", "publicationPaper", "publicationDesignReady"] },
    "Broşür": { input: "Broşür bastırmak istiyorum", keys: ["flatPrintFormat", "flatPrintSides", "flatPrintPaperWeight", "flatPrintFold", "flatPrintDesignReady"] },
    Kartvizit: { input: "Kartvizit bastırmak istiyorum", keys: ["cardFormat", "cardStock", "cardFinish", "cardDesignReady"] },
    "Tişört baskı": { input: "Tişört baskı yaptırmak istiyorum", keys: ["promoTextilePrintMethod", "promoTextileSizing", "promoTextilePlacement", "promoDesignReady"] },
    "Kupa / mug baskı": { input: "Kupa baskı yaptırmak istiyorum", keys: ["promoObjectPrintMethod", "promoObjectBrandingArea", "promoObjectPackaging", "promoDesignReady"] },
    "Roll-up Banner": { input: "Roll-up banner yaptırmak istiyorum", keys: ["largeFormatDimensions", "largeFormatPlacement", "largeFormatInstall", "largeFormatDesignReady"] },
    "Kaşe": { input: "Kaşe yaptırmak istiyorum", keys: ["customPrintSpecs", "customPrintMaterial", "customPrintDesignReady"] },
  };
  const allKeys = new Set(Object.values(expected).flatMap((entry) => entry.keys));
  for (const [productType, expectation] of Object.entries(expected)) {
    const parsed = understandRequest(expectation.input);
    assert.equal(parsed.category.value, "printing", productType);
    const actual = listProfilesForCategory({ categoryId: "printing", productType })
      .map((profile) => profile.fieldKey)
      .filter((key) => allKeys.has(key))
      .sort();
    assert.deepEqual(actual, [...expectation.keys].sort(), productType);
  }
});

check("delivery is date_or_deadline", () => {
  const def = resolveQuestionControl({
    categoryId: "baby",
    fieldKey: "delivery",
  });
  assert.equal(def.controlType, "date_or_deadline");
});

check("furniture dimensions never receive paper-format presets", () => {
  const contract = getCategoryById("furniture")?.measurementContracts?.dimensions;
  assert.equal(contract?.kind, "physical_dimensions");
  assert.deepEqual(contract?.axes, ["width", "depth", "height"]);
  const def = resolveQuestionControl({
    categoryId: "furniture",
    fieldKey: "dimensions",
    productType: "Makam odası takımı",
    allowUnknown: true,
  });
  assert.equal(def.controlType, "dimensions");
  assert.equal(def.measurementKind, "physical_dimensions");
  assert.deepEqual(def.options, []);
  assert.ok(![...def.options, ...def.softOptions].some((o) => /^(A3|A4|A5)$/.test(o.label)));
  assert.match(def.placeholder ?? "", /cm/);
});

check("printing keeps paper-format presets where the contract permits them", () => {
  const contract = getCategoryById("printing")?.measurementContracts?.dimensions;
  assert.equal(contract?.kind, "print_format");
  const def = resolveQuestionControl({
    categoryId: "printing",
    fieldKey: "dimensions",
    productType: "Broşür",
  });
  assert.equal(def.measurementKind, "print_format");
  assert.ok(def.options.some((o) => o.value === "A4"));
  assert.ok(def.options.some((o) => o.value === "A5"));
});

check("physical printing products never receive paper-format presets", () => {
  for (const [fieldKey, productType] of [
    ["dimensions", "Karton kutu"],
    ["size", "Etiket baskı"],
  ] as const) {
    const def = resolveQuestionControl({
      categoryId: "printing",
      fieldKey,
      productType,
    });
    assert.equal(def.measurementKind, "physical_dimensions");
    assert.deepEqual(def.options, []);
  }
});

check("knowledge-only physical measurement fields use their category contract", () => {
  for (const [categoryId, fieldKey, productType] of [
    ["appliances", "dimensions", "Buzdolabı"],
    ["home-kitchen", "dimensions", "Eviye"],
    ["machinery", "bedSize", "CNC kesim"],
  ] as const) {
    const contract = getCategoryById(categoryId)?.measurementContracts?.[fieldKey];
    assert.equal(contract?.kind, "physical_dimensions");
    const def = resolveQuestionControl({ categoryId, fieldKey, productType });
    assert.equal(def.controlType, "dimensions");
    assert.equal(def.measurementKind, "physical_dimensions");
    assert.deepEqual(def.options, []);
    assert.match(def.placeholder ?? "", /cm|mm/);
  }
});

check("appliance product contracts own their physical dimension controls", () => {
  for (const [productType, example] of [
    ["Buzdolabı", "75 × 70 × 185 cm"],
    ["Çamaşır makinesi", "60 × 60 × 85 cm"],
    ["Klima", "90 × 23 × 30 cm"],
  ] as const) {
    const def = resolveQuestionControl({
      categoryId: "appliances",
      fieldKey: "dimensions",
      productType,
      allowUnknown: true,
    });
    assert.equal(def.controlType, "dimensions");
    assert.equal(def.measurementKind, "physical_dimensions");
    assert.equal(def.placeholder, example + (productType === "Klima" ? " (iç ünite)" : ""));
    assert.deepEqual(def.options, []);
  }
});

check("appliance product contracts ask only their own questions", () => {
  const keysFor = (productType: string) =>
    new Set(
      listProfilesForCategory({ categoryId: "appliances", productType }).map(
        (profile) => profile.fieldKey,
      ),
    );

  const fridge = keysFor("Buzdolabı");
  assert.ok(fridge.has("fridgeType"));
  assert.ok(fridge.has("fridgeCapacity"));
  assert.ok(fridge.has("fridgeCoolingSystem"));
  assert.ok(fridge.has("energyClass"));
  assert.ok(!fridge.has("capacityBtu"));
  assert.ok(!fridge.has("capacityKg"));

  const washer = keysFor("Çamaşır makinesi");
  assert.ok(washer.has("capacityKg"));
  assert.ok(washer.has("washerDryFeature"));
  assert.ok(washer.has("washerLoadType"));
  assert.ok(washer.has("spinSpeed"));
  assert.ok(!washer.has("fridgeType"));
  assert.ok(!washer.has("capacityBtu"));

  const climate = keysFor("Klima");
  assert.ok(climate.has("airConditionerType"));
  assert.ok(climate.has("capacityBtu"));
  assert.ok(climate.has("climateRoomSize"));
  assert.ok(climate.has("inverterPreference"));
  assert.ok(climate.has("installation"));
  assert.ok(!climate.has("fridgeType"));
  assert.ok(!climate.has("capacityKg"));
});

check("appliance contracts suppress unrelated inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "appliances",
    values: {
      applianceType: "Buzdolabı",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "capacityBtu",
        label: "BTU",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 1,
        inputType: "select",
      },
      {
        fieldKey: "fridgeCapacity",
        label: "Net hacim",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 1,
        inputType: "select",
      },
    ],
  });
  assert.ok(
    schedule.visible.some((question) => question.fieldKey === "fridgeCapacity"),
  );
  assert.ok(!schedule.visible.some((question) => question.fieldKey === "capacityBtu"));
});

check("technology product contracts ask only their own questions", () => {
  const keysFor = (productType: string, needType = "hardware") =>
    new Set(
      listProfilesForCategory({
        categoryId: "technology",
        needType,
        productType,
      }).map((profile) => profile.fieldKey),
    );

  const tv = keysFor("Televizyon");
  assert.ok(tv.has("screenSize"));
  assert.ok(tv.has("resolution"));
  assert.ok(tv.has("panelType"));
  assert.ok(tv.has("refreshRate"));
  assert.ok(!tv.has("processor"));
  assert.ok(!tv.has("storageCapacity"));

  const laptop = keysFor("Dizüstü bilgisayar");
  assert.ok(laptop.has("usagePurpose"));
  assert.ok(laptop.has("processor"));
  assert.ok(laptop.has("ram"));
  assert.ok(laptop.has("storage"));
  assert.ok(laptop.has("graphics"));
  assert.ok(!laptop.has("panelType"));
  assert.ok(!laptop.has("mobileNetwork"));

  const phone = keysFor("Cep telefonu");
  assert.ok(phone.has("storageCapacity"));
  assert.ok(phone.has("mobileNetwork"));
  assert.ok(phone.has("cameraPriority"));
  assert.ok(!phone.has("processor"));
  assert.ok(!phone.has("tabletAccessory"));

  const tablet = keysFor("Tablet");
  assert.ok(tablet.has("storageCapacity"));
  assert.ok(tablet.has("tabletConnectivity"));
  assert.ok(tablet.has("tabletAccessory"));
  assert.ok(!tablet.has("mobileNetwork"));
  assert.ok(!tablet.has("graphics"));

  const software = keysFor("Laptop", "software");
  assert.ok(!software.has("processor"));
  assert.ok(!software.has("screenSize"));
});

check("technology contracts suppress unrelated inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "technology",
    needType: "hardware",
    values: {
      needType: "hardware",
      solutionType: "Televizyon",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "processor",
        label: "İşlemci",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
      {
        fieldKey: "resolution",
        label: "Çözünürlük",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
    ],
  });
  assert.ok(schedule.visible.some((question) => question.fieldKey === "resolution"));
  assert.ok(!schedule.visible.some((question) => question.fieldKey === "processor"));
});

check("home-kitchen root removes the broad Diğer bucket without changing taxonomy ids", () => {
  const families = getCategoryChildren("home-kitchen");
  const labels = new Set(families.map((family) => family.label));
  assert.ok(!labels.has("Diğer"));
  for (const label of [
    "Yemek Takımı",
    "Kahve / Çay Seti",
    "Pişirme gereçleri",
    "Mutfak gereçleri",
    "Mutfak ve banyo armatür / lavabo",
    "Ev dekorasyonu",
    "Ev sarf malzemesi",
  ]) {
    assert.ok(labels.has(label), `${label} görünmeli`);
  }
  assert.ok(
    families.some((family) => family.id === "tax:home-kitchen:diger:pisirme-gerecleri"),
    "mevcut taxonomy kimliği korunmalı",
  );
});

check("home-kitchen contracts ask only family-specific questions", () => {
  const keysFor = (productType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "home-kitchen",
        productType,
      }).map((profile) => profile.fieldKey),
    );

  const dinnerware = keysFor("Porselen yemek takımı");
  assert.ok(dinnerware.has("serviceCount"));
  assert.ok(dinnerware.has("pieceCount"));
  assert.ok(dinnerware.has("dishwasherSafe"));
  assert.ok(!dinnerware.has("cooktopCompatibility"));
  assert.ok(!dinnerware.has("brewCapacity"));

  const cookware = keysFor("Tencere seti");
  assert.ok(cookware.has("cookwareSetType"));
  assert.ok(cookware.has("cooktopCompatibility"));
  assert.ok(cookware.has("cookwareSize"));
  assert.ok(!cookware.has("serviceCount"));
  assert.ok(!cookware.has("brewCapacity"));

  const coffeeSet = keysFor("Kahve fincan takımı");
  assert.ok(coffeeSet.has("serviceCount"));
  assert.ok(coffeeSet.has("drinkwareSetContents"));
  assert.ok(!coffeeSet.has("cooktopCompatibility"));
  assert.ok(!coffeeSet.has("brewCapacity"));

  const brewer = keysFor("French press");
  assert.ok(brewer.has("brewCapacity"));
  assert.ok(brewer.has("filterPreference"));
  assert.ok(!brewer.has("serviceCount"));
  assert.ok(!brewer.has("cooktopCompatibility"));
});

check("remaining home-kitchen families keep their questions isolated", () => {
  const keysFor = (productType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "home-kitchen",
        productType,
      }).map((profile) => profile.fieldKey),
    );

  const cutlery = keysFor("Çatal-bıçak takımı");
  assert.ok(cutlery.has("cutleryServiceCount"));
  assert.ok(cutlery.has("cutleryFinish"));
  assert.ok(!cutlery.has("glasswareCapacity"));
  assert.ok(!cutlery.has("cooktopCompatibility"));

  const glassware = keysFor("Bardak seti");
  assert.ok(glassware.has("glasswareCapacity"));
  assert.ok(glassware.has("dishwasherSafe"));
  assert.ok(!glassware.has("cutleryFinish"));
  assert.ok(!glassware.has("storageSeal"));

  const storage = keysFor("Saklama kabı");
  assert.ok(storage.has("storageCapacity"));
  assert.ok(storage.has("storageSeal"));
  assert.ok(!storage.has("glasswareCapacity"));
  assert.ok(!storage.has("kitchenLayout"));

  const fixture = keysFor("Eviye / lavabo");
  assert.ok(fixture.has("sinkMountType"));
  assert.ok(fixture.has("fixtureMaterial"));
  assert.ok(!fixture.has("cooktopCompatibility"));
  assert.ok(!fixture.has("careProductPurpose"));

  const serving = keysFor("Sunum tabağı");
  assert.ok(serving.has("pieceCount"));
  assert.ok(serving.has("dishwasherSafe"));
  assert.ok(!serving.has("cutleryFinish"));

  const decor = keysFor("Duvar kağıdı");
  assert.ok(decor.has("coverageArea"));
  assert.ok(decor.has("decorStyle"));
  assert.ok(!decor.has("careProductPurpose"));

  const homeCare = keysFor("Ev temizlik malzemeleri");
  assert.ok(homeCare.has("careProductPurpose"));
  assert.ok(homeCare.has("packageSize"));
  assert.ok(!homeCare.has("decorStyle"));
});

check("home-kitchen contracts suppress cross-family inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "home-kitchen",
    values: {
      kitchenProductType: "Tencere seti",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "serviceCount",
        label: "Kişilik",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
      {
        fieldKey: "cooktopCompatibility",
        label: "Ocak uyumu",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
    ],
  });
  assert.ok(
    schedule.visible.some((question) => question.fieldKey === "cooktopCompatibility"),
  );
  assert.ok(!schedule.visible.some((question) => question.fieldKey === "serviceCount"));
});

check("home-kitchen fixtures suppress cookware inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "home-kitchen",
    values: {
      kitchenProductType: "Eviye / lavabo",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "cooktopCompatibility",
        label: "Ocak uyumu",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
      {
        fieldKey: "sinkMountType",
        label: "Montaj tipi",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
    ],
  });
  assert.ok(schedule.visible.some((question) => question.fieldKey === "sinkMountType"));
  assert.ok(
    !schedule.visible.some((question) => question.fieldKey === "cooktopCompatibility"),
  );
});

check("baby product contracts ask only their own questions", () => {
  const keysFor = (babyProductType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "baby",
        productType: babyProductType,
      }).map((profile) => profile.fieldKey),
    );

  const stroller = keysFor("Bebek arabası / puset");
  assert.ok(stroller.has("strollerType"));
  assert.ok(stroller.has("strollerUseCase"));
  assert.ok(stroller.has("strollerFoldPreference"));
  assert.ok(!stroller.has("carSeatMount"));
  assert.ok(!stroller.has("sleepSetupType"));

  const carSeat = keysFor("Oto koltuğu / ana kucağı");
  assert.ok(carSeat.has("carSeatGroup"));
  assert.ok(carSeat.has("carSeatMount"));
  assert.ok(carSeat.has("carSeatDirection"));
  assert.ok(!carSeat.has("strollerUseCase"));
  assert.ok(!carSeat.has("sleepSafetyFeature"));

  const sleep = keysFor("Beşik / park yatak");
  assert.ok(sleep.has("sleepSetupType"));
  assert.ok(sleep.has("dimensions"));
  assert.ok(sleep.has("sleepSafetyFeature"));
  assert.ok(!sleep.has("carSeatMount"));
  assert.ok(!sleep.has("strollerFoldPreference"));
});

check("baby sleep dimensions use the bed contract, never paper formats", () => {
  const def = resolveQuestionControl({
    categoryId: "baby",
    fieldKey: "dimensions",
    productType: "Beşik / park yatak",
    allowUnknown: true,
  });
  assert.equal(def.controlType, "dimensions");
  assert.equal(def.measurementKind, "physical_dimensions");
  assert.equal(def.placeholder, "60 × 120 cm");
  assert.deepEqual(def.options, []);
});

check("baby car-seat contracts suppress stroller inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "baby",
    values: {
      babyProductType: "Oto koltuğu / ana kucağı",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "strollerFoldPreference",
        label: "Katlanma",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
      {
        fieldKey: "carSeatMount",
        label: "Sabitleme",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
    ],
  });
  assert.ok(schedule.visible.some((question) => question.fieldKey === "carSeatMount"));
  assert.ok(
    !schedule.visible.some(
      (question) => question.fieldKey === "strollerFoldPreference",
    ),
  );
});

check("baby mobility contracts keep carriers, portbebes, and accessories isolated", () => {
  const keysFor = (babyProductType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "baby",
        productType: babyProductType,
      }).map((profile) => profile.fieldKey),
    );

  const carrier = keysFor("Kanguru / bebek taşıyıcı");
  assert.ok(carrier.has("carrierAgeWeightRange"));
  assert.ok(carrier.has("carrierCarryPosition"));
  assert.ok(!carrier.has("carrycotCompatibility"));
  assert.ok(!carrier.has("strollerAccessoryType"));

  const carrycot = keysFor("Portbebe");
  assert.ok(carrycot.has("carrycotUseCase"));
  assert.ok(carrycot.has("carrycotCompatibility"));
  assert.ok(!carrycot.has("carrierCarryPosition"));
  assert.ok(!carrycot.has("carSeatAccessoryType"));

  const strollerAccessory = keysFor("Bebek arabası aksesuarı");
  assert.ok(strollerAccessory.has("strollerAccessoryType"));
  assert.ok(strollerAccessory.has("strollerAccessoryCompatibility"));
  assert.ok(!strollerAccessory.has("strollerFoldPreference"));
  assert.ok(!strollerAccessory.has("carSeatAccessoryType"));

  const carSeatAccessory = keysFor("Oto koltuğu aksesuarı");
  assert.ok(carSeatAccessory.has("carSeatAccessoryType"));
  assert.ok(carSeatAccessory.has("carSeatAccessoryCompatibility"));
  assert.ok(!carSeatAccessory.has("carSeatGroup"));
  assert.ok(!carSeatAccessory.has("strollerAccessoryType"));

  const carrierAccessory = keysFor("Kanguru aksesuarı");
  assert.ok(carrierAccessory.has("carrierAccessoryType"));
  assert.ok(carrierAccessory.has("carrierAccessoryCompatibility"));
  assert.ok(!carrierAccessory.has("carrierCarryPosition"));
});

check("baby car-seat accessories suppress full-seat inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "baby",
    values: {
      babyProductType: "Oto koltuğu aksesuarı",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "carSeatGroup",
        label: "Kilo grubu",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
      {
        fieldKey: "carSeatAccessoryCompatibility",
        label: "Marka / model uyumu",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "text",
      },
    ],
  });
  assert.ok(
    schedule.visible.some(
      (question) => question.fieldKey === "carSeatAccessoryCompatibility",
    ),
  );
  assert.ok(!schedule.visible.some((question) => question.fieldKey === "carSeatGroup"));
});

check("baby mobility text resolves to its narrow product type", () => {
  for (const [text, expected] of [
    ["ergonomik bebek kangurusu arıyorum", "Kanguru / bebek taşıyıcı"],
    [
      "travel sistem için bebek arabası yağmurluğu lazım",
      "Bebek arabası aksesuarı",
    ],
    ["isofix oto koltuğu aksesuarı arıyorum", "Oto koltuğu aksesuarı"],
    ["bebek arabasına uyumlu portbebe arıyorum", "Portbebe"],
  ] as const) {
    assert.equal(detectAttributes(text, "baby").babyProductType, expected);
  }
});

check("baby care contracts keep each product family isolated", () => {
  const keysFor = (babyProductType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "baby",
        productType: babyProductType,
      }).map((profile) => profile.fieldKey),
    );

  const changing = keysFor("Bebek bezi / alt değiştirme");
  assert.ok(changing.has("diaperCareProduct"));
  assert.ok(changing.has("diaperCareMaterial"));
  assert.ok(!changing.has("diaperDisposalCapacity"));
  assert.ok(!changing.has("babyBathStage"));

  const disposal = keysFor("Bez saklama / atık yönetimi");
  assert.ok(disposal.has("diaperDisposalProduct"));
  assert.ok(disposal.has("diaperDisposalCapacity"));
  assert.ok(!disposal.has("diaperCareMaterial"));
  assert.ok(!disposal.has("skinCareSensitivity"));

  const skinCare = keysFor("Islak mendil / pişik bakımı");
  assert.ok(skinCare.has("skinCareProduct"));
  assert.ok(skinCare.has("skinCareSensitivity"));
  assert.ok(!skinCare.has("babyHealthOperation"));
  assert.ok(!skinCare.has("pacifierAccessoryMaterial"));

  const bath = keysFor("Bebek banyo ürünü");
  assert.ok(bath.has("babyBathProduct"));
  assert.ok(bath.has("babyBathStage"));
  assert.ok(!bath.has("toiletTrainingStage"));
  assert.ok(!bath.has("diaperCareUseCase"));

  const health = keysFor("Bebek sağlık / bakım ürünü");
  assert.ok(health.has("babyHealthProduct"));
  assert.ok(health.has("babyHealthOperation"));
  assert.ok(!health.has("babyBathFeature"));
  assert.ok(!health.has("feedingNippleStage"));

  const pacifierAccessory = keysFor("Emzik aksesuarı / temizliği");
  assert.ok(pacifierAccessory.has("pacifierAccessoryProduct"));
  assert.ok(pacifierAccessory.has("pacifierAccessoryMaterial"));
  assert.ok(!pacifierAccessory.has("feedingNippleMaterial"));
  assert.ok(!pacifierAccessory.has("babyHealthFeature"));

  const toiletTraining = keysFor("Lazımlık / tuvalet eğitimi");
  assert.ok(toiletTraining.has("toiletTrainingProduct"));
  assert.ok(toiletTraining.has("toiletTrainingStage"));
  assert.ok(!toiletTraining.has("babyBathProduct"));
  assert.ok(!toiletTraining.has("diaperDisposalProduct"));
});

check("baby care text resolves to its narrow product type", () => {
  for (const [text, expected] of [
    ["seyahat için alt açma minderi arıyorum", "Bebek bezi / alt değiştirme"],
    ["yedek poşetli bebek bezi çöp kovası lazım", "Bez saklama / atık yönetimi"],
    ["hassas cilt için parfümsüz bebek ıslak mendili", "Islak mendil / pişik bakımı"],
    ["yenidoğan için katlanabilir bebek küveti", "Bebek banyo ürünü"],
    ["temassız bebek ateş ölçer arıyorum", "Bebek sağlık / bakım ürünü"],
    ["yıkanabilir emzik klipsi lazım", "Emzik aksesuarı / temizliği"],
    ["kaydırmaz lazımlık arıyorum", "Lazımlık / tuvalet eğitimi"],
  ] as const) {
    assert.equal(detectAttributes(text, "baby").babyProductType, expected);
  }
});

check("baby other-family contracts keep safety, play, toys, and other products isolated", () => {
  const keysFor = (babyProductType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "baby",
        productType: babyProductType,
      }).map((profile) => profile.fieldKey),
    );

  const safety = keysFor("Bebek güvenlik ürünü");
  assert.ok(safety.has("safetyProtectionTarget"));
  assert.ok(safety.has("safetyInstallation"));
  assert.ok(!safety.has("playTravelUseSetting"));
  assert.ok(!safety.has("toyPlayTheme"));

  const playTravel = keysFor("Oyun / gezi ürünü");
  assert.ok(playTravel.has("playTravelAgeStage"));
  assert.ok(playTravel.has("playTravelUseSetting"));
  assert.ok(!playTravel.has("safetyInstallation"));
  assert.ok(!playTravel.has("toyOperationFeature"));

  const toy = keysFor("Oyuncak");
  assert.ok(toy.has("toyAgeStage"));
  assert.ok(toy.has("toyPlayTheme"));
  assert.ok(!toy.has("playTravelFeature"));
  assert.ok(!toy.has("otherBabyPriority"));

  const otherBaby = keysFor("Diğer bebek ürünü");
  assert.ok(otherBaby.has("otherBabyProduct"));
  assert.ok(otherBaby.has("otherBabyUseStage"));
  assert.ok(!otherBaby.has("toyPlayTheme"));
  assert.ok(!otherBaby.has("safetyCompatibility"));
});

check("baby other-family text resolves to the right family", () => {
  for (const [text, expected] of [
    ["merdiven için vidalı bebek güvenlik çiti lazım", "Bebek güvenlik ürünü"],
    ["bahçe için akülü araba arıyorum", "Oyun / gezi ürünü"],
    ["6 yaş için uzaktan kumandalı oyuncak lazım", "Oyuncak"],
    ["kameralı bebek monitörü arıyorum", "Diğer bebek ürünü"],
  ] as const) {
    assert.equal(detectAttributes(text, "baby").babyProductType, expected);
  }
});

check("machinery production contracts isolate each machine family", () => {
  const keysFor = (productType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "machinery",
        needType: "machine",
        productType,
      }).map((profile) => profile.fieldKey),
    );

  const machining = keysFor("CNC freze");
  assert.ok(machining.has("machiningControl"));
  assert.ok(machining.has("dimensions"));
  assert.ok(!machining.has("pressCapacity"));
  assert.ok(!machining.has("weldingProcess"));

  const forming = keysFor("Hidrolik pres");
  assert.ok(forming.has("formingMachineType"));
  assert.ok(forming.has("pressCapacity"));
  assert.ok(!forming.has("machiningPrecision"));
  assert.ok(!forming.has("plasticProcess"));

  const plastics = keysFor("Plastik enjeksiyon makinesi");
  assert.ok(plastics.has("plasticProcess"));
  assert.ok(plastics.has("plasticThroughput"));
  assert.ok(!plastics.has("weldingPower"));
  assert.ok(!plastics.has("fluidCapacity"));

  const welding = keysFor("TIG kaynak makinesi");
  assert.ok(welding.has("weldingProcess"));
  assert.ok(welding.has("weldingPower"));
  assert.ok(!welding.has("pressCapacity"));
  assert.ok(!welding.has("liftCapacity"));

  const fluid = keysFor("Vidalı kompresör");
  assert.ok(fluid.has("fluidMachineType"));
  assert.ok(fluid.has("fluidCapacity"));
  assert.ok(!fluid.has("weldingAutomation"));
  assert.ok(!fluid.has("liftingPowerDrive"));

  const handling = keysFor("Forklift");
  assert.ok(handling.has("liftCapacity"));
  assert.ok(handling.has("liftingPowerDrive"));
  assert.ok(!handling.has("fluidOperation"));
  assert.ok(!handling.has("machiningControl"));
});

check("machinery contracts suppress cross-family inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "machinery",
    needType: "machine",
    values: {
      needType: "machine",
      machineType: "Forklift",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "machiningControl",
        label: "Kontrol tipi",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
      {
        fieldKey: "liftCapacity",
        label: "Kapasite",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
    ],
  });
  assert.ok(schedule.visible.some((question) => question.fieldKey === "liftCapacity"));
  assert.ok(!schedule.visible.some((question) => question.fieldKey === "machiningControl"));
});

check("machining dimensions use the product-owned physical contract", () => {
  const def = resolveQuestionControl({
    categoryId: "machinery",
    needType: "machine",
    fieldKey: "dimensions",
    productType: "CNC freze",
    allowUnknown: true,
  });
  assert.equal(def.controlType, "dimensions");
  assert.equal(def.measurementKind, "physical_dimensions");
  assert.equal(def.placeholder, "800 × 500 × 500 mm");
  assert.deepEqual(def.options, []);
});

check("machinery cutting contracts isolate cutting from machining", () => {
  const keysFor = (productType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "machinery",
        needType: "machine",
        productType,
      }).map((profile) => profile.fieldKey),
    );

  const laser = keysFor("Fiber lazer kesim");
  assert.ok(laser.has("cuttingTechnology"));
  assert.ok(laser.has("cuttingMaterial"));
  assert.ok(laser.has("dimensions"));
  assert.ok(!laser.has("machiningControl"));
  assert.ok(!laser.has("pressCapacity"));

  const router = keysFor("CNC router / ahşap kesim");
  assert.ok(router.has("cuttingThickness"));
  assert.ok(!router.has("machiningPrecision"));

  const def = resolveQuestionControl({
    categoryId: "machinery",
    needType: "machine",
    fieldKey: "dimensions",
    productType: "Fiber lazer kesim",
    allowUnknown: true,
  });
  assert.equal(def.measurementKind, "physical_dimensions");
  assert.equal(def.placeholder, "1.500 × 3.000 mm");
});

check("machinery cutting text resolves before generic CNC machining", () => {
  assert.equal(
    detectAttributes("3 kW fiber lazerle sac kesim arıyorum", "machinery")
      .machineType,
    "Kesim teknolojisi",
  );
  assert.equal(
    detectAttributes("CNC router ile MDF kesim makinesi lazım", "machinery")
      .machineType,
    "Kesim teknolojisi",
  );
});

check("machinery packaging contracts keep production questions isolated", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Flowpack paketleme makinesi",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("packagingProcess"));
  assert.ok(keys.has("packagingFormat"));
  assert.ok(keys.has("packagingThroughput"));
  assert.ok(!keys.has("cuttingMaterial"));
  assert.ok(!keys.has("plasticThroughput"));
  assert.ok(!keys.has("weldingPower"));
});

check("machinery packaging text resolves to packaging", () => {
  for (const text of [
    "dakikada 90 adet flowpack makinesi arıyorum",
    "şişe dolum ve kapak kapama makinesi lazım",
    "palet streç makinesi arıyorum",
  ]) {
    assert.equal(
      detectAttributes(text, "machinery").machineType,
      "Paketleme makinesi",
    );
  }
});

check("machinery spare parts keep the brain intentionally sparse", () => {
  const profiles = listProfilesForCategory({
    categoryId: "machinery",
    needType: "part",
    productType: "Forklift",
  });
  const keys = new Set(profiles.map((profile) => profile.fieldKey));
  assert.ok(keys.has("partPreference"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("condition"));
  assert.ok(!keys.has("liftCapacity"));
  assert.ok(!keys.has("compressorType"));
  assert.ok(!keys.has("dimensions"));

  const preference = profiles.find(
    (profile) => profile.fieldKey === "partPreference",
  );
  assert.deepEqual(
    preference?.quickChoices?.map((choice) => choice.value),
    ["Orijinal", "Muadil"],
  );
});

check("machinery spare-part text keeps original or equivalent preference", () => {
  const original = detectAttributes(
    "CNC freze için orijinal rulman yedek parçası arıyorum",
    "machinery",
  );
  assert.equal(original.needType, "part");
  assert.equal(original.partPreference, "Orijinal");

  const equivalent = detectAttributes(
    "forklift için muadil filtre lazım",
    "machinery",
  );
  assert.equal(equivalent.needType, "part");
  assert.equal(equivalent.partPreference, "Muadil");
});

check("machinery spare parts use the Türkiye il-ilçe delivery picker", () => {
  const location = globalCoreQuestionProfiles("machinery", {
    needType: "part",
  }).find((profile) => profile.fieldKey === "city");
  assert.equal(
    location?.prompt,
    "Teslimat adresi neresi? Türkiye geneli veya il ve ilçe seçin.",
  );
  const control = resolveQuestionControl({
    categoryId: "machinery",
    needType: "part",
    fieldKey: "city",
  });
  assert.equal(control.controlType, "location_picker");
});

check("machinery no longer exposes service or maintenance", () => {
  const category = getCategoryById("machinery");
  const needType = category?.fields.find((field) => field.key === "needType");
  assert.ok(needType);
  assert.ok(
    !needType.options?.some((option) => option.value === "service"),
  );
  assert.ok(!category?.fields.some((field) => field.key === "serviceType"));
  assert.equal(
    detectAttributes("CNC bakım ve servis gerekiyor", "machinery").needType,
    "machine",
  );
});

check("generator asks only condition, kVA, and fuel beyond global location", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Dizel Jeneratör",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("generatorPower"));
  assert.ok(keys.has("generatorFuel"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));
  assert.ok(!keys.has("inspectionAvailability"));
  assert.ok(!keys.has("liftCapacity"));

  const fuel = resolveQuestionControl({
    categoryId: "machinery",
    needType: "machine",
    productType: "Dizel Jeneratör",
    fieldKey: "generatorFuel",
    profileChoices: [
      { label: "Dizel", value: "Dizel" },
      { label: "Benzin", value: "Benzin" },
      { label: "LPG / doğalgaz", value: "LPG / doğalgaz" },
    ],
  });
  assert.equal(fuel.controlType, "single_choice");
});

check("generator text resolves kVA family and fuel", () => {
  const attrs = detectAttributes(
    "ikinci el dizel jeneratör arıyorum",
    "machinery",
  );
  assert.equal(attrs.condition, "İkinci el");
  assert.equal(attrs.machineType, "2. el Jeneratör");
  assert.equal(attrs.generatorFuel, "Dizel");
});

check("machinery excavation and loading families stay narrow", () => {
  const excavatorKeys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Mini Ekskavatör",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(excavatorKeys.has("condition"));
  assert.ok(excavatorKeys.has("excavatorWeightClass"));
  assert.ok(excavatorKeys.has("excavatorAttachment"));
  assert.ok(!excavatorKeys.has("fullExcavatorWeightClass"));
  assert.ok(!excavatorKeys.has("loaderCapacity"));
  assert.ok(!excavatorKeys.has("brand"));
  assert.ok(!excavatorKeys.has("model"));
  assert.ok(!excavatorKeys.has("modelYear"));
  assert.ok(!excavatorKeys.has("operatingHours"));

  const loaderKeys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "2. el Yükleyici (Loder)",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(loaderKeys.has("condition"));
  assert.ok(loaderKeys.has("loaderCapacity"));
  assert.ok(loaderKeys.has("loaderAttachment"));
  assert.ok(!loaderKeys.has("excavatorWeightClass"));
  assert.ok(!loaderKeys.has("brand"));
  assert.ok(!loaderKeys.has("model"));
  assert.ok(!loaderKeys.has("modelYear"));
  assert.ok(loaderKeys.has("operatingHours"));
  assert.ok(!loaderKeys.has("inspectionAvailability"));
});

check("machinery full excavator stays distinct from mini excavator", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "2. el Ekskavatör",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("fullExcavatorWeightClass"));
  assert.ok(keys.has("fullExcavatorAttachment"));
  assert.ok(keys.has("operatingHours"));
  assert.ok(!keys.has("excavatorWeightClass"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("inspectionAvailability"));
});

check("real-estate residential families stay scoped", () => {
  const apartmentKeys = new Set(
    listProfilesForCategory({
      categoryId: "real-estate",
      productType: "Yalı Dairesi",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(apartmentKeys.has("listingType"));
  assert.ok(apartmentKeys.has("propertyType"));
  assert.ok(apartmentKeys.has("roomCount"));
  assert.ok(apartmentKeys.has("area"));
  assert.ok(apartmentKeys.has("floor"));
  assert.ok(apartmentKeys.has("buildingAge"));
  assert.ok(apartmentKeys.has("newBuildPreference"));
  assert.ok(!apartmentKeys.has("brand"));
  assert.ok(!apartmentKeys.has("model"));

  const houseKeys = new Set(
    listProfilesForCategory({
      categoryId: "real-estate",
      productType: "Müstakil Ev",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(houseKeys.has("roomCount"));
  assert.ok(houseKeys.has("area"));
  assert.ok(houseKeys.has("totalFloors"));
  assert.ok(houseKeys.has("buildingAge"));
  assert.ok(!houseKeys.has("floor"));

  for (const propertyType of ["Yalı", "Köşk & Konak", "Çiftlik Evi"]) {
    const scopedKeys = new Set(
      listProfilesForCategory({
        categoryId: "real-estate",
        productType: propertyType,
      }).map((profile) => profile.fieldKey),
    );
    assert.ok(scopedKeys.has("totalFloors"), `${propertyType} needs total floors`);
    assert.ok(!scopedKeys.has("floor"), `${propertyType} must not ask apartment floor`);
  }
});

check("real-estate land families stay free of building questions", () => {
  for (const propertyType of [
    "İmarlı arsa",
    "Konut imarlı arsa",
    "Ticari arsa",
    "Sanayi arsası",
    "Tarla",
  ]) {
    const keys = new Set(
      listProfilesForCategory({
        categoryId: "real-estate",
        productType: propertyType,
      }).map((profile) => profile.fieldKey),
    );
    assert.ok(keys.has("area"), `${propertyType} needs land area`);
    assert.ok(keys.has("deedStatus"), `${propertyType} needs deed preference`);
    assert.ok(!keys.has("roomCount"), `${propertyType} must not ask room count`);
    assert.ok(!keys.has("floor"), `${propertyType} must not ask apartment floor`);
    assert.ok(!keys.has("buildingAge"), `${propertyType} must not ask building age`);
    assert.ok(!keys.has("heating"), `${propertyType} must not ask heating`);
  }
});

check("real-estate commercial families ask only role-specific questions", () => {
  const keysFor = (productType: string) =>
    new Set(
      listProfilesForCategory({ categoryId: "real-estate", productType }).map(
        (profile) => profile.fieldKey,
      ),
    );

  const office = keysFor("Ofis");
  assert.ok(office.has("area"));
  assert.ok(office.has("floor"));
  assert.ok(office.has("parking"));
  assert.ok(!office.has("roomCount"));
  assert.ok(!office.has("loadingAccess"));

  const store = keysFor("Dükkan / mağaza");
  assert.ok(store.has("area"));
  assert.ok(store.has("floor"));
  assert.ok(store.has("storefrontNeed"));
  assert.ok(!store.has("parking"));
  assert.ok(!store.has("loadingAccess"));

  const warehouse = keysFor("Depo / antrepo");
  assert.ok(warehouse.has("area"));
  assert.ok(warehouse.has("loadingAccess"));
  assert.ok(warehouse.has("ceilingHeight"));
  assert.ok(!warehouse.has("floor"));
  assert.ok(!warehouse.has("roomCount"));

  const factory = keysFor("Fabrika / imalathane");
  assert.ok(factory.has("area"));
  assert.ok(factory.has("loadingAccess"));
  assert.ok(factory.has("ceilingHeight"));
  assert.ok(factory.has("industrialPower"));
  assert.ok(!factory.has("roomCount"));

  const hotel = keysFor("Otel / apart");
  assert.ok(hotel.has("roomCount"));
  assert.ok(hotel.has("area"));
  assert.ok(hotel.has("lodgingPermit"));
  assert.ok(!hotel.has("floor"));
  assert.ok(!hotel.has("loadingAccess"));
});

check("real-estate other families keep their short, scoped questions", () => {
  const keysFor = (productType: string) =>
    new Set(
      listProfilesForCategory({ categoryId: "real-estate", productType }).map(
        (profile) => profile.fieldKey,
      ),
    );

  const devren = keysFor("Devren işyeri");
  assert.ok(devren.has("businessActivity"));
  assert.ok(devren.has("transferScope"));
  assert.ok(devren.has("businessPermitStatus"));
  assert.ok(!devren.has("roomCount"));
  assert.ok(!devren.has("floor"));

  const mustemilat = keysFor("Müştemilat");
  assert.ok(mustemilat.has("outbuildingUsage"));
  assert.ok(mustemilat.has("area"));
  assert.ok(mustemilat.has("independentAccess"));
  assert.ok(mustemilat.has("utilityInfrastructure"));
  assert.ok(!mustemilat.has("roomCount"));
  assert.ok(!mustemilat.has("buildingAge"));

  const cooperative = keysFor("Kooperatif hissesi");
  assert.ok(cooperative.has("cooperativePurpose"));
  assert.ok(cooperative.has("cooperativeStage"));
  assert.ok(cooperative.has("cooperativeShareCount"));
  assert.ok(cooperative.has("cooperativePaymentPlan"));
  assert.ok(!cooperative.has("floor"));

  const tourism = keysFor("Turistik tesis");
  assert.ok(tourism.has("tourismFacilityType"));
  assert.ok(tourism.has("roomCount"));
  assert.ok(tourism.has("lodgingPermit"));
  assert.ok(tourism.has("tourismOperationStatus"));
  assert.ok(!tourism.has("floor"));
  assert.ok(!tourism.has("industrialPower"));

  const timeshare = keysFor("Devre mülk");
  assert.ok(timeshare.has("timeshareFacilityType"));
  assert.ok(timeshare.has("timesharePeriod"));
  assert.ok(timeshare.has("timeshareSeason"));
  assert.ok(timeshare.has("newBuildPreference"));
  assert.ok(!timeshare.has("roomCount"));
  assert.ok(!timeshare.has("floor"));

  assert.ok(!keysFor("Tarla").has("newBuildPreference"));
  assert.ok(!keysFor("Kooperatif hissesi").has("newBuildPreference"));
});

check("real-estate residential text keeps its exact property family", () => {
  assert.equal(
    detectAttributes("kiralık yalı dairesi arıyorum", "real-estate").propertyType,
    "Yalı Dairesi",
  );
  assert.equal(
    detectAttributes("satılık müstakil ev arıyorum", "real-estate").propertyType,
    "Müstakil Ev",
  );
  assert.equal(
    detectAttributes("satılık çiftlik evi arıyorum", "real-estate").propertyType,
    "Çiftlik Evi",
  );
  assert.equal(
    detectAttributes("2 katlı satılık müstakil ev arıyorum", "real-estate").totalFloors,
    2,
  );
  assert.equal(
    detectAttributes("satılık 2 dönüm konut imarlı arsa arıyorum", "real-estate").propertyType,
    "Konut imarlı arsa",
  );
  assert.equal(
    detectAttributes("satılık tarla arıyorum", "real-estate").propertyType,
    "Tarla",
  );
  assert.equal(
    detectAttributes("kiralık depo arıyorum", "real-estate").propertyType,
    "Depo / antrepo",
  );
  assert.equal(
    detectAttributes("satılık plaza ofisi arıyorum", "real-estate").propertyType,
    "Plaza ofisi",
  );
  assert.equal(
    detectAttributes("satılık fabrika arıyorum", "real-estate").propertyType,
    "Fabrika / imalathane",
  );
  assert.equal(
    detectAttributes("devren işyeri arıyorum", "real-estate").propertyType,
    "Devren işyeri",
  );
  assert.equal(
    detectAttributes("müştemilat arıyorum", "real-estate").propertyType,
    "Müştemilat",
  );
  assert.equal(
    detectAttributes("kooperatif hissesi arıyorum", "real-estate").propertyType,
    "Kooperatif hissesi",
  );
  assert.equal(
    detectAttributes("turistik tesis arıyorum", "real-estate").propertyType,
    "Turistik tesis",
  );
  const timeshare = detectAttributes(
    "sıfır bina devre mülk arıyorum",
    "real-estate",
  );
  assert.equal(timeshare.propertyType, "Devre mülk");
  assert.equal(timeshare.newBuildPreference, "Yeni bina şart");
});

check("real-estate canonical binding keeps the most specific property type", () => {
  const yaliDairesi = buildCanonicalRequestState({
    understanding: understandRequest("kiralık yalı dairesi arıyorum"),
  });
  assert.equal(yaliDairesi.fields.propertyType?.value, "Yalı Dairesi");
  assert.equal(
    yaliDairesi.taxonomyNodeId,
    "tax:real-estate:kiralik-konut:konut-tipleri:yali-dairesi",
  );

  const tarla = buildCanonicalRequestState({
    understanding: understandRequest("satılık 500 m² tarla arıyorum"),
  });
  assert.equal(tarla.categoryId, "real-estate");
  assert.equal(tarla.fields.propertyType?.value, "Tarla");
  assert.equal(
    tarla.taxonomyNodeId,
    "tax:real-estate:arsa:arsa-tipleri:tarla",
  );

  const depo = buildCanonicalRequestState({
    understanding: understandRequest("kiralık 300 m² depo arıyorum"),
  });
  assert.equal(depo.categoryId, "real-estate");
  assert.equal(depo.fields.propertyType?.value, "Depo / antrepo");
  assert.equal(depo.subcategorySlug, "ticari-gayrimenkul");
  assert.equal(
    depo.taxonomyNodeId,
    "tax:real-estate:ticari-gayrimenkul:ticari-tipler:depo-antrepo",
  );

  const cooperative = buildCanonicalRequestState({
    understanding: understandRequest("satılık kooperatif hissesi arıyorum"),
  });
  assert.equal(cooperative.categoryId, "real-estate");
  assert.equal(cooperative.fields.propertyType?.value, "Kooperatif hissesi");
  assert.equal(cooperative.subcategorySlug, "diger");
  assert.equal(
    cooperative.taxonomyNodeId,
    "tax:real-estate:diger:diger-emlak:kooperatif-hissesi",
  );

  const timeshare = buildCanonicalRequestState({
    understanding: understandRequest("sıfır bina devre mülk arıyorum"),
  });
  assert.equal(timeshare.categoryId, "real-estate");
  assert.equal(timeshare.fields.propertyType?.value, "Devre mülk");
  assert.equal(timeshare.fields.newBuildPreference?.value, "Yeni bina şart");
  assert.equal(timeshare.subcategorySlug, "diger");
  assert.equal(
    timeshare.taxonomyNodeId,
    "tax:real-estate:diger:diger-emlak:devre-mulk",
  );

  const konakDistrict = buildCanonicalRequestState({
    understanding: understandRequest("İzmir Konak'ta 3+1 kiralık daire arıyorum"),
  });
  assert.equal(konakDistrict.fields.propertyType?.value, "Daire");
  assert.equal(
    konakDistrict.taxonomyNodeId,
    "tax:real-estate:kiralik-konut:konut-tipleri:daire",
  );
});

check("machinery excavation and loading text resolves to the right family", () => {
  assert.equal(
    detectAttributes("mini ekskavatör arıyorum", "machinery").machineType,
    "Mini ekskavatör",
  );
  assert.equal(
    detectAttributes("ikinci el paletli ekskavatör arıyorum", "machinery")
      .machineType,
    "2. el Ekskavatör",
  );
  assert.equal(
    detectAttributes("ikinci el beko loder arıyorum", "machinery").machineType,
    "2. el Yükleyici (loder)",
  );
});

check("machinery post-generator question depth follows the product decision", () => {
  const keysFor = (productType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "machinery",
        needType: "machine",
        productType,
      }).map((profile) => profile.fieldKey),
    );

  const miniExcavator = keysFor("Mini ekskavatör");
  assert.ok(miniExcavator.has("miniExcavatorDigDepth"));
  assert.ok(miniExcavator.has("miniExcavatorCabin"));

  const excavator = keysFor("Ekskavatör");
  assert.ok(excavator.has("excavatorUndercarriage"));
  assert.ok(excavator.has("fullExcavatorDigDepth"));

  const loader = keysFor("Yükleyici (loder)");
  assert.ok(loader.has("loaderMachineType"));
  assert.ok(loader.has("loaderLiftHeight"));

  const towerCrane = keysFor("Kule vinç");
  assert.ok(towerCrane.has("towerCraneHookHeight"));
  assert.ok(towerCrane.has("towerCraneMounting"));

  const mobileCrane = keysFor("Mobil vinç");
  assert.ok(mobileCrane.has("mobileCraneSiteAccess"));
  assert.ok(!mobileCrane.has("mobileCraneChassisType"));

  const survey = keysFor("Arazi ölçümü");
  assert.ok(survey.has("surveyCorrectionSource"));
  assert.ok(survey.has("surveyDataExport"));

  const tractor = keysFor("Traktör");
  assert.ok(tractor.has("tractorCabinType"));
  assert.ok(tractor.has("tractorLoaderNeed"));

  for (const [productType, expectedKeys] of [
    ["Beton santrali", ["concretePlantType", "concretePlantCapacity"]],
    ["Beton pompası", ["concretePumpType", "concretePumpReach"]],
    ["Silindir (kompaktör)", ["compactorType", "compactorWeightClass"]],
    ["Ağaç yonga makinesi", ["woodChipperFeedDiameter", "woodChipperDriveType"]],
    ["Balya makinesi", ["balerForm", "balerCropType"]],
    ["Mibzer", ["seederMethod", "seederWorkingWidth"]],
    ["Pulluk", ["plowType", "plowFurrowCount"]],
    ["Süt sağım makinesi", ["milkingSystemType", "milkingUnitCount"]],
    ["Yem karma makinesi", ["feedMixerType", "feedMixerCapacity"]],
  ] as const) {
    const keys = keysFor(productType);
    for (const fieldKey of expectedKeys) assert.ok(keys.has(fieldKey));
  }
});

check("machinery concrete equipment families stay narrow", () => {
  const plantKeys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Beton Santrali",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(plantKeys.has("condition"));
  assert.ok(plantKeys.has("concretePlantType"));
  assert.ok(plantKeys.has("concretePlantCapacity"));
  assert.ok(!plantKeys.has("concretePumpType"));
  assert.ok(!plantKeys.has("brand"));
  assert.ok(!plantKeys.has("model"));
  assert.ok(!plantKeys.has("modelYear"));
  assert.ok(!plantKeys.has("operatingHours"));

  const pumpKeys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "2. el Beton Pompası",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(pumpKeys.has("condition"));
  assert.ok(pumpKeys.has("concretePumpType"));
  assert.ok(pumpKeys.has("concretePumpReach"));
  assert.ok(!pumpKeys.has("concretePlantType"));
  assert.ok(!pumpKeys.has("brand"));
  assert.ok(!pumpKeys.has("model"));
  assert.ok(!pumpKeys.has("modelYear"));
  assert.ok(!pumpKeys.has("operatingHours"));
  assert.ok(!pumpKeys.has("inspectionAvailability"));
});

check("machinery concrete equipment text resolves to the right family", () => {
  assert.equal(
    detectAttributes("mobil beton santrali arıyorum", "machinery").machineType,
    "Beton Santrali",
  );
  assert.equal(
    detectAttributes("ikinci el beton pompası arıyorum", "machinery").machineType,
    "2. el Beton Pompası",
  );
});

check("machinery crane families stay narrow", () => {
  const towerKeys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Kule Vinç",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(towerKeys.has("condition"));
  assert.ok(towerKeys.has("towerCraneCapacity"));
  assert.ok(towerKeys.has("towerCraneJibLength"));
  assert.ok(!towerKeys.has("mobileCraneCapacity"));
  assert.ok(!towerKeys.has("liftCapacity"));
  assert.ok(!towerKeys.has("brand"));
  assert.ok(!towerKeys.has("model"));
  assert.ok(!towerKeys.has("modelYear"));

  const mobileKeys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "2. el Mobil Vinç",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(mobileKeys.has("condition"));
  assert.ok(mobileKeys.has("mobileCraneCapacity"));
  assert.ok(mobileKeys.has("mobileCraneReach"));
  assert.ok(!mobileKeys.has("towerCraneCapacity"));
  assert.ok(!mobileKeys.has("liftCapacity"));
  assert.ok(!mobileKeys.has("brand"));
  assert.ok(!mobileKeys.has("model"));
  assert.ok(!mobileKeys.has("modelYear"));
  assert.ok(!mobileKeys.has("operatingHours"));
});

check("machinery crane text resolves to the right family", () => {
  assert.equal(
    detectAttributes("kule vinç arıyorum", "machinery").machineType,
    "Kule Vinç",
  );
  assert.equal(
    detectAttributes("ikinci el mobil vinç arıyorum", "machinery").machineType,
    "2. el Mobil Vinç",
  );
});

check("machinery compactor stays narrow", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Silindir (Kompaktör)",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("compactorType"));
  assert.ok(keys.has("compactorWeightClass"));
  assert.ok(!keys.has("towerCraneCapacity"));
  assert.ok(!keys.has("liftCapacity"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));
});

check("machinery compactor text resolves to its family", () => {
  assert.equal(
    detectAttributes("ikinci el kompaktör arıyorum", "machinery").machineType,
    "2. el Silindir (kompaktör)",
  );
});

check("machinery wood chipper stays narrow", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Ağaç Yonga Makineleri",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("woodChipperFeedDiameter"));
  assert.ok(keys.has("woodChipperDriveType"));
  assert.ok(!keys.has("compactorType"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));
});

check("machinery wood chipper text resolves to its family", () => {
  assert.equal(
    detectAttributes("traktör için dal öğütücü arıyorum", "machinery")
      .machineType,
    "Ağaç yonga makinesi",
  );
});

check("machinery land-survey equipment stays narrow", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Arazi Ölçümü",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("surveyEquipmentType"));
  assert.ok(keys.has("surveyAccuracyLevel"));
  assert.ok(!keys.has("woodChipperDriveType"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));
});

check("machinery land-survey text resolves to its family", () => {
  assert.equal(
    detectAttributes("GNSS RTK cihazı arıyorum", "machinery").machineType,
    "Arazi ölçüm cihazı",
  );
});

check("machinery tractor stays narrow", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Traktör",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("brand"));
  assert.ok(keys.has("tractorPowerClass"));
  assert.ok(keys.has("tractorDriveType"));
  assert.ok(!keys.has("surveyEquipmentType"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));

  const brands = popularBrandOptions({
    categoryId: "machinery",
    fieldKey: "brand",
    productType: "Traktör",
  });
  assert.ok(brands.some((option) => option.value === "New Holland"));
  assert.ok(brands.some((option) => option.value === "Massey Ferguson"));
  assert.ok(!brands.some((option) => option.value === "Caterpillar"));
});

check("machinery tractor text resolves to its family", () => {
  const attrs = detectAttributes(
    "New Holland 4 çeker traktör arıyorum",
    "machinery",
  );
  assert.equal(attrs.machineType, "Traktör");
  assert.equal(attrs.brand, "New Holland");

  const manufacturerMention = detectAttributes(
    "TürkTraktör traktör arıyorum",
    "machinery",
  );
  assert.equal(manufacturerMention.machineType, "Traktör");
  assert.equal(manufacturerMention.brand, undefined);
});

check("machinery baler stays narrow", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Balya Makinesi",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("balerForm"));
  assert.ok(keys.has("balerCropType"));
  assert.ok(!keys.has("tractorPowerClass"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));
});

check("machinery baler text resolves to its family", () => {
  assert.equal(
    detectAttributes("yuvarlak balya makinesi arıyorum", "machinery")
      .machineType,
    "Balya makinesi",
  );
});

check("machinery seeder stays narrow", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Mibzer",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("seederMethod"));
  assert.ok(keys.has("seederWorkingWidth"));
  assert.ok(!keys.has("balerForm"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));
});

check("machinery seeder text resolves to its family", () => {
  assert.equal(
    detectAttributes("pnömatik ekim makinesi arıyorum", "machinery")
      .machineType,
    "Ekim makinesi (mibzer)",
  );
});

check("machinery plow stays narrow", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Pulluk",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("plowType"));
  assert.ok(keys.has("plowFurrowCount"));
  assert.ok(!keys.has("seederMethod"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));
});

check("machinery plow text resolves to its family", () => {
  assert.equal(
    detectAttributes("dönerli pulluk arıyorum", "machinery").machineType,
    "Pulluk",
  );
});

check("machinery milking machine stays narrow", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Süt Sağım Makinesi",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("milkingSystemType"));
  assert.ok(keys.has("milkingUnitCount"));
  assert.ok(!keys.has("plowType"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));
});

check("machinery milking text resolves to its family", () => {
  assert.equal(
    detectAttributes("taşınabilir süt sağım makinesi arıyorum", "machinery")
      .machineType,
    "Süt sağım makinesi",
  );
});

check("machinery feed mixer stays narrow", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "Yem Karma Makinesi",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("condition"));
  assert.ok(keys.has("feedMixerType"));
  assert.ok(keys.has("feedMixerCapacity"));
  assert.ok(!keys.has("milkingSystemType"));
  assert.ok(!keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("operatingHours"));
});

check("machinery feed-mixer text resolves to its family", () => {
  assert.equal(
    detectAttributes("dikey yem karma makinesi arıyorum", "machinery")
      .machineType,
    "Yem karma makinesi",
  );
});

check("machinery used-machine profiles extend the matching product family", () => {
  const keys = new Set(
    listProfilesForCategory({
      categoryId: "machinery",
      needType: "machine",
      productType: "2. el CNC freze",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(keys.has("modelYear"));
  assert.ok(keys.has("operatingHours"));
  assert.ok(keys.has("inspectionAvailability"));
  assert.ok(keys.has("machiningControl"));
  assert.ok(keys.has("dimensions"));
  assert.ok(!keys.has("pressCapacity"));
});

check("machinery used-machine text and browse pin the used condition", () => {
  const text = detectAttributes(
    "2018 model 2. el CNC freze arıyorum",
    "machinery",
  );
  assert.equal(text.needType, "machine");
  assert.equal(text.condition, "İkinci el");
  assert.match(String(text.machineType), /^2\. el CNC/);

  const packaging = detectAttributes(
    "2. el paketleme hattı arıyorum",
    "machinery",
  );
  assert.equal(packaging.condition, "İkinci el");
  assert.equal(packaging.machineType, "2. el Paketleme makinesi");

  const role = resolveBrowseSemanticRole({
    categoryId: "machinery",
    subcategorySlug: "ikinci-el-makine",
  });
  assert.equal(role.fixedFields?.condition, "İkinci el");
});

check("machinery production text resolves to its narrow family", () => {
  for (const [text, expected] of [
    ["5 eksenli CNC freze arıyorum", "CNC / talaşlı imalat"],
    ["250 ton hidrolik pres lazım", "Pres / şekillendirme"],
    ["seri üretim için plastik enjeksiyon makinesi", "Plastik enjeksiyon / ekstrüzyon"],
    ["350 amper TIG kaynak makinesi", "Kaynak / birleştirme"],
    ["vidalı kompresör arıyorum", "Kompresör / akışkan sistemi"],
    ["depo için elektrikli forklift lazım", "Taşıma / istifleme"],
  ] as const) {
    assert.equal(detectAttributes(text, "machinery").machineType, expected);
  }
});

check("baby feeding contracts keep accessory and device questions isolated", () => {
  const keysFor = (babyProductType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "baby",
        productType: babyProductType,
      }).map((profile) => profile.fieldKey),
    );

  const highChair = keysFor("Mama sandalyesi");
  assert.ok(highChair.has("highChairHarness"));
  assert.ok(highChair.has("highChairAdjustability"));
  assert.ok(!highChair.has("feedingBottleCapacity"));
  assert.ok(!highChair.has("feedingDeviceCapacity"));

  const bottle = keysFor("Biberon / suluk");
  assert.ok(bottle.has("feedingBottleCapacity"));
  assert.ok(bottle.has("feedingBottleMaterial"));
  assert.ok(!bottle.has("feedingNippleStage"));
  assert.ok(!bottle.has("breastPumpOperation"));

  const nipple = keysFor("Biberon ucu");
  assert.ok(nipple.has("feedingNippleStage"));
  assert.ok(nipple.has("feedingNippleMaterial"));
  assert.ok(!nipple.has("feedingBottleCapacity"));
  assert.ok(!nipple.has("feedingDeviceCapacity"));

  const device = keysFor("Sterilizatör / mama hazırlama");
  assert.ok(device.has("feedingDeviceType"));
  assert.ok(device.has("feedingDeviceCapacity"));
  assert.ok(!device.has("feedingBottleMaterial"));
  assert.ok(!device.has("breastPumpOperation"));

  const pump = keysFor("Göğüs pompası / süt saklama");
  assert.ok(pump.has("breastPumpOperation"));
  assert.ok(pump.has("breastPumpConfiguration"));
  assert.ok(!pump.has("feedingDeviceOperation"));
  assert.ok(!pump.has("maternalFeedingPackSize"));

  const food = keysFor("Bebek / çocuk gıdası");
  assert.ok(food.has("babyFoodType"));
  assert.ok(food.has("babyFoodPackageSize"));
  assert.ok(!food.has("feedingDeviceCapacity"));
  assert.ok(!food.has("feedingBottleCapacity"));
});

check("baby biberon tips keep bottle candidates out of the schedule", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "baby",
    values: {
      productType: "Biberon ucu",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "feedingBottleCapacity",
        label: "Hacim",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
      {
        fieldKey: "feedingNippleStage",
        label: "Akış",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
    ],
  });
  assert.ok(schedule.visible.some((question) => question.fieldKey === "feedingNippleStage"));
  assert.ok(
    !schedule.visible.some(
      (question) => question.fieldKey === "feedingBottleCapacity",
    ),
  );
});

check("baby sleep contracts keep textile, furniture, and nest questions isolated", () => {
  const keysFor = (babyProductType: string) =>
    new Set(
      listProfilesForCategory({
        categoryId: "baby",
        productType: babyProductType,
      }).map((profile) => profile.fieldKey),
    );

  const sleepBag = keysFor("Uyku tulumu");
  assert.ok(sleepBag.has("sleepBagTog"));
  assert.ok(sleepBag.has("sleepBagClosure"));
  assert.ok(!sleepBag.has("sleepTextileMaterial"));
  assert.ok(!sleepBag.has("babyRoomSetContents"));

  const blanket = keysFor("Bebek battaniyesi / kundak");
  assert.ok(blanket.has("sleepTextileType"));
  assert.ok(blanket.has("sleepTextileMaterial"));
  assert.ok(blanket.has("sleepTextileSize"));
  assert.ok(!blanket.has("sleepBagTog"));
  assert.ok(!blanket.has("sleepSupportType"));

  const roomSet = keysFor("Bebek odası mobilyası");
  assert.ok(roomSet.has("babyRoomSetContents"));
  assert.ok(roomSet.has("dimensions"));
  assert.ok(roomSet.has("babyRoomMaterial"));
  assert.ok(!roomSet.has("sleepBagTog"));
  assert.ok(!roomSet.has("sleepSupportFeature"));

  const nest = keysFor("Yatak koruyucu / nest");
  assert.ok(nest.has("sleepSupportType"));
  assert.ok(nest.has("sleepSupportMaterial"));
  assert.ok(!nest.has("dimensions"));
  assert.ok(!nest.has("sleepTextileSize"));
});

check("baby room furniture dimensions use the room-set contract", () => {
  const def = resolveQuestionControl({
    categoryId: "baby",
    fieldKey: "dimensions",
    productType: "Bebek odası mobilyası",
    allowUnknown: true,
  });
  assert.equal(def.controlType, "dimensions");
  assert.equal(def.measurementKind, "physical_dimensions");
  assert.equal(def.placeholder, "280 × 50 × 200 cm");
  assert.deepEqual(def.options, []);
});

check("baby sleep bags suppress blanket inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "baby",
    values: {
      babyProductType: "Uyku tulumu",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "sleepTextileMaterial",
        label: "Kumaş",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
      {
        fieldKey: "sleepBagTog",
        label: "Tog",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 99,
        inputType: "select",
      },
    ],
  });
  assert.ok(schedule.visible.some((question) => question.fieldKey === "sleepBagTog"));
  assert.ok(
    !schedule.visible.some(
      (question) => question.fieldKey === "sleepTextileMaterial",
    ),
  );
});

check("automotive need-type contracts ask only their own questions", () => {
  const keysFor = (needType: string | undefined) =>
    new Set(
      listProfilesForCategory({ categoryId: "automotive", needType }).map(
        (profile) => profile.fieldKey,
      ),
    );

  const vehicle = keysFor("vehicle");
  assert.ok(vehicle.has("modelYear"));
  assert.ok(vehicle.has("mileage"));
  assert.ok(vehicle.has("fuel"));
  assert.ok(vehicle.has("transmission"));
  assert.ok(!vehicle.has("tireSize"));
  assert.ok(!vehicle.has("partVehicleYear"));

  const part = keysFor("part");
  assert.ok(part.has("brand"));
  assert.ok(part.has("model"));
  assert.ok(part.has("part"));
  assert.ok(part.has("partPreference"));
  assert.ok(part.has("partVehicleYear"));
  assert.ok(!part.has("oemNumber"));
  assert.ok(!part.has("vin"));
  assert.ok(!part.has("engine"));
  assert.ok(!part.has("generation"));
  assert.ok(!part.has("mileage"));
  assert.ok(!part.has("tireSize"));

  const tire = keysFor("tire");
  assert.ok(tire.has("tireItemType"));
  assert.ok(tire.has("tireSize"));
  assert.ok(tire.has("tireSeason"));
  assert.ok(tire.has("tireQuantity"));
  assert.ok(!tire.has("modelYear"));
  assert.ok(!tire.has("part"));

  const wheel = new Set(
    listProfilesForCategory({
      categoryId: "automotive",
      needType: "tire",
      productType: "Alaşım jant",
    }).map((profile) => profile.fieldKey),
  );
  assert.deepEqual(
    [...wheel].sort(),
    ["budget", "city", "condition", "needType", "tireQuantity", "tireSize"].sort(),
  );

  const service = keysFor("service");
  assert.ok(service.has("brand"));
  assert.ok(service.has("model"));
  assert.ok(service.has("mileage"));
  assert.ok(!service.has("tireSize"));

  const ppf = new Set(
    listProfilesForCategory({
      categoryId: "automotive",
      productType: "Koruma filmi / kaplama",
    }).map((profile) => profile.fieldKey),
  );
  assert.ok(ppf.has("brand"));
  assert.ok(ppf.has("model"));
  assert.ok(ppf.has("color"));
  assert.ok(!ppf.has("bodyType"));

  const unresolved = keysFor(undefined);
  assert.ok(!unresolved.has("modelYear"));
  assert.ok(!unresolved.has("part"));
  assert.ok(!unresolved.has("tireSize"));
});

check("simplified automotive flows omit time questions from every scheduler source", () => {
  const cases = [
    { needType: "part", productType: "Far" },
    { needType: "service", productType: "Periyodik bakım" },
    { needType: "tire", productType: "Alaşım jant" },
    { needType: "tire", productType: "Lastik değişimi" },
    { needType: "other", productType: "Koruma filmi / kaplama" },
    { needType: "other", productType: "Çeki demiri" },
    { needType: "other", productType: "Tavan / bagaj sistemleri" },
  ];
  for (const context of cases) {
    const answeredKeys = new Set<string>(["needType"]);
    const observed = new Set<string>();
    for (let step = 0; step < 20; step += 1) {
      const result = scheduleNextQuestions({
        categoryId: "automotive",
        ...context,
        values: { needType: context.needType },
        answeredKeys,
        hybridCandidates: [{
          fieldKey: "delivery", label: "Zaman", reason: "inferred",
          publishImpact: 0, matchingImpact: 0, priceImpact: 0,
          confidenceImpact: 0, priorityScore: 1, inputType: "text",
        }],
      });
      if (!result.visible.length) break;
      for (const question of result.visible) {
        assert.notEqual(question.fieldKey, "delivery", context.productType);
        assert.ok(!observed.has(question.fieldKey), context.productType);
        observed.add(question.fieldKey);
        answeredKeys.add(question.fieldKey);
      }
    }
    assert.ok(observed.has("budget"), context.productType);
    assert.ok(observed.has("city"), context.productType);
    assert.equal(observed.has("serviceDate"), context.productType === "Lastik değişimi");
    assert.ok(!listProfilesForCategory({ categoryId: "automotive", ...context })
      .some((profile) => profile.fieldKey === "delivery"));
  }
});

check("vehicle and tire purchases keep their shared time question", () => {
  for (const needType of ["vehicle", "tire"]) {
    const profiles = listProfilesForCategory({ categoryId: "automotive", needType });
    const result = scheduleNextQuestions({
      categoryId: "automotive", needType,
      values: { needType }, hybridCandidates: [],
      answeredKeys: profiles.map((p) => p.fieldKey).filter((key) => key !== "delivery"),
    });
    assert.ok(result.visible.some((q) => q.fieldKey === "delivery"), needType);
  }
});

check("automotive contracts also protect legacy field visibility", () => {
  const fields = getCategoryById("automotive")?.fields ?? [];
  const visible = getVisibleCategoryFields(fields, { needType: "tire" }, "automotive");
  const keys = new Set(visible.map((field) => field.key));
  assert.ok(keys.has("needType"));
  assert.ok(keys.has("brand"));
  assert.ok(!keys.has("model"));
  assert.ok(!keys.has("modelYear"));
  assert.ok(!keys.has("part"));
});

check("automotive free text routes each purchase family correctly", () => {
  const vehicle = understandRequest(
    "2020 model 3.20d beyaz renk BMW arıyorum Türkiye",
  );
  assert.equal(vehicle.category.value, "automotive");
  assert.equal(vehicle.attributes.needType?.value, "vehicle");
  assert.equal(vehicle.identity.model?.value, "3.20d");

  const part = understandRequest(
    "BMW 320d için ön far yedek parçası arıyorum İstanbul",
  );
  assert.equal(part.attributes.needType?.value, "part");
  assert.equal(part.identity.model?.value, "320d");
  assert.equal(part.attributes.part?.value, "Ön far");

  const wheel = understandRequest(
    "BMW için 4 adet 18 inç jant arıyorum İzmir",
  );
  assert.equal(wheel.attributes.needType?.value, "tire");
  assert.equal(wheel.attributes.tireItemType?.value, "Jant");
  assert.equal(wheel.subject.productType?.value, "Jant");

  const tire = understandRequest("225 45 R17 kış lastiği arıyorum Bursa");
  assert.equal(tire.attributes.needType?.value, "tire");
  assert.equal(tire.attributes.tireItemType?.value, "Lastik");
  assert.equal(tire.subject.productType?.value, "Lastik");
});

check("automotive free text routes service and accessory families", () => {
  const maintenance = understandRequest(
    "BMW 320d periyodik bakım yaptırmak istiyorum Ankara",
  );
  assert.equal(maintenance.category.value, "automotive");
  assert.equal(maintenance.attributes.needType?.value, "service");
  assert.equal(maintenance.identity.brand?.value, "BMW");
  assert.equal(maintenance.identity.model?.value, "320d");

  const tireService = understandRequest(
    "BMW için lastik değişimi yaptırmak istiyorum İstanbul",
  );
  assert.equal(tireService.attributes.needType?.value, "tire");
  assert.equal(tireService.subject.productType?.value, "Lastik değişimi");
  assert.deepEqual(
    listProfilesForCategory({
      categoryId: "automotive",
      needType: "tire",
      productType: "Lastik değişimi",
    })
      .map((profile) => profile.fieldKey)
      .filter((key) => !["needType", "city", "budget", "delivery"].includes(key)),
    ["tireQuantity", "serviceDate"],
  );

  const ppf = understandRequest(
    "BMW 320d için şeffaf PPF kaplama istiyorum İstanbul",
  );
  assert.equal(ppf.subject.productType?.value, "Koruma filmi / kaplama");
  assert.equal(ppf.attributes.needType?.value, "service");

  const towBar = understandRequest(
    "BMW 320d için çeki demiri arıyorum İstanbul",
  );
  assert.equal(towBar.subject.productType?.value, "Çeki demiri");
  assert.equal(towBar.requestSubject.kind.value, "ACCESSORY");

  const roofRack = understandRequest(
    "BMW 320d için tavan bagaj sistemi arıyorum İstanbul",
  );
  assert.equal(
    roofRack.subject.productType?.value,
    "Tavan / bagaj sistemleri",
  );
  assert.equal(roofRack.requestSubject.kind.value, "ACCESSORY");
});

check("automotive contracts suppress cross-need inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "automotive",
    needType: "tire",
    values: {
      needType: "tire",
      city: "İstanbul",
      budget: "100000",
    },
    candidates: [
      {
        fieldKey: "modelYear",
        label: "Model yılı",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 1,
        inputType: "number",
      },
      {
        fieldKey: "tireSize",
        label: "Lastik ebadı",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 1,
        inputType: "text",
      },
    ],
  });
  assert.ok(schedule.visible.some((question) => question.fieldKey === "tireSize"));
  assert.ok(!schedule.visible.some((question) => question.fieldKey === "modelYear"));
});

check("automotive PPF keeps its dedicated flow through the full chain", () => {
  const understanding = understandRequest("Şeffaf PPF kaplama istiyorum");
  const mapped = mapUnderstandingToFields(understanding);
  assert.equal(understanding.category.value, "automotive");
  assert.equal(understanding.attributes.needType?.value, "service");
  assert.equal(understanding.attributes.serviceType?.value, "Koruma filmi / kaplama");
  assert.equal(understanding.subject.productType?.value, "Koruma filmi / kaplama");
  assert.equal(mapped.productType?.value, "Koruma filmi / kaplama");
  assert.equal(mapped.color?.value, "Şeffaf");

  const state = buildCanonicalRequestState({
    understanding,
    lastUserAction: "text",
  });
  assert.ok(
    resolveBrowsePath(state).some(
      (item) => item.label === "Koruma filmi / kaplama",
    ),
  );

  const values = Object.fromEntries(
    Object.entries(mapped)
      .filter(([, field]) => field.kind === "VALUE")
      .map(([key, field]) => [key, String(field.value ?? "")]),
  );
  const seen = new Set<string>();
  const answered = new Set<string>();
  for (let i = 0; i < 10; i += 1) {
    const scheduled = scheduleComposerQuestions({
      categoryId: "automotive",
      needType: "service",
      candidates: [],
      values,
      answeredKeys: answered,
    });
    if (!scheduled.visible.length) break;
    for (const question of scheduled.visible) {
      seen.add(question.fieldKey);
      answered.add(question.fieldKey);
    }
  }
  for (const key of ["brand", "model"]) assert.ok(seen.has(key), key);
  assert.ok(!seen.has("color"));
  assert.ok(!seen.has("serviceType"));
  assert.ok(!seen.has("mileage"));
});

check("automotive part labels never absorb the detected location", () => {
  for (const text of [
    "Ön far arıyorum İstanbul",
    "on far ariyorum istanbul",
    "BMW 320d için ön far yedek parçası arıyorum İstanbul",
  ]) {
    const understanding = understandRequest(text);
    const mapped = mapUnderstandingToFields(understanding);
    const seeded = seedFieldValuesFromUnderstanding(understanding);
    assert.equal(mapped.part?.value, "ön far", text);
    assert.equal(seeded.part, "Ön Far", text);
    assert.ok(!String(mapped.part?.value).toLocaleLowerCase("tr-TR").includes("istanbul"), text);
    assert.ok(!String(seeded.part).toLocaleLowerCase("tr-TR").includes("istanbul"), text);
  }
  const path = resolveBrowsePath(
    buildCanonicalRequestState({
      understanding: understandRequest("Ön far arıyorum İstanbul"),
      lastUserAction: "text",
    }),
  );
  assert.ok(path.some((item) => item.label === "ön"));
  assert.ok(!path.some((item) => item.label === "ön sol"));
});

check("automotive understanding covers sparse, typo and ambiguous input", () => {
  const typoPart = understandRequest("on far ariyorum istanbul");
  assert.equal(typoPart.attributes.needType?.value, "part");
  assert.equal(typoPart.attributes.part?.value, "Ön far");

  const brandlessTire = understandRequest("lastik arıyorum");
  assert.equal(brandlessTire.attributes.needType?.value, "tire");
  assert.equal(brandlessTire.subject.productType?.value, "Lastik");

  const ambiguous = understandRequest("otomotiv ürünü arıyorum");
  assert.equal(ambiguous.category.value, "automotive");
  assert.equal(ambiguous.attributes.needType, undefined);
  assert.equal(ambiguous.requestSubject.kind.value, "PRODUCT");

  assert.equal(understandRequest("makam odası takımı arıyorum").category.value, "furniture");
  assert.equal(understandRequest("buzdolabı arıyorum").category.value, "appliances");
});

check("switching from tire to jant clears stale tire-only answers", () => {
  const lastik = createTextOnlyState("225 45 R17 kış lastiği arıyorum Bursa");
  assert.equal(lastik.fields.productType?.value, "Lastik");
  const withSeason = applyBrowseSelectionToState(lastik, {
    key: "tireSeason",
    value: "Kış",
  });
  const jant = applyBrowseSelectionToState(withSeason, {
    key: "tireItemType",
    value: "Jant",
  });
  assert.equal(jant.fields.productType?.value, "Jant");
  assert.ok(!jant.fields.tireSize || jant.fields.tireSize.kind === "UNKNOWN");
  assert.ok(!jant.fields.tireSeason || jant.fields.tireSeason.kind === "UNKNOWN");
  assert.ok(!jant.fields.serviceDate || jant.fields.serviceDate.kind === "UNKNOWN");
  const withDiameter = applyBrowseSelectionToState(jant, {
    key: "tireSize",
    value: "18",
  });
  assert.equal(withDiameter.fields.tireSize?.value, "18");
  const finalSummary = composeNaturalRequestText(jant);
  assert.match(finalSummary, /Jant/i);
  assert.doesNotMatch(finalSummary, /225\s*45|R17/i);
  const visible = listProfilesForCategory({
    categoryId: "automotive",
    needType: "tire",
    productType: "Jant",
  }).map((profile) => profile.fieldKey);
  assert.ok(!visible.includes("tireSeason"));
  const nextQuestions = scheduleComposerQuestions({
    categoryId: "automotive",
    needType: "tire",
    productType: "Jant",
    /* Bütçe + konum önce gelir (kurucu, 2026-09-12): kategori sorusu ancak
       ikisi kapandıktan sonra görünür; kontrol edilen iddia değişmedi. */
    values: {
      needType: "tire",
      productType: "Jant",
      budget: "25000",
      city: "İstanbul / Kadıköy",
    },
    candidates: [],
    answeredKeys: [],
  });
  assert.ok(nextQuestions.visible.some((question) => question.fieldKey === "tireSize"));
  assert.ok(visible.includes("condition"));
});

check("wheel diameter survives text edits after tire-to-wheel browse answers", () => {
  let state = createTextOnlyState("Lastik arıyorum");
  for (const [key, value] of [
    ["tireSize", "225/45 R17"],
    ["tireSeason", "Kış"],
    ["tireItemType", "Jant"],
    ["tireSize", "18"],
    ["tireQuantity", "4"],
  ]) {
    state = syncFromBrowse(state, { key, value }).state;
  }
  const edited = syncFromText(state, "4 adet 18 inç jant arıyorum");
  assert.equal(edited.skipped, false);
  assert.equal(edited.state.fields.tireSize?.value, "18");
  assert.match(edited.state.lastComposedText ?? "", /18 inç.*jant/i);
  assert.ok(!edited.state.fields.tireSeason || edited.state.fields.tireSeason.kind === "UNKNOWN");

  const answered = syncFromBrowse(edited.state, {
    key: "condition",
    value: "İkinci el",
  }).state;
  const reparsed = syncFromText(answered, answered.lastComposedText!, { force: true }).state;
  assert.equal(reparsed.fields.tireSize?.value, "18");
  assert.match(reparsed.lastComposedText ?? "", /18 inç.*ikinci el jant/i);
});

check("same wheel family preserves a diameter answer when editing other details", () => {
  const state = syncFromBrowse(createTextOnlyState("Jant arıyorum"), {
    key: "tireSize",
    value: "18",
  }).state;
  const edited = syncFromText(state, "İkinci el jant arıyorum").state;
  assert.equal(edited.fields.tireSize?.value, "18");
  assert.match(edited.lastComposedText ?? "", /18 inç.*jant/i);
  const schedule = scheduleComposerQuestions({
    categoryId: edited.categoryId!,
    needType: String(edited.fields.needType?.value),
    productType: String(edited.fields.productType?.value),
    values: toResolverFieldBag(edited),
    candidates: [],
    answeredKeys: Object.entries(edited.fields)
      .filter(([, field]) => field.kind === "VALUE")
      .map(([key]) => key),
  });
  assert.ok(!schedule.visible.some((question) => question.fieldKey === "tireSize"));
});

check("explicit wheel diameter edits replace the previous browse answer", () => {
  const state = syncFromBrowse(createTextOnlyState("Jant arıyorum"), {
    key: "tireSize",
    value: "18",
  }).state;
  const edited = syncFromText(state, "4 adet 19 inç jant arıyorum").state;
  assert.equal(edited.fields.tireSize?.value, "19");
  assert.match(edited.lastComposedText ?? "", /19 inç.*jant/i);
  assert.doesNotMatch(edited.lastComposedText ?? "", /18 inç/);
  assert.equal(createTextOnlyState("4 adet 19 inç jant arıyorum").fields.tireSize?.value, "19");
});

check("text switches from tires to wheels clear tire size but keep a new diameter", () => {
  let state = createTextOnlyState("Lastik arıyorum");
  state = syncFromBrowse(state, { key: "tireSize", value: "225/45 R17" }).state;
  state = syncFromBrowse(state, { key: "tireSeason", value: "Kış" }).state;
  const noDiameter = syncFromText(state, "Jant arıyorum").state;
  assert.ok(!noDiameter.fields.tireSize || noDiameter.fields.tireSize.kind === "UNKNOWN");
  assert.ok(!noDiameter.fields.tireSeason || noDiameter.fields.tireSeason.kind === "UNKNOWN");
  const withDiameter = syncFromText(state, "18 inç jant arıyorum").state;
  assert.equal(withDiameter.fields.tireSize?.value, "18");
  assert.match(withDiameter.lastComposedText ?? "", /18 inç.*jant/i);
  assert.doesNotMatch(withDiameter.lastComposedText ?? "", /225|R17|kış/i);
});

check("text switches from browsed wheels to tires update both family fields and summary", () => {
  let state = createTextOnlyState("Lastik arıyorum");
  for (const [key, value] of [
    ["tireItemType", "Jant"],
    ["tireSize", "18"],
    ["tireQuantity", "4"],
  ]) {
    state = syncFromBrowse(state, { key, value }).state;
  }
  const edited = syncFromText(state, "225/45 R17 kış lastiği arıyorum").state;
  assert.equal(edited.fields.productType?.value, "Lastik");
  assert.equal(edited.fields.tireItemType?.value, "Lastik");
  assert.equal(edited.fields.tireSize?.value, "225/45 R17");
  assert.equal(edited.fields.tireSeason?.value, "Kış");
  assert.match(edited.lastComposedText ?? "", /225\/45 R17.*kış.*lasti/i);
  assert.doesNotMatch(edited.lastComposedText ?? "", /jant|18 inç/i);

  const reparsed = syncFromText(edited, edited.lastComposedText!, { force: true }).state;
  assert.equal(reparsed.fields.tireItemType?.value, "Lastik");
  assert.equal(reparsed.fields.tireSize?.value, "225/45 R17");
  assert.doesNotMatch(reparsed.lastComposedText ?? "", /jant/i);
});

check("returning to tires asks for tire size instead of retaining wheel diameter", () => {
  let state = createTextOnlyState("Lastik arıyorum");
  state = syncFromBrowse(state, { key: "tireItemType", value: "Jant" }).state;
  state = syncFromBrowse(state, { key: "tireSize", value: "18" }).state;
  for (const [key, value] of [
    ["city", "İstanbul"],
    ["budget", "20000"],
    ["brand", "Michelin"],
    ["condition", "Sıfır"],
    ["tireQuantity", "4"],
  ]) {
    state = syncFromBrowse(state, { key, value }).state;
  }
  const edited = syncFromText(state, "Lastik arıyorum").state;
  assert.equal(edited.fields.productType?.value, "Lastik");
  assert.equal(edited.fields.tireItemType?.value, "Lastik");
  assert.ok(!edited.fields.tireSize || edited.fields.tireSize.kind === "UNKNOWN");
  assert.doesNotMatch(edited.lastComposedText ?? "", /jant|18/i);
  const schedule = scheduleComposerQuestions({
    categoryId: edited.categoryId!,
    needType: String(edited.fields.needType?.value),
    productType: String(edited.fields.productType?.value),
    values: toResolverFieldBag(edited),
    candidates: [],
    answeredKeys: [],
  });
  assert.ok(schedule.visible.some((question) => question.fieldKey === "tireSize"));
  const answered = syncFromBrowse(edited, { key: "tireSize", value: "205/55 R16" }).state;
  assert.equal(answered.fields.tireSize?.value, "205/55 R16");
  assert.match(answered.lastComposedText ?? "", /205\/55 R16.*lasti/i);
});

check("text can switch a browsed tire family to wheels and back", () => {
  let state = createTextOnlyState("Lastik arıyorum");
  state = syncFromBrowse(state, { key: "tireItemType", value: "Lastik" }).state;
  state = syncFromBrowse(state, { key: "tireSize", value: "225/45 R17" }).state;
  state = syncFromBrowse(state, { key: "tireSeason", value: "Kış" }).state;
  const wheel = syncFromText(state, "18 inç jant arıyorum").state;
  assert.equal(wheel.fields.productType?.value, "Jant");
  assert.equal(wheel.fields.tireItemType?.value, "Jant");
  assert.equal(wheel.fields.tireSize?.value, "18");
  assert.ok(!wheel.fields.tireSeason || wheel.fields.tireSeason.kind === "UNKNOWN");
  assert.match(wheel.lastComposedText ?? "", /18 inç.*jant/i);
  const tire = syncFromText(wheel, "205/55 R16 yaz lastiği arıyorum").state;
  assert.equal(tire.fields.productType?.value, "Lastik");
  assert.equal(tire.fields.tireItemType?.value, "Lastik");
  assert.equal(tire.fields.tireSize?.value, "205/55 R16");
  assert.match(tire.lastComposedText ?? "", /205\/55 R16.*yaz.*lasti/i);
  assert.doesNotMatch(tire.lastComposedText ?? "", /jant|18 inç|kış/i);
});

check("automotive final summaries keep the selected family and explicit constraints", () => {
  const jant = createTextOnlyState("Jant arıyorum");
  assert.match(composeNaturalRequestText(jant), /^Jant arıyorum\.$/i);
  assert.doesNotMatch(composeNaturalRequestText(jant), /Lastik arıyorum/i);

  const ppf = createTextOnlyState("Şeffaf PPF kaplama istiyorum");
  assert.equal(ppf.fields.color?.value, "Şeffaf");
  const ppfSummary = composeNaturalRequestText(ppf);
  assert.match(ppfSummary, /Şeffaf/i);
  assert.doesNotMatch(
    ppfSummary,
    /Koruma filmi \/ kaplama için Koruma filmi \/ kaplama/i,
  );
  const ppfWithBrand = applyBrowseSelectionToState(ppf, {
    key: "brand",
    value: "BMW",
  });
  assert.equal(
    composeNaturalRequestText(ppfWithBrand),
    "BMW için şeffaf PPF kaplama arıyorum.",
  );
  const ppfWithModel = applyBrowseSelectionToState(ppfWithBrand, {
    key: "model",
    value: "320d",
  });
  assert.equal(
    composeNaturalRequestText(ppfWithModel),
    "BMW 320d için şeffaf PPF kaplama arıyorum.",
  );

  const ambiguous = createTextOnlyState("Otomotiv ürünü arıyorum");
  assert.notEqual(ambiguous.subcategorySlug, "arac-satin-alma");
  assert.ok(
    !resolveBrowsePath(ambiguous).some((item) => item.label === "Araç Satın Alma"),
  );
  assert.doesNotMatch(composeNaturalRequestText(ambiguous), /Araç arıyorum/i);
  assert.match(composeNaturalRequestText(ambiguous), /otomotiv ürünü/i);

  const machinePart = createTextOnlyState("Torna tezgahı için yedek parça arıyorum");
  assert.equal(machinePart.categoryId, "machinery");
  assert.equal(
    composeNaturalRequestText(machinePart),
    "Torna tezgahı için yedek parça arıyorum.",
  );

  const graphic = createTextOnlyState("logo tasarımı arıyorum");
  assert.equal(graphic.categoryId, "services");
  assert.equal(
    composeNaturalRequestText(graphic),
    "Grafik ve logo tasarımı arıyorum.",
  );

  assert.equal(
    composeNaturalRequestText(createTextOnlyState("İkinci el araba almak istiyorum")),
    "ikinci el araç arıyorum.",
  );
  assert.equal(
    composeNaturalRequestText(createTextOnlyState("0 km SUV arıyorum bütçem 2 milyon TL")),
    "sıfır SUV arıyorum.",
  );
  const ambiguousValues = Object.fromEntries(
    Object.entries(ambiguous.fields)
      .filter(([, field]) => field.kind === "VALUE")
      .map(([key, field]) => [key, String(field.value ?? "")]),
  );
  const clarification = scheduleComposerQuestions({
    categoryId: "automotive",
    needType: null,
    /* Bütçe + konum önce gelir (kurucu, 2026-09-12): kategori sorusu ancak
       ikisi kapandıktan sonra görünür; kontrol edilen iddia değişmedi. */
    values: { ...ambiguousValues, budget: "25000", city: "İstanbul / Kadıköy" },
    candidates: [],
    answeredKeys: [],
  });
  assert.ok(clarification.visible.some((question) => question.fieldKey === "needType"));
});

check("automotive families produce final user-facing summaries", () => {
  const cases: Array<[string, string]> = [
    [
      "2020 model 3.20d beyaz BMW arıyorum",
      "2020 model BMW 3.20d beyaz ikinci el arıyorum.",
    ],
    [
      "BMW 320d için ön far yedek parçası arıyorum",
      "BMW 320d için ön far arıyorum.",
    ],
    [
      "BMW 320d periyodik bakım yaptırmak istiyorum",
      "BMW 320d için Periyodik bakım arıyorum.",
    ],
    [
      "225 45 R17 kış lastiği arıyorum",
      "225 45 R17 kış lastiği arıyorum.",
    ],
    [
      "BMW 320d için şeffaf PPF kaplama istiyorum",
      "BMW 320d için şeffaf PPF kaplama arıyorum.",
    ],
    [
      "BMW 320d için çeki demiri arıyorum",
      "BMW 320d için çeki demiri arıyorum.",
    ],
    [
      "BMW 320d için tavan bagaj sistemi arıyorum",
      "BMW 320d için tavan bagaj sistemi arıyorum.",
    ],
  ];
  for (const [raw, expected] of cases) {
    assert.equal(composeNaturalRequestText(createTextOnlyState(raw)), expected, raw);
  }

  let jant = createTextOnlyState("BMW için jant arıyorum");
  jant = applyBrowseSelectionToState(jant, {
    key: "tireSize",
    value: "18",
  });
  assert.equal(composeNaturalRequestText(jant), "BMW için 18 inç jant arıyorum.");
});

check("automotive end-to-end route matrix keeps family and breadcrumb aligned", () => {
  const cases: Array<{
    raw: string;
    subcategory: string;
    breadcrumb: string;
    summary: string;
  }> = [
    {
      raw: "2020 model 3.20d beyaz BMW arıyorum",
      subcategory: "arac-satin-alma",
      breadcrumb: "Araç Satın Alma",
      summary: "2020 model BMW 3.20d beyaz ikinci el arıyorum.",
    },
    {
      raw: "BMW 320d için ön far yedek parçası arıyorum",
      subcategory: "yedek-parca",
      breadcrumb: "Yedek Parça",
      summary: "BMW 320d için ön far arıyorum.",
    },
    {
      raw: "BMW 320d periyodik bakım yaptırmak istiyorum",
      subcategory: "arac-bakim",
      breadcrumb: "Araç Bakım",
      summary: "BMW 320d için Periyodik bakım arıyorum.",
    },
    {
      raw: "225 45 R17 kış lastiği arıyorum",
      subcategory: "lastik-ve-jant",
      breadcrumb: "Lastik ve Jant",
      summary: "225 45 R17 kış lastiği arıyorum.",
    },
    {
      raw: "BMW 320d için şeffaf PPF kaplama istiyorum",
      subcategory: "arac-bakim",
      breadcrumb: "Araç Bakım",
      summary: "BMW 320d için şeffaf PPF kaplama arıyorum.",
    },
    {
      raw: "BMW 320d için çeki demiri arıyorum",
      subcategory: "diger",
      breadcrumb: "Diğer",
      summary: "BMW 320d için çeki demiri arıyorum.",
    },
    {
      raw: "Tavan bagaj sistemi arıyorum",
      subcategory: "diger",
      breadcrumb: "Aksesuar",
      summary: "tavan bagaj sistemi arıyorum.",
    },
  ];

  for (const testCase of cases) {
    const state = createTextOnlyState(testCase.raw);
    const path = resolveBrowsePath(state);
    assert.equal(state.categoryId, "automotive", testCase.raw);
    assert.equal(state.subcategorySlug, testCase.subcategory, testCase.raw);
    assert.ok(path.some((entry) => entry.label === testCase.breadcrumb), testCase.raw);
    assert.equal(composeNaturalRequestText(state), testCase.summary, testCase.raw);
  }
});

check("automotive service and accessory corrections survive the final summary", () => {
  let tireService = createTextOnlyState("Lastik değişimi yaptırmak istiyorum");
  tireService = applyBrowseSelectionToState(tireService, {
    key: "tireQuantity",
    value: "4",
  });
  tireService = applyBrowseSelectionToState(tireService, {
    key: "serviceDate",
    value: "15 Eylül",
  });
  const tireServiceSummary = composeNaturalRequestText(tireService);
  assert.match(tireServiceSummary, /lastik değişimi/i);
  assert.match(tireServiceSummary, /4 adet/i);
  assert.match(tireServiceSummary, /15 Eylül/i);
  assert.doesNotMatch(tireServiceSummary, /lastiği arıyorum\.$/i);

  let maintenance = createTextOnlyState(
    "BMW 320d periyodik bakım yaptırmak istiyorum",
  );
  maintenance = applyBrowseSelectionToState(maintenance, {
    key: "serviceType",
    value: "Fren bakımı",
  });
  assert.equal(
    composeNaturalRequestText(maintenance),
    "BMW 320d için Fren bakımı arıyorum.",
  );

  const roof = createTextOnlyState("Tavan bagaj sistemi arıyorum");
  assert.equal(roof.categoryId, "automotive");
  assert.equal(roof.subcategorySlug, "diger");
  assert.equal(
    roof.taxonomyNodeId,
    "tax:automotive:diger:diger-otomotiv:aksesuar:tavan-bagaj-sistemleri",
  );
  const roofPathLabels = resolveBrowsePath(roof).map((entry) => entry.label);
  assert.ok(roofPathLabels.includes("Aksesuar"));
  assert.ok(roofPathLabels.includes("Tavan / bagaj sistemleri"));
  assert.equal(
    composeNaturalRequestText(roof),
    "tavan bagaj sistemi arıyorum.",
  );

  let wheel = createTextOnlyState("BMW için jant arıyorum");
  wheel = applyBrowseSelectionToState(wheel, {
    key: "tireSize",
    value: "18",
  });
  wheel = applyBrowseSelectionToState(wheel, {
    key: "tireQuantity",
    value: "4",
  });
  wheel = applyBrowseSelectionToState(wheel, {
    key: "condition",
    value: "İkinci el",
  });
  assert.equal(
    composeNaturalRequestText(wheel),
    "BMW için 4 adet, 18 inç, ikinci el jant arıyorum.",
  );
});

check("home support requests stay in services and ask the right four questions", () => {
  const helperQueries = [
    "ev yardımcısı arıyorum",
    "evde hizmetli arıyorum",
    "ev işleri yardımcısı arıyorum",
  ];
  for (const raw of helperQueries) {
    const understanding = understandRequest(raw);
    assert.equal(understanding.category.value, "services", raw);
    assert.notEqual(understanding.category.value, "real-estate", raw);
    assert.equal(
      understanding.attributes.serviceType?.value,
      "Ev yardımcısı / ev hizmetlisi",
      raw,
    );
    const state = createTextOnlyState(raw);
    assert.equal(state.categoryId, "services", raw);
    assert.equal(
      composeNaturalRequestText(state),
      "Ev yardımcısı / ev hizmetlisi arıyorum.",
      raw,
    );
  }

  const helperFields = listProfilesForCategory({
    categoryId: "services",
    needType: "service",
    productType: "Ev yardımcısı / ev hizmetlisi",
  })
    .map((profile) => profile.fieldKey)
    .filter((key) => key.startsWith("homeHelper"));
  assert.deepEqual(helperFields, [
    "homeHelperScope",
    "homeHelperSchedule",
    "homeHelperDuration",
    "homeHelperStart",
  ]);

  for (const raw of [
    "yaşlı bakım yardımcısı arıyorum",
    "hasta bakıcısı arıyorum",
  ]) {
    const understanding = understandRequest(raw);
    assert.equal(understanding.category.value, "services", raw);
    assert.equal(
      understanding.attributes.serviceType?.value,
      "Evde bakım desteği",
      raw,
    );
    const careFields = listProfilesForCategory({
      categoryId: "services",
      needType: "service",
      productType: "Evde bakım desteği",
    })
      .map((profile) => profile.fieldKey)
      .filter((key) => key.startsWith("homeCare"));
    assert.deepEqual(careFields, [
      "homeCareSupportScope",
      "homeCareSchedule",
      "homeCareDuration",
      "homeCareStart",
    ]);
  }

  const ambiguous = createTextOnlyState("yardımcı arıyorum");
  assert.equal(ambiguous.categoryId, "services");
  const values = Object.fromEntries(
    Object.entries(ambiguous.fields)
      .filter(([, field]) => field.kind === "VALUE")
      .map(([key, field]) => [key, String(field.value ?? "")]),
  );
  const clarification = scheduleComposerQuestions({
    categoryId: "services",
    needType: "service",
    /* Bütçe + konum önce gelir (kurucu, 2026-09-12): kategori sorusu ancak
       ikisi kapandıktan sonra görünür; kontrol edilen iddia değişmedi. */
    values: { ...values, budget: "25000", city: "İstanbul / Kadıköy" },
    fieldStates: ambiguous.fields,
    candidates: [],
    answeredKeys: [],
  });
  assert.ok(
    clarification.visible.some((question) => question.fieldKey === "serviceType"),
  );
});

check("health aliases and removed medical testing do not cross-route", () => {
  const pressureMonitor = understandRequest("Tansiyon ölçer arıyorum");
  assert.equal(pressureMonitor.category.value, "health");
  assert.equal(pressureMonitor.requestSubject.name?.value, "tansiyon ölçer");
  const pressureState = createTextOnlyState("Tansiyon ölçer arıyorum");
  assert.equal(pressureState.categoryId, "health");
  assert.equal(pressureState.subcategorySlug, "medikal-cihaz");
  assert.equal(pressureState.fields.productType?.value, "Tansiyon ölçer");

  for (const raw of [
    "Tıbbi test yaptırmak istiyorum",
    "Tıbbi test arıyorum",
  ]) {
    const removed = understandRequest(raw);
    assert.equal(removed.requestScope.value, "UNSUPPORTED_REMOVED_SCOPE", raw);
    assert.equal(removed.category.value, null, raw);
    assert.equal(removed.subject.kind.value, null, raw);
    assert.equal(removed.attributes.needType, undefined, raw);
    assert.equal(removed.attributes.serviceType, undefined, raw);

    const removedState = createTextOnlyState(raw);
    assert.equal(removedState.categoryId, null, raw);
    assert.doesNotMatch(removedState.lastComposedText, /servis arıyorum/i, raw);
    assert.match(removedState.lastComposedText, /tıbbi test/i, raw);
  }

  const medicalDevice = understandRequest("Tıbbi test cihazı arıyorum");
  assert.notEqual(medicalDevice.requestScope.value, "UNSUPPORTED_REMOVED_SCOPE");
});

check("furniture product contracts ask only their own questions", () => {
  const keysFor = (productType: string) =>
    new Set(
      listProfilesForCategory({ categoryId: "furniture", productType }).map(
        (profile) => profile.fieldKey,
      ),
    );

  const executive = keysFor("Makam / yönetici masa takımı");
  assert.ok(executive.has("executiveDeskConfiguration"));
  assert.ok(executive.has("cableManagement"));
  assert.ok(!executive.has("bedSize"));
  assert.ok(!executive.has("diningSeats"));

  const meeting = keysFor("Toplantı masası");
  assert.ok(meeting.has("meetingCapacity"));
  assert.ok(meeting.has("meetingTableShape"));
  assert.ok(!meeting.has("bedSize"));

  const chair = keysFor("Ofis sandalyesi");
  assert.ok(chair.has("officeChairMechanism"));
  assert.ok(chair.has("officeChairErgonomics"));
  assert.ok(!chair.has("bedSize"));

  const officeChair = keysFor("Ofis koltuğu");
  assert.ok(officeChair.has("officeChairMechanism"));
  assert.ok(officeChair.has("officeChairErgonomics"));
});

check("furniture contracts suppress irrelevant inferred candidates", () => {
  const schedule = scheduleComposerQuestions({
    categoryId: "furniture",
    values: {
      furnitureType: "Makam / yönetici masa takımı",
      city: "İstanbul",
      budget: "100000",
      delivery: "2 hafta",
    },
    candidates: [
      {
        fieldKey: "bedSize",
        label: "Yatak boyutu",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 1,
        inputType: "select",
      },
      {
        fieldKey: "executiveDeskConfiguration",
        label: "Takım içeriği",
        reason: "test",
        publishImpact: 0,
        matchingImpact: 0,
        priceImpact: 0,
        confidenceImpact: 0,
        priorityScore: 1,
        inputType: "select",
      },
    ],
  });
  assert.ok(
    schedule.visible.some(
      (question) => question.fieldKey === "executiveDeskConfiguration",
    ),
  );
  assert.ok(!schedule.visible.some((question) => question.fieldKey === "bedSize"));
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
