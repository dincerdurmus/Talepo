/**
 * Understanding invariant sweep — class-level guards over the REAL pipeline.
 *
 * Purpose: Dinçer should never have to find these by hand. Every bug class he
 * reported becomes an invariant here, checked across many realistic Turkish
 * inputs (canonical, diacritic-free and ALL-CAPS spellings alike):
 *
 *   I1  No intent/commission verb may survive as brand, model or product.
 *   I2  No product-type phrase may be labeled as a model.
 *   I3  Category must not be "services" when a confident product detector
 *       fired for a manufacture request (kartvizit yaptırmak ≠ Hizmetler).
 *   I4  ALL-CAPS and diacritic-free inputs must resolve like canonical ones.
 *   I5  Brand values must come from the catalog (canonical spelling), and a
 *       brand the user typed must be recognized as EXPLICIT.
 *   I6  The understood-facts board must never render duplicate label+value
 *       rows, and displayed values keep Turkish diacritics.
 *   I7  An explicit browse/question answer survives a text re-sync when the
 *       conflicting phrase in the text did not change.
 *
 * Synthetic only: no DB, no network, no notifications.
 */
import assert from "node:assert/strict";

import {
  getVisibleCategoryFields,
  REQUEST_CATEGORIES,
} from "../src/lib/request-category-engine";
import { getBrowseChildren } from "../src/lib/knowledge/browse";
import {
  babyBrandsForProductName,
  furnitureBrandsForProduct,
  furnitureBrandsForSegment,
  inferFurnitureSegment,
  kitchenBrandsForProductName,
  machineryBrandsForFamily,
} from "../src/lib/knowledge/harvest-brands";
import { brandsForProductName } from "../src/lib/knowledge/product-brands";
import { resolveRequestSchema } from "../src/lib/knowledge/request-schema";
import {
  createNotMeasuredTally,
  isUnreachableDatabase,
  NOT_MEASURED_EXIT,
} from "../src/lib/verification/not-measured";
import {
  canWriteToDatabase,
  databaseHost,
} from "../src/lib/verification/db-guard";
import {
  ensureTaxonomyLoaded,
  listAllTaxonomyNodes,
} from "../src/lib/taxonomy";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { isProductTypePhrase } from "../src/lib/product-identity/identity-candidates";
import { enrichUnderstoodFacts } from "../src/lib/request-composer/v2/understood-facts";
import { mergePreservedBrowseFields } from "../src/lib/request-composer/build-state";
import { scheduleNextQuestions } from "../src/lib/request-composer/v2/question-scheduler";
import {
  applyBrowseSelectionToState,
  buildUnderstoodFacts,
  composeNaturalRequestText,
  syncFromText,
  syncFromBrowse,
} from "../src/lib/request-composer";

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    passed += 1;
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(err);
  }
}

const FOLD: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};
function fold(s: string): string {
  let out = "";
  for (const ch of s.toLocaleLowerCase("tr-TR")) out += FOLD[ch] ?? ch;
  return out;
}

type Res = Record<string, never>;
function ru(raw: string) {
  return understandRequest({ rawInput: raw }) as never as Res;
}
function catOf(r: Res): string | null {
  return ((r as never)["category"] as Record<string, unknown>)["value"] as
    | string
    | null;
}
function identityOf(r: Res) {
  return ((r as never)["identity"] ?? {}) as Record<
    string,
    { value?: unknown } | undefined
  >;
}

/** Verbs & conversation words that must never become a value. */
const FORBIDDEN_VALUE_TOKENS = [
  "almak", "satmak", "aramak", "bakmak", "bulmak", "kiralamak",
  "yaptırmak", "yaptirmak", "bastırmak", "bastirmak", "ürettirmek",
  "istiyorum", "arıyorum", "ariyorum", "lazım", "lazim", "gerek",
];

/** Broad, realistic sweep corpus — canonical / ASCII / CAPS variants. */
const SWEEP: string[] = [
  "Arçelik 55 inç televizyon almak istiyorum",
  "arcelik 55 inc tv",
  "ARÇELİK 55 İNÇ TELEVİZYON ALMAK İSTİYORUM",
  "kartvizit yaptırmak istiyorum",
  "KARTVİZİT YAPTIRMAK İSTİYORUM",
  "1000 adet kartvizit bastırmak istiyorum",
  "logolu kutu yaptırmak istiyorum",
  "ikinci el dyson hava temizleyicisi arıyorum",
  "dyson hava temizleyicisi",
  "robot süpürge arıyorum",
  "robot supurge ariyorum",
  "vestel çamaşır makinesi almak istiyorum",
  "samsung buzdolabı arıyorum",
  "50 ofis sandalyesi lazım acil İstanbul",
  "2+1 kiralık daire Bağcılar",
  "3+1 kiralık ev arıyorum ankara civarı",
  "klima montajı yaptırmak istiyorum",
  "ev boyatmak istiyorum",
  "Heidelberg SM 74 için nemlendirme pompası lazım",
  "iphone 15 pro max almak istiyorum",
  "makarna makinesi bakıyorum",
  "hava nemlendirici arıyorum",
  "saç kurutma makinesi",
  "bulaşık makinesi tamiri",
  "broşür bastırmak istiyorum 5000 adet",
  // MediaMarkt envanterinden eklenen markalar (2026-08-22)
  "canon fotoğraf makinesi almak istiyorum",
  "jbl bluetooth hoparlör arıyorum",
  "KARCHER HALI YIKAMA MAKİNESİ",
  "logitech kablosuz mouse",
  "nespresso kahve makinesi kapsüllü",
];

check("I8: MediaMarkt-sourced brands resolve with correct category", () => {
  for (const [raw, wantCat, wantBrand] of [
    ["canon fotoğraf makinesi almak istiyorum", "technology", "Canon"],
    ["jbl bluetooth hoparlör arıyorum", "technology", "JBL"],
    ["karcher halı yıkama makinesi", "appliances", "Kärcher"],
    ["KARCHER HALI YIKAMA", "appliances", "Kärcher"],
    ["braun tıraş makinesi", "appliances", "Braun"],
    ["nespresso kahve makinesi kapsüllü", "home-kitchen", "Nespresso"],
  ] as const) {
    const r = ru(raw);
    assert.equal(catOf(r), wantCat, raw);
    assert.equal(identityOf(r).brand?.value, wantBrand, raw);
  }
});

/* ================= I1 + I2 + I5 — value hygiene over the sweep ============ */

