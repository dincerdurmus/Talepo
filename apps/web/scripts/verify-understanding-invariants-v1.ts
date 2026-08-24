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
import { readFileSync } from "node:fs";
import { join as pathJoin, resolve as pathResolve } from "node:path";

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
  getTaxonomyAncestorIds,
  getTaxonomyNode,
  listAllTaxonomyNodes,
  resolveTaxonomyAlias,
} from "../src/lib/taxonomy";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { buildUnderstandingSummary } from "../src/lib/request-understanding/activation-bridge";
import { isProductTypePhrase } from "../src/lib/product-identity/identity-candidates";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
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

/** apps/web/scripts → repo kökü. Kanonik kaynak dosyaları oradan okunur. */
function repoRootForTests(): string {
  return pathResolve(__dirname, "..", "..", "..");
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

/** Structured identity — kısıtlanan kullanıcı yüzeyinden AYRI okunur. */
function idOf(u: unknown, key: "brand" | "model"): string | null {
  const block = ((u as Record<string, unknown>)["identity"] ?? {}) as Record<
    string,
    { value?: unknown } | undefined
  >;
  const v = block[key]?.value;
  return v == null ? null : String(v);
}

/** Test yardımcıları — açık dünya parça sözleşmesi (KB-12 devamı). */
/**
 * Tek yüzey okuyucu. `fieldValues` verildiğinde structured/browse akışını
 * temsil eder — kullanıcının DOĞRULADIĞI rol bu yoldan girer.
 */
function surfacesFor(raw: string, fieldValues?: Record<string, string>) {
  const structured = fieldValues ? { fieldValues } : undefined;
  const understanding = understandRequest({ rawInput: raw, structured }) as never;
  const headline = String(
    (buildUnderstandingSummary(understanding) as unknown as { headline?: string })
      ?.headline ?? "",
  );
  const { state } = syncFromText(null, raw, structured ? { structured } : undefined);
  const val = (k: string) => {
    const f = state.fields[k];
    return f && f.kind === "VALUE" && f.value ? String(f.value) : null;
  };
  const rs = (understanding as unknown as {
    requestSubject?: {
      kind?: { value?: unknown; status?: unknown; evidence?: unknown };
      name?: { value?: unknown };
      parentEntity?: Record<string, { value?: unknown } | undefined>;
    };
  }).requestSubject;
  return {
    state,
    headline,
    text: composeNaturalRequestText(state),
    subjectKind: String(rs?.kind?.value ?? ""),
    parentModel: rs?.parentEntity?.model?.value != null
      ? String(rs.parentEntity.model.value)
      : null,
    brand: val("brand"),
    model: val("model"),
    part: val("part"),
    parentProduct: val("applianceType") ?? val("productType") ?? val("machineType"),
    categoryId: state.categoryId,
    intent: String(
      (understanding as unknown as { intent?: { value?: unknown } }).intent
        ?.value ?? "",
    ),
    identityBrand: idOf(understanding, "brand"),
    identityModel: idOf(understanding, "model"),
    subjectStatus: String(rs?.kind?.status ?? ""),
    subjectEvidence: Array.isArray(rs?.kind?.evidence)
      ? (rs.kind.evidence as string[]).map(String)
      : [],
    parentBrand:
      rs?.parentEntity?.brand?.value != null
        ? String(rs.parentEntity.brand.value)
        : null,
    subjectName: rs?.name?.value != null ? String(rs.name.value) : null,
    /**
     * Korunmuş belirsizlik yüzeyi — MEVCUT sözleşme (1C).
     * `unresolvedExpressions` yayın anında `ambiguities` + `unknownFields`
     * üzerinden üretilir (publish-understanding.ts); invariant doğrudan o
     * üretim kaynağını okur, yeni bir telemetri katmanı kurulmaz.
     */
    nextQuestionKeys: (
      (resolveHybridQuestions(state) as unknown as { next?: Array<{ key: string }> })
        .next ?? []
    ).map((f) => f.key),
    ambiguityMessages: (
      (understanding as unknown as {
        ambiguities?: Array<{ kind?: string; message?: string }>;
      }).ambiguities ?? []
    ).map((a) => `${a.kind ?? ""}:${a.message ?? ""}`),
  };
}

check("I18: uyumluluk bağlacı çok kelimeli parça adını kısaltamaz (KB-11)", () => {
  /**
   * Ölçülen gerçek: aynı talep, yalnız "için" bağlacı eklenince parça adı
   * kısalıyor.
   *   "Heidelberg SM 74 nemlendirme pompası"        → part = "nemlendirme pompası"  ✅
   *   "Heidelberg SM 74 İÇİN nemlendirme pompası …" → part = "pompa"                ❌
   * Tek fark bağlaç; ikisi de aynı sonucu vermeli.
   */
  for (const raw of [
    "Heidelberg SM 74 için nemlendirme pompası arıyorum",
    "Heidelberg SM 74 nemlendirme pompası",
  ]) {
    const s = surfacesFor(raw);
    assert.equal(
      s.part,
      "nemlendirme pompası",
      `${raw}: parça adı kısalmamalı (${JSON.stringify(s.part)})`,
    );
  }
  const text = surfacesFor("Heidelberg SM 74 için nemlendirme pompası arıyorum").text;
  for (const must of ["nemlendirme pompası", "heidelberg", "sm 74"]) {
    assert.ok(fold(text).includes(fold(must)), `'${must}' kayboldu: '${text}'`);
  }
});

check("I19: istenen parça, üst ürünün MODELİ olarak atanamaz (KB-12)", () => {
  /**
   * Ölçülen gerçek — parça adı `model` alanına kaçıyor:
   *   "Arçelik bulaşık makinesi için rezistans …" → model = "rezistans"
   *   "Siemens ankastre fırın için termostat …"   → model = "termostat"
   * Siemens vakasında parça kataloğu "termostat"ı PARÇA olarak tanıyor ama
   * model çıkarıcısı da aynı kelimeyi sahipleniyor: aynı jetona iki rol.
   *
   * Kural GENEL: "<üst ürün> için <X>" kalıbında X istenen şeydir; istenen şey
   * üst ürünün modeli olamaz. Kelimeye özel istisna yok — jeton rolü sınanır.
   */
  const CASES = [
    { raw: "Arçelik bulaşık makinesi için rezistans arıyorum", part: "rezistans" },
    { raw: "Siemens ankastre fırın için termostat lazım", part: "termostat" },
  ];
  for (const c of CASES) {
    const s = surfacesFor(c.raw);
    assert.ok(
      fold(s.model ?? "") !== fold(c.part),
      `${c.raw}: '${c.part}' model olarak atanmış (model='${s.model}')`,
    );
    assert.ok(
      s.identityModel == null || fold(s.identityModel) !== fold(c.part),
      `${c.raw}: identity.model hâlâ parçayı taşıyor (${s.identityModel})`,
    );
  }

  /**
   * CÜMLE SÖZLEŞMESİ — parça, uyumluluk bağlacının ARDINDA gelmeli.
   * Rolü belirsiz "Siemens Fırın termostat" biçimi kabul edilmez.
   */
  const s = surfacesFor("Siemens ankastre fırın için termostat lazım");
  assert.equal(fold(s.part ?? ""), "termostat", "Siemens: parça alanı dolmalı");
  const norm = fold(s.text);
  for (const must of ["fırın", "termostat", "siemens"]) {
    assert.ok(norm.includes(fold(must)), `'${must}' cümlede YOK → '${s.text}'`);
  }
  assert.ok(
    /firin[^a-z0-9]+icin[^a-z0-9]+termostat/.test(norm),
    `'<üst ürün> için <parça>' yapısı yok → '${s.text}'`,
  );
});

check("I20: kullanıcının yazmadığı marka başlıkta kesin gerçek gibi görünemez (KB-13)", () => {
  /**
   * Ölçülen gerçek: "C180 ön far" girdisinde marka çıkarımla `Mercedes-Benz`
   * oluyor ve başlık "Mercedes-Benz C180 için ön far" diye üretiliyor —
   * kullanıcı "Mercedes" yazmadığı hâlde.
   *
   * DİKKAT: provenance tek başına ayırt EDİCİ DEĞİL — kullanıcı "Mercedes"
   * yazdığında da INFERRED geliyor (değer katalogdan kanonikleştiriliyor).
   * Ayırt edici ölçüt, markanın kullanıcının KENDİ metninde geçmesidir.
   *
   * I24 ile birlikte okunur: orada jeton SINIRI sınanır ("benzinli" içindeki
   * "benz" marka sayılamaz), burada markanın kullanıcı yüzeyine çıkma hakkı.
   * Structured identity her hâlükârda korunur — matching onu kullanır.
   */
  const MATRIX: Array<[string, boolean]> = [
    ["C180 ön far", false],
    ["benzinli C180 ön far", false],
    ["Mercedes C180 ön far", true],
    ["Mercedes-Benz C180 ön far", true],
    ["Mercedes C180 için ön far arıyorum", true],
  ];
  for (const [raw, shouldShow] of MATRIX) {
    const s = surfacesFor(raw);
    const shown = fold(s.headline).includes("mercedes");
    assert.equal(
      shown,
      shouldShow,
      `${raw}: başlıkta marka ${shown ? "VAR" : "YOK"}, beklenen ${shouldShow ? "VAR" : "YOK"} → '${s.headline}'`,
    );
    assert.ok(fold(s.headline).includes("c180"), `${raw}: C180 kayboldu → '${s.headline}'`);
    assert.ok(
      s.identityBrand != null,
      `${raw}: identity.brand çıkarımı korunmalı — kısıtlanan yalnız kullanıcı yüzeyi`,
    );
  }
  assert.ok(
    fold(surfacesFor("C180 ön far").headline).includes("far"),
    "talep içeriği (parça) başlıktan düşemez",
  );
});


/* ------------------------------------------------------------------------ *
 * UYUMLULUK İLİŞKİSİ — TEK FİXTURE TABLOSU (I21, I27-I33)
 *
 * Bu satırların hepsi aynı yapıyı ("X için Y") sınar, bu yüzden beklentiler
 * TEK yerde bildirilir ve her invariant tablonun BİR BOYUTUNU kontrol eder.
 * Aynı girdiyi her invariantta yeniden kurmak, aynı alanları elle yeniden
 * assert etmek yalnız satır sayısını büyütüyordu — kapsamı değil.
 *
 * verdict:
 *   PART      — kanonik üst ürün kanıtlı; kesin parça talebi beklenir.
 *   NOT_PART  — üst ürün kanonik olarak "parça taşımaz" ya da hedef bütün bir
 *               üründür; parça ilişkisi kurulamaz.
 *   TENTATIVE — fiziksel ürün ama yetkinlik kürasyonu YOK. Kesin PART
 *               üretilmez, talep de kaybolmaz.
 * ------------------------------------------------------------------------ */
type CompatCase = {
  raw: string;
  verdict: "PART" | "NOT_PART" | "TENTATIVE";
  /** Kanonik üst ürünün alanı — bildirilmişse birebir eşleşmeli. */
  categoryId?: string;
  /** null = alan BOŞ olmalı (uydurma yasak). Bildirilmezse sınanmaz. */
  brand?: string | null;
  model?: string | null;
  /** `part` alanı ve profesyonel metin bu ifadeyi EKSİKSİZ taşımalı. */
  part?: string;
  /** üst ürün alanı bu ifadeyi taşımalı. */
  parent?: string;
  /** başlıkta da parça adı beklenir mi? (başlık lemma kullanan vakalarda hayır) */
  headlinePart?: boolean;
  /** hiçbir yüzeyde kaybolmaması gereken kullanıcı ifadesi. */
  keep?: string;
  /** kaydedilmiş belirsizlik gerekçesinin sınıfı. */
  reason?: RegExp;
  /** beklenen requestSubject.kind (PART dışı sınıflarda anlamlı). */
  subjectKind?: string;
};

const COMPAT_CASES: CompatCase[] = [
  // --- Kanonik üst ürün kanıtlı: kesin PART ---
  {
    raw: "Arçelik bulaşık makinesi için rezistans arıyorum",
    verdict: "PART",
    categoryId: "appliances",
    brand: "Arçelik",
    model: null,
    parent: "bulaşık makinesi",
    part: "rezistans",
    headlinePart: true,
  },
  {
    raw: "Bosch bulaşık makinesi için su giriş ventili arıyorum",
    verdict: "PART",
    categoryId: "appliances",
    brand: "Bosch",
    model: null,
    parent: "bulaşık makinesi",
    part: "su giriş ventili",
    headlinePart: true,
  },
  {
    raw: "Siemens fırın için termostat arıyorum",
    verdict: "PART",
    categoryId: "appliances",
    brand: "Siemens",
    model: null,
    parent: "fırın",
    part: "termostat",
  },
  {
    // Uzun parça adı: kelime sayısı bir ret gerekçesi DEĞİLDİR.
    raw: "Bulaşık makinesi için ön sağ kapı kilit mekanizması arıyorum",
    verdict: "PART",
    categoryId: "appliances",
    brand: null,
    model: null,
    parent: "bulaşık makinesi",
    part: "ön sağ kapı kilit mekanizması",
  },
  {
    // Rol çakışması: "Klima" solda üst ürün olarak tüketildi → marka olamaz.
    raw: "Klima için dış ünite fan motoru arıyorum",
    verdict: "PART",
    categoryId: "appliances",
    brand: null,
    model: null,
    parent: "klima",
    part: "dış ünite fan motoru",
  },
  {
    raw: "Televizyon için güç kartı arıyorum",
    verdict: "PART",
    categoryId: "technology",
    brand: null,
    model: null,
    parent: "televizyon",
    part: "güç kartı",
  },
  {
    // Kısa alias tekil ve kanonik ise çalışmaya DEVAM eder.
    raw: "TV için güç kartı arıyorum",
    verdict: "PART",
    categoryId: "technology",
    brand: null,
    model: null,
    parent: "televizyon",
    part: "güç kartı",
  },
  {
    // Katalog dışı makine: marka + alfanümerik belirteç kanıtı.
    raw: "Heidelberg SM 74 için nemlendirme pompası arıyorum",
    verdict: "PART",
    brand: "Heidelberg",
    model: "SM 74",
    part: "nemlendirme pompası",
  },

  // --- Üst ürün kanonik olarak reddedildi ya da hedef bütün bir ürün ---
  /**
   * 1F SONUCU — bu üç satır NOT_PART'tan TENTATIVE'e geçti.
   *
   * 1E, emlak/hizmet için doğrulanmamış kesin RET kayıtlarını kaldırdı; geriye
   * "bilmiyorum" kaldı. 1F ise kanıt kapısını tek yere (authority) topladı:
   * yapı varsa aday üretilir, kanıt yoksa TENTATIVE olur. İkisi birlikte
   * zorunlu olarak bunu verir — "kesin PART üretilmesin" iddiası aynen durur,
   * düşen tek şey "bu asla parça olamaz" iddiasıydı ve o iddianın dayanağı
   * yoktu. İstenen ifade ve gerekçe hâlâ kilitli.
   */
  {
    raw: "Daire için kapı kolu arıyorum",
    verdict: "TENTATIVE",
    keep: "kapı kolu",
    reason: /capability-unknown/i,
  },
  {
    raw: "Ofis için masa ayağı arıyorum",
    verdict: "TENTATIVE",
    keep: "masa ayağı",
    reason: /capability-unknown/i,
  },
  {
    raw: "Ev için rezistans arıyorum",
    verdict: "TENTATIVE",
    keep: "rezistans",
    model: null,
    reason: /capability-unknown/i,
  },
  /**
   * Marka TEK BAŞINA üst ürün kanıtı değildir (1B/1D). 1F'de bu iki satır
   * NOT_PART'tan TENTATIVE'e geçti ve ÖLÇÜLEBİLİR biçimde İYİLEŞTİ: önce
   * "Bosch beyaz eşya arıyorum." üretiliyor, kullanıcının istediği şey
   * tamamen düşüyordu; şimdi "Bosch için rezistans arıyorum." Model hâlâ
   * uydurulmuyor, kesinlik hâlâ verilmiyor.
   */
  {
    raw: "Bosch kampanya için destek arıyorum",
    verdict: "TENTATIVE",
    keep: "destek",
    model: null,
    reason: /capability-unknown/i,
  },
  {
    raw: "Bosch için rezistans arıyorum",
    verdict: "TENTATIVE",
    keep: "rezistans",
    model: null,
    reason: /capability-unknown/i,
  },
  { raw: "Çocuk için tablet arıyorum", verdict: "NOT_PART" },
  { raw: "Salon için televizyon arıyorum", verdict: "NOT_PART" },
  {
    raw: "Ofis için televizyon arıyorum",
    verdict: "NOT_PART",
    keep: "televizyon",
  },
  {
    // Hizmet niyeti marka + amaç ifadesiyle bozulmamalı.
    raw: "Bosch acil için servis arıyorum",
    verdict: "NOT_PART",
    subjectKind: "SERVICE",
    model: null,
  },

  // --- Fiziksel ürün, yetkinlik kürasyonu YOK: belirsiz ama kaybolmuyor ---
  {
    raw: "Tıbbi cihaz için sensör arıyorum",
    verdict: "TENTATIVE",
    keep: "sensör",
    reason: /capability-unknown/i,
  },
  {
    raw: "Matbaa makinesi için kontrol paneli arıyorum",
    verdict: "TENTATIVE",
    keep: "kontrol paneli",
    reason: /capability-unknown/i,
  },
  {
    raw: "Bebek arabası için ön teker kilidi arıyorum",
    verdict: "TENTATIVE",
    keep: "ön teker kilidi",
    reason: /capability-unknown/i,
  },
  {
    raw: "Blender için bıçak bağlantı aparatı arıyorum",
    verdict: "TENTATIVE",
    keep: "bıçak bağlantı aparatı",
    reason: /capability-unknown/i,
  },
  {
    raw: "Masa için yükseklik ayar mekanizması arıyorum",
    verdict: "TENTATIVE",
    keep: "yükseklik ayar mekanizması",
    reason: /capability-unknown/i,
  },

  // --- 1E: AYNI PARENT, FARKLI BİLİNİRLİLİK ---
  // "Matbaa makinesi" kanonik olarak doğrulanmadı; istenen kelimenin eski
  // sözlükte olup olmaması güveni DEĞİŞTİREMEZ. Üçü de aynı aileye düşmeli.
  {
    raw: "Matbaa makinesi için rulman arıyorum",
    verdict: "TENTATIVE",
    keep: "rulman",
    reason: /capability-unknown/i,
  },
  {
    raw: "Matbaa makinesi için kontrol paneli arıyorum",
    verdict: "TENTATIVE",
    keep: "kontrol paneli",
    reason: /capability-unknown/i,
  },
  {
    raw: "Matbaa makinesi için mürekkep besleme valfi arıyorum",
    verdict: "TENTATIVE",
    keep: "mürekkep besleme valfi",
    reason: /capability-unknown/i,
  },

  // --- 1E: AKSESUAR DALI CAPABILITY KAPISINI BYPASS EDEMEZ ---
  {
    raw: "Bebek arabası için bardaklık adaptörü arıyorum",
    verdict: "TENTATIVE",
    keep: "bardaklık adaptörü",
    reason: /capability-unknown/i,
  },
  {
    // Televizyon KANONİK part-bearing → kesinlik üretilebilir.
    raw: "Televizyon için duvar askı aparatı arıyorum",
    verdict: "PART",
    categoryId: "technology",
    brand: null,
    model: null,
    parent: "televizyon",
    part: "duvar askı aparatı",
  },

  // --- 1E: DOĞRULANMIŞ KATALOG İLİŞKİSİ (parent claim var, kanıt da var) ---
  {
    raw: "Golf 7 dizel çıkma motor arıyorum",
    verdict: "PART",
    categoryId: "automotive",
    brand: "Volkswagen",
    part: "dizel çıkma motor",
  },
  {
    raw: "MacBook için şarj adaptörü lazım",
    verdict: "PART",
    categoryId: "technology",
    brand: "Apple",
    model: "MacBook",
    part: "şarj adaptörü",
  },
];

const byVerdict = (v: CompatCase["verdict"]) =>
  COMPAT_CASES.filter((c) => c.verdict === v);

/** İfade herhangi bir korunmuş yüzeyde duruyor mu? (kayıp = hiçbirinde yok) */
function preservedSurfaces(s: ReturnType<typeof surfacesFor>): string {
  return fold(
    [
      s.text,
      s.headline,
      String(s.part ?? ""),
      String(s.subjectName ?? ""),
      s.ambiguityMessages.join(" | "),
    ].join(" ~ "),
  );
}

/**
 * Tablonun BİLDİRİLMİŞ her alanını tek biçimde sınar. Bildirilmeyen alan
 * sınanmaz — böylece bir satır yalnız ilgilendiği boyutu iddia eder ve
 * assertion gücü satır başına açıkça okunur.
 */
function assertCompatCase(c: CompatCase): void {
  const s = surfacesFor(c.raw);
  const at = (msg: string) => `${c.raw}: ${msg}`;

  if (c.verdict === "PART") {
    assert.equal(s.subjectKind, "PART", at(`kesin PART olmalı (${s.subjectKind})`));
  } else if (c.verdict === "NOT_PART") {
    assert.notEqual(s.subjectKind, "PART", at("parça ilişkisi kurulamaz"));
  } else {
    assert.ok(
      !(s.subjectKind === "PART" && s.subjectStatus === "CONFIDENT"),
      at(`yetkinlik yokken KESİN PART üretilemez (${s.subjectKind}/${s.subjectStatus})`),
    );
  }
  if (c.subjectKind) {
    assert.equal(s.subjectKind, c.subjectKind, at(`konu türü (${s.subjectKind})`));
  }
  if (c.categoryId) {
    assert.equal(
      s.categoryId,
      c.categoryId,
      at(`kategori kanonik üst ürünün alanından gelmeli (${s.categoryId})`),
    );
  }
  if (c.brand !== undefined) {
    assert.equal(
      c.brand === null ? s.brand : fold(s.brand ?? ""),
      c.brand === null ? null : fold(c.brand),
      at(`marka (${JSON.stringify(s.brand)})`),
    );
  }
  if (c.model !== undefined) {
    assert.equal(
      c.model === null ? s.model : fold(s.model ?? ""),
      c.model === null ? null : fold(c.model),
      at(`model (${JSON.stringify(s.model)})`),
    );
  }
  if (c.parent) {
    assert.ok(
      fold(s.parentProduct ?? "").includes(fold(c.parent)),
      at(`üst ürün '${c.parent}' yok (${s.parentProduct})`),
    );
  }
  if (c.part) {
    assert.ok(
      fold(s.part ?? "").includes(fold(c.part)),
      at(`parça '${c.part}' eksik (${JSON.stringify(s.part)})`),
    );
    assert.ok(
      fold(s.text).includes(fold(c.part)),
      at(`profesyonel metinde parça eksik → '${s.text}'`),
    );
    assert.ok(
      s.parentModel == null || fold(s.parentModel) !== fold(c.part),
      at(`parentEntity.model parçayı taşıyor (${s.parentModel})`),
    );
  }
  if (c.headlinePart && c.part) {
    assert.ok(
      fold(s.headline).includes(fold(c.part)),
      at(`başlıkta parça yok → '${s.headline}'`),
    );
  }
  if (c.parent) {
    assert.ok(
      fold(s.text).includes(fold(c.parent)),
      at(`profesyonel metinde üst ürün eksik → '${s.text}'`),
    );
  }
  if (c.keep) {
    assert.ok(
      preservedSurfaces(s).includes(fold(c.keep)),
      at(`'${c.keep}' hiçbir korunmuş yüzeyde yok → ${preservedSurfaces(s)}`),
    );
  }
  if (c.reason) {
    assert.ok(
      s.ambiguityMessages.some((m) => c.reason!.test(m)),
      at(`gerekçe ${c.reason} olarak kaydedilmeli → ${JSON.stringify(s.ambiguityMessages)}`),
    );
  }
}

check("I21: katalog dışı parça da istenen şey olarak korunur (KB-12 açık dünya)", () => {
  /**
   * Sözleşme: kanonik bir üst ürün varken kullanıcı "… İÇİN <X>" yazdıysa X
   * istenen şeydir. X katalogda OLMASA BİLE korunur — katalog allowlist
   * değildir. X model olamaz, sessizce kaybolamaz.
   *
   * Tablo hem katalogda TANINAN ("rezistans") hem TANINMAYAN ("su giriş
   * ventili") örnekleri, hem de üst ürün kanıtı bulunmayan negatifleri
   * birlikte taşır; kelimeye özel liste sınanmaz.
   */
  for (const c of COMPAT_CASES) assertCompatCase(c);

  // 'ev'/'ofis' üst ürün ALANINA da sızamaz.
  for (const [raw, token] of [
    ["Ev için klima arıyorum", "ev"],
    ["Ofis için televizyon arıyorum", "ofis"],
  ] as const) {
    const s = surfacesFor(raw);
    assert.ok(
      !fold(s.parentProduct ?? "").includes(token),
      `${raw}: '${token}' üst ürün olamaz (${s.parentProduct})`,
    );
  }
});

check("I22: başlık zenginleştirilmiş parça adını kaybetmez (KB-11 başlık)", () => {
  const s = surfacesFor("Heidelberg SM 74 için nemlendirme pompası arıyorum");
  for (const must of ["heidelberg", "sm 74", "nemlendirme pompasi"]) {
    assert.ok(
      fold(s.headline).includes(must),
      `başlıkta '${must}' yok → '${s.headline}'`,
    );
  }
  // Aynı bilgi iki kez yazılmamalı.
  const pompaCount = (fold(s.headline).match(/pompa/g) ?? []).length;
  assert.equal(pompaCount, 1, `başlıkta 'pompa' ${pompaCount} kez → '${s.headline}'`);
});

check("I23: konum belirteci parça adına iki kez eklenemez", () => {
  /**
   * "ön far" + position "ön" → "ön ön far". Genel kural: konum belirteci parça
   * adının başında ZATEN varsa tekrar eklenmez. Cümleye özel değiştirme yok.
   */
  for (const raw of ["Mercedes C180 için ön far arıyorum", "C180 ön far"]) {
    const s = surfacesFor(raw);
    for (const surface of [s.text, s.headline, String(s.part ?? "")]) {
      assert.ok(
        !/\bon\s+on\b/.test(fold(surface)),
        `${raw}: bitişik tekrar üretildi → '${surface}'`,
      );
    }
    assert.ok(fold(s.text).includes("on far"), `${raw}: 'ön far' kayboldu → '${s.text}'`);
    assert.ok(fold(s.headline).includes("c180"), `${raw}: C180 kayboldu → '${s.headline}'`);
  }
  const explicit = surfacesFor("Mercedes C180 için ön far arıyorum");
  assert.ok(
    fold(explicit.text).includes("mercedes"),
    `açık marka metinde korunmalı → '${explicit.text}'`,
  );
});

check("I25: amaç/yer ifadesi üst ürün değildir — 'ev için klima' emlak talebi olamaz", () => {
  /**
   * "X için Y" yapısında X HER ZAMAN üst ürün değildir:
   *   - X gerçek bir ürün/makine ise  → Y uyumlu parça olabilir
   *   - X kullanım YERİ / AMAÇ ise     → Y asıl talep konusudur
   *
   * Ölçülen hata: "Ev için klima arıyorum" → kategori real-estate, subject
   * REAL_ESTATE, metin "konut arıyorum." — kullanıcının yazdığı KLİMA
   * tamamen kayboluyor. Oysa `productType = "Klima"` zaten yakalanmış durumda;
   * yani ayırt edici sinyal sistemde var, kullanılmıyor.
   */
  const klima = surfacesFor("Ev için klima arıyorum");
  assert.notEqual(
    klima.subjectKind,
    "REAL_ESTATE",
    `'Ev için klima' emlak talebi olamaz (kind=${klima.subjectKind})`,
  );
  assert.ok(
    fold(klima.text).includes("klima"),
    `klima metinden düşmemeli → '${klima.text}'`,
  );
  assert.ok(
    !fold(klima.text).includes("konut"),
    `'konut arıyorum'a düşmemeli → '${klima.text}'`,
  );
  assert.ok(
    fold(klima.headline).includes("klima"),
    `başlıkta klima olmalı → '${klima.headline}'`,
  );

  // Ofis/televizyon bugün doğru — kilitle.
  const tv = surfacesFor("Ofis için televizyon arıyorum");
  assert.ok(fold(tv.text).includes("televizyon"), `→ '${tv.text}'`);
  assert.notEqual(tv.subjectKind, "PART", "televizyon parça olamaz");

  // GERÇEK emlak talepleri bozulmamalı.
  for (const raw of ["Ev arıyorum", "Ankara'da 2+1 ev arıyorum"]) {
    const s = surfacesFor(raw);
    assert.equal(
      s.subjectKind,
      "REAL_ESTATE",
      `${raw}: gerçek emlak talebi kalmalı (kind=${s.subjectKind})`,
    );
  }

  // Hizmet niyeti korunmalı — bütün ürün talebine zorlanmamalı.
  const servis = surfacesFor("Ev için klima servisi arıyorum");
  assert.equal(
    servis.subjectKind,
    "SERVICE",
    `hizmet niyeti korunmalı (kind=${servis.subjectKind})`,
  );

  // Markasız gerçek parça ilişkisi korunmalı.
  const rez = surfacesFor("Bulaşık makinesi için rezistans arıyorum");
  assert.ok(
    fold(rez.text).includes("rezistans"),
    `markasız parça ilişkisi korunmalı → '${rez.text}'`,
  );
});

/* ------------------------------------------------------------------------ *
 * KANONİK PARÇA TAŞIYICILIĞI (1C/1D) — I27-I33
 *
 * Ortak sözleşme:
 *   - `PART_BEARING` DÜĞÜM bazında, versiyonlanabilir bir KAYNAK dosyadan
 *     gelir; alan (domain) toplamasıyla üretilemez.
 *   - Kayıt YOKLUĞU bir RET değildir: talep kesinleştirilmez ama kaybolmaz.
 *   - Konu, kanonik alanlar ve profesyonel metin AYNI gerçeği anlatır.
 *   - Üst ürün olarak tüketilen span aynı anda marka/model olamaz.
 * ------------------------------------------------------------------------ */

/** Kanonik capability kaynağı — generator'ın GİRDİSİ, çıktısı değil. */
const PART_BEARING_SOURCE_PATH = pathJoin(
  repoRootForTests(),
  "data",
  "taxonomy-sources",
  "part-bearing-capability.json",
);

type PartBearingEntry = {
  nodeId: string;
  bearing: boolean;
  scope: "node" | "subtree";
  source: string;
  note?: string;
};

/**
 * Uyumluluk niteliği taşıyan talep konusu türleri — TEK authority'ye bağlı.
 * Sistemde bugün ikisi var; `RequestSubjectKind` genişlerse (COMPONENT,
 * SPARE_PART …) yeni tür buraya eklenir ve aynı kapıdan geçer.
 */
const COMPATIBILITY_KINDS = new Set(["PART", "ACCESSORY"]);

/** Kanıt kodları — yalnız bunlar CONFIDENT uyumluluk kararını taşıyabilir. */
const VERIFIED_PARENT_EVIDENCE = /^parent:(taxonomy-part-bearing|catalog-model|branded-designator)$/;

check("I27: SPLIT-BRAIN yasağı — konu, kanonik alanlar ve metin aynı gerçeği anlatır", () => {
  /**
   * `subject.kind === PART` ise en az şunlar birlikte bulunmalıdır:
   *   (a) somut istenen parça (kanonik `part` alanı),
   *   (b) geçerli üst ürün YA DA açıkça kaydedilmiş unresolved parent durumu,
   *   (c) kullanıcının ifadesini koruyan profesyonel metin.
   *
   * Ölçülen HEAD davranışı: "Ev için rezistans" → kind=PART, part=null,
   * üst ürün=null, metin "konut arıyorum." — üç yüzey üç ayrı şey söylüyor.
   */
  for (const c of COMPAT_CASES) {
    const s = surfacesFor(c.raw);
    if (!COMPATIBILITY_KINDS.has(s.subjectKind)) continue;

    // (b) Her hâlde: üst ürün ya bilinir ya da belirsizliği KAYDEDİLMİŞtir.
    const parentKnown = Boolean(s.parentProduct || s.parentModel || s.brand);
    const parentDeclaredUnresolved = s.ambiguityMessages.some((m) =>
      /parent|ust_urun|compat/i.test(m),
    );
    assert.ok(
      parentKnown || parentDeclaredUnresolved,
      `${c.raw}: ${s.subjectKind} ama ne üst ürün var ne de unresolved parent kaydı`,
    );

    if (s.subjectStatus === "CONFIDENT") {
      // (a)+(c) KESİN karar tam sözleşmeyi taşır.
      assert.ok(
        s.part && s.part.trim().length > 0,
        `${c.raw}: CONFIDENT ${s.subjectKind} ama kanonik part alanı boş (split-brain)`,
      );
      assert.ok(
        fold(s.text).includes(fold(String(s.part))),
        `${c.raw}: profesyonel metin parçayı anlatmıyor → '${s.text}' (part=${s.part})`,
      );
      continue;
    }

    /**
     * TENTATIVE karar da SESSİZ KALAMAZ (1E). Kanonik alan kategori şemasında
     * bulunmayabilir (ör. baby şemasında `part` yok, alan domain geçişinde
     * temizleniyor); o zaman bile kullanıcının istediği şey korunmuş bir
     * yüzeyde durmalıdır. Kaydedilmemiş bir belirsizlik, kayıptır.
     */
    assert.ok(
      c.keep == null || preservedSurfaces(s).includes(fold(c.keep)),
      `${c.raw}: TENTATIVE ${s.subjectKind} ama istenen şey hiçbir yüzeyde yok → ${preservedSurfaces(s)}`,
    );
  }
});

check("I28: kanıt yetersizken talep kaybolmaz — aday/unresolved korunur", () => {
  /**
   * Üst ürün kanıtlanamıyorsa sistem KESİN PART üretmez; ama kullanıcının
   * yazdığı istenen şey de sessizce düşmez. Ölçülen HEAD davranışı:
   * "Bosch için rezistans arıyorum" → "Bosch beyaz eşya arıyorum." —
   * 'rezistans' hiçbir yüzeyde yok, hiçbir kayıt da yok.
   *
   * Sınıf başına beklentiler tabloda; burada sınıfın BOŞ OLMADIĞI da
   * kilitlenir ki tablo sessizce boşalıp invariant no-op'a düşmesin.
   */
  const notPart = byVerdict("NOT_PART");
  const tentative = byVerdict("TENTATIVE");
  // Sınıf sayıları: tablo sessizce boşalıp invariant no-op'a düşmesin diye.
  // 1F'de beş satır NOT_PART'tan TENTATIVE'e geçti (bkz. tablo notları).
  assert.ok(notPart.length >= 4, "NOT_PART sınıfı boşaltılamaz");
  assert.ok(tentative.length >= 12, "TENTATIVE sınıfı boşaltılamaz");
  for (const c of [...notPart, ...tentative]) assertCompatCase(c);

  // Yayın hiçbir belirsizlik yüzünden engellenmez — kayıt bir kapı değildir.
  for (const c of tentative) {
    const s = surfacesFor(c.raw);
    assert.ok(
      s.text.trim().length > 0,
      `${c.raw}: belirsizlik kaydı profesyonel metni boşaltamaz`,
    );
  }
});

check("I29: kanonik üst üründe parça adı EKSİKSİZ korunur", () => {
  /**
   * Ölçülen HEAD kayıpları:
   *   "Klima için dış ünite fan motoru" → part='dış fan motoru' ('ünite' düştü)
   *   "Televizyon için güç kartı"       → part='kart', metin 'televizyon
   *                                        arıyorum.' ('güç' düştü, konu değişti)
   * Kısaltma bir NORMALİZASYON değil KAYIPTIR.
   */
  const parts = byVerdict("PART");
  assert.ok(parts.length >= 7, "PART sınıfı boşaltılamaz");
  for (const c of parts) assertCompatCase(c);
});

check("I30: kısa/çakışabilir alias yüksek güvenli üst ürün kanıtı üretmez", () => {
  /**
   * Denetimde EV, SW, PC, TV, UPS, NUC, fan, Cam gibi kısa alias'lar bulundu.
   * Kural KÖRLEMESİNE YASAK DEĞİLDİR — TV ve PC gerçek ürün türleridir ve
   * çalışmaya devam etmelidir (tabloda "TV için güç kartı" satırı). Ayırt
   * edici olan BAĞLAMDIR: alias çözümü belirsizse
   * (`resolveTaxonomyAlias(...).ambiguous`) yüksek güvenli karar için
   * kullanılamaz; kanonik etiketle tam ve tekil eşleşme kullanılabilir.
   */
  ensureTaxonomyLoaded();
  assert.ok(
    resolveTaxonomyAlias("ev")?.ambiguous,
    "'ev' alias'ı belirsiz olarak işaretlenmeli (emlak ↔ elektrikli araç)",
  );

  // Kısa alias guard'ı GERÇEK modeli reddetmemeli.
  for (const [raw, model] of [
    ["Heidelberg SM 74 için nemlendirme pompası arıyorum", "sm 74"],
    ["Mercedes C180 için ön far arıyorum", "c180"],
  ] as const) {
    assert.equal(
      fold(surfacesFor(raw).model ?? ""),
      model,
      `${raw}: gerçek model reddedilemez`,
    );
  }
});

check("I31: kanonik üst ürün span'i aynı anda marka/model olamaz", () => {
  /**
   * Ölçülen hata: "Klima için dış ünite fan motoru arıyorum" →
   * `categoryId=automotive`, `brand="Klima"`. "Klima" solda KANONİK ÜST ÜRÜN
   * olarak tüketilmişken aynı jeton marka alanına da yazılıyordu; kategori de
   * otomotiv yedek parça grubundan geliyordu.
   *
   * Kural ada özel DEĞİLDİR, SPAN'e bakar: üst ürün olarak tüketilen span
   * marka/model adayından güçlüdür ve kategori onun alanından gelir. Tablodaki
   * `categoryId`/`brand`/`model` alanları hem kuralı hem de regresyon tarafını
   * (span DIŞINDAKİ gerçek marka silinemez) taşır.
   */
  const declared = COMPAT_CASES.filter(
    (c) => c.categoryId || c.brand !== undefined || c.model !== undefined,
  );
  assert.ok(declared.length >= 10, "rol/kategori beklentisi olan satırlar boşaltılamaz");
  for (const c of declared) assertCompatCase(c);

  // Span DIŞINDA kalan gerçek kullanıcı markası korunur.
  for (const [raw, brand] of [
    ["Heidelberg SM 74 için nemlendirme pompası arıyorum", "heidelberg"],
    ["Mercedes C180 için ön far arıyorum", "mercedes"],
    ["Arçelik bulaşık makinesi için rezistans arıyorum", "arçelik"],
  ] as const) {
    assert.equal(
      fold(surfacesFor(raw).brand ?? ""),
      fold(brand),
      `${raw}: parent span DIŞINDAKİ marka korunmalı`,
    );
  }
});

check("I32: PART_BEARING alan toplamasıyla değil, düğüm bazında bildirilir", () => {
  /**
   * Ölçülen hata: yetkinlik generator içinde `PART_BEARING_DOMAINS` ile
   * veriliyordu — bir alanın İÇİNDEKİ BÜTÜN ürünler aynı yetenekle
   * işaretleniyordu (appliances 97, technology 113, machinery 305,
   * automotive 26 = 541 düğüm). Alan üyeliği bir ürünün servis edilebilir
   * olduğunu KANITLAMAZ.
   *
   * Bu invariant dört şeyi birden kilitler:
   *   1) yetkinliğin kaynağı versiyonlanabilir bir VERİ dosyasıdır,
   *   2) üretilmiş her PART_BEARING düğüm o kaynağa kadar izlenebilir,
   *   3) hiçbir alanın ürün düğümlerinin TAMAMI işaretli değildir,
   *   4) "parça taşımaz" AÇIKÇA bildirilir; sessiz varsayım değildir.
   */
  ensureTaxonomyLoaded();
  const src = JSON.parse(readFileSync(PART_BEARING_SOURCE_PATH, "utf8")) as {
    capability: string;
    version: string;
    entries: PartBearingEntry[];
  };
  assert.equal(src.capability, "PART_BEARING", "kaynak dosya yetkinliği bildirmeli");
  assert.ok(src.version, "kaynak dosya versiyonlanmalı");

  const seen = new Set<string>();
  for (const e of src.entries) {
    assert.ok(!seen.has(e.nodeId), `kaynakta yinelenen node id: ${e.nodeId}`);
    seen.add(e.nodeId);
    assert.ok(e.source?.trim(), `${e.nodeId}: provenance zorunlu`);
    assert.ok(
      e.scope === "node" || e.scope === "subtree",
      `${e.nodeId}: scope 'node' veya 'subtree' olmalı`,
    );
    assert.ok(getTaxonomyNode(e.nodeId), `kaynaktaki node id taksonomide yok: ${e.nodeId}`);
  }

  const nodes = listAllTaxonomyNodes();
  const bearing = nodes.filter((n) => n.applicableCapabilities.includes("PART_BEARING"));
  assert.ok(bearing.length > 0, "hiçbir düğüm PART_BEARING bildirmiyor");

  // (2) Üretilmiş her yetkinlik kaynağa kadar izlenebilir.
  const positiveIds = new Set(src.entries.filter((e) => e.bearing).map((e) => e.nodeId));
  for (const n of bearing) {
    assert.ok(
      getTaxonomyAncestorIds(n.id).some((id) => positiveIds.has(id)),
      `${n.id}: PART_BEARING kaynağa kadar izlenemiyor`,
    );
  }

  // (3) Hiçbir alanın ürün düğümlerinin TAMAMI işaretli olamaz.
  const byCategory = new Map<string, { total: number; marked: number }>();
  for (const n of nodes) {
    if (n.nodeType !== "PRODUCT_TYPE") continue;
    const e = byCategory.get(n.categoryId) ?? { total: 0, marked: 0 };
    e.total += 1;
    if (n.applicableCapabilities.includes("PART_BEARING")) e.marked += 1;
    byCategory.set(n.categoryId, e);
  }
  for (const [cat, e] of byCategory) {
    if (e.marked === 0) continue;
    assert.ok(
      e.marked < e.total,
      `${cat}: ürün düğümlerinin TAMAMI (${e.marked}/${e.total}) işaretli — alan toplaması`,
    );
  }

  /**
   * (4) DÜRÜST PROVENANCE (1E). Kurucu düğüm listesini tek tek onaylamadı;
   * "kurucu kararı"/"founder approved" gibi doğrulanmamış iddia kaynakta
   * duramaz. Etiket, kaydı gerçekten neyin doğruladığını söylemeli.
   */
  for (const e of src.entries) {
    assert.ok(
      !/kurucu|founder|approved|onaylad/i.test(e.source),
      `${e.nodeId}: doğrulanmamış otorite iddiası taşıyan provenance: '${e.source}'`,
    );
    assert.ok(
      /^(seed|verified|derived):/.test(e.source),
      `${e.nodeId}: provenance tanınan bir sınıfla başlamalı (seed|verified|derived) — '${e.source}'`,
    );
    assert.ok(
      e.note && e.note.trim().length > 0,
      `${e.nodeId}: kaydın neye dayandığı yazılmalı`,
    );
  }

  /**
   * (5) GENİŞ KESİN NEGATİF YOK (1E). "Daire için kapı kolu" fiziksel bir ürün
   * talebi olabilir; kurucu emlak/hizmet alanlarının hiçbir zaman uyumluluk
   * parent'ı olamayacağına dair bir ürün kararı VERMEDİ. Doğrulanmamış geniş
   * subtree reddi, kürasyon eksiğini kesin bilgi gibi gösterir.
   */
  for (const e of src.entries) {
    assert.ok(
      !(e.bearing === false && e.scope === "subtree"),
      `${e.nodeId}: doğrulanmamış geniş subtree EXCLUDED kararı kullanılamaz`,
    );
  }
  const realEstateBearing = bearing.filter((n) => n.categoryId === "real-estate");
  assert.equal(
    realEstateBearing.length,
    0,
    `emlak düğümü PART_BEARING olamaz: ${realEstateBearing.map((n) => n.id).join(", ")}`,
  );

  /**
   * (6) NO-OP KAYIT YOK (1E). Sıfır düğüme uygulanan kayıt, kaynağı gerçekte
   * olmayan bir kararla şişirir. Her kayıt en az bir mevcut düğüme değmeli.
   */
  for (const e of src.entries) {
    const applied = nodes.filter(
      (n) =>
        n.nodeType === "PRODUCT_TYPE" &&
        getTaxonomyAncestorIds(n.id).includes(e.nodeId),
    ).length;
    assert.ok(
      applied > 0,
      `${e.nodeId}: hiçbir düğüme uygulanmıyor (no-op kayıt)`,
    );
  }

  // Parça düğümünün kendisi parça taşıyıcı değildir (roller karışmaz).
  assert.equal(
    bearing.filter((n) => n.nodeType === "PART_TYPE").length,
    0,
    "PART_TYPE düğümü PART_BEARING olamaz",
  );

  // Bu turun kanonik seed'leri bildirilmiş olmalı (ad DEĞİL, yetkinlik sınanır).
  for (const name of ["Bulaşık Makinesi", "Fırın", "Klima", "Televizyon"]) {
    assert.ok(
      bearing.some((n) => fold(n.canonicalName) === fold(name) && n.nodeType === "PRODUCT_TYPE"),
      `'${name}' kanonik olarak PART_BEARING bildirmeli`,
    );
  }
});

check("I33: kürasyonsuz fiziksel ürün 'parça taşıyamaz' sayılmaz", () => {
  /**
   * Yetkinlik kaydı YOKLUĞU bir RET değildir ve bildirilmiş retten AYRI bir
   * gerekçe alır: birincisinde kürasyon açılır ya da soru sorulur, ikincisinde
   * sorulmaz. Bu ayrım kaydın SINIFINDA taşınır.
   */
  for (const c of byVerdict("TENTATIVE")) {
    const s = surfacesFor(c.raw);
    assert.ok(
      s.ambiguityMessages.some((m) => /capability-unknown/i.test(m)),
      `${c.raw}: gerekçe 'kürasyon yok' olmalı → ${JSON.stringify(s.ambiguityMessages)}`,
    );
    assert.ok(
      !s.ambiguityMessages.some((m) => /not-part-bearing/i.test(m)),
      `${c.raw}: kürasyon eksiği 'bildirilmiş ret' gibi kaydedilemez`,
    );
  }
  /**
   * KARŞI TARAF (1E): "bildirilmiş ret" gerekçesi yalnız kaynakta DOĞRULANMIŞ
   * bir node-level negatif kaydı varsa üretilebilir. Bugün öyle bir kayıt yok;
   * dolayısıyla hiçbir talep 'not-part-bearing' iddiası taşıyamaz. Bu, ret
   * mekanizmasının kaldırıldığı anlamına gelmez — dayanaksız kullanılamayacağı
   * anlamına gelir.
   */
  const src = JSON.parse(readFileSync(PART_BEARING_SOURCE_PATH, "utf8")) as {
    entries: PartBearingEntry[];
  };
  const verifiedNegatives = src.entries.filter((e) => e.bearing === false);
  for (const raw of [
    "Ofis için masa ayağı arıyorum",
    "Daire için kapı kolu arıyorum",
    "Ev için rezistans arıyorum",
  ]) {
    const s = surfacesFor(raw);
    const claimsRefusal = s.ambiguityMessages.some((m) => /not-part-bearing/i.test(m));
    assert.equal(
      claimsRefusal,
      verifiedNegatives.length > 0,
      `${raw}: doğrulanmış negatif kaydı ${verifiedNegatives.length} iken 'bildirilmiş ret' iddiası ${claimsRefusal} → ${JSON.stringify(s.ambiguityMessages)}`,
    );
  }
});


check("I34: CONFIDENT uyumluluk kararı yalnız doğrulanmış parent kanıtıyla verilir", () => {
  /**
   * ANA SORUN (1E): aynı "parent için istenen şey" ilişkisi dört ayrı erken
   * daldan geçiyordu — kapalı dünya PART_LEMMAS, açık dünya PART, ACCESSORY
   * ve forcedNeedType. Yalnız ikisi capability kapısından geçiyordu, bu yüzden
   * güven istenen KELİMENİN sözlükte olup olmamasına göre değişiyordu:
   *
   *   "Matbaa makinesi için rulman"          → PART / CONFIDENT   (sözlükte)
   *   "Matbaa makinesi için kontrol paneli"  → kayıp, MANUFACTURED_ITEM
   *   "Blender için bıçak bağlantı aparatı"  → ACCESSORY / CONFIDENT
   *
   * Sözleşme: bir lemma ya da regex TEK BAŞINA bu invariant'ı geçiremez.
   * CONFIDENT uyumluluk kararı yalnız doğrulanmış parent kanıtıyla verilir.
   */
  for (const c of COMPAT_CASES) {
    const s = surfacesFor(c.raw);
    if (!COMPATIBILITY_KINDS.has(s.subjectKind)) continue;
    if (s.subjectStatus !== "CONFIDENT") continue;

    // (1) Doğrulanmış parent kanıtı.
    const hasCanonicalEvidence = s.subjectEvidence.some((e) =>
      VERIFIED_PARENT_EVIDENCE.test(e),
    );
    const hasCatalogParent = Boolean(s.parentBrand || s.parentModel || s.model);
    assert.ok(
      hasCanonicalEvidence || hasCatalogParent,
      `${c.raw}: CONFIDENT ${s.subjectKind} ama doğrulanmış parent kanıtı yok (ev=${JSON.stringify(s.subjectEvidence)})`,
    );

    // (2) Somut istenen şey — kanonik alanda.
    assert.ok(
      s.part && s.part.trim().length > 0,
      `${c.raw}: CONFIDENT ${s.subjectKind} ama kanonik part alanı boş`,
    );

    // (3) Rol ayrımı: istenen şey üst ürünün modeli/markası olamaz.
    for (const [role, value] of [
      ["model", s.model],
      ["parentEntity.model", s.parentModel],
      ["brand", s.brand],
    ] as const) {
      assert.ok(
        value == null || fold(value) !== fold(String(s.part)),
        `${c.raw}: istenen şey '${role}' alanına da yazılmış (${value})`,
      );
    }

    // (4) Yüzey metni istenen şeyi taşımalı.
    assert.ok(
      fold(s.text).includes(fold(String(s.part))),
      `${c.raw}: profesyonel metin istenen şeyi düşürüyor → '${s.text}'`,
    );
  }
});

check("I35: aynı parent, farklı bilinirlilik — kesinlik sözlüğe göre değişemez", () => {
  /**
   * Ölçülen HEAD davranışı:
   *   "Matbaa makinesi için rulman"         → PART / CONFIDENT  (kelime sözlükte)
   *   "Matbaa makinesi için kontrol paneli" → kesinlik yok, ifade cümleden kayıp
   *
   * Sözleşme: kesinlik ÜST ÜRÜNDEN gelir, istenen kelimeden değil. Aynı
   * parent'ın bütün talepleri aynı kesinlik ailesine düşer, istenen şey her
   * hâlde korunur, gerekçe aynı authority'den gelir ve cümle boşaltılmaz.
   */
  const FAMILIES: Array<{ parent: string; bearing: boolean; raws: [string, string][] }> = [
    {
      parent: "Matbaa makinesi (kanonik doğrulanmamış)",
      bearing: false,
      raws: [
        ["Matbaa makinesi için rulman arıyorum", "rulman"],
        ["Matbaa makinesi için kontrol paneli arıyorum", "kontrol paneli"],
        ["Matbaa makinesi için mürekkep besleme valfi arıyorum", "mürekkep besleme valfi"],
      ],
    },
    {
      parent: "Bulaşık makinesi (kanonik PART_BEARING)",
      bearing: true,
      raws: [
        ["Bulaşık makinesi için rulman arıyorum", "rulman"],
        ["Bulaşık makinesi için rezistans arıyorum", "rezistans"],
        ["Bulaşık makinesi için ön sağ kapı kilit mekanizması arıyorum", "ön sağ kapı kilit mekanizması"],
      ],
    },
  ];
  for (const family of FAMILIES) {
    const reasons = new Set<string>();
    for (const [raw, keep] of family.raws) {
      const s = surfacesFor(raw);
      assert.equal(
        COMPATIBILITY_KINDS.has(s.subjectKind) && s.subjectStatus === "CONFIDENT",
        family.bearing,
        `${raw}: kesinlik beklentisi ${family.bearing}, ölçülen ${s.subjectKind}/${s.subjectStatus}`,
      );
      assert.ok(
        preservedSurfaces(s).includes(fold(keep)),
        `${raw}: '${keep}' hiçbir korunmuş yüzeyde yok → ${preservedSurfaces(s)}`,
      );
      assert.ok(s.text.trim().length > 0, `${raw}: profesyonel metin boşaltılamaz`);
      if (!family.bearing) {
        const reason = s.ambiguityMessages.find((m) => /compat_target_unresolved/i.test(m));
        assert.ok(reason, `${raw}: belirsizlik gerekçesi kaydedilmemiş`);
        // Mesaj biçimi "<kind>:<message>"; gerekçe SINIFI kind içindedir.
        reasons.add(reason!.split(":").slice(0, 2).join(":"));
      }
    }
    assert.ok(
      family.bearing || reasons.size === 1,
      `${family.parent}: gerekçe dala göre değişiyor → ${[...reasons].join(" | ")}`,
    );
  }
});

check("I36: üretim niyeti AÇIK kanıt ister — ilişki yapısı üretim değildir", () => {
  /**
   * Ölçülen hata: "Matbaa makinesi için kontrol paneli arıyorum" →
   * `intent=MANUFACTURE`, `kind=MANUFACTURED_ITEM/CONFIDENT`, profesyonel metin
   * `"arıyorum."`. Sebep, alanın ADINI taşıyan bir sözcüğün ("matbaa") tek
   * başına üretim niyeti seçtirmesiydi.
   *
   * Kural GENEL ve ada özel DEĞİL: alan adı zayıf sinyaldir, üretim niyetini
   * ancak AÇIK bir üretim kanıtı (ürettirmek, imal ettirmek, fason, adet +
   * üretim bağlamı …) taşır. "makine", "matbaa", ürün adı, "için" ve parça adı
   * birlikte bile MANUFACTURED_ITEM için yeterli değildir.
   */
  const NOT_MANUFACTURE: Array<[string, string]> = [
    ["Matbaa makinesi için kontrol paneli arıyorum", "kontrol paneli"],
    ["Matbaa makinesi için rulman arıyorum", "rulman"],
    ["Matbaa makinesi için mürekkep besleme valfi arıyorum", "mürekkep besleme valfi"],
    ["Tıbbi cihaz için sensör arıyorum", "sensör"],
    ["Bebek arabası için bardaklık adaptörü arıyorum", "bardaklık adaptörü"],
    ["Masa için yükseklik ayar mekanizması arıyorum", "yükseklik ayar mekanizması"],
  ];
  for (const [raw, item] of NOT_MANUFACTURE) {
    const s = surfacesFor(raw);
    assert.notEqual(
      s.subjectKind,
      "MANUFACTURED_ITEM",
      `${raw}: ilişki yapısı üretim talebi sayılamaz (${s.subjectKind})`,
    );
    assert.notEqual(
      s.intent,
      "MANUFACTURE",
      `${raw}: açık üretim kanıtı yokken intent MANUFACTURE olamaz`,
    );
    // Kullanıcının istediği şey profesyonel metinden düşemez.
    assert.ok(
      fold(s.text).includes(fold(item)),
      `${raw}: profesyonel metin istenen şeyi düşürüyor → '${s.text}'`,
    );
  }

  /** AÇIK üretim niyeti — doğru okunmaya devam etmeli. */
  const MANUFACTURE: string[] = [
    "Matbaa makinesi ürettirmek istiyorum",
    "Kontrol paneli imal ettirmek istiyorum",
    "500 adet metal panel yaptırmak istiyorum",
    "Fason üretim için plastik parça ürettirmek istiyorum",
  ];
  for (const raw of MANUFACTURE) {
    const s = surfacesFor(raw);
    assert.equal(
      s.intent,
      "MANUFACTURE",
      `${raw}: açık üretim niyeti korunmalı (intent=${s.intent}, kind=${s.subjectKind})`,
    );
  }
});

check("I37: istenen şey kategori şemasından BAĞIMSIZ olarak canonical konuda durur", () => {
  /**
   * Ölçülen hata: "Bebek arabası için bardaklık adaptörü arıyorum" →
   * `requestSubject.name = "adaptör"`, `fields.part = null` (baby şemasında
   * `part` alanı yok, domain geçişinde temizleniyor) ve kullanıcının tam
   * ifadesi YALNIZ unresolved mesajında yaşıyor.
   *
   * Sözleşme: kategori formuna yeni alan EKLENMEZ. Canonical birincil yüzey
   * `requestSubject.name`dir ve kullanıcının istediği şeyi taşımak zorundadır;
   * `unresolvedExpressions` yalnız destekleyici audit izidir.
   */
  const CASES: Array<[string, string]> = [
    ["Bebek arabası için bardaklık adaptörü arıyorum", "bardaklık adaptörü"],
    ["Masa için yükseklik ayar mekanizması arıyorum", "yükseklik ayar mekanizması"],
    ["Matbaa makinesi için kontrol paneli arıyorum", "kontrol paneli"],
    ["Blender için bıçak bağlantı aparatı arıyorum", "bıçak bağlantı aparatı"],
  ];
  for (const [raw, item] of CASES) {
    const s = surfacesFor(raw);
    assert.ok(
      fold(String(s.subjectName ?? "")).includes(fold(item)),
      `${raw}: requestSubject.name istenen şeyi taşımıyor (name=${JSON.stringify(s.subjectName)})`,
    );
    assert.ok(
      fold(s.text).includes(fold(item)),
      `${raw}: profesyonel metin istenen şeyi düşürüyor → '${s.text}'`,
    );
    // Audit izi tek başına yeterli SAYILMAZ — yukarısı zaten kanıtlar.
    assert.ok(
      s.ambiguityMessages.length === 0 ||
        s.ambiguityMessages.some((m) => /compat_target_unresolved/i.test(m)),
      `${raw}: belirsizlik kaydı tanınan sınıfta olmalı`,
    );
  }
});

check("I38: kullanıcının doğruladığı ROL ile üst ürün GÜVENİ ayrı şeylerdir", () => {
  /**
   * Kullanıcı browse/structured akışta "Yedek parça" seçtiyse rol
   * DOĞRULANMIŞTIR ve bir daha sorulmaz. Ama bu seçim hangi ürün için
   * olduğunu KANITLAMAZ: marka/model uydurulamaz ve ilişki CONFIDENT olamaz.
   */
  const rolePinned = (text: string) =>
    surfacesFor(text, { needType: "part" });

  // (1) Rol seçildi, üst ürün yazılmadı.
  const bare = rolePinned("yedek parça arıyorum");
  assert.ok(
    ["PART", "ACCESSORY"].includes(bare.subjectKind),
    `rol seçimi korunmalı (${bare.subjectKind})`,
  );
  assert.ok(
    bare.subjectEvidence.some((e) => /user-confirmed-role/i.test(e)),
    `kullanıcı onayı kanıt olarak kaydedilmeli → ${JSON.stringify(bare.subjectEvidence)}`,
  );
  assert.notEqual(
    bare.subjectStatus,
    "CONFIDENT",
    "üst ürün kanıtlanmadan ilişki KESİN sayılamaz",
  );
  assert.equal(bare.parentBrand, null, "marka uydurulamaz");
  assert.equal(bare.parentModel, null, "model uydurulamaz");
  assert.ok(
    bare.subjectEvidence.some((e) => /parent-required|parent-capability-unknown/i.test(e)),
    `üst ürünün gerektiği kaydedilmeli → ${JSON.stringify(bare.subjectEvidence)}`,
  );
  // Rol bir daha SORULMAZ, üst ürün sorulur.
  assert.ok(
    !bare.nextQuestionKeys.includes("needType"),
    `rol tekrar sorulamaz → ${bare.nextQuestionKeys.join(",")}`,
  );
  assert.ok(
    bare.nextQuestionKeys.length > 0,
    "üst ürünü netleştirecek soru sorulmalı",
  );

  // (2) Rol seçildi VE doğrulanmış üst ürün yazıldı → ilişki kesinleşebilir.
  const withParent = rolePinned("Bulaşık makinesi için rezistans arıyorum");
  assert.equal(withParent.subjectKind, "PART", "rol korunmalı");
  assert.equal(withParent.subjectStatus, "CONFIDENT", "doğrulanmış üst üründe ilişki kesindir");
  assert.ok(
    withParent.subjectEvidence.some((e) => /parent:taxonomy-part-bearing/.test(e)),
    `üst ürün kanıtı kaydedilmeli → ${JSON.stringify(withParent.subjectEvidence)}`,
  );

  // (3) Seçim yok, üst ürün iddiası yok → authority yanlışlıkla reddetmez.
  const free = surfacesFor("tahliye pompası arıyorum");
  assert.equal(free.subjectKind, "PART", `serbest metin bozulmamalı (${free.subjectKind})`);
  assert.equal(free.subjectStatus, "CONFIDENT", "üst ürün iddiası yokken ceza verilmez");
  assert.ok(
    fold(free.text).includes("tahliye pompasi"),
    `istenen şey korunmalı → '${free.text}'`,
  );
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
