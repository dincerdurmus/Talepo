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
import { resolveRequestSchema } from "../src/lib/knowledge/request-schema";
import {
  brandsForTechFamily,
  inferTechBrandFamily,
} from "../src/lib/knowledge/technology-brands";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { isProductTypePhrase } from "../src/lib/product-identity/identity-candidates";
import { enrichUnderstoodFacts } from "../src/lib/request-composer/v2/understood-facts";
import { mergePreservedBrowseFields } from "../src/lib/request-composer/build-state";
import { scheduleNextQuestions } from "../src/lib/request-composer/v2/question-scheduler";
import {
  applyBrowseSelectionToState,
  buildUnderstoodFacts,
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

  // Marka aileleri ürünle alakalı — drone kamera markası alır, RAM markası değil
  const fam = (id: string, name: string) =>
    inferTechBrandFamily({ id, name, nodeType: "PRODUCT_TYPE", subcategoryId: "donanim" });
  assert.equal(fam("tax:technology:donanim:diger-teknoloji:drone", "Drone"), "camera");
  assert.equal(fam("tax:technology:donanim:ses-ve-kulaklik:kulaklik", "Kulaklık"), "audio");
  assert.equal(fam("tax:technology:donanim:ag-ve-modem:modem", "Modem"), "network");
  assert.equal(fam("tax:technology:donanim:cevre-birimleri:yazici", "Yazıcı"), "printer");
  assert.ok(brandsForTechFamily("camera").includes("DJI"));
  assert.ok(!brandsForTechFamily("camera").includes("HP"));
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