check("I1: no verb/conversation token survives as brand/model/product", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const r = ru(raw);
    const idn = identityOf(r);
    for (const key of ["brand", "model", "series"]) {
      const v = idn[key]?.value;
      if (v == null) continue;
      const f = fold(String(v));
      for (const tok of FORBIDDEN_VALUE_TOKENS) {
        if (f === fold(tok)) bad.push(`${raw} → ${key}=${String(v)}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

check("I2: no product-type phrase is labeled as a model", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const r = ru(raw);
    const model = identityOf(r).model?.value;
    if (model == null) continue;
    if (isProductTypePhrase(String(model))) {
      bad.push(`${raw} → model=${String(model)}`);
    }
  }
  assert.deepEqual(bad, []);
});

check("I2c: composer fields.model never carries a product-type phrase", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const { state } = syncFromText(null, raw);
    const model = state.fields.model?.value;
    if (model == null) continue;
    if (isProductTypePhrase(String(model))) {
      bad.push(`${raw} → fields.model=${String(model)}`);
    }
  }
  assert.deepEqual(bad, []);
  // Real model codes must survive the same gate.
  const heidelberg = syncFromText(
    null,
    "Heidelberg SM 74 için nemlendirme pompası lazım",
  );
  assert.equal(String(heidelberg.state.fields.model?.value ?? ""), "SM 74");
});

check("I2b: instrument-noun morphology counts as product type", () => {
  for (const phrase of [
    "hava temizleyicisi",
    "temizleyici",
    "nemlendirici",
    "hava nemlendiricisi",
  ]) {
    assert.ok(isProductTypePhrase(phrase), phrase);
  }
  // Real model codes must NOT be swallowed by the suffix rule.
  for (const code of ["DCD996", "SM 74", "C180", "A55", "V15 Detect"]) {
    assert.ok(!isProductTypePhrase(code), code);
  }
});

/* ================= I3 — manufacture vs services =========================== */

check("I3: printed goods with 'yaptırmak' stay in printing, services stay services", () => {
  for (const [raw, want] of [
    ["kartvizit yaptırmak istiyorum", "printing"],
    ["KARTVİZİT YAPTIRMAK İSTİYORUM", "printing"],
    ["logolu kutu yaptırmak istiyorum", "printing"],
    ["1000 adet kartvizit bastırmak istiyorum", "printing"],
    ["klima montajı yaptırmak istiyorum", "services"],
    ["ev boyatmak istiyorum", "services"],
  ] as const) {
    assert.equal(catOf(ru(raw)), want, raw);
  }
});

/* ================= I4 — spelling robustness =============================== */

check("I4: ALL-CAPS and ASCII spellings resolve to the same category", () => {
  const trios: Array<[string, string, string]> = [
    [
      "Arçelik 55 inç televizyon almak istiyorum",
      "arcelik 55 inc tv almak istiyorum",
      "ARÇELİK 55 İNÇ TELEVİZYON ALMAK İSTİYORUM",
    ],
    [
      "kartvizit yaptırmak istiyorum",
      "kartvizit yaptirmak istiyorum",
      "KARTVİZİT YAPTIRMAK İSTİYORUM",
    ],
    [
      "robot süpürge arıyorum",
      "robot supurge ariyorum",
      "ROBOT SÜPÜRGE ARIYORUM",
    ],
  ];
  for (const [a, b, c] of trios) {
    const ca = catOf(ru(a));
    assert.ok(ca, a);
    assert.equal(catOf(ru(b)), ca, `${b} ≠ ${a}`);
    assert.equal(catOf(ru(c)), ca, `${c} ≠ ${a}`);
  }
});

check("I4b: user-typed brand is EXPLICIT regardless of spelling", () => {
  for (const raw of [
    "Arçelik 55 inç televizyon almak istiyorum",
    "arcelik 55 inc tv",
    "ARÇELİK TELEVİZYON",
  ]) {
    const idn = identityOf(ru(raw));
    assert.equal(idn.brand?.value, "Arçelik", raw);
    assert.equal(
      (idn.brand as { provenance?: string } | undefined)?.provenance,
      "EXPLICIT",
      raw,
    );
  }
});

/* ================= I5 — brand canonicalization ============================ */

check("I5: brand values are canonical catalog spellings", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const v = identityOf(ru(raw)).brand?.value;
    if (v == null) continue;
    const s = String(v);
    // Canonical entries start uppercase and are not shouting.
    if (s === s.toLocaleUpperCase("tr-TR") && s.length > 3) {
      bad.push(`${raw} → brand=${s}`);
    }
  }
  assert.deepEqual(bad, []);
});

/* ================= I6 — understood-facts board hygiene ==================== */

function boardFor(raw: string) {
  const { state } = syncFromText(null, raw);
  const facts = enrichUnderstoodFacts({
    facts: buildUnderstoodFacts(state),
    understanding: state.understanding,
    categoryId: state.categoryId,
  });
  return facts;
}

check("I6: board never renders duplicate label+value rows", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const rows = boardFor(raw);
    const seen = new Set<string>();
    for (const row of rows) {
      const id = `${row.label}::${fold(row.displayValue)}`;
      if (seen.has(id)) bad.push(`${raw} → ${row.label}: ${row.displayValue}`);
      seen.add(id);
    }
  }
  assert.deepEqual(bad, []);
});

check("I6b: displayed values keep Turkish diacritics for known words", () => {
  const rows = boardFor("robot süpürge arıyorum");
  const flat = rows.map((r) => r.displayValue).join(" | ");
  assert.ok(
    !/supurge/i.test(flat),
    `diacritic-stripped display leaked: ${flat}`,
  );
});

/* ================= I7 — explicit answer beats stale text ================== */

check("I7: unchanged text phrase cannot clobber an explicit answer", () => {
  // Same precedence class Dinçer hit with city ("ankara" in text kept beating
  // his chosen city). `fields` carries brand through the exact same merge, so
  // the invariant is exercised on brand end-to-end.
  // 1) User writes text containing "arçelik"
  const first = syncFromText(null, "arçelik televizyon almak istiyorum");
  assert.equal(
    String(first.state.fields.brand?.value ?? ""),
    "Arçelik",
    "precondition: text extracted Arçelik",
  );
  // 2) User answers the brand question with Vestel (browse/question path)
  const answered = syncFromBrowse(first.state, {
    key: "brand",
    value: "Vestel",
    isAny: false,
  });
  assert.equal(String(answered.state.fields.brand?.value ?? ""), "Vestel");
  // 3) User touches the text again — same "arçelik" phrase still inside
  const resynced = syncFromText(
    answered.state,
    "arçelik televizyon almak istiyorum acil",
    { force: true },
  );
  assert.equal(
    String(resynced.state.fields.brand?.value ?? ""),
    "Vestel",
    "stale 'arçelik' in the text clobbered the explicit answer",
  );
  // 4) But a REAL text change to the brand is a new statement and must win
  const retyped = syncFromText(
    answered.state,
    "samsung televizyon almak istiyorum",
    { force: true },
  );
  assert.equal(
    String(retyped.state.fields.brand?.value ?? ""),
    "Samsung",
    "a genuinely retyped brand must override the old answer",
  );
});

check("I7b: merge helper honors rawInputs contract directly", () => {
  const browseCity = {
    kind: "VALUE" as const,
    value: "İzmir",
    provenance: "EXPLICIT_BROWSE" as const,
    confidence: 1,
    evidence: ["user-answer"],
  };
  const textCity = {
    kind: "VALUE" as const,
    value: "Ankara",
    provenance: "EXPLICIT_TEXT" as const,
    confidence: 0.9,
    evidence: ["ankara"],
  };
  const merged = mergePreservedBrowseFields(
    { city: textCity },
    { city: browseCity },
    "text",
    { previous: "ev arıyorum ankara civarı", current: "ev arıyorum ankara civarı acil" },
  );
  assert.equal(merged.city?.value, "İzmir", "stale restatement must not win");

  const fresh = mergePreservedBrowseFields(
    { city: textCity },
    { city: browseCity },
    "text",
    { previous: "ev arıyorum izmir tarafı", current: "ev arıyorum ankara civarı" },
  );
  assert.equal(fresh.city?.value, "Ankara", "newly typed value must win");
});

/* ================= I9 — product → question mapping ======================== */

function scheduledKeys(
  categoryId: string,
  productType: string | null,
): Set<string> {
  // Drain the whole queue past the ≤3 visibility cap: keep marking visible
  // questions answered until nothing new appears (optionals surface only
  // after criticals are satisfied).
  const keys = new Set<string>();
  for (let round = 0; round < 6; round += 1) {
    const result = scheduleNextQuestions({
      categoryId,
      productType,
      hybridCandidates: [],
      values: {},
      answeredKeys: [...keys],
    });
    let grew = false;
    for (const q of result.visible) {
      if (!keys.has(q.fieldKey)) {
        keys.add(q.fieldKey);
        grew = true;
      }
    }
    if (!grew) break;
  }
  return keys;
}

check("I9: each product family gets its own questions and nobody else's", () => {
  const cases: Array<{
    cat: string;
    product: string | null;
    must: string[];
    never: string[];
  }> = [
    { cat: "technology", product: "Televizyon", must: ["screenSize"], never: ["btu", "vacuumType", "coffeeType"] },
    { cat: "technology", product: "Laptop", must: ["usagePurpose"], never: ["screenSize", "btu"] },
    { cat: "technology", product: "Kulaklık", must: ["headphoneType"], never: ["screenSize"] },
    { cat: "technology", product: "Fotoğraf Makinesi", must: ["cameraType"], never: ["screenSize", "usagePurpose"] },
    { cat: "technology", product: null, must: [], never: ["screenSize", "storageCapacity", "usagePurpose"] },
    { cat: "appliances", product: "Klima", must: ["btu"], never: ["screenSize", "vacuumType", "capacityKg"] },
    { cat: "appliances", product: "Robot Süpürge", must: ["vacuumType"], never: ["screenSize", "btu"] },
    { cat: "appliances", product: "Hava Temizleme Cihazı", must: ["usageArea"], never: ["screenSize", "btu"] },
    { cat: "appliances", product: "Çamaşır Makinesi", must: ["capacityKg"], never: ["btu", "screenSize"] },
    { cat: "appliances", product: "Buzdolabı", must: ["fridgeType"], never: ["screenSize", "capacityKg"] },
    { cat: "appliances", product: null, must: [], never: ["screenSize", "btu", "vacuumType"] },
    { cat: "home-kitchen", product: "Kahve Makinesi", must: ["coffeeType"], never: ["btu", "screenSize"] },
    // Matbaaloji ailesi (2026-08-22)
    { cat: "printing", product: "Kartvizit", must: ["quantity", "lamination"], never: ["printSize", "pageCount", "btu"] },
    { cat: "printing", product: "Broşür", must: ["quantity", "printSize", "paperWeight"], never: ["pageCount", "btu"] },
    { cat: "printing", product: "Afiş", must: ["quantity", "printSize"], never: ["paperWeight", "lamination", "pageCount"] },
    { cat: "printing", product: "Katalog", must: ["quantity", "pageCount", "lamination"], never: ["printSize", "paperWeight"] },
    { cat: "printing", product: null, must: [], never: ["lamination", "printSize", "paperWeight", "pageCount"] },
    // Emlak/hizmet: marka-model asla sorulmaz (kurucu geri bildirimi, 2026-08-23)
    { cat: "real-estate", product: null, must: [], never: ["brand", "model"] },
    { cat: "services", product: null, must: [], never: ["brand", "model"] },
    // Emlak tipi matrisi: arsaya konut sorusu asla (kurucu, 2026-08-23)
    { cat: "real-estate", product: "İmarlı arsa", must: [], never: ["roomCount", "heating", "totalFloors", "bathroomCount", "furnished", "elevator", "brand", "model"] },
    { cat: "real-estate", product: "Tarla", must: [], never: ["roomCount", "heating", "totalFloors", "bathroomCount"] },
    { cat: "real-estate", product: "Daire", must: ["roomCount"], never: ["brand", "model"] },
    // e-bebek ailesi (2026-08-22)
    { cat: "baby", product: "Bebek Arabası", must: ["strollerType"], never: ["carSeatGroup", "diaperSize", "bedSize"] },
    { cat: "baby", product: "Oto Koltuğu", must: ["carSeatGroup"], never: ["strollerType", "diaperSize"] },
    { cat: "baby", product: "Bebek Bezi", must: ["diaperSize"], never: ["strollerType", "carSeatGroup"] },
    { cat: "baby", product: null, must: [], never: ["strollerType", "carSeatGroup", "diaperSize"] },
    // Koçtaş mobilya ailesi (2026-08-22)
    { cat: "furniture", product: "Çift Kişilik Yatak", must: ["bedSize"], never: ["wardrobeType", "seatingType", "btu"] },
    { cat: "furniture", product: "Sürgülü Gardırop", must: ["wardrobeType"], never: ["bedSize", "seatingType"] },
    { cat: "furniture", product: "Köşe Koltuk", must: ["seatingType"], never: ["bedSize", "wardrobeType"] },
    { cat: "furniture", product: "Yemek Masası", must: ["diningSeats"], never: ["bedSize", "seatingType"] },
    { cat: "furniture", product: "Ofis Sandalyesi", must: [], never: ["bedSize", "wardrobeType", "seatingType", "diningSeats"] },
    // Makinecim ailesi (2026-08-22)
    { cat: "machinery", product: "Jeneratör", must: ["generatorPower", "condition"], never: ["liftCapacity", "compressorType", "btu"] },
    { cat: "machinery", product: "Forklift", must: ["liftCapacity", "condition"], never: ["generatorPower", "toolPower"] },
    { cat: "machinery", product: "Kompresör", must: ["compressorType", "condition"], never: ["generatorPower", "liftCapacity"] },
    // Bauhaus ailesi (2026-08-22)
    { cat: "machinery", product: "Akülü Matkap", must: ["toolPower"], never: ["btu", "screenSize", "coffeeType"] },
    { cat: "machinery", product: "Çim Biçme Makinesi", must: ["mowerType"], never: ["toolPower", "btu"] },
    { cat: "home-kitchen", product: "Mangal", must: ["grillType"], never: ["coffeeType", "btu"] },
    { cat: "machinery", product: null, must: [], never: ["toolPower", "mowerType", "paintScope"] },
  ];
  const bad: string[] = [];
  for (const c of cases) {
    const keys = scheduledKeys(c.cat, c.product);
    for (const k of c.must) {
      if (!keys.has(k)) bad.push(`${c.cat}/${c.product} soru EKSİK: ${k}`);
    }
    for (const k of c.never) {
      if (keys.has(k)) bad.push(`${c.cat}/${c.product} alakasız soru: ${k}`);
    }
  }
  assert.deepEqual(bad, []);
});

check("I9b: product-scoped questions ship one-tap options", () => {
  const result = scheduleNextQuestions({
    categoryId: "appliances",
    productType: "Klima",
    hybridCandidates: [],
    values: {},
  });
  const btu = result.visible.find((q) => q.fieldKey === "btu");
  assert.ok(btu, "btu question missing");
  assert.ok(
    (btu.quickChoices?.length ?? 0) >= 3,
    "btu question has no quick choices",
  );
});

check("I10: engine fields are product-scoped — a TV is never asked computer specs", () => {
  const tech = REQUEST_CATEGORIES.find((c) => c.id === "technology")!;
  const fieldsFor = (productType: string) =>
    getVisibleCategoryFields(
      tech.fields,
      { needType: "hardware", productType },
      "technology",
    ).map((f) => f.key);

  const tv = fieldsFor("Televizyon");
  for (const key of ["ram", "processor", "storage", "graphics", "quantityDetail"]) {
    assert.ok(!tv.includes(key), `TV alanlarında '${key}' olmamalı: ${tv.join(",")}`);
  }
  const pc = fieldsFor("Oyun Bilgisayarı Laptop");
  for (const key of ["ram", "processor", "storage", "graphics"]) {
    assert.ok(pc.includes(key), `Bilgisayar alanlarında '${key}' olmalı: ${pc.join(",")}`);
  }
  // Ürün algılanmadıysa bilgisayar soruları görünmez (sıkı varsayılan)
  const unknown = fieldsFor("");
  for (const key of ["ram", "processor", "storage", "graphics"]) {
    assert.ok(!unknown.includes(key), `Ürünsüz akışta '${key}' olmamalı`);
  }

  // Emlak: bina soruları yalnız yapılı tiplerde — arsada asla
  const re = REQUEST_CATEGORIES.find((c) => c.id === "real-estate")!;
  const reFieldsFor = (propertyType: string) =>
    getVisibleCategoryFields(
      re.fields,
      { listingType: "Satılık", propertyType },
      "real-estate",
    ).map((f) => f.key);
  const arsa = reFieldsFor("İmarlı arsa");
  for (const key of ["heating", "totalFloors", "bathroomCount", "furnished", "elevator", "parking", "grossArea", "netArea", "roomCount"]) {
    assert.ok(!arsa.includes(key), `Arsa alanlarında '${key}' olmamalı: ${arsa.join(",")}`);
  }
  const daire = reFieldsFor("Daire");
  for (const key of ["heating", "roomCount"]) {
    assert.ok(daire.includes(key), `Daire alanlarında '${key}' olmalı: ${daire.join(",")}`);
  }
});

check("I11: browse — Donanım hoisted out, brand columns product-relevant", () => {
  const kids = getBrowseChildren("technology", {
    categoryId: "technology",
    subcategorySlug: null,
  });
  const labels = kids.map((k) => k.label);
  assert.ok(!labels.includes("Donanım"), `Donanım hâlâ ağaçta: ${labels.join(",")}`);
  for (const mustHave of ["TV ve görüntü", "Bilgisayar", "Fotoğraf ve Kamera"]) {
    assert.ok(labels.includes(mustHave), `'${mustHave}' Teknoloji altında olmalı: ${labels.join(",")}`);
  }
  // Hoist edilen gruplar şema slug'unu taşır — Donanım sözleşmesi bozulmaz
  const tvGroup = kids.find((k) => k.label === "TV ve görüntü");
  assert.equal(tvGroup?.meta?.subcategorySlug, "donanim");

  // Marka kolonu ürünün KENDİ pazarından gelir (MediaMarkt dağılımı) ve
  // veri yoksa hiç açılmaz — megafona kulaklık markası çıkmaz
  // (kurucu, 2026-08-23).
  const tv = brandsForProductName("Televizyon");
  const mic = brandsForProductName("Mikrofon");
  assert.ok(tv && tv[0] === "Samsung", `TV markaları pazar sıralı olmalı: ${tv}`);
  assert.ok(mic && mic.includes("Hyperx"), `mikrofon markaları kendi pazarı olmalı: ${mic}`);
  assert.notEqual(
    JSON.stringify(tv),
    JSON.stringify(mic),
    "televizyon ve mikrofon aynı marka listesini alamaz",
  );
  assert.equal(
    brandsForProductName("Megafonlar"),
    null,
    "gerçek veri olmayan üründe marka kolonu açılmaz",
  );
  assert.equal(brandsForProductName("Ses Aksesuarları"), null);
  const proj = brandsForProductName("Projeksiyon cihazı", "technology");
  assert.ok(proj && !proj.includes("Onvo"), "projeksiyonda TV markası olmamalı");

  // Türkçe baş isim kuralı: tamlamanın SONU ürünü belirler.
  assert.equal(
    brandsForProductName("Fırın kabı / borcam", "home-kitchen"),
    null,
    "'fırın kabı' fırın değildir",
  );
  assert.equal(
    brandsForProductName("Buzdolabı Magnetleri", "home-kitchen"),
    null,
    "'buzdolabı magneti' buzdolabı değildir",
  );
  assert.equal(
    brandsForProductName("Mikro oluklu kutu", "printing"),
    null,
    "'oluklu kutu' ütü değildir",
  );
  // Kategori kapsamı: hasta monitörü bilgisayar markası almaz
  assert.equal(brandsForProductName("Hasta monitörü", "health"), null);
  assert.ok(brandsForProductName("Monitör", "technology"));
});

check("I11b: her kategori kendi marka kaynağından beslenir", () => {
  // Makine ürün ailesi
  const cnc = machineryBrandsForFamily("metal");
  assert.ok(cnc.includes("Durma") && !cnc.includes("Caterpillar"));
  // Mobilya: gerçek mobilyaya marka, aksesuara yok
  assert.ok(furnitureBrandsForProduct({ name: "Çekyat, Kanepe" }));
  assert.equal(furnitureBrandsForProduct({ name: "Paspas" }), null);
  // Mutfak: sofra markası, kahve makinesi markası değil
  const sofra = kitchenBrandsForProductName("Porselen yemek takımı");
  assert.ok(sofra?.includes("Karaca") && !sofra.includes("Nespresso"));
  assert.equal(kitchenBrandsForProductName("Buzdolabı Magnetleri"), null);
  // Anne & çocuk: bez markası ile araba markası ayrı
  const bez = babyBrandsForProductName("Bebek bezi");
  const araba = babyBrandsForProductName("Travel sistem bebek arabası");
  assert.ok(bez?.includes("Prima") && !bez.includes("Britax Römer"));
  assert.ok(araba?.includes("Britax Römer") && !araba.includes("Prima"));
});

check("I11c: aksesuar/kılıf/örtü/kutu/çanta yaprağı marka kolonu AÇMAZ", () => {
  // Ürünün markası ile aksesuarının markası aynı pazar değildir: Prima bebek
  // bezi üretir, bebek bezi çöp kovası aksesuarı üretmez (kurucu, 2026-08-23).
  const accessoryLeaves: Array<[string, string]> = [
    ["baby", "Bebek Bezi Çöp Kovası Aksesuarları"],
    ["baby", "Bebek Bezi Kutuları"],
    ["baby", "Kirli Bebek Bezi Çantaları"],
    ["baby", "Bebek Arabası Aksesuarları"],
    ["baby", "Bebek Arabası Örtüleri ve Tulumları"],
    ["baby", "Bebek ve Küçük Çocuk Oto Koltuğu Aksesuarları"],
    ["baby", "Kanguru Aksesuarları"],
    ["furniture", "Masa Parçaları ve Aksesuarları"],
    ["furniture", "Ofis Koltuğu Aksesuarları"],
    ["furniture", "Bahçe Mobilya Örtüleri"],
    ["home-kitchen", "Mutfak Aleti Aksesuarları"],
    ["home-kitchen", "Yiyecek Saklama Aksesuarları"],
    ["technology", "Ses Aksesuarları"],
  ];
  for (const [categoryId, name] of accessoryLeaves) {
    assert.equal(
      brandsForProductName(name, categoryId),
      null,
      `${name}: aksesuar yaprağı pazar markası almamalı`,
    );
    const curated =
      categoryId === "baby"
        ? babyBrandsForProductName(name)
        : categoryId === "furniture"
          ? furnitureBrandsForProduct({ name })
          : categoryId === "home-kitchen"
            ? kitchenBrandsForProductName(name)
            : null;
    assert.equal(curated, null, `${name}: aksesuar yaprağı küratörlü marka da almamalı`);
  }
});

check("I11d: ünsüz yumuşaması olan ve olmayan kardeş yapraklar aynı davranır", () => {
  // "Koltuk" kolon açıp "Yönetici Koltuğu" açmıyordu: k→ğ dönüşümü düz
  // startsWith ile tutmuyor. Kardeş çiftler artık tek kuraldan geçer.
  // Çiftler AYNI segmentte seçildi: "Koltuk"/"Yönetici Koltuğu" artık bilerek
  // farklı davranıyor (biri ev, diğeri ofis-kurumsal), o ayrım I11g'nin işi.
  // Burada sınanan tek şey yumuşamanın segmentten bağımsız çalıştığı.
  const furniturePairs = [
    ["Dolap", "Mutfak Dolabı"],
    ["Kitaplık", "Kitaplığı"],
    ["Ayakkabılık", "Ayakkabılığı"],
  ];
  for (const [plain, softened] of furniturePairs) {
    assert.equal(
      inferFurnitureSegment({ name: plain! }),
      inferFurnitureSegment({ name: softened! }),
      `mobilya: '${plain}' ile '${softened}' aynı segmentte olmalı`,
    );
    assert.equal(
      furnitureBrandsForProduct({ name: plain! }) != null,
      furnitureBrandsForProduct({ name: softened! }) != null,
      `mobilya: '${plain}' ile '${softened}' aynı davranmalı`,
    );
  }
  const kitchenPairs = [
    ["Dekoratif Tabaklar", "Sunum Tabağı"],
    ["Tencere seti", "Döküm Tencere"],
  ];
  for (const [plain, softened] of kitchenPairs) {
    assert.equal(
      kitchenBrandsForProductName(plain!) != null,
      kitchenBrandsForProductName(softened!) != null,
      `mutfak: '${plain}' ile '${softened}' aynı davranmalı`,
    );
  }
  const babyPairs = [
    ["Oto koltuğu", "Oto Koltukları"],
    ["Beşik", "Bebek Yatağı"],
  ];
  for (const [plain, softened] of babyPairs) {
    assert.equal(
      babyBrandsForProductName(plain!) != null,
      babyBrandsForProductName(softened!) != null,
      `bebek: '${plain}' ile '${softened}' aynı davranmalı`,
    );
  }
});

check("I11e: marka kolonu açılma oranı ölçülen değerden sapmıyor", () => {
  /**
   * DİKKAT — bu sınırlar ONAYLANMIŞ HEDEF DEĞİLDİR. Ölçülen mevcut durumun
   * etrafına konmuş bir geriye gidiş cırcırıdır (kurucu, 2026-08-23):
   * sınırlar ölçümden SONRA, o günkü değerin üstüne ve altına yerleştirildi.
   * "%57 mobilya doğru orandır" gibi bir karar hiçbir zaman verilmedi; test
   * yalnızca bu oranın SESSİZCE değişmesini yakalar, doğruluğunu onaylamaz.
   *
   * Yakaladığı iki yön:
   *  - tavan: kalıpların sessizce genişlemesi (kolon her yaprakta açılmaya
   *    başlar),
   *  - taban: katlamanın/eşleştirmenin bozulup kolonların toptan kapanması.
   *
   * Yakalamadığı: bir kolonun DOĞRU açılıp açılmadığı. Oranın kendisi kalite
   * ölçüsü değildir — mobilyada baş isim listesi kategorinin kendi sözlüğü
   * olduğu için %57 neredeyse kurgu gereği çıkar, bebekte ise liste belirli
   * ürün pazarlarını saydığı için %30 gerçek bir seçim yapar. Aynı yüzdeler
   * aynı şeyi ölçmez.
   *
   * Ölçüm 2026-08-23 (mobilya segmentlere ayrıldıktan ve çıplak "tv" kalıbı
   * kaldırıldıktan SONRA): technology 40/113, appliances 19/97, home-kitchen
   * 28/141, baby 38/128, machinery 135/305, furniture 80/236.
   *
   * Mobilya sınırı bu turda %48–62'den %28–40'a taşındı: tek listeli kolon
   * segmentlere bölününce oran %56.8'den %33.9'a düştü. Eski sınır kaldırıldı,
   * çünkü artık ölçtüğü şey mevcut değil — bir cırcır, dayandığı ölçüm
   * değiştiğinde yeniden yerleştirilir, yoksa geçmişi korumaz.
   */
  const BOUNDS: Record<string, { min: number; max: number }> = {
    technology: { min: 28, max: 40 },
    appliances: { min: 12, max: 25 },
    "home-kitchen": { min: 12, max: 26 },
    baby: { min: 20, max: 35 },
    machinery: { min: 36, max: 50 },
    furniture: { min: 28, max: 40 },
  };

  ensureTaxonomyLoaded();
  const leaves = listAllTaxonomyNodes().filter(
    (n) => n.nodeType === "PRODUCT_TYPE",
  );
  const counts = new Map<string, { total: number; open: number }>();
  for (const leaf of leaves) {
    if (!leaf.parentId) continue;
    const ctx = {
      categoryId: leaf.categoryId ?? "",
      subcategorySlug: leaf.subcategoryId ?? null,
    };
    const kids = getBrowseChildren(leaf.id, ctx);
    const bucket = counts.get(leaf.categoryId ?? "?") ?? { total: 0, open: 0 };
    bucket.total += 1;
    if (kids.some((k) => k.kind === "brand")) bucket.open += 1;
    counts.set(leaf.categoryId ?? "?", bucket);
  }

  for (const [categoryId, bound] of Object.entries(BOUNDS)) {
    const bucket = counts.get(categoryId);
    assert.ok(bucket && bucket.total > 0, `${categoryId}: ürün yaprağı sayılamadı`);
    const pct = (bucket!.open / bucket!.total) * 100;
    const seen = `${bucket!.open}/${bucket!.total} = %${pct.toFixed(1)}`;
    assert.ok(
      pct <= bound.max,
      `${categoryId}: marka kolonu ölçülenden fazla açılıyor (${seen}, sınır %${bound.max} — hedef değil, 2026-08-23 ölçümü)`,
    );
    assert.ok(
      pct >= bound.min,
      `${categoryId}: marka kolonu ölçülenden az açılıyor (${seen}, sınır %${bound.min} — hedef değil, 2026-08-23 ölçümü)`,
    );
  }

  // Marka kolonu OLMAYAN kategoriler sessizce kolon açmaya başlamamalı.
  for (const categoryId of ["automotive", "health", "printing", "real-estate", "services"]) {
    const bucket = counts.get(categoryId);
    if (!bucket) continue;
    assert.equal(
      bucket.open,
      0,
      `${categoryId}: bu kategoride marka kolonu beklenmiyor (${bucket.open}/${bucket.total})`,
    );
  }
});

check("I11g: mobilya kolonu tek liste değil — segmentine göre marka", () => {
  /**
   * Kurucunun 2026-08-23'te reddettiği durum: kolon açan 134 mobilya yaprağının
   * TAMAMI aynı 11 markayı görüyordu. Adını verdiği dört yanlışın her biri
   * burada kalıcı satır oldu ("ben bunları sürekli arayarak bulamam").
   */
  const leaf = (name: string, parentId?: string, subcategoryId?: string) =>
    furnitureBrandsForProduct({ name, parentId, subcategoryId });

  // 1) Çilek çocuk mobilyası markasıdır: ofis/kurumsalda görünemez.
  for (const [name, sub] of [
    ["Makam Oda Takımı", "ofis-mobilyalari"],
    ["Konferans koltuğu", "ofis-sandalyesi"],
    ["Yönetici Koltuğu", "ofis-mobilyalari"],
    ["Toplantı Masası", "ofis-mobilyalari"],
  ] as const) {
    assert.equal(
      leaf(name, undefined, sub),
      null,
      `${name}: ofis/kurumsal segmentte marka kolonu açılamaz`,
    );
  }
  // Çocuk & Genç odasında ise Çilek İLK sırada olmalı (uzman marka önce).
  const cocuk = leaf(
    "Genç Odası Takımı",
    "tax:furniture:ev-mobilyasi:cocuk-genc-odasi",
    "ev-mobilyasi",
  );
  assert.ok(cocuk && cocuk[0] === "Çilek", `çocuk & genç: Çilek başta olmalı: ${cocuk}`);
  // Ev segmenti Çilek'i TAŞIMAZ — yatak odası çocuk odası değildir.
  const ev = leaf("Gardırop", "tax:furniture:ev-mobilyasi:yatak-odasi", "ev-mobilyasi");
  assert.ok(ev && !ev.includes("Çilek"), `ev segmenti Çilek almamalı: ${ev}`);

  // 2) Kurumsal donanım (metal dolap) mobilya markası hiç almaz.
  for (const name of ["Ecza Dolabı", "Anahtar Dolabı", "Emanet Dolabı", "Soyunma Dolabı"]) {
    assert.equal(
      leaf(name, "tax:furniture:ofis-mobilyalari:dolaplar", "ofis-mobilyalari"),
      null,
      `${name}: kurumsal donanım, ev mobilyası markası alamaz`,
    );
  }

  // 3) Bahçe mobilyası ayrı pazar — ev markası almaz.
  for (const name of ["Bahçe Yatakları", "Bahçe Koltukları", "Bahçe Masaları", "Balkon Seti"]) {
    assert.equal(
      leaf(name, "tax:furniture:diger:bahce-ve-balkon-mobilyasi", "diger"),
      null,
      `${name}: bahçe segmentinde güvenilir marka listesi yok`,
    );
  }

  // 4) Ölçüye özel / proje bazlı üretim tanımı gereği markasızdır.
  for (const name of ["Ölçüye özel masa", "Proje bazlı ofis mobilyası"]) {
    assert.equal(
      leaf(name, "tax:furniture:ozel-uretim:ozel-isler", "ozel-uretim"),
      null,
      `${name}: özel üretim markasızdır`,
    );
  }

  // Ebeveyn grubu isimden GÜÇLÜDÜR: aynı ad iki segmentte farklı davranır.
  assert.notEqual(
    inferFurnitureSegment({ name: "Sandalye", parentId: "tax:furniture:ev-mobilyasi:mutfak" }),
    inferFurnitureSegment({ name: "Sandalye", subcategoryId: "ofis-mobilyalari" }),
    "aynı ad, farklı ebeveyn → farklı segment olmalı",
  );
  // Mutfak grubu karışıktır: dolap ankastre pazarı, masa/sandalye ev mobilyası.
  const mutfakDolap = leaf("Mutfak Dolabı", "tax:furniture:ev-mobilyasi:mutfak", "ev-mobilyasi");
  const mutfakMasa = leaf("Mutfak Masası", "tax:furniture:ev-mobilyasi:mutfak", "ev-mobilyasi");
  assert.ok(mutfakDolap && mutfakMasa);
  assert.notEqual(
    JSON.stringify(mutfakDolap),
    JSON.stringify(mutfakMasa),
    "mutfak dolabı ile mutfak masası aynı listeyi alamaz",
  );

  // Kolon açan segmentler farklı listeler vermeli — "tek liste" geri gelemez.
  const openLists = (["ev", "cocuk-genc", "mutfak-dolabi"] as const).map((s) =>
    JSON.stringify(furnitureBrandsForSegment(s)),
  );
  assert.equal(
    new Set(openLists).size,
    openLists.length,
    `segmentler ayrı liste vermeli: ${openLists.join(" || ")}`,
  );
  // Kapalı segmentler sessizce açılmamalı.
  for (const s of ["ofis-kurumsal", "bahce", "ozel-uretim"] as const) {
    assert.equal(furnitureBrandsForSegment(s), null, `${s}: kolon açılmamalı`);
  }
});

check("I11h: baş ismi ürün pazarıyla çakışan hizmet yaprağı marka kolonu açmaz", () => {
  // "Uydu ve Kablo TV" bir abonelik alanıdır, televizyon değil; baş isim kuralı
  // adın sonunu tuttuğu için televizyonun MediaMarkt listesini alıyordu
  // (Samsung, LG, TCL…). Samsung uydu aboneliği satmaz (kurucu, 2026-08-23).
  assert.equal(
    brandsForProductName("Uydu ve Kablo TV", "technology"),
    null,
    "uydu/kablo TV televizyon markası alamaz",
  );
  // Gerçek televizyon yaprağı etkilenmedi — kaldırılan kalıbın maliyeti yoktu.
  const tv = brandsForProductName("Televizyon", "technology");
  assert.ok(tv && tv[0] === "Samsung", `televizyon kolonu bozulmamalı: ${tv}`);

  const uydu = getBrowseChildren("tax:technology:donanim:tv-ve-goruntu:uydu-ve-kablo-tv", {
    categoryId: "technology",
    subcategorySlug: "donanim",
  });
  assert.equal(
    uydu.filter((n) => n.kind === "brand").length,
    0,
    `uydu/kablo TV ağaçta marka kolonu açmamalı: ${uydu.map((n) => n.label).join(",")}`,
  );
});

check("I11f: kolonun kaynağı işaretli — küratörlü liste pazar verisi gibi durmaz", () => {
  // Kurucu kararı (2026-08-23): e-bebek/Koçtaş/Makinecim hasatlarında ürün
  // tipi → marka kırılımı YOK. Küratörlü kolon, MediaMarkt dağılımıyla aynı
  // statüde görünmesin diye kaynağıyla birlikte taşınır.
  const marketColumn = getBrowseChildren(
    "tax:technology:donanim:tv-ve-goruntu:televizyon",
    { categoryId: "technology", subcategorySlug: "donanim" },
  );
  assert.ok(marketColumn.length > 0, "televizyon marka kolonu açılmalı");
  for (const n of marketColumn) {
    assert.equal(n.meta?.brandSource, "mediamarkt", `${n.label}: pazar verisi işareti eksik`);
  }

  const curatedLeaf = listAllTaxonomyNodes().find(
    (n) =>
      n.nodeType === "PRODUCT_TYPE" &&
      n.categoryId === "baby" &&
      n.canonicalName === "Oto koltuğu",
  );
  assert.ok(curatedLeaf, "bebek oto koltuğu yaprağı bulunmalı");
  const curatedColumn = getBrowseChildren(curatedLeaf!.id, {
    categoryId: "baby",
    subcategorySlug: curatedLeaf!.subcategoryId ?? null,
  });
  assert.ok(curatedColumn.length > 0, "oto koltuğu marka kolonu açılmalı");
  for (const n of curatedColumn) {
    assert.equal(n.meta?.brandSource, "curated", `${n.label}: küratörlü işareti eksik`);
  }
});

check("I14: 'ölçemedim' ile 'ölçtüm, bozuk' aynı renge boyanmaz", () => {
  /**
   * Kurucu kuralı (2026-08-23, KB-7): çalışmayan bir ölçüm başarısız bir ölçüm
   * değildir. verify-request-publish-v1 veritabanı yokken FAIL sayıyordu ve
   * böylece yayınlama kodu hakkında sahip olmadığımız bir bilgiyi iddia
   * ediyordu. Kural burada davranış olarak sınanır — kaynak metni değil.
   */
  // 1) Üç durum ayrı: NOT-MEASURED'ın kendi çıkış kodu var ve 0/1 değil.
  assert.notEqual(NOT_MEASURED_EXIT, 0, "ölçülemeyen 'yeşil' sayılamaz");
  assert.notEqual(NOT_MEASURED_EXIT, 1, "ölçülemeyen 'kırmızı' sayılamaz");

  // 2) Defter boşken çıkış 0, bir kayıt girince ayrı kod.
  const lines: string[] = [];
  const tally = createNotMeasuredTally((l) => lines.push(l));
  assert.equal(tally.exitCode(), 0);
  tally.record("live publish", "DATABASE_URL yok");
  assert.equal(tally.count, 1);
  assert.equal(tally.exitCode(), NOT_MEASURED_EXIT);
  // Sessiz kalamaz: ölçülemeyen kontrol kendi satırında görünmek zorunda.
  assert.ok(
    lines.some((l) => l.startsWith("NOT-MEASURED —")),
    `ölçülemeyen kontrol raporlanmalı: ${JSON.stringify(lines)}`,
  );

  // 3) Sınıflandırma: yalnız BAĞLANTI hatası ölçülemez sayılır.
  const unreachable = [
    Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:5432"), { code: "ECONNREFUSED" }),
    Object.assign(new Error("Can't reach database server at aws-0.pooler:5432"), { errorCode: "P1001" }),
    Object.assign(new Error("timed out"), { errorCode: "P1002" }),
    Object.assign(new Error("getaddrinfo ENOTFOUND db.example"), { code: "ENOTFOUND" }),
  ];
  for (const err of unreachable) {
    assert.ok(isUnreachableDatabase(err), `ölçülemez sayılmalı: ${err.message}`);
  }

  // Kaçış deliği OLMAMALI: veritabanının verdiği gerçek cevaplar FAIL kalır.
  const realDefects = [
    Object.assign(new Error("Unique constraint failed on the fields: (`email`)"), { errorCode: "P2002" }),
    Object.assign(new Error("An operation failed because it depends on one or more records that were required but not found"), { errorCode: "P2025" }),
    Object.assign(new Error("published status expected PUBLISHED, got DRAFT"), {}),
  ];
  for (const err of realDefects) {
    assert.ok(
      !isUnreachableDatabase(err),
      `gerçek kusur ölçülemez sayılamaz (kaçış deliği): ${err.message}`,
    );
  }
});

check("I15: DB'ye yazan doğrulayıcı allowlist dışı host'a asla yazmaya kalkışmaz", () => {
  /**
   * Kurucu kuralı (2026-08-23, KB-9): bu kapı KONVANSİYON değil MEKANİZMA.
   * `.env` Tuğrul ile ortak Supabase pooler'ına bakıyor ve altı doğrulayıcı
   * gerçek prisma istemcisiyle yazıyor. Veritabanı bu sabaha kadar kapalıydı;
   * bizi koruyan şey bir kural değil, bir arızaydı. Artık açık.
   *
   * Üç koşul birden aranır. Aşağıdaki her senaryo, bağlantı DENENMEDEN
   * reddedilmeyi sınar.
   */
  const SHARED = "postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";
  const LOCAL = "postgresql://u:p@localhost:5432/talepo_test";

  // 1) Bayrak yoksa: hedef ne olursa olsun yazma yok.
  for (const url of [SHARED, LOCAL]) {
    const v = canWriteToDatabase({ DATABASE_URL: url });
    assert.equal(v.allowed, false, `bayraksız yazma reddedilmeli: ${url}`);
  }

  // 2) Bayrak VAR ama host ortak/üretim: yine reddedilir (negatif kontrol).
  const shared = canWriteToDatabase({
    TALEPO_VERIFY_ALLOW_DB: "1",
    DATABASE_URL: SHARED,
  });
  assert.equal(shared.allowed, false, "ortak pooler'a bayrakla bile yazılamaz");
  assert.match(
    shared.allowed === false ? shared.reason : "",
    /pooler\.supabase\.com/,
    "red gerekçesi yasak host'u ADIYLA söylemeli",
  );
  for (const host of [
    "db.abcdefgh.supabase.co",
    "talepo-prod.rds.amazonaws.com",
    "ep-x.neon.tech",
    "production-db.internal",
  ]) {
    const v = canWriteToDatabase({
      TALEPO_VERIFY_ALLOW_DB: "1",
      DATABASE_URL: `postgresql://u:p@${host}:5432/db`,
    });
    assert.equal(v.allowed, false, `${host}: yazma reddedilmeli`);
  }

  // 3) Bayrak VAR ama host tanınmıyor: allowlist dar, bilinmeyen test sayılmaz.
  const unknown = canWriteToDatabase({
    TALEPO_VERIFY_ALLOW_DB: "1",
    DATABASE_URL: "postgresql://u:p@some-random-host.example:5432/db",
  });
  assert.equal(unknown.allowed, false, "bilinmeyen host test sayılamaz");

  // 4) Üçü de sağlanınca AÇILIR — kapı kilit değil, kapı.
  for (const url of [
    LOCAL,
    "postgresql://u:p@127.0.0.1:5432/db",
    "postgresql://u:p@talepo-test.internal:5432/db",
    "postgresql://u:p@staging-db.internal:5432/db",
  ]) {
    const v = canWriteToDatabase({ TALEPO_VERIFY_ALLOW_DB: "1", DATABASE_URL: url });
    assert.equal(v.allowed, true, `test hedefine yazılabilmeli: ${url}`);
  }

  // 5) URL yok / bozuk: host BİLİNMİYOR demektir, tahmin edilmez.
  for (const bad of [undefined, "", "not-a-url", "   "]) {
    const v = canWriteToDatabase({
      TALEPO_VERIFY_ALLOW_DB: "1",
      DATABASE_URL: bad,
    });
    assert.equal(v.allowed, false, `bozuk URL yazmaya izin veremez: ${bad}`);
  }
  assert.equal(databaseHost("not-a-url"), null);
  assert.equal(databaseHost(SHARED), "aws-0-eu-central-1.pooler.supabase.com");
});

check("I16: üretilen cümlede hedef ifade birden fazla kez geçemez", () => {
  /**
   * Kurucu ilkesi: kullanıcının yazdığı ona tekrar sorulmaz/tekrarlanmaz.
   *
   * Somut hata (KB-2c): "Bosch çamaşır makinesi için pompa arıyorum" girdisi
   * "bosch için bosch çamaşır makinesi için pompa arıyorum" üretiyordu — marka
   * iki kez, bağlaç iki kez. Sebep, parça adının zenginleştirilmesi sırasında
   * uyumluluk hedefinin parça adına yutulmasıydı; compose-text sonra hedefi
   * bir kez daha önüne ekliyordu.
   *
   * Bu invariant MEKANİZMADAN BAĞIMSIZ yazıldı: hangi katman tekrar üretirse
   * üretsin yakalar. Kalıcı koruma, düzeltmenin kendisi değil budur.
   */
  const STOP = new Set(["arıyorum", "ariyorum", "ve", "ile", "olsun", "model"]);

  for (const raw of [
    "Bosch çamaşır makinesi için pompa arıyorum", // bugünkü hata
    "Alfa Romeo 156 için fren balatası", // rakamlı hedef
    "Heidelberg SM 74 nemlendirme pompası", // belgedeki örnek
    "bebek arabası", // ürün adı marka sanılmasın
    "Golf 7 dizel çıkma motor arıyorum",
    "tahliye pompası arıyorum",
    "Bosch bulaşık makinesi için rezistans lazım",
    "Arçelik buzdolabı için termostat arıyorum",
  ]) {
    const { state } = syncFromText(null, raw);
    const text = composeNaturalRequestText(state);
    const tokens = fold(text)
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter((t) => t.length >= 3 && !STOP.has(t));

    const seen = new Map<string, number>();
    for (const t of tokens) seen.set(t, (seen.get(t) ?? 0) + 1);
    const repeated = [...seen.entries()].filter(([, n]) => n > 1);
    assert.deepEqual(
      repeated,
      [],
      `'${raw}' → '${text}' : içerik kelimesi tekrarlanıyor ${JSON.stringify(repeated)}`,
    );

    // Uyumluluk bağlacı da tekrarlanamaz — "X için Y için Z" olamaz.
    const icinCount = (fold(text).match(/\bicin\b/g) ?? []).length;
    assert.ok(
      icinCount <= 1,
      `'${raw}' → '${text}' : 'için' ${icinCount} kez geçiyor`,
    );
  }

  // Parça adı, uyumluluk hedefinin kelimelerini ASLA içermez (kuralın kaynağı).
  const bosch = syncFromText(null, "Bosch çamaşır makinesi için pompa arıyorum");
  const partValue = String(bosch.state.fields.part?.value ?? "");
  for (const forbidden of ["bosch", "camasir", "makinesi", "icin"]) {
    assert.ok(
      !fold(partValue).includes(forbidden),
      `parça adı hedefin kelimesini taşıyamaz: part='${partValue}' içinde '${forbidden}'`,
    );
  }
  // Gerçek zenginleşme korunur — kural fazla geniş olmamalı.
  assert.equal(
    String(
      syncFromText(null, "Heidelberg SM 74 nemlendirme pompası").state.fields.part
        ?.value ?? "",
    ),
    "nemlendirme pompası",
  );
});

check("I17: otomotiv dışı uyumluluk parçasında üst ürün cümleden düşemez", () => {
  /**
   * KB-10. I16'nın AKSİ yönü: I16 fazladan tekrarı kovalar, bu invariant EKSİK
   * BİLGİYİ kovalar. İkisi birlikte çalışır — biri "iki kez yazma" der, diğeri
   * "hiç yazmamazlık etme" der.
   *
   * Sözleşme: otomotiv DIŞI bir uyumluluk parçası talebinde üst ürün
   * biliniyorsa, oluşturulan cümlede hem üst ürün adı hem gerçek parça adı
   * bulunmalıdır.
   *
   * Somut hata: "Bosch çamaşır makinesi için pompa arıyorum" →
   * "Bosch için pompa arıyorum." Tedarikçi pompanın hangi cihaz için
   * istendiğini göremiyor; bulaşık makinesi pompası da olabilir.
   *
   * Bu invariant AYNI ZAMANDA naif düzeltmeye karşı bir kapan: otomotiv
   * rotasını kapatıp beyaz eşya gövdesine düşmek parçayı tamamen kaybettiriyor
   * (ölçüldü). O yüzden hem üst ürün hem parça aranıyor.
   */
  const CASES = [
    {
      raw: "Bosch çamaşır makinesi için pompa arıyorum",
      parent: "çamaşır makinesi",
      part: "pompa",
      once: ["bosch"],
    },
    {
      // Üst ürün SABİT KODLANMADIĞININ kanıtı — aynı marka, farklı cihaz.
      raw: "Bosch bulaşık makinesi için pompa arıyorum",
      parent: "bulaşık makinesi",
      part: "pompa",
      once: ["bosch"],
    },
  ];

  for (const c of CASES) {
    const { state } = syncFromText(null, c.raw);
    const text = composeNaturalRequestText(state);
    const norm = fold(text);

    assert.ok(
      norm.includes(fold(c.parent)),
      `'${c.raw}' → '${text}' : üst ürün '${c.parent}' cümlede YOK`,
    );
    assert.ok(
      norm.includes(fold(c.part)),
      `'${c.raw}' → '${text}' : parça '${c.part}' cümlede YOK`,
    );
    for (const token of c.once) {
      const n = (norm.match(new RegExp(`\\b${fold(token)}\\b`, "g")) ?? []).length;
      assert.equal(
        n,
        1,
        `'${c.raw}' → '${text}' : '${token}' ${n} kez geçiyor, tam 1 olmalı`,
      );
    }
  }

  // Otomotiv kontrolü — sınır yalnız otomotiv DIŞINI değiştirmeli.
  const auto = syncFromText(null, "Mercedes C180 için su pompası arıyorum");
  const autoText = composeNaturalRequestText(auto.state);
  const autoNorm = fold(autoText);
  for (const must of ["mercedes", "c180", "pompa"]) {
    assert.ok(
      autoNorm.includes(must),
      `otomotiv rotası bozuldu: '${autoText}' içinde '${must}' yok`,
    );
  }

  /**
   * SANAYİ MAKİNESİ — üst ürün `machineType` alanından gelir.
   *
   * Kontrollü fixture kullanılıyor çünkü doğal dil çıkarımı bu alanı bugün
   * güvenilir doldurmuyor ("Heidelberg SM 74 …" için `machineType` null geliyor);
   * sınanan şey besteci sözleşmesi, çıkarım değil.
   *
   * Bu blok ilk denemedeki gerçek kusuru kilitliyor: üst ürün zinciri iki
   * rotada ayrı ayrı yazılmıştı ve `compatibility_part` dalı `machineType`'ı
   * OKUMUYORDU; o daldan geçen makine parçası üst makine adını kaybediyordu.
   * Bu yüzden HER İKİ rota da ayrı ayrı sınanır.
   */
  const machineBase = syncFromText(
    null,
    "Heidelberg SM 74 nemlendirme pompası",
  ).state;
  const withMachineType = (subcategorySlug: string | null) => ({
    ...machineBase,
    categoryId: "machinery",
    subcategorySlug,
    fields: {
      ...machineBase.fields,
      machineType: {
        kind: "VALUE" as const,
        value: "Ofset Baskı Makinesi",
        provenance: "EXPLICIT" as const,
        confidence: 1,
      },
    },
  });

  for (const [routeName, slug] of [
    ["genel yol (compositionMode=generic)", null],
    ["compatibility_part dalı", "yedek-parca"],
  ] as const) {
    const text = composeNaturalRequestText(
      withMachineType(slug) as typeof machineBase,
    );
    const norm = fold(text);
    assert.ok(
      norm.includes(fold("Ofset Baskı Makinesi")),
      `${routeName}: üst makine adı cümlede YOK → '${text}'`,
    );
    assert.ok(
      norm.includes("pompa"),
      `${routeName}: parça adı cümlede YOK → '${text}'`,
    );
  }
});

check("I12: browsing a whole-product leaf clears stale part/accessory context", () => {
  // Ara grup metni ("… & Aksesuar") ACCESSORY kalıntısı bırakır — ürün
  // yaprağı seçilince telefon ALMAK isteyen yedek parçaya düşmemeli.
  const { state: contaminated } = syncFromText(
    null,
    "Cep Telefonu & Aksesuar arıyorum.",
  );
  const after = applyBrowseSelectionToState(contaminated, {
    key: "productType",
    value: "Cep Telefonu",
    entityId: "tax:technology:donanim:cep-telefonu-aksesuar:cep-telefonu",
  });
  // Alan düzeyi: parça bağlamı yaprak seçiminde süpürülür (kalıcı hata buydu)
  const partField = after.fields.part;
  assert.ok(
    !partField || partField.kind === "UNKNOWN",
    `part alanı temizlenmeli: ${JSON.stringify(partField)}`,
  );
  const needAfter = after.fields.needType;
  assert.ok(
    !(needAfter?.kind === "VALUE" && needAfter.value === "part"),
    `needType 'part' kalmamalı: ${JSON.stringify(needAfter)}`,
  );
  // Temiz yaprak metni asla PART/ACCESSORY üretmez (UI'daki nihai metin)
  const clean = syncFromText(null, "Cep Telefonu arıyorum.");
  const subject = clean.state.understanding.requestSubject.kind.value;
  assert.equal(subject, "PRODUCT", `temiz metin PRODUCT olmalı: ${subject}`);
});

check("I13: audit classes — Faz, servis niyeti, uzaktan, nakliye, donanım sinyali", () => {
  // Faz yalnız elektrikli sabit makinelerde
  const schemaFor = (values: Record<string, string>) =>
    resolveRequestSchema({ categoryId: "machinery", values }).fields.map((f) => f.key);
  assert.ok(!schemaFor({ machineType: "mini ekskavatör" }).includes("phase"), "ekskavatöre Faz sorulmaz");
  assert.ok(schemaFor({ machineType: "jeneratör" }).includes("phase"), "jeneratöre Faz sorulur");

  // Servis niyeti ürün-spec sorularını süpürür (kombi bakımı)
  const appl = REQUEST_CATEGORIES.find((c) => c.id === "appliances")!;
  const applKeys = getVisibleCategoryFields(
    appl.fields,
    { needType: "service", applianceType: "Kombi" },
    "appliances",
  ).map((f) => f.key);
  for (const bad of ["energyClass", "usageArea", "capacity"]) {
    assert.ok(!applKeys.includes(bad), `servis niyetinde '${bad}' olmamalı: ${applKeys.join(",")}`);
  }

  // Nakliye artık kategorisiz düşmez
  const nak = syncFromText(null, "evden eve nakliye arıyorum");
  assert.equal(nak.state.categoryId, "services", `nakliye services olmalı: ${nak.state.categoryId}`);

  // Kurucu (2026-08-23): ürün-bakım/yaptırma niyeti Hizmetler'e yönlenir
  for (const t of [
    "kombi bakımı yaptırmak istiyorum",
    "web sitesi yaptırmak istiyorum",
  ]) {
    const s = syncFromText(null, t).state;
    assert.equal(s.categoryId, "services", `${t} → services olmalı: ${s.categoryId}`);
  }
  // Otomotiv istisnası: araç bakımı kendi kategorisinde kalır
  const arac = syncFromText(null, "aracıma periyodik bakım yaptırmak istiyorum").state;
  assert.equal(arac.categoryId, "automotive", `araç bakımı automotive kalmalı: ${arac.categoryId}`);

  // Donanım sinyali: drone/oyun bilgisayarı hardware'e oturur
  for (const t of ["drone arıyorum", "oyun bilgisayarı arıyorum"]) {
    const s = syncFromText(null, t).state;
    assert.equal(
      s.fields.needType?.value ?? null,
      "hardware",
      `${t} → needType hardware olmalı`,
    );
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
