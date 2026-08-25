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
import { classifyNumbers } from "../src/lib/request-understanding/number-role";
import { buildUnderstandingSummary } from "../src/lib/request-understanding/activation-bridge";
import { isProductTypePhrase } from "../src/lib/product-identity/identity-candidates";
import { isCanonicalWholeProductPhrase } from "../src/lib/taxonomy/phrase-classification";
import { CATALOG_BRAND_DOMAIN_IDS } from "../src/lib/request-understanding/part-relation";
import { classifyBrandEvidence } from "../src/lib/product-identity/brand-extraction";
import { buildRequestRoutingEnvelope } from "../src/lib/matching-v3/routing-envelope";
import {
  DOMAIN_ENTITIES,
  findDomainEntity,
  isBrandLikeEntityType,
} from "../src/lib/catalog/domain-entities";
import {
  DOMAIN_ENTITY_PRECEDENCE,
  domainEntityEvidenceStrength,
  resolveDomainEntity,
} from "../src/lib/catalog";
import {
  APPLIANCE_BRANDS,
  AUTOMOTIVE_BRANDS,
  BABY_BRANDS,
  FURNITURE_BRANDS,
  HOME_KITCHEN_BRANDS,
  MACHINERY_BRANDS,
  TECHNOLOGY_BRANDS,
  findBrand,
} from "../src/lib/ai/parser/brand-catalog";
import { listTaxonomyAliasCandidates } from "../src/lib/taxonomy/registry";
import {
  buildPublishUnderstandingSnapshot,
} from "../src/lib/request/publish-understanding";
import {
  buildUnderstandingSnapshot,
  parseUnderstandingSnapshot,
} from "../src/lib/request/understanding-snapshot";

/** Marka kataloğu listeleri — çapraz çakışma denetimi için (1K). */
function brandListsForTests() {
  return [
    ["automotive", AUTOMOTIVE_BRANDS],
    ["appliances", APPLIANCE_BRANDS],
    ["home-kitchen", HOME_KITCHEN_BRANDS],
    ["machinery", MACHINERY_BRANDS],
    ["technology", TECHNOLOGY_BRANDS],
    ["furniture", FURNITURE_BRANDS],
    ["baby", BABY_BRANDS],
  ] as const;
}
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
/**
 * BİLİNEN AÇIKLAR — PASS sayısına dahil EDİLMEZ (1I).
 *
 * Bozuk davranışı doğrulayan ters assertion bir anti-pattern'dir: hata
 * düzeldiğinde test kırmızıya döner ve düzeltmeyi cezalandırır. Bunun
 * yerine DOĞRU davranış yazılır; henüz gerçekleşmiyorsa KNOWN_FAIL olarak
 * ayrı sayılır, bataryayı kırmızıya çevirmez ve gerçekleştiğinde kendi
 * kendine PASS'e döner.
 */
let knownFail = 0;
const knownFailNotes: string[] = [];
function knownGap(name: string, fn: () => void) {
  try {
    fn();
    console.log(
      `PASS  ${name}  (BİLİNEN AÇIK KAPANDI — knownGap yerine check kullanılmalı)`,
    );
    passed += 1;
  } catch (err) {
    knownFail += 1;
    knownFailNotes.push(`${name} → ${(err as Error).message}`);
    console.warn(`KNOWN_FAIL  ${name}`);
  }
}
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
    /**
     * ÜRÜN KARARI DEĞİŞTİ (1I) — beklenti bayat olduğu için güncellendi.
     *
     * 2026-08-23 sözleşmesi otomotiv ve makine dışındaki bütün hizmet
     * taleplerini `services` kategorisine yönlendiriyordu. 1I bu istisnayı
     * genel kurala çevirdi: kategori uzmanlık ALANINI, kind ihtiyaç TÜRÜNÜ
     * anlatır. "klima montajı" bir beyaz eşya işidir ve kind'ı SERVICE
     * kalır — kategori artık alanı kaybetmiyor.
     *
     * "ev boyatmak" doğrulanmış bir ürün/platform kanıtı taşımadığı için
     * genel hizmet pazarında kalır; yedek yolun hâlâ çalıştığını gösterir.
     */
    ["klima montajı yaptırmak istiyorum", "appliances"],
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
/** Uyumluluk niteliği taşıyan konu türleri — production ile aynı küme. */
const COMPATIBILITY_KINDS = new Set(["PART", "ACCESSORY"]);

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
      relation?: { value?: unknown; status?: unknown };
      relationship?: { value?: unknown };
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
    /**
     * Anlama katmanının KENDİ kategori kararı — besteci `categoryId` ile
     * karşılaştırmak için (1H). İki otoritenin ayrışması ölçülebilir olmalı.
     */
    understandingCategoryStatus: String(
      (understanding as unknown as { category?: { status?: unknown } }).category
        ?.status ?? "",
    ),
    understandingCategory: (understanding as unknown as {
      category?: { value?: unknown; status?: unknown };
    }).category?.status !== "UNKNOWN"
      ? String(
          (understanding as unknown as { category?: { value?: unknown } })
            .category?.value ?? "",
        ) || null
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
    relationValue: String(rs?.relation?.value ?? ""),
    relationStatus: String(rs?.relation?.status ?? ""),
    relationshipValue: String(rs?.relationship?.value ?? ""),
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

/** Publish + routing yüzeyleri — marka kanıt denetimi için (I43). */
function publishSurfaces(raw: string) {
  const understanding = understandRequest({ rawInput: raw }) as never;
  const { state } = syncFromText(null, raw);
  const f = (k: string) => {
    const x = (state.fields as Record<string, { kind?: string; value?: unknown }>)[k];
    return x && x.kind === "VALUE" && x.value ? String(x.value) : null;
  };
  const snap = buildPublishUnderstandingSnapshot({
    understanding,
    userSelected: false,
    primarySlug: null,
  });
  const env = buildRequestRoutingEnvelope({
    understandingSnapshot: snap,
    categorySlug: state.categoryId ?? undefined,
  } as never) as never as { brand?: string | null };
  const attrs = (understanding as never as {
    attributes?: Record<string, { value?: unknown }>;
  }).attributes ?? {};
  return {
    rawInput: raw,
    stateCat: state.categoryId ?? null,
    fieldsBrand: f("brand"),
    snapBrand: snap.entities?.brand?.value ?? null,
    envBrand: env.brand ?? null,
    brandEvidence: attrs.brandEvidence?.value != null ? String(attrs.brandEvidence.value) : null,
    brandCandidate: attrs.brandCandidate?.value != null ? String(attrs.brandCandidate.value) : null,
    text: composeNaturalRequestText(state),
    headline: String(
      (buildUnderstandingSummary(understanding) as unknown as { headline?: string })
        ?.headline ?? "",
    ),
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
    /**
     * 1G: "destek" hizmet dilinin parçasıdır (taksonomi de "Bakım / destek
     * sözleşmesi" diyor). Bu satır TENTATIVE parça adayından SERVICE'e geçti;
     * kesinlik iddiası artmadı, yanlış sınıf düzeldi ve ifade korunuyor.
     */
    raw: "Bosch kampanya için destek arıyorum",
    verdict: "NOT_PART",
    subjectKind: "SERVICE",
    keep: "destek",
    model: null,
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

/**
 * KULLANIM BAĞLAMI TALEP KONUSUNU EZEMEZ (I25 ailesi, 1H).
 *
 * "X için Y" yapısında X HER ZAMAN üst ürün değildir:
 *   - Y bir BİLEŞEN ise      → X gerçek üst üründür, marka/model olabilir
 *   - Y bütün ÜRÜN ya da HİZMET ise → Y asıl talep konusudur, X yalnız
 *     kullanım amacı / hedef kitle / yer / kurum bağlamıdır
 *
 * Ölçülen hata ailesi tek kökten geliyordu: anlama katmanı sağ tarafı doğru
 * çözdükten SONRA, ham cümlenin tamamını yeniden tarayan ipucu katmanları
 * soldaki bağlamı asıl ürün ya da marka sanıp doğru kararı eziyordu.
 *   "Ev için klima arıyorum"            → REAL_ESTATE, metin "konut arıyorum."
 *   "Ofis için muhasebe yazılımı"       → kategori real-estate, productType "Ofis"
 *   "Restoran için POS yazılımı"        → marka "Restoran"
 */
type ContextCase = {
  raw: string;
  /** Sağ taraftaki asıl talep konusu — hiçbir yüzeyde kaybolamaz. */
  target: string;
  /** Beklenen konu türü. */
  kind: "PRODUCT" | "SERVICE";
  /** Soldaki bağlam — marka, model veya ürün türü olamaz. */
  context: string;
};

const USAGE_CONTEXT_FAMILY: ContextCase[] = [
  { raw: "Ev için klima arıyorum", target: "klima", kind: "PRODUCT", context: "ev" },
  { raw: "İşyeri için klima arıyorum", target: "klima", kind: "PRODUCT", context: "işyeri" },
  { raw: "Ofis için televizyon arıyorum", target: "televizyon", kind: "PRODUCT", context: "ofis" },
  { raw: "Ofis için muhasebe yazılımı arıyorum", target: "muhasebe yazılımı", kind: "PRODUCT", context: "ofis" },
  { raw: "İşletmem için CRM yazılımı arıyorum", target: "crm yazılımı", kind: "PRODUCT", context: "işletme" },
  { raw: "Restoran için POS yazılımı arıyorum", target: "pos yazılımı", kind: "PRODUCT", context: "restoran" },
  { raw: "Çocuk için eğitim uygulaması arıyorum", target: "eğitim uygulaması", kind: "PRODUCT", context: "çocuk" },
  { raw: "Şirket için ERP sistemi arıyorum", target: "erp sistemi", kind: "PRODUCT", context: "şirket" },
  { raw: "Ev için klima servisi arıyorum", target: "klima servisi", kind: "SERVICE", context: "ev" },
  { raw: "WordPress için teknik destek arıyorum", target: "teknik destek", kind: "SERVICE", context: "wordpress" },
  { raw: "SAP için danışmanlık arıyorum", target: "danışmanlık", kind: "SERVICE", context: "sap" },
  { raw: "Logo yazılımı için kurulum hizmeti arıyorum", target: "kurulum hizmeti", kind: "SERVICE", context: "logo" },
  { raw: "Web sitesi için bakım desteği arıyorum", target: "bakım desteği", kind: "SERVICE", context: "web sitesi" },
];

check("I25: kullanım bağlamı talep konusunu, kategorisini ve markasını ezemez", () => {
  for (const c of USAGE_CONTEXT_FAMILY) {
    const s = surfacesFor(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;

    // (1) Asıl konu sağ taraftır.
    assert.equal(s.subjectKind, c.kind, at(`konu türü (${s.subjectKind})`));
    assert.ok(
      !COMPATIBILITY_KINDS.has(s.subjectKind),
      at(`kullanım bağlamı parça ilişkisi kuramaz (${s.subjectKind})`),
    );
    assert.notEqual(s.relationValue, "PART_OF", at("PART_OF izi kaldı"));
    assert.ok(
      !s.ambiguityMessages.some((m) => /compat_target_unresolved/i.test(m)),
      at(`gereksiz uyumluluk kaydı → ${JSON.stringify(s.ambiguityMessages)}`),
    );

    // (2) Kullanıcının yazdığı hedef başlıkta ya da profesyonel metinde durur.
    assert.ok(
      fold(s.text).includes(fold(c.target)) || fold(s.headline).includes(fold(c.target)),
      at(`'${c.target}' kayboldu → başlık='${s.headline}' metin='${s.text}'`),
    );

    // (3) Yanlış genelleme yok.
    assert.ok(
      !fold(s.text).includes("konut"),
      at(`'konut' kullanıcının talebini eziyor → '${s.text}'`),
    );

    // (4) Soldaki bağlam marka, model ya da ürün türü olamaz.
    for (const [label, value] of [
      ["marka", s.brand],
      ["model", s.model],
      ["ürün türü", s.parentProduct],
    ] as const) {
      if (!value) continue;
      assert.ok(
        !fold(value).includes(fold(c.context)) && !fold(c.context).includes(fold(value)),
        at(`kullanım bağlamı '${c.context}' ${label} oldu → '${value}'`),
      );
    }

    // (5) Kategori sağ taraftan türer; emlak olmayan talep emlak sayılamaz.
    assert.notEqual(
      s.categoryId,
      "real-estate",
      at(`kategori kullanım bağlamından geldi (${s.categoryId})`),
    );

    // (6) Anlama kategorisi ile besteci kategorisi ayrışamaz.
    if (s.understandingCategory && s.categoryId) {
      assert.equal(
        s.categoryId,
        s.understandingCategory,
        at(
          `kategori otoriteleri ayrıştı: understanding='${s.understandingCategory}' state='${s.categoryId}'`,
        ),
      );
    }
  }
});

check("I25b: gerçek emlak talepleri kullanım bağlamı sanılamaz", () => {
  /**
   * Kural yalnız bağlacın SAĞINDA ayrı bir talep hedefi kuran cümleler için
   * çalışır. Aşağıdakilerde ya uyumluluk bağlacı yoktur ya da asıl nesnenin
   * kendisi emlaktır; "ev/ofis/işyeri/restoran" burada bağlam değil taleptir.
   */
  const REAL_ESTATE = [
    "Ev arıyorum",
    "2+1 ev arıyorum",
    "Ankara Çankaya'da 2+1 ev arıyorum",
    "Satılık ofis arıyorum",
    "Kiralık işyeri arıyorum",
    "Restoran olmaya uygun kiralık dükkan arıyorum",
    "Satılık arsa arıyorum",
  ];
  for (const raw of REAL_ESTATE) {
    const s = surfacesFor(raw);
    assert.equal(
      s.subjectKind,
      "REAL_ESTATE",
      `${raw}: gerçek emlak talebi kalmalı (kind=${s.subjectKind})`,
    );
    assert.equal(
      s.categoryId,
      "real-estate",
      `${raw}: emlak kategorisi kalmalı (${s.categoryId})`,
    );
  }

  // Bağlaç VAR ama sağ taraf da emlak: bağlam kuralı devreye girmez.
  const family = surfacesFor("Ailem için 3+1 daire arıyorum");
  assert.equal(
    family.subjectKind,
    "REAL_ESTATE",
    `sağ taraf emlaksa emlak kalmalı (kind=${family.subjectKind})`,
  );

  // Markasız gerçek parça ilişkisi korunmalı.
  const rez = surfacesFor("Bulaşık makinesi için rezistans arıyorum");
  assert.ok(
    fold(rez.text).includes("rezistans"),
    `markasız parça ilişkisi korunmalı → '${rez.text}'`,
  );
});

check("I25c: bileşen talebinde sol taraf gerçek üst üründür", () => {
  /**
   * Bağlam kuralı YALNIZ sağ taraf bütün ürün ya da hizmetken çalışır.
   * Sağ taraf bir bileşense sol taraf gerçek üst üründür: markası, modeli ve
   * ürün kimliği KORUNUR, bağlam sanılıp silinmez.
   */
  const CASES: Array<{ raw: string; part: string; brand?: string; model?: string }> = [
    { raw: "Arçelik bulaşık makinesi için rezistans arıyorum", part: "rezistans", brand: "Arçelik" },
    { raw: "Bosch bulaşık makinesi için su giriş ventili arıyorum", part: "su giriş ventili", brand: "Bosch" },
    { raw: "Siemens çamaşır makinesi için tahliye pompası arıyorum", part: "tahliye pompası", brand: "Siemens" },
    { raw: "Heidelberg SM 74 için nemlendirme pompası arıyorum", part: "nemlendirme pompası", brand: "Heidelberg", model: "SM 74" },
    { raw: "Renault Clio için ön far arıyorum", part: "ön far", brand: "Renault", model: "Clio" },
    { raw: "MacBook Pro için şarj adaptörü arıyorum", part: "şarj adaptörü", model: "MacBook Pro" },
    { raw: "WordPress için SEO eklentisi arıyorum", part: "seo eklentisi" },
    { raw: "Logo yazılımı için e-fatura modülü arıyorum", part: "e-fatura modülü" },
    { raw: "Blender için bıçak bağlantı aparatı arıyorum", part: "bıçak bağlantı aparatı" },
    { raw: "Masa için özel bağlantı aparatı arıyorum", part: "özel bağlantı aparatı" },
  ];
  for (const c of CASES) {
    const s = surfacesFor(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;
    assert.ok(
      COMPATIBILITY_KINDS.has(s.subjectKind),
      at(`bileşen talebi uyumluluk yolundan düştü (${s.subjectKind})`),
    );
    assert.ok(
      fold(s.text).includes(fold(c.part)) || fold(s.headline).includes(fold(c.part)),
      at(`'${c.part}' kayboldu → başlık='${s.headline}' metin='${s.text}'`),
    );
    if (c.brand) {
      assert.ok(
        fold(String(s.brand ?? s.parentBrand ?? "")).includes(fold(c.brand)),
        at(`üst ürün markası bağlam sanılıp silindi (${s.brand ?? s.parentBrand})`),
      );
    }
    if (c.model) {
      assert.ok(
        fold(String(s.model ?? s.parentModel ?? "")).includes(fold(c.model)),
        at(`üst ürün modeli bağlam sanılıp silindi (${s.model ?? s.parentModel})`),
      );
    }
    /**
     * Sol taraf kullanım bağlamı SANILAMAZ: bu dalda marka/model ya
     * kullanıcının yazdığıdır ya da kanonik katalogdan doğrulanmış bir
     * zenginleştirmedir ("MacBook Pro" → Apple). Uydurma marka yasağı bu
     * satırda değil, I20 (başlıkta kesin gerçek gibi gösterme) ve I40
     * (dijital hedefte katalog yok) invariant'larında kilitlidir.
     */
    if (s.brand && !fold(c.raw).includes(fold(s.brand))) {
      assert.ok(
        s.model != null && fold(c.raw).includes(fold(s.model)),
        at(`marka ne yazıldı ne de doğrulanmış bir modelden türedi → '${s.brand}'`),
      );
    }
  }
});

knownGap(
  "I25d: bağlaçsız serbest metinde kullanıcı ifadesi profesyonel metinde durur",
  () => {
    /**
     * DOĞRU davranış yazılır, bozuk olan değil (1I).
     *
     * Uyumluluk bağlacı OLMAYAN cümlelerde profesyonel metin kullanıcının
     * ifadesini taşımıyor; besteci genel kategori diline düşüyor:
     *   "destek ayağı arıyorum"              → "arıyorum."
     *   "koltuk destek mekanizması arıyorum" → "mobilya arıyorum."
     *
     * `preserveRequestedTarget` bilerek genişletilmedi: bağlaçsız serbest
     * metnin tamamını taşımak bütçe/telefon/adres sızıntısı riski taşır
     * (bkz. I42). Bu satır açığı GÖRÜNÜR tutar ve PASS sayısına girmez;
     * davranış düzeldiğinde kendi kendine PASS'e döner.
     */
    for (const raw of ["destek ayağı arıyorum", "koltuk destek mekanizması arıyorum"]) {
      const s = surfacesFor(raw);
      // Konu türü ZATEN doğru olmalı — bu kısım I41'de sert kilitli.
      assert.notEqual(s.subjectKind, "SERVICE", `${raw}: konu türü (${s.subjectKind})`);
      const head = fold(raw).split(" ")[0] ?? "";
      assert.ok(
        fold(s.text).includes(head),
        `${raw}: '${head}' profesyonel metinde yok → '${s.text}'`,
      );
    }
  },
);

/* ------------------------------------------------------------------------ *
 * UZMANLIK ALANI (KATEGORİ) ile İHTİYAÇ TÜRÜ (KIND) AYRI EKSENLERDİR — I26
 *
 * `SERVICE` olmak kategorinin otomatik `services` olması demek DEĞİLDİR.
 * Kategori "hangi uzmanlık alanı?", kind "ne tür ihtiyaç?" sorusunu yanıtlar.
 * Otomotiv bu ayrımı zaten uyguluyordu (`arac-bakim` akışı); 1I bu istisnayı
 * genel kurala çevirir: doğrulanmış bir ürün/platform alanı varsa hizmet
 * talebi o alanda kalır, yoksa genel hizmet pazarına düşer.
 * ------------------------------------------------------------------------ */
type DomainCase = {
  raw: string;
  /** Beklenen uzmanlık alanı (kategori). */
  domain: string;
  /** Beklenen ihtiyaç türü. */
  kind: string;
  /** Kullanıcı yüzünde durması gereken ifadeler. */
  keep: string[];
};

const DOMAIN_KIND_CASES: DomainCase[] = [
  // Teknoloji hizmetleri — alan yazılım/platform kanıtından gelir.
  { raw: "Logo yazılımı için kurulum hizmeti arıyorum", domain: "technology", kind: "SERVICE", keep: ["logo", "kurulum"] },
  { raw: "Web sitesi için bakım desteği arıyorum", domain: "technology", kind: "SERVICE", keep: ["web sitesi", "bakım"] },
  // Beyaz eşya hizmetleri — alan kanonik ürün düğümünden gelir.
  { raw: "Ev için klima servisi arıyorum", domain: "appliances", kind: "SERVICE", keep: ["klima", "servis"] },
  { raw: "Arçelik bulaşık makinesi için servis arıyorum", domain: "appliances", kind: "SERVICE", keep: ["arcelik", "servis"] },
  { raw: "Bosch çamaşır makinesi için bakım arıyorum", domain: "appliances", kind: "SERVICE", keep: ["bosch", "bakim"] },
  { raw: "Buzdolabı tamiri arıyorum", domain: "appliances", kind: "SERVICE", keep: ["buzdolabi"] },
  // Otomotiv hizmetleri — alan katalog markasından gelir.
  { raw: "Renault Clio için bakım arıyorum", domain: "automotive", kind: "SERVICE", keep: ["renault", "clio", "bakim"] },
  { raw: "Mercedes C180 için servis arıyorum", domain: "automotive", kind: "SERVICE", keep: ["c180", "servis"] },
  { raw: "BMW için ekspertiz arıyorum", domain: "automotive", kind: "SERVICE", keep: ["bmw", "ekspertiz"] },
  // Makine hizmetleri.
  { raw: "Heidelberg SM 74 için bakım arıyorum", domain: "machinery", kind: "SERVICE", keep: ["heidelberg", "sm 74", "bakim"] },
  // Gerçek genel hizmetler — doğrulanmış ürün alanı YOK.
  { raw: "Ev temizliği arıyorum", domain: "services", kind: "SERVICE", keep: ["temizlik"] },
  { raw: "Ofis temizliği arıyorum", domain: "services", kind: "SERVICE", keep: ["temizlik"] },
  { raw: "Ev için temizlik hizmeti arıyorum", domain: "services", kind: "SERVICE", keep: ["temizlik"] },
  { raw: "Genel hukuk danışmanlığı arıyorum", domain: "services", kind: "SERVICE", keep: ["danismanlik"] },
  // Dijital bütün ürünler — kind PRODUCT, alan technology.
  { raw: "Şirket için ERP sistemi arıyorum", domain: "technology", kind: "PRODUCT", keep: ["erp sistemi"] },
  { raw: "İşletmem için CRM yazılımı arıyorum", domain: "technology", kind: "PRODUCT", keep: ["crm yazilimi"] },
  { raw: "Restoran için POS yazılımı arıyorum", domain: "technology", kind: "PRODUCT", keep: ["pos yazilimi"] },
  { raw: "Ofis için muhasebe yazılımı arıyorum", domain: "technology", kind: "PRODUCT", keep: ["muhasebe yazilimi"] },
  { raw: "Çocuk için eğitim uygulaması arıyorum", domain: "technology", kind: "PRODUCT", keep: ["egitim uygulamasi"] },
];

check("I26: uzmanlık alanı ile ihtiyaç türü ayrı eksenlerdir", () => {
  /**
   * SAPMA KAPISI: katalog listelerinin adlandırdığı alan kimlikleri kanonik
   * taksonominin kök kategori kimlikleriyle AYNI olmalıdır. Taksonomi tarafı
   * yeniden adlandırılırsa bu satır gürültülü biçimde kırılır; eşleme sessizce
   * ayrışamaz.
   */
  ensureTaxonomyLoaded();
  const canonicalDomains = new Set(
    listAllTaxonomyNodes().map((n) => n.categoryId).filter(Boolean),
  );
  for (const id of CATALOG_BRAND_DOMAIN_IDS) {
    assert.ok(
      canonicalDomains.has(id),
      `katalog alan kimliği '${id}' kanonik taksonomide yok — eşleme sapmış`,
    );
  }

  for (const c of DOMAIN_KIND_CASES) {
    const s = surfacesFor(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;

    // (1) İhtiyaç türü.
    assert.equal(s.subjectKind, c.kind, at(`ihtiyaç türü (${s.subjectKind})`));

    // (2) Uzmanlık alanı — kategori null bırakılamaz, uydurulamaz.
    assert.equal(s.categoryId, c.domain, at(`uzmanlık alanı (${s.categoryId})`));

    // (3) İki kategori otoritesi ayrışamaz.
    assert.equal(
      s.categoryId,
      s.understandingCategory,
      at(
        `kategori otoriteleri ayrıştı: understanding='${s.understandingCategory}' state='${s.categoryId}'`,
      ),
    );

    // (4) Hizmetin/ürünün bağlı olduğu varlık kullanıcı yüzünde durur.
    for (const k of c.keep) {
      assert.ok(
        fold(s.text).includes(fold(k)) || fold(s.headline).includes(fold(k)),
        at(`'${k}' kullanıcı yüzünde yok → başlık='${s.headline}' metin='${s.text}'`),
      );
    }

    // (5) Hizmet talebi parça ilişkisi kurmaz.
    if (c.kind === "SERVICE") {
      assert.notEqual(s.relationValue, "PART_OF", at("hizmet PART_OF izi bırakamaz"));
      assert.ok(
        !COMPATIBILITY_KINDS.has(s.subjectKind),
        at(`hizmet parça sayılamaz (${s.subjectKind})`),
      );
    }

    // (6) Kullanıcının yazmadığı marka/model üretilemez.
    for (const v of [s.brand, s.model]) {
      if (!v) continue;
      assert.ok(
        fold(c.raw).includes(fold(v)),
        at(`kullanıcının yazmadığı marka/model üretildi → '${v}'`),
      );
    }
  }
});

/**
 * TİPLİ ALAN VARLIĞI — marka / platform / yazılım ailesi / makine türü (1J).
 *
 * Bir adın hangi uzmanlık alanına ait olduğu ile NE TÜR bir varlık olduğu
 * ayrı sorulardır. WordPress bir platform, SAP ve Logo birer yazılım
 * ailesi, CNC tezgâhı bir makine türüdür — hiçbiri üretici markası değildir
 * ve hiçbiri kullanıcıya "Marka" olarak gösterilemez.
 */
type EntityCase = {
  raw: string;
  domain: string;
  kind: string;
  /** Kullanıcı yüzünde durması gereken varlık adı. */
  keep: string;
};

const TYPED_ENTITY_CASES: EntityCase[] = [
  { raw: "WordPress için teknik destek arıyorum", domain: "technology", kind: "SERVICE", keep: "wordpress" },
  { raw: "WordPress için SEO eklentisi arıyorum", domain: "technology", kind: "PART", keep: "wordpress" },
  { raw: "SAP için danışmanlık arıyorum", domain: "technology", kind: "SERVICE", keep: "sap" },
  { raw: "SAP için FI modülü arıyorum", domain: "technology", kind: "PART", keep: "sap" },
  { raw: "Shopify için entegrasyon hizmeti arıyorum", domain: "technology", kind: "SERVICE", keep: "shopify" },
  { raw: "Logo yazılımı için kurulum hizmeti arıyorum", domain: "technology", kind: "SERVICE", keep: "logo" },
  { raw: "Logo yazılımı için e-fatura modülü arıyorum", domain: "technology", kind: "PART", keep: "e-fatura" },
  { raw: "CNC tezgahı için teknik servis arıyorum", domain: "machinery", kind: "SERVICE", keep: "cnc" },
];

check("I26b: tipli alan varlığı — platform ve makine türü marka değildir", () => {
  /**
   * (0) KAYNAK BÜTÜNLÜĞÜ: tipli varlık kaynağı çakışmasız olmalı ve
   * adlandırdığı alanlar kanonik taksonomide bulunmalı.
   */
  ensureTaxonomyLoaded();
  const canonicalDomains = new Set(
    listAllTaxonomyNodes().map((n) => n.categoryId).filter(Boolean),
  );
  const ids = new Set<string>();
  const aliasOwner = new Map<string, string>();
  for (const e of DOMAIN_ENTITIES) {
    assert.ok(!ids.has(e.canonicalId), `yinelenen canonicalId: ${e.canonicalId}`);
    ids.add(e.canonicalId);
    assert.ok(
      canonicalDomains.has(e.domainCategoryId),
      `${e.canonicalId}: '${e.domainCategoryId}' kanonik taksonomide yok`,
    );
    assert.ok(
      e.provenance.verificationStatus === "PENDING_CURATION" ||
        e.provenance.verificationStatus === "CURATOR_APPROVED",
      `${e.canonicalId}: provenance durumu eksik`,
    );
    assert.ok(
      (e.aliases.length + (e.caseSensitiveAliases?.length ?? 0)) > 0,
      `${e.canonicalId}: hiç alias yok`,
    );
    for (const a of [...e.aliases, ...(e.caseSensitiveAliases ?? [])]) {
      const key = fold(a);
      const owner = aliasOwner.get(key);
      assert.ok(
        !owner || owner === e.canonicalId,
        `alias çakışması: '${a}' hem ${owner} hem ${e.canonicalId}`,
      );
      aliasOwner.set(key, e.canonicalId);
    }
  }

  for (const c of TYPED_ENTITY_CASES) {
    const s = surfacesFor(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;

    // (1) Uzmanlık alanı doğru ve iki otorite ayrışmıyor.
    assert.equal(s.categoryId, c.domain, at(`uzmanlık alanı (${s.categoryId})`));
    assert.equal(
      s.categoryId,
      s.understandingCategory,
      at(
        `kategori otoriteleri ayrıştı: understanding='${s.understandingCategory}' state='${s.categoryId}'`,
      ),
    );

    // (2) İhtiyaç türü.
    assert.equal(s.subjectKind, c.kind, at(`ihtiyaç türü (${s.subjectKind})`));

    // (3) Varlık adı kullanıcı yüzünde duruyor.
    assert.ok(
      fold(s.text).includes(c.keep) || fold(s.headline).includes(c.keep),
      at(`'${c.keep}' kullanıcı yüzünde yok → başlık='${s.headline}' metin='${s.text}'`),
    );

    // (4) PLATFORM / SOFTWARE_SUITE / MACHINE_TYPE marka alanına SIZAMAZ.
    const hit = findDomainEntity(c.raw);
    assert.ok(hit, at("tipli varlık tanınmadı"));
    if (hit && !isBrandLikeEntityType(hit.entity.entityType)) {
      assert.ok(
        !s.brand || !fold(s.brand).includes(fold(hit.label.split(" ")[0] ?? "")),
        at(
          `${hit.entity.entityType} varlığı marka alanına sızdı → marka='${s.brand}'`,
        ),
      );
    }
  }
});

check("I26d: ad çakışmaları yanlış tipli varlık üretmez", () => {
  /**
   * "sap" Türkçede tutamak, "logo" bir grafik tasarım nesnesidir. Yalnız
   * jeton eşleşmesi varlık kanıtı değildir: büyük harf yazımı ve yazılım
   * bağlamı koşulları tam da bunun içindir. "CNC" ise hiçbir koşulda marka
   * olamaz — türü makine türüdür.
   */
  const NEGATIVE = [
    "şirket logosu yaptırmak istiyorum",
    "logo tasarımı arıyorum",
    "tavanın sapı kırıldı",
    "kürek sapı arıyorum",
  ];
  for (const raw of NEGATIVE) {
    assert.equal(
      findDomainEntity(raw),
      null,
      `${raw}: yanlış tipli varlık üretildi → ${JSON.stringify(findDomainEntity(raw)?.id)}`,
    );
    const s = surfacesFor(raw);
    assert.equal(s.brand, null, `${raw}: uydurma marka üretildi → '${s.brand}'`);
    assert.notEqual(
      s.categoryId,
      "technology",
      `${raw}: yanlış teknoloji alanı üretildi`,
    );
  }

  // CNC hiçbir koşulda marka değildir; makine alanı korunur.
  const cnc = surfacesFor("CNC marka bir ürün arıyorum");
  assert.equal(cnc.brand, null, `CNC marka alanına yazıldı → '${cnc.brand}'`);
  assert.equal(cnc.categoryId, "machinery", `CNC makine alanında kalmalı (${cnc.categoryId})`);
  const cncHit = findDomainEntity("CNC marka bir ürün arıyorum");
  assert.equal(cncHit?.entity.entityType, "MACHINE_TYPE", "CNC türü makine türüdür");

  // Kullanım yeri tipli varlık DEĞİLDİR: alan bağlamdan gelemez.
  const office = surfacesFor("ofis için teknik destek arıyorum");
  assert.equal(office.subjectKind, "SERVICE", `hizmet kalmalı (${office.subjectKind})`);
  assert.notEqual(
    office.categoryId,
    "real-estate",
    `kullanım yeri alanı ele geçirdi (${office.categoryId})`,
  );
});

/* ------------------------------------------------------------------------ *
 * TİPLİ VARLIK YÖNETİŞİMİ, TEK GİRİŞ NOKTASI VE KALICILIK — I26e-I26h
 *
 * Bir katalog kaydının "doğru" olması onu YETKİLİ yapmaz. Kürasyon durumu
 * çalışma zamanında okunmalı, otorite tek kapıdan geçmeli ve anlaşılan
 * varlık kalıcı denetlenebilir bir alanda yaşamalıdır.
 * ------------------------------------------------------------------------ */

check("I26e: kürasyon durumu çalışma zamanında okunur — onaysız kayıt kesinlik üretemez", () => {
  /**
   * `PENDING_CURATION` bir kayıt alan ADAYI ve kanıt üretebilir; tek başına
   * `CONFIDENT` kategori ya da doğrulanmış routing kanıtı ÜRETEMEZ.
   * `REJECTED`/`DEPRECATED` kayıt hiç kanıt üretemez.
   *
   * Ölü metadata yasağı: `verificationStatus` yalnız veride durmamalı,
   * kararı gerçekten değiştirmelidir. Aşağıdaki fixture bunu kanıtlar —
   * aynı fonksiyon, yalnız durum değişince sonuç değişiyor.
   */
  const base = {
    canonicalId: "platform:test",
    label: "TestPlatform",
    aliases: ["testplatform"],
    entityType: "PLATFORM" as const,
    domainCategoryId: "technology" as const,
    provenance: {
      sourceType: "AI_INFERRED" as const,
      sourceName: "invariant-fixture",
      confidence: "HIGH" as const,
      verificationStatus: "PENDING_CURATION" as const,
    },
  };
  assert.equal(
    domainEntityEvidenceStrength(base),
    "CANDIDATE",
    "PENDING_CURATION yalnız aday kanıt üretir",
  );
  assert.equal(
    domainEntityEvidenceStrength({
      ...base,
      provenance: { ...base.provenance, verificationStatus: "CURATOR_APPROVED" },
    }),
    "VERIFIED",
    "CURATOR_APPROVED güçlü kanıt üretebilir",
  );
  for (const dead of ["REJECTED", "DEPRECATED"] as const) {
    assert.equal(
      domainEntityEvidenceStrength({
        ...base,
        provenance: { ...base.provenance, verificationStatus: dead },
      }),
      "NONE",
      `${dead} kayıt routing kanıtı olamaz`,
    );
  }

  // Üretimdeki beş seed'in tamamı kürasyon bekliyor → hepsi TENTATIVE.
  for (const e of DOMAIN_ENTITIES) {
    assert.equal(
      e.provenance.verificationStatus,
      "PENDING_CURATION",
      `${e.canonicalId}: seed'ler bu turda onaylanmış sayılamaz`,
    );
  }
  const PENDING: Array<{ raw: string; domain: string }> = [
    { raw: "WordPress destek arıyorum", domain: "technology" },
    { raw: "Shopify entegrasyon arıyorum", domain: "technology" },
    { raw: "SAP danışmanlık arıyorum", domain: "technology" },
    { raw: "Logo e-fatura kurulumu arıyorum", domain: "technology" },
    { raw: "CNC tezgâh bakımı arıyorum", domain: "machinery" },
  ];
  for (const c of PENDING) {
    const s = surfacesFor(c.raw);
    assert.equal(s.categoryId, c.domain, `${c.raw}: alan adayı (${s.categoryId})`);
    assert.equal(
      s.understandingCategoryStatus,
      "TENTATIVE",
      `${c.raw}: onaysız kayıt CONFIDENT üretemez (${s.understandingCategoryStatus})`,
    );
  }
});

check("I26f: tipli varlık otoritesi tek kapıdan okunur ve çakışma sessizce çözülmez", () => {
  /**
   * (1) Production tüketicileri modülü DOĞRUDAN import etmemeli; ortak
   *     katalog cephesi (`@/lib/catalog`) tek giriş noktasıdır.
   */
  const ROOT = repoRootForTests();
  const CONSUMERS = [
    "apps/web/src/lib/request-understanding/part-relation.ts",
    "apps/web/src/lib/request-understanding/understand-request.ts",
    "apps/web/src/lib/request-composer/compose-text.ts",
  ];
  for (const rel of CONSUMERS) {
    const src = readFileSync(pathJoin(ROOT, rel), "utf8");
    assert.ok(
      !/from\s+"@\/lib\/catalog\/domain-entities"/.test(src),
      `${rel}: tipli varlık kaynağı doğrudan import ediliyor — cephe atlanıyor`,
    );
  }

  /**
   * (2) ÇAPRAZ ÇAKIŞMA: tipli varlık alias'ları marka kataloglarında ve
   *     kanonik taksonomide karşılık BULMAMALI. Bugün sıfır çakışma var;
   *     bu satır onu kilitler.
   */
  ensureTaxonomyLoaded();
  const brandLists: Array<[string, ReturnType<typeof brandListsForTests>[number][1]]> =
    brandListsForTests();
  for (const e of DOMAIN_ENTITIES) {
    for (const alias of [...e.aliases, ...(e.caseSensitiveAliases ?? [])]) {
      for (const [domain, list] of brandLists) {
        assert.ok(
          !findBrand(alias, list),
          `${e.canonicalId}: '${alias}' marka kataloğunda da var (${domain}) — iki kaynak aynı adı sahipleniyor`,
        );
      }
      const taxonomyHit = listTaxonomyAliasCandidates(alias).nodes;
      assert.equal(
        taxonomyHit.length,
        0,
        `${e.canonicalId}: '${alias}' kanonik taksonomide de var (${taxonomyHit
          .map((n) => `${n.nodeType}@${n.categoryId}`)
          .join(",")})`,
      );
    }
  }

  /**
   * (3) ÖNCELİK SÖZLEŞMESİ açık olmalı ve çakışma sessizce çözülmemeli.
   *     Cephe, aynı span için başka bir kaynak farklı bir alan iddia
   *     ediyorsa `AMBIGUOUS` döner; hiçbir taraf sessizce kazanmaz.
   */
  const wp = resolveDomainEntity("WordPress");
  assert.equal(wp.status, "RESOLVED", "WordPress tek kaynakta — çözülmeli");
  assert.equal(wp.evidenceStrength, "CANDIDATE", "onaysız kayıt aday kalır");
  assert.equal(
    resolveDomainEntity("Arçelik").status,
    "NONE",
    "katalog markası tipli varlık değildir",
  );
  assert.deepEqual(
    DOMAIN_ENTITY_PRECEDENCE,
    ["catalog-entity", "taxonomy", "brand-catalog"],
    "öncelik sırası açıkça yazılı olmalı",
  );
});

check("I26g: anlaşılan tipli varlık canonical snapshot'ta yaşar", () => {
  /**
   * Varlık kategoriyi etkileyip kaybolamaz. `resolvedEntities` additive ve
   * optional bir alandır; eski snapshot'lar geçerli kalır, Prisma
   * migration'ı gerekmez (discoveryProjection bir JSON kolonudur).
   */
  const build = (raw: string) => {
    const understanding = understandRequest({ rawInput: raw }) as never;
    return buildPublishUnderstandingSnapshot({
      understanding,
      userSelected: false,
      primarySlug: null,
    });
  };

  const wp = build("WordPress destek arıyorum");
  const list = wp.resolvedEntities ?? [];
  assert.equal(list.length, 1, `WordPress varlığı snapshot'ta yok → ${JSON.stringify(list)}`);
  const first = list[0]!;
  assert.equal(first.canonicalId, "platform:wordpress");
  assert.equal(first.entityType, "PLATFORM");
  assert.equal(first.canonicalLabel, "WordPress");
  assert.equal(first.domainId, "technology");
  assert.equal(first.verificationStatus, "PENDING_CURATION");
  assert.ok(typeof first.confidence === "number" && first.confidence <= 1);
  assert.ok(first.source, "provenance kaynağı taşınmalı");
  assert.ok(
    !first.canonicalLabel.includes("arıyorum"),
    "ham kullanıcı cümlesi bu alana kopyalanamaz",
  );

  const cnc = build("CNC tezgâh bakımı arıyorum");
  assert.equal(cnc.resolvedEntities?.[0]?.entityType, "MACHINE_TYPE");
  assert.equal(cnc.resolvedEntities?.[0]?.domainId, "machinery");

  // Varlık yoksa alan üretilmez (geriye uyumluluk: eski okuyucular etkilenmez).
  const none = build("bıçak sapı arıyorum");
  assert.ok(
    !none.resolvedEntities || none.resolvedEntities.length === 0,
    `varlık yokken alan doldurulmamalı → ${JSON.stringify(none.resolvedEntities)}`,
  );

  // Sınırlar: en fazla 8, yinelenmez, deterministic sıralı.
  const many = buildUnderstandingSnapshot({
    categoryResolution: {
      status: "unresolved",
      userSelected: false,
      userChoice: null,
      primary: null,
      candidates: [],
    },
    resolvedEntities: Array.from({ length: 20 }, (_, i) => ({
      canonicalId: `platform:x${i % 3}`,
      entityType: "PLATFORM" as const,
      canonicalLabel: "X".repeat(400),
      domainId: "technology",
      confidence: 2,
      source: "fixture",
      verificationStatus: "PENDING_CURATION",
    })),
  });
  const bounded = many.resolvedEntities ?? [];
  assert.ok(bounded.length <= 8, `en fazla 8 varlık (${bounded.length})`);
  assert.equal(
    new Set(bounded.map((e) => `${e.canonicalId}|${e.entityType}`)).size,
    bounded.length,
    "aynı canonicalId+entityType yinelenemez",
  );
  assert.ok(
    bounded.every((e) => e.canonicalLabel.length <= 241),
    "etiket uzunluğu snapshot sanitization sınırına uymalı",
  );
  assert.ok(
    bounded.every((e) => e.confidence >= 0 && e.confidence <= 1),
    "güven 0..1 aralığına sıkıştırılmalı",
  );
  assert.deepEqual(
    bounded.map((e) => e.canonicalId),
    [...bounded.map((e) => e.canonicalId)].sort(),
    "sıralama deterministic olmalı",
  );

  // ESKİ SNAPSHOT: alan yokken okuyucu bozulmamalı.
  const legacy = {
    version: 1,
    kind: "understanding_snapshot",
    categoryResolution: { status: "resolved", userSelected: false, userChoice: null, primary: null, candidates: [] },
    entities: { brand: { value: "Arçelik" } },
    attributes: {},
    unresolvedExpressions: [],
    confirmedFieldKeys: [],
  };
  const parsed = parseUnderstandingSnapshot(legacy);
  assert.ok(parsed, "eski snapshot hâlâ ayrıştırılabilmeli");
  assert.equal(parsed?.resolvedEntities, undefined, "eski snapshot'ta alan yok");
});

check("I26h: tipli varlık profesyonel metinden ve niyetten düşmez", () => {
  /**
   * Kullanıcının yazdığı platform/makine adı öznesiz bir "arıyorum."a
   * indirgenemez. Kural varlık ROLÜNE dayanır: tipli bir varlık çözülmüşse
   * ve adı üretilen cümlede yoksa, cümle kullanıcının GÜVENLİ ifadesinden
   * yeniden kurulur — kelimeye özel bir dal yoktur.
   *
   * Açık hizmet eylemleri ("destek", "danışmanlık", "entegrasyon",
   * "kurulum", "bakım", "servis") tipli varlık yüzünden bastırılamaz.
   */
  const POSITIVE: Array<{ raw: string; keep: string[] }> = [
    { raw: "WordPress destek arıyorum", keep: ["wordpress", "destek"] },
    { raw: "SAP danışmanlık arıyorum", keep: ["sap", "danismanlik"] },
    { raw: "Shopify entegrasyon arıyorum", keep: ["shopify", "entegrasyon"] },
    { raw: "Logo e-fatura kurulumu arıyorum", keep: ["logo", "kurulum"] },
    { raw: "CNC servis arıyorum", keep: ["cnc", "servis"] },
    { raw: "CNC tezgâh bakımı arıyorum", keep: ["cnc", "bakim"] },
  ];
  for (const c of POSITIVE) {
    const s = surfacesFor(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;
    assert.notEqual(s.text.trim(), "arıyorum.", at("öznesiz metin kabul edilmez"));
    const surface = `${fold(s.text)} || ${fold(s.headline)}`;
    for (const k of c.keep) {
      assert.ok(surface.includes(k), at(`'${k}' kullanıcı yüzünde yok → '${s.text}'`));
    }
    assert.equal(s.subjectKind, "SERVICE", at(`hizmet niyeti bastırıldı (${s.subjectKind})`));
    assert.equal(s.brand, null, at(`tipli varlık marka alanına sızdı → '${s.brand}'`));
    assert.equal(s.model, null, at(`tipli varlık model alanına sızdı → '${s.model}'`));
    // Fazla tekrar yok: aynı varlık adı iki kez yazılmaz.
    const label = fold(c.keep[0] ?? "");
    const hits = fold(s.text).split(label).length - 1;
    assert.ok(hits <= 1, at(`'${label}' metinde ${hits} kez geçti → '${s.text}'`));
    // Serbest metin sızıntısı yok.
    assert.ok(!/\d{7,}/.test(s.text), at(`iletişim bilgisi sızdı → '${s.text}'`));
  }

  // PII/bütçe yan cümleleri metne taşınmaz.
  const noisy = surfacesFor(
    "Merhaba, telefonum 05321234567, WordPress destek arıyorum, bütçem 20 bin TL",
  );
  assert.ok(fold(noisy.text).includes("wordpress"), `varlık korunmalı → '${noisy.text}'`);
  assert.ok(!/\d{5,}/.test(noisy.text), `iletişim bilgisi sızdı → '${noisy.text}'`);
  assert.ok(
    !fold(noisy.text).includes("butcem"),
    `bütçe yan cümlesi sızdı → '${noisy.text}'`,
  );

  // NEGATİF: ad çakışmaları tipli varlık üretmez, marka üretmez.
  const NEGATIVE = [
    "bıçak sapı arıyorum",
    "logo tasarımı istiyorum",
    "koltuk destek mekanizması arıyorum",
    "saplı bıçak arıyorum",
  ];
  for (const raw of NEGATIVE) {
    assert.equal(
      resolveDomainEntity(raw).status,
      "NONE",
      `${raw}: yanlış tipli varlık üretildi`,
    );
    const s = surfacesFor(raw);
    assert.equal(s.brand, null, `${raw}: uydurma marka → '${s.brand}'`);
  }
  const cncBrand = surfacesFor("CNC servis arıyorum");
  assert.equal(cncBrand.brand, null, "CNC marka alanına yazılamaz");
});

/* ------------------------------------------------------------------------ *
 * MARKA KANIT SÖZLEŞMESİ — I43 (RC_BRAND dilimi)
 *
 * Yalnız kanıtı olan marka kesinleşir: kanonik katalog doğrulaması
 * (VERIFIED_CATALOG) ya da açık kullanıcı sözdizimi (USER_ASSERTED).
 * Kanıtsız aday CANDIDATE olarak korunur ama kesin `brand` alanına,
 * snapshot `entities.brand`e ve routing envelope'a giremez. Ürün, özellik,
 * malzeme, sıfat ve ticaret sözcükleri hiç marka olamaz (NONE).
 * ------------------------------------------------------------------------ */

check("I43: marka kanıt sınıflandırıcısı — truth table", () => {
  const T: Array<[string, string, string]> = [
    // VERIFIED_CATALOG — kanonik katalog.
    ["Arçelik bulaşık makinesi arıyorum", "Arçelik", "VERIFIED_CATALOG"],
    ["Bosch Serie 6 arıyorum", "Bosch", "VERIFIED_CATALOG"],
    ["Mercedes C180 satın almak istiyorum", "Mercedes", "VERIFIED_CATALOG"],
    ["Heidelberg SM 74 için bakım arıyorum", "Heidelberg", "VERIFIED_CATALOG"],
    // USER_ASSERTED — açık sözdizimi; katalog dışı ad + Türkçe ek/harf çeşitleri.
    ["Nordex marka klima arıyorum", "Nordex", "USER_ASSERTED"],
    ["nordex marka klima arıyorum", "nordex", "USER_ASSERTED"],
    ["NORDEX MARKA KLİMA ARIYORUM", "NORDEX", "USER_ASSERTED"],
    ["Nordex markalı klima arıyorum", "Nordex", "USER_ASSERTED"],
    ["eufy marka bebek arabası arıyorum", "eufy", "USER_ASSERTED"],
    ["Marka olarak Nordex istiyorum", "Nordex", "USER_ASSERTED"],
    // CANDIDATE — kanıtsız bilinmeyen; SİLİNMEZ ama kesinleşmez.
    ["Nordex klima arıyorum", "Nordex", "CANDIDATE"],
    ["North Star klima arıyorum", "North Star", "CANDIDATE"],
    // NONE — genel kanıt kuralları (kelime listesi DEĞİL).
    ["Dizüstü bilgisayar arıyorum, 16 GB RAM olsun", "RAM", "NONE"], // sayı komşuluğu
    ["Kompresör arıyorum atölye için", "Kompresör", "NONE"], // istenen şeyin kendisi
    ["Tekerlekli sandalye arıyorum", "Tekerlekli", "NONE"], // sıfat + kanonik ürün
    ["Logolu promosyon kalem bastırmak istiyorum", "Logolu", "NONE"], // sıfat + ürün
    ["Klima arıyorum", "Klima", "NONE"], // kanonik ürünün kendisi
  ];
  for (const [raw, token, want] of T) {
    const got = classifyBrandEvidence(raw, token);
    assert.equal(
      got.status,
      want,
      `'${raw}' / '${token}': ${got.status} (${got.reason}), beklenen ${want}`,
    );
  }
});

check("I43b: kanıtsız jeton kesin markaya, snapshot'a ve envelope'a giremez", () => {
  /**
   * 108'lik corpus'un 10 RC_BRAND girdisi — fixture'daki gerçek cümleler.
   * Hepsinde ölçülen kusur: sahte marka `fields.brand` + `entities.brand` +
   * `envelope.brand` zincirinden geçip exact brandHit riski üretiyordu.
   */
  const RC_BRAND: Array<{ raw: string; fake: string; keep: string }> = [
    { raw: "Dizüstü bilgisayar arıyorum, 16 GB RAM olsun", fake: "RAM", keep: "dizüstü" },
    { raw: "Ticari araç arıyorum, panelvan olabilir", fake: "Ticari", keep: "araç" },
    { raw: "Torna tezgahı için yedek parça arıyorum", fake: "Torna", keep: "torna" },
    { raw: "Kompresör arıyorum atölye için", fake: "Kompresör", keep: "kompresör" },
    { raw: "Tekerlekli sandalye arıyorum", fake: "Tekerlekli", keep: "tekerlekli" },
    { raw: "Toptan bardak arıyorum, 500 adet", fake: "Toptan", keep: "bardak" },
    { raw: "Kürek sapı arıyorum", fake: "Kürek", keep: "kürek" },
    { raw: "Çelik tencere kapağı arıyorum 24 cm", fake: "Çelik", keep: "kapa" },
    { raw: "Logolu promosyon kalem bastırmak istiyorum", fake: "Logolu", keep: "kalem" },
    { raw: "E-ticaret için karton kutu ürettirmek istiyorum", fake: "E-ticaret", keep: "kutu" },
  ];
  for (const c of RC_BRAND) {
    const p = publishSurfaces(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;
    assert.ok(
      !p.fieldsBrand || fold(p.fieldsBrand) !== fold(c.fake),
      at(`sahte marka canonical alanda → '${p.fieldsBrand}'`),
    );
    assert.ok(
      !p.snapBrand || fold(p.snapBrand) !== fold(c.fake),
      at(`sahte marka snapshot entities.brand içinde → '${p.snapBrand}'`),
    );
    assert.ok(
      !p.envBrand || fold(p.envBrand) !== fold(c.fake),
      at(`sahte marka routing envelope'a ulaştı → '${p.envBrand}'`),
    );
    // Ham kullanıcı bilgisi kaybolmaz: ifade en az bir kullanıcı yüzeyinde.
    assert.ok(
      `${fold(p.text)} || ${fold(p.headline)} || ${fold(p.rawInput)}`.includes(fold(c.keep)),
      at(`'${c.keep}' hiçbir yüzeyde kalmadı → metin='${p.text}'`),
    );
  }
});

check("I43c: doğrulanmış ve beyan edilmiş marka korunur; aday kalıcı ama kesin değil", () => {
  /**
   * POZİTİF KORUMA — gerçek katalog kayıtları kesin marka olarak kalır ve
   * envelope'a ulaşır; kanıt etiketi denetlenebilir.
   */
  const VERIFIED: Array<{ raw: string; brand: string }> = [
    { raw: "Arçelik televizyon arıyorum", brand: "Arçelik" },
    { raw: "Bosch Serie 6 bulaşık makinesi arıyorum", brand: "Bosch" },
    { raw: "Siemens çamaşır makinesi için tahliye pompası arıyorum", brand: "Siemens" },
    { raw: "Mercedes C180 satın almak istiyorum", brand: "Mercedes" },
    { raw: "Renault Clio için ön far arıyorum", brand: "Renault" },
    { raw: "Heidelberg SM 74 için nemlendirme pompası arıyorum", brand: "Heidelberg" },
  ];
  for (const c of VERIFIED) {
    const p = publishSurfaces(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;
    assert.ok(
      fold(p.envBrand ?? "").includes(fold(c.brand)),
      at(`katalog markası envelope'tan düştü → '${p.envBrand}'`),
    );
    assert.equal(p.brandEvidence, "VERIFIED_CATALOG", at(`kanıt etiketi (${p.brandEvidence})`));
  }

  /**
   * USER_ASSERTED — katalog dışı ama açık beyan: marka korunur, kanıt
   * etiketi USER_ASSERTED olur (katalog doğrulaması gibi görünmez).
   */
  const asserted = publishSurfaces("Nordex marka klima arıyorum");
  assert.equal(String(asserted.fieldsBrand), "Nordex", "beyan edilen marka canonical kalmalı");
  assert.equal(asserted.brandEvidence, "USER_ASSERTED", `kanıt etiketi (${asserted.brandEvidence})`);
  assert.ok(asserted.envBrand === "Nordex", "beyan edilen marka routing sinyali olabilir");

  /**
   * CANDIDATE — sözdizimi yok: kesinleşmez, silinmez, kalıcılaşır.
   * Talep oluşturma engellenmez (publish snapshot üretilebilir kalır).
   */
  for (const raw of ["Nordex klima arıyorum", "North Star klima arıyorum"]) {
    const p = publishSurfaces(raw);
    const at = (m: string) => `${raw}: ${m}`;
    assert.ok(!p.envBrand, at(`aday exact marka sinyaline dönüştü → '${p.envBrand}'`));
    assert.ok(!p.snapBrand, at(`aday snapshot'ta kesin marka → '${p.snapBrand}'`));
    assert.ok(
      p.brandCandidate != null && p.brandCandidate.length > 0,
      at("aday kalıcılaşmadı (attributes.brandCandidate boş)"),
    );
    assert.ok(
      fold(p.rawInput).includes("nordex") || fold(p.rawInput).includes("north"),
      at("ham ifade kayboldu"),
    );
    // Kategori bozulmamalı: klima talebi beyaz eşyada kalır.
    assert.equal(p.stateCat, "appliances", at(`kategori (${p.stateCat})`));
  }
});

check("I43d: marka temizliği kullanıcının ürün ifadesini profesyonel metinden silemez", () => {
  /**
   * Blast-radius denetiminin bulgusu (2026-08-25): sahte marka kaldırılınca
   * besteci cümleyi kuracak alan bulamıyor ve metin "arıyorum."a iniyordu —
   * "Kürek sapı arıyorum" HEAD'de tam cümleyken kapıdan sonra öznesiz kaldı.
   * Kural geneldir: marka kesinleşmese de kullanıcının GÜVENLİ ifadesi
   * metinde durur; kaynak ham cümlenin ayrıştırılmış ilk güvenli öbeğidir,
   * kelime listesi değildir.
   */
  const CASES: Array<{ raw: string; keep: string[] }> = [
    { raw: "Torna tezgahı arıyorum", keep: ["torna tezgah"] },
    { raw: "Kürek sapı arıyorum", keep: ["kürek sapı"] },
    { raw: "Kompresör atölye için arıyorum", keep: ["kompresör"] },
    { raw: "Nordex pompa arıyorum", keep: ["nordex", "pompa"] },
    { raw: "North Star pompa arıyorum", keep: ["north star", "pompa"] },
  ];
  for (const c of CASES) {
    const p = publishSurfaces(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;
    assert.notEqual(p.text.trim(), "arıyorum.", at("öznesiz metin kabul edilmez"));
    for (const k of c.keep) {
      assert.ok(
        fold(p.text).includes(fold(k)),
        at(`'${k}' profesyonel metinde yok → '${p.text}'`),
      );
      // Aynı ifade iki kez yazılamaz.
      const hits = fold(p.text).split(fold(k)).length - 1;
      assert.ok(hits <= 1, at(`'${k}' metinde ${hits} kez → '${p.text}'`));
    }
    // Aday marka doğrulanmış marka gibi davranamaz.
    assert.ok(!p.envBrand || p.brandEvidence, at(`kanıtsız marka envelope'ta → '${p.envBrand}'`));
  }

  // PII güvenlik ağı: koruma ham cümleyi değil güvenli öbeği taşır.
  const noisy = publishSurfaces("Kürek sapı arıyorum, telefonum 05321234567, bütçem 20 bin TL");
  assert.ok(fold(noisy.text).includes(fold("kürek sapı")), `ifade korunmalı → '${noisy.text}'`);
  assert.ok(!/\d{5,}/.test(noisy.text), `telefon sızdı → '${noisy.text}'`);
  assert.ok(!fold(noisy.text).includes("bütçem") && !fold(noisy.text).includes("butcem"), `bütçe sızdı → '${noisy.text}'`);
});

check("I43e: küçük harfli açık marka beyanı da USER_ASSERTED markadır", () => {
  /**
   * Ölçülen açık: kimlik katmanı küçük harfli jetonları hiç marka adayı
   * yapmıyor; "eufy marka bebek arabası" beyanı bu yüzden kanıt kapısına
   * hiç ulaşmıyordu. Açık "X marka" dilbilgisi, yazım biçiminden bağımsız
   * kullanıcı beyanıdır.
   */
  const p = publishSurfaces("eufy marka bebek arabası arıyorum");
  assert.equal(String(p.fieldsBrand ?? p.snapBrand), "eufy", `marka çözülmedi → '${p.fieldsBrand}'`);
  assert.equal(p.brandEvidence, "USER_ASSERTED", `kanıt etiketi (${p.brandEvidence})`);
  assert.equal(p.snapBrand, "eufy", `snapshot entities.brand (${p.snapBrand})`);
  assert.equal(p.envBrand, "eufy", `envelope.brand (${p.envBrand})`);
  assert.equal(p.stateCat, "baby", `kategori (${p.stateCat})`);
  assert.ok(
    fold(`${p.text} || ${p.headline}`).includes(fold("bebek arabası")),
    `ürün ifadesi kayboldu → '${p.text}'`,
  );
  // eufy model ya da yalnız aday olamaz.
  const u = understandRequest({ rawInput: "eufy marka bebek arabası arıyorum" }) as never as {
    identity?: { model?: { value?: unknown } };
    attributes?: Record<string, { value?: unknown }>;
  };
  assert.notEqual(String(u.identity?.model?.value ?? ""), "eufy", "eufy model olamaz");
  assert.ok(!u.attributes?.brandCandidate?.value, "beyan edilen marka yalnız aday bırakılamaz");
});

check("I43f: envelope'a kanıtsız marka çıkaran hiçbir yol kalmadı", () => {
  /**
   * `parentTokens.brand` dahil bütün yazım noktaları tek kanıt otoritesine
   * bağlıdır. Kara-kutu kapanış kanıtı: HANGİ yoldan gelirse gelsin,
   * envelope'a ulaşan her marka denetlenebilir kanıt etiketi taşımak
   * ZORUNDADIR (BRAND_PRESENT ⇒ BRAND_ROUTABLE_TRUSTED).
   */
  const MIXED = [
    // eski sahte marka üreticileri
    "Dizüstü bilgisayar arıyorum, 16 GB RAM olsun",
    "Ticari araç arıyorum, panelvan olabilir",
    "Torna tezgahı için yedek parça arıyorum",
    "Kompresör arıyorum atölye için",
    "Toptan bardak arıyorum, 500 adet",
    "Kürek sapı arıyorum",
    "Çelik tencere kapağı arıyorum 24 cm",
    "E-ticaret için karton kutu ürettirmek istiyorum",
    // parent-token bölme adayları
    "North Star pompa arıyorum",
    "Falanca X200 için filtre arıyorum",
    // doğrulanmış ve beyan edilmiş markalar
    "Mercedes C180 için su pompası arıyorum",
    "Heidelberg SM 74 için nemlendirme pompası arıyorum",
    "Arçelik bulaşık makinesi arıyorum",
    "Nordex marka klima arıyorum",
    "eufy marka bebek arabası arıyorum",
  ];
  for (const raw of MIXED) {
    const p = publishSurfaces(raw);
    if (p.envBrand) {
      assert.ok(
        p.brandEvidence === "VERIFIED_CATALOG" || p.brandEvidence === "USER_ASSERTED",
        `${raw}: envelope markası kanıtsız → brand='${p.envBrand}' evidence='${p.brandEvidence}'`,
      );
    }
  }
});

check("I26c: platform/ürün bilgisi hizmet talebinden silinemez", () => {
  /**
   * Alan kanıtı katalogda olmasa bile kullanıcının yazdığı platform/ürün
   * profesyonel metinden çıkarılamaz: "teknik destek arıyorum" cümlesi
   * hangi ürün için destek arandığını kaybeder ve talep eşleşemez hâle
   * gelir. Bu satır kullanıcı yüzü sözleşmesini kilitler; kategori
   * kararından bağımsızdır.
   */
  const CASES: Array<{ raw: string; parts: string[] }> = [
    { raw: "WordPress için teknik destek arıyorum", parts: ["wordpress", "destek"] },
    { raw: "SAP için danışmanlık arıyorum", parts: ["sap", "danismanlik"] },
    { raw: "Logo yazılımı için kurulum hizmeti arıyorum", parts: ["logo", "kurulum"] },
    { raw: "Shopify için entegrasyon hizmeti arıyorum", parts: ["shopify", "entegrasyon"] },
    { raw: "Renault Clio için bakım arıyorum", parts: ["renault", "clio", "bakim"] },
    { raw: "Heidelberg SM 74 için bakım arıyorum", parts: ["heidelberg", "sm 74", "bakim"] },
    { raw: "Arçelik bulaşık makinesi için servis arıyorum", parts: ["arcelik", "servis"] },
  ];
  for (const c of CASES) {
    const s = surfacesFor(c.raw);
    const surface = `${fold(s.text)} || ${fold(s.headline)}`;
    for (const p of c.parts) {
      assert.ok(
        surface.includes(p),
        `${c.raw}: '${p}' kullanıcı yüzünde yok → başlık='${s.headline}' metin='${s.text}'`,
      );
    }
    // Serbest metin sızıntısı yok: profesyonel metin ham cümleyi kopyalamaz.
    assert.ok(!/\d{7,}/.test(s.text), `${c.raw}: iletişim bilgisi sızdı → '${s.text}'`);
  }
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

type NegativeCase = {
  raw: string;
  /** Kullanıcının istediği ve HİÇBİR yüzeyde kaybolmaması gereken ifade. */
  keep: string;
  /** Beklenen talep konusu türü (biliniyorsa). */
  expectKind?: string;
  /** Cümlede ASLA görünmemesi gereken, kullanıcıya ait olmayan genelleme. */
  forbidInText?: string[];
  /** İfade hem başlıkta HEM profesyonel metinde durmalı. */
  keepEverywhere?: boolean;
};

const USAGE_CONTEXT_CASES: NegativeCase[] = [
  {
    raw: "Salon için koltuk arıyorum",
    keep: "koltuk",
    forbidInText: ["mobilya"],
  },
  {
    raw: "Ofis için yazılım desteği arıyorum",
    keep: "yazılım desteği",
    expectKind: "SERVICE",
    forbidInText: ["konut"],
  },
  {
    raw: "Ev için klima servisi arıyorum",
    keep: "klima servisi",
    expectKind: "SERVICE",
  },
  {
    /**
     * "muhasebe yazılımı" bir yazılım ÜRÜNÜdür, bileşen değil. Ayrım kanonik
     * rol yetkisinden okunur (requested-item-role): Türkçe baş sözcük
     * "yazılım" bütün ürün, "modül"/"eklenti" bileşen, "destek"/"hizmet"
     * hizmet rolündedir. Bu satır artık açık bırakılmaz.
     */
    raw: "Ofis için muhasebe yazılımı arıyorum",
    keep: "muhasebe yazılımı",
    forbidInText: ["konut"],
    keepEverywhere: true,
  },
  { raw: "Ofis için televizyon arıyorum", keep: "televizyon" },
  { raw: "Çocuk için tablet arıyorum", keep: "tablet" },
  { raw: "Ev için buzdolabı arıyorum", keep: "buzdolabı" },
  { raw: "İşyeri için klima arıyorum", keep: "klima", forbidInText: ["konut"] },
  { raw: "Salon için televizyon arıyorum", keep: "televizyon" },
];

check("I39: kullanım yeri ve hizmet cümlesi parça ilişkisi kurmaz", () => {
  /**
   * "X için Y" tek başına parça kanıtı değildir; ama hedefin dijital olması da
   * ilişkiyi otomatik reddetmez. Bu invariant reddedilen tarafı BÜTÜN kullanıcı
   * yüzeyleriyle kilitler: konu, ilişki, structured alan, başlık, profesyonel
   * metin ve belirsizlik kaydı.
   */
  for (const c of USAGE_CONTEXT_CASES) {
    const s = surfacesFor(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;

    assert.ok(
      !COMPATIBILITY_KINDS.has(s.subjectKind),
      at(`kullanım bağlamı parça talebi sayılamaz (${s.subjectKind}/${s.subjectStatus})`),
    );
    assert.notEqual(
      s.relationValue,
      "PART_OF",
      at(`parça ilişkisi izi kaldı (relation=${s.relationValue}/${s.relationStatus})`),
    );
    assert.notEqual(
      s.relationshipValue,
      "PART_FOR_PRODUCT",
      at(`relationship parça ilişkisi iddia ediyor (${s.relationshipValue})`),
    );
    assert.ok(
      !s.ambiguityMessages.some((m) => /compat_target_unresolved/i.test(m)),
      at(`gereksiz uyumluluk kaydı → ${JSON.stringify(s.ambiguityMessages)}`),
    );

    // İstenen ifade profesyonel metinde ya da başlıkta DURMALI — yalnız
    // audit kaydında yaşaması yeterli sayılmaz.
    assert.ok(
      fold(s.text).includes(fold(c.keep)) || fold(s.headline).includes(fold(c.keep)),
      at(`'${c.keep}' kullanıcı yüzeyinde yok → başlık='${s.headline}' metin='${s.text}'`),
    );
    if (c.keepEverywhere) {
      assert.ok(
        fold(s.headline).includes(fold(c.keep)),
        at(`'${c.keep}' başlıkta yok → '${s.headline}'`),
      );
      assert.ok(
        fold(s.text).includes(fold(c.keep)),
        at(`'${c.keep}' profesyonel metinde yok → '${s.text}'`),
      );
    }

    // Kullanıcının yazmadığı daha geniş bir kelime onun ürününü ezemez.
    for (const banned of c.forbidInText ?? []) {
      assert.ok(
        !fold(s.text).includes(fold(banned)),
        at(`'${banned}' kullanıcının ifadesini eziyor → '${s.text}'`),
      );
    }

    if (c.expectKind) {
      assert.equal(s.subjectKind, c.expectKind, at(`konu türü (${s.subjectKind})`));
    }
  }

  /**
   * ALIAS BELİRSİZLİĞİ: bir ifade herhangi bir kategoride bütün ürün adayı
   * taşıyorsa, daha derin bir parça alias'ı onu parçaya çeviremez. Kural
   * mekanizmadan okunur, örnekten değil.
   */
  ensureTaxonomyLoaded();
  const byTerm = new Map<string, Set<string>>();
  for (const n of listAllTaxonomyNodes()) {
    for (const term of [n.canonicalName, ...n.aliases]) {
      const key = fold(term);
      if (!key) continue;
      const set = byTerm.get(key) ?? new Set<string>();
      set.add(n.nodeType);
      byTerm.set(key, set);
    }
  }
  const ambiguous = [...byTerm.entries()].filter(
    ([, types]) => types.has("PRODUCT_TYPE") && types.has("PART_TYPE"),
  );
  assert.ok(
    ambiguous.length > 0,
    "hem ürün hem parça olarak geçen bir ifade bulunamadı — kural sınanamıyor",
  );
  for (const [term] of ambiguous) {
    assert.ok(
      isCanonicalWholeProductPhrase(term),
      `'${term}' bir kategoride bütün ürün olarak duruyor; daha derin parça alias'ı bunu bastıramaz`,
    );
  }
});

/**
 * DİJİTAL HEDEF ROLÜ — ÜRÜN / BİLEŞEN / HİZMET (1G son kapı).
 *
 * Yazılımın ürünü de, modülü de, hizmeti de olur. Tek bir kanonik rol yetkisi
 * bunları ayırır; bu invariant o ayrımı kullanıcıya görünen bütün yüzeylerde
 * kilitler. Beklenen roller ÖRNEK CÜMLEDEN değil Türkçe baş sözcüğün rolünden
 * gelir; üretim kodunda bu cümlelerin hiçbiri özel durum olarak yazılı değildir.
 */
type DigitalRole = "PRODUCT" | "COMPONENT" | "SERVICE" | "OPEN";
type DigitalCase = { raw: string; keep: string; role: DigitalRole };

const DIGITAL_ROLE_CASES: DigitalCase[] = [
  // Bütün dijital ürün: baş sözcük yazılım / uygulama / sistem.
  { raw: "Ofis için muhasebe yazılımı arıyorum", keep: "muhasebe yazılımı", role: "PRODUCT" },
  { raw: "İşletmem için CRM yazılımı arıyorum", keep: "crm yazılımı", role: "PRODUCT" },
  { raw: "Restoran için POS yazılımı arıyorum", keep: "pos yazılımı", role: "PRODUCT" },
  { raw: "Çocuk için eğitim uygulaması arıyorum", keep: "eğitim uygulaması", role: "PRODUCT" },
  { raw: "Şirket için ERP sistemi arıyorum", keep: "erp sistemi", role: "PRODUCT" },
  // Dijital bileşen / aksesuar: baş sözcük eklenti / modül / tema.
  { raw: "WordPress için SEO eklentisi arıyorum", keep: "seo eklentisi", role: "COMPONENT" },
  { raw: "Logo yazılımı için e-fatura modülü arıyorum", keep: "e-fatura modülü", role: "COMPONENT" },
  { raw: "SAP için FI modülü arıyorum", keep: "modülü", role: "COMPONENT" },
  { raw: "Photoshop için eklenti arıyorum", keep: "eklenti", role: "COMPONENT" },
  { raw: "WordPress için tema arıyorum", keep: "tema", role: "COMPONENT" },
  // Hizmet: baş sözcük destek / danışmanlık / hizmet.
  { raw: "WordPress için teknik destek arıyorum", keep: "teknik destek", role: "SERVICE" },
  { raw: "SAP için danışmanlık arıyorum", keep: "danışmanlık", role: "SERVICE" },
  { raw: "Logo yazılımı için kurulum hizmeti arıyorum", keep: "kurulum hizmeti", role: "SERVICE" },
  { raw: "Shopify için entegrasyon hizmeti arıyorum", keep: "entegrasyon hizmeti", role: "SERVICE" },
  { raw: "Web sitesi için bakım desteği arıyorum", keep: "bakım desteği", role: "SERVICE" },
  // Rolü bilinmiyor ama ifade korunmalı; kanıt yokken kesinlik iddia edilemez.
  { raw: "Shopify için stok entegrasyonu arıyorum", keep: "stok entegrasyonu", role: "OPEN" },
  { raw: "ERP için özel bağlantı arıyorum", keep: "özel bağlantı", role: "OPEN" },
];

check("I40: dijital hedefin rolü — ürün, bileşen ve hizmet ayrı ayrı korunur", () => {
  for (const c of DIGITAL_ROLE_CASES) {
    const s = surfacesFor(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;

    // (1) Kullanıcının ifadesi başlıktan ya da profesyonel metinden düşemez.
    assert.ok(
      fold(s.text).includes(fold(c.keep)) || fold(s.headline).includes(fold(c.keep)),
      at(`'${c.keep}' kullanıcı yüzeyinde yok → başlık='${s.headline}' metin='${s.text}'`),
    );

    // (2) Kullanıcının yazmadığı marka/model üretilemez.
    for (const [label, value] of [["marka", s.brand], ["model", s.model]] as const) {
      if (!value) continue;
      assert.ok(
        fold(c.raw).includes(fold(value)),
        at(`kullanıcının yazmadığı ${label} üretildi → '${value}'`),
      );
    }

    if (c.role === "PRODUCT") {
      // Bütün dijital ürün parça olamaz.
      assert.ok(
        !COMPATIBILITY_KINDS.has(s.subjectKind),
        at(`bütün dijital ürün parça sayılamaz (${s.subjectKind}/${s.subjectStatus})`),
      );
      assert.notEqual(s.relationValue, "PART_OF", at("parça ilişkisi izi kaldı"));
      assert.notEqual(
        s.relationshipValue,
        "PART_FOR_PRODUCT",
        at("relationship parça ilişkisi iddia ediyor"),
      );
      assert.ok(
        !s.ambiguityMessages.some((m) => /compat_target_unresolved/i.test(m)),
        at(`gereksiz uyumluluk kaydı → ${JSON.stringify(s.ambiguityMessages)}`),
      );
    } else if (c.role === "SERVICE") {
      // Hizmet parça olamaz.
      assert.equal(s.subjectKind, "SERVICE", at(`hizmet bekleniyordu (${s.subjectKind})`));
      assert.notEqual(s.relationValue, "PART_OF", at("hizmet PART_OF izi bırakamaz"));
      assert.ok(
        !s.ambiguityMessages.some((m) => /compat_target_unresolved/i.test(m)),
        at(`hizmette uyumluluk kaydı üretilemez → ${JSON.stringify(s.ambiguityMessages)}`),
      );
    } else if (c.role === "COMPONENT") {
      // Modül/eklenti sırf dijital diye reddedilemez...
      assert.ok(
        COMPATIBILITY_KINDS.has(s.subjectKind),
        at(`dijital bileşen uyumluluk yolundan düştü (${s.subjectKind})`),
      );
      // ...ama üst ürün kanıtı yokken kesinlik iddia edemez.
      assert.notEqual(
        s.subjectStatus,
        "CONFIDENT",
        at(`kanıtsız dijital uyumlulukta kesinlik üretilemez (${s.subjectStatus})`),
      );
    } else if (COMPATIBILITY_KINDS.has(s.subjectKind)) {
      assert.notEqual(
        s.subjectStatus,
        "CONFIDENT",
        at(`rolü belirsiz hedefte kesinlik üretilemez (${s.subjectStatus})`),
      );
    }
  }
});

check("I41: hizmet sözcüğü niteleyici konumdayken talebi hizmete çeviremez", () => {
  /**
   * "destek" ve "danışmanlık" hizmet sözlüğündedir; ama Türkçe ad tamlamasında
   * BAŞ SONDADIR. "destek ayağı" bir ayaktır, "koltuk destek mekanizması" bir
   * mekanizmadır — ikisi de hizmet değildir. Yalnız lemma eşleşmesi bütün
   * talebi hizmete çeviremez.
   *
   * "danışmanlık firması" istisna DEĞİL, aynı kuralın sonucudur: sağlayıcı adı
   * ("firma", "şirket", "usta") rolü kendi üstüne almaz, solundakini taşır.
   */
  const CASES: Array<{ raw: string; service: boolean }> = [
    { raw: "destek ayağı arıyorum", service: false },
    { raw: "koltuk destek mekanizması arıyorum", service: false },
    { raw: "teknik destek arıyorum", service: true },
    { raw: "yazılım danışmanlığı arıyorum", service: true },
    { raw: "danışmanlık firması arıyorum", service: true },
  ];
  for (const c of CASES) {
    const s = surfacesFor(c.raw);
    const at = (m: string) => `${c.raw}: ${m}`;
    if (c.service) {
      assert.equal(s.subjectKind, "SERVICE", at(`hizmet bekleniyordu (${s.subjectKind})`));
    } else {
      assert.notEqual(
        s.subjectKind,
        "SERVICE",
        at(`niteleyici hizmet sözcüğü bütün talebi hizmete çevirdi (${s.subjectKind})`),
      );
    }
  }
});

check("I42: ifade koruma yalnız ayrıştırılmış hedefi taşır, ham cümleyi değil", () => {
  /**
   * `preserveRequestedTarget` kullanıcının hedefini profesyonel metne geri
   * koyar. Bu invariant o kuralın SINIRINI kilitler: yalnız ayrıştırılmış
   * hedef span'i taşınır — bütçe, telefon ve konum gibi serbest metin
   * parçaları taşınmaz; parça bestecisi ezilmez; ifade iki kez yazılmaz.
   */
  const budget = surfacesFor("Ofis için muhasebe yazılımı arıyorum, bütçem 20 bin TL");
  assert.ok(
    fold(budget.text).includes("muhasebe yazilimi"),
    `hedef korunmalı → '${budget.text}'`,
  );
  for (const leak of ["butcem", "20 bin", " tl"]) {
    assert.ok(
      !fold(budget.text).includes(leak),
      `serbest metin parçası profesyonel metne sızdı ('${leak}') → '${budget.text}'`,
    );
  }

  const phone = surfacesFor("WordPress için destek arıyorum, telefonum 05321234567");
  assert.ok(
    !/\d{7,}/.test(phone.text),
    `iletişim bilgisi profesyonel metne sızdı → '${phone.text}'`,
  );

  const place = surfacesFor("Ev için klima servisi, İstanbul Kadıköy");
  assert.equal(place.subjectKind, "SERVICE", `hizmet kalmalı (${place.subjectKind})`);

  // Parça bestecisi ezilmez: marka ve model cümlede kalır, ifade tekrarlanmaz.
  const merc = surfacesFor("Mercedes C180 için su pompası arıyorum");
  assert.ok(
    fold(merc.text).includes("mercedes") && fold(merc.text).includes("c180"),
    `parça bestecisi ezildi → '${merc.text}'`,
  );
  const heid = surfacesFor("Heidelberg SM 74 için nemlendirme pompası arıyorum");
  assert.ok(
    fold(heid.text).includes("heidelberg") && fold(heid.text).includes("sm 74"),
    `parça bestecisi ezildi → '${heid.text}'`,
  );
  for (const s of [merc, heid, budget, place]) {
    const dup = fold(s.text).match(/pompasi/g)?.length ?? 0;
    assert.ok(dup <= 1, `aynı ifade iki kez yazıldı → '${s.text}'`);
    assert.ok(!/\s{2,}/.test(s.text), `bozuk boşluk → '${s.text}'`);
    assert.ok(/\.$/.test(s.text.trim()), `cümle noktalanmadı → '${s.text}'`);
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

/* ------------------------------------------------------------------------ *
 * I44 — TİPLİ SAYI-BİRİM OTORİTESİ + MODEL KANIT KAPISI (S1A dilimi)
 *
 * Sözleşme: bir sayının görevini BAĞLAMI ve BİRİMİ belirler; aynı span iki
 * çelişen exact role yazılamaz. Exact model yalnız güvenilir model
 * kanıtından geçer (katalog modeli ya da sayı otoritesinin MODEL_IDENTIFIER
 * kararı); miktar/ağırlık/kapasite/ebat span'i model, screenSize veya
 * üretim nesnesi ÜRETEMEZ.
 *
 * Bilinçli kapsam dışı (bu dilimde ÇÖZÜLMEDİ, burada test edilmez):
 *   - "ahşap" malzeme çıkarımı (furn-07'nin ayrı kök nedeni)
 *   - "kiralama" işlem türü (auto-06) ve filo/lastik ailelerinin kind kararı
 *   - taxonomy alias ("lastiği" → Lastik düğümü) ve kategori dedektörü
 * ------------------------------------------------------------------------ */

/** I44 yüzey okuyucu — publishSurfaces'ın model odaklı ikizi. */
function i44Surfaces(raw: string) {
  const understanding = understandRequest({ rawInput: raw }) as never as {
    quantity?: { value?: { value?: number } };
    requestSubject?: { kind?: { value?: string } };
    attributes?: Record<string, { value?: unknown }>;
  };
  const { state } = syncFromText(null, raw);
  const f = (k: string) => {
    const x = (state.fields as Record<string, { kind?: string; value?: unknown }>)[k];
    return x && x.kind === "VALUE" && x.value ? String(x.value) : null;
  };
  const snap = buildPublishUnderstandingSnapshot({
    understanding: understanding as never,
    userSelected: false,
    primarySlug: null,
  });
  const env = buildRequestRoutingEnvelope({
    understandingSnapshot: snap,
    categorySlug: state.categoryId ?? undefined,
  } as never) as never as { model?: string | null };
  const attrs = understanding.attributes ?? {};
  return {
    kind: understanding.requestSubject?.kind?.value ?? null,
    quantity: understanding.quantity?.value?.value ?? null,
    fieldsBrand: f("brand"),
    fieldsModel: f("model"),
    snapModel:
      (snap.entities as Record<string, { value?: unknown }> | undefined)?.model
        ?.value != null
        ? String(
            (snap.entities as Record<string, { value?: unknown }>).model.value,
          )
        : null,
    envModel: env.model ?? null,
    attr: (k: string) => (attrs[k]?.value != null ? String(attrs[k].value) : null),
    headline: String(
      (buildUnderstandingSummary(understanding as never) as unknown as {
        headline?: string;
      })?.headline ?? "",
    ),
    text: composeNaturalRequestText(state),
  };
}

check("I44a: sayı-birim truth table — rol bağlam ve birimden gelir", () => {
  const roleOf = (raw: string, span: string): string[] =>
    classifyNumbers(raw)
      .filter((n) => n.raw.toLocaleLowerCase("tr-TR").includes(span.toLocaleLowerCase("tr-TR")) ||
        span.toLocaleLowerCase("tr-TR").includes(n.raw.toLocaleLowerCase("tr-TR")))
      .map((n) => String(n.role));

  // 1. Lastik ebadı — model/screen/quantity değil
  {
    const roles = roleOf("Araba lastiği arıyorum 205/55 R16", "205/55");
    assert.ok(roles.includes("TIRE_SIZE"), `205/55 → TIRE_SIZE olmalı: ${roles.join(",")}`);
    for (const all of classifyNumbers("Araba lastiği arıyorum 205/55 R16")) {
      assert.notEqual(String(all.role), "MODEL_IDENTIFIER",
        `lastik ebadı içinden model üretilemez: ${all.raw}:${all.role}`);
      assert.notEqual(String(all.role), "SCREEN_SIZE", `${all.raw} screen olamaz`);
      assert.notEqual(String(all.role), "QUANTITY", `${all.raw} quantity olamaz`);
    }
  }
  // 2. Kişi kapasitesi — model/screen değil, körlemesine quantity değil
  {
    const roles = roleOf("6 kişilik ahşap yemek masası arıyorum", "6");
    assert.ok(roles.includes("SEATING"), `6 kişilik → SEATING olmalı: ${roles.join(",")}`);
    assert.ok(!roles.includes("MODEL_IDENTIFIER"), "6 model olamaz");
    assert.ok(!roles.includes("SCREEN_SIZE"), "6 screen olamaz");
    assert.ok(!roles.includes("QUANTITY"), "6 kişilik körlemesine quantity olamaz");
  }
  // 3. Miktar + birim (kutu)
  {
    const q = classifyNumbers("Klinik için steril eldiven arıyorum, 100 kutu").find(
      (n) => String(n.role) === "QUANTITY",
    );
    assert.ok(q && q.value === 100 && /kutu/.test(String(q.unit)),
      `100 kutu → QUANTITY(100, kutu) olmalı: ${JSON.stringify(q)}`);
    assert.ok(
      classifyNumbers("Klinik için steril eldiven arıyorum, 100 kutu").every(
        (n) => String(n.role) !== "SCREEN_SIZE" && String(n.role) !== "MODEL_IDENTIFIER",
      ),
      "100 screen/model olamaz",
    );
  }
  // 4. Filo miktarı ("araçlık" birimi) — model/screen değil
  {
    const q = classifyNumbers("Şirketim için 10 araçlık filo kiralama arıyorum").find(
      (n) => String(n.role) === "QUANTITY",
    );
    assert.ok(q && q.value === 10, `10 araçlık → QUANTITY(10) olmalı: ${JSON.stringify(q)}`);
    assert.ok(
      classifyNumbers("Şirketim için 10 araçlık filo kiralama arıyorum").every(
        (n) => String(n.role) !== "MODEL_IDENTIFIER" && String(n.role) !== "SCREEN_SIZE",
      ),
      "10 model/screen olamaz",
    );
  }
  // 5. BTU — kapasite
  {
    const c = classifyNumbers("12000 BTU klima arıyorum").find(
      (n) => String(n.role) === "CAPACITY",
    );
    assert.ok(c && c.value === 12000 && /btu/i.test(String(c.unit)),
      `12000 BTU → CAPACITY(btu) olmalı: ${JSON.stringify(c)}`);
    assert.ok(
      classifyNumbers("12000 BTU klima arıyorum").every(
        (n) =>
          String(n.role) !== "MODEL_IDENTIFIER" &&
          String(n.role) !== "SCREEN_SIZE" &&
          String(n.role) !== "QUANTITY",
      ),
      "12000 model/screen/quantity olamaz",
    );
  }
  // 6. Ağırlık
  {
    const w = classifyNumbers("15 kg bebek maması arıyorum").find(
      (n) => String(n.role) === "WEIGHT",
    );
    assert.ok(w && w.value === 15 && w.unit === "kg", `15 kg → WEIGHT: ${JSON.stringify(w)}`);
  }
  // 7. Ekran — birim destekli mevcut doğru davranış korunur
  {
    const s = classifyNumbers("Arçelik 55 inç televizyon arıyorum").find(
      (n) => String(n.role) === "SCREEN_SIZE",
    );
    assert.ok(s && s.value === 55, `55 inç → SCREEN_SIZE: ${JSON.stringify(s)}`);
  }
  // 8. Model yılı korunur
  {
    const y = classifyNumbers("2019 Renault Clio arıyorum").find(
      (n) => String(n.role) === "MODEL_YEAR",
    );
    assert.ok(y && y.value === 2019, `2019 → MODEL_YEAR: ${JSON.stringify(y)}`);
  }
});

check("I44b: aynı sayı span'i iki çelişen exact role yazılamaz", () => {
  const INPUTS = [
    "Araba lastiği arıyorum 205/55 R16",
    "6 kişilik ahşap yemek masası arıyorum",
    "Klinik için steril eldiven arıyorum, 100 kutu",
    "Şirketim için 10 araçlık filo kiralama arıyorum",
    "12000 BTU klima arıyorum",
    "15 kg bebek maması arıyorum",
    "Arçelik 55 inç televizyon arıyorum",
    "2019 Renault Clio arıyorum",
    "Mercedes C180 için ön far arıyorum",
    "Heidelberg SM 74 için nemlendirme pompası arıyorum",
  ];
  for (const raw of INPUTS) {
    const claimed = classifyNumbers(raw).filter((n) => String(n.role) !== "OTHER");
    for (let i = 0; i < claimed.length; i++) {
      for (let j = i + 1; j < claimed.length; j++) {
        const a = claimed[i]!;
        const b = claimed[j]!;
        const overlap =
          a.index < b.index + b.raw.length && b.index < a.index + a.raw.length;
        assert.ok(
          !overlap,
          `${raw}: '${a.raw}':${a.role} ile '${b.raw}':${b.role} çakışıyor`,
        );
      }
    }
  }
});

check("I44c: miktar/ölçü span'i model olamaz — publish yüzeyleri temiz", () => {
  const CASES: Array<{ raw: string; keepInText: string }> = [
    // "ahşap" bu dilimin DIŞINDA — yalnız model temizliği ve ürünün metinde kalması denetlenir.
    { raw: "Yemek masası arıyorum 6 kişilik ahşap", keepInText: "masa" },
    { raw: "Torna tezgahı için yedek parça arıyorum", keepInText: "torna" },
    { raw: "Araba lastiği arıyorum 205/55 R16", keepInText: "lasti" },
    { raw: "Oto koltuğu arıyorum 9-36 kg", keepInText: "koltu" },
  ];
  for (const c of CASES) {
    const s = i44Surfaces(c.raw);
    for (const [surface, v] of [
      ["fields.model", s.fieldsModel],
      ["snapshot.model", s.snapModel],
      ["envelope.model", s.envModel],
    ] as const) {
      assert.equal(
        v,
        null,
        `${c.raw}: ${surface} kanıtsız model taşıyamaz → '${v}'`,
      );
    }
    assert.ok(
      !/^\d+$/.test(s.headline.trim()),
      `${c.raw}: başlık çıplak sayıya bozulamaz → '${s.headline}'`,
    );
    assert.ok(
      fold(s.text).includes(c.keepInText),
      `${c.raw}: ürün ifadesi metinden düşemez → '${s.text}'`,
    );
  }
  // Lastik ebadı canonical attribute'a taşınır (kaybolmaz)
  const tire = i44Surfaces("Araba lastiği arıyorum 205/55 R16");
  assert.ok(
    (tire.attr("tireSize") ?? "").includes("205/55"),
    `lastik ebadı tireSize attribute'unda tutulmalı → '${tire.attr("tireSize")}'`,
  );
});

check("I44d: gerçek modeller model kanıt kapısından geçer (koruma)", () => {
  const CASES: Array<{ raw: string; model: string }> = [
    { raw: "Mercedes C180 için ön far arıyorum", model: "C180" },
    { raw: "Heidelberg SM 74 için nemlendirme pompası arıyorum", model: "SM 74" },
    { raw: "2019 Renault Clio arıyorum", model: "Clio" },
    { raw: "Volkswagen Passat arıyorum", model: "Passat" },
    { raw: "iPhone 15 Pro arıyorum", model: "iPhone 15 Pro" },
  ];
  for (const c of CASES) {
    const s = i44Surfaces(c.raw);
    assert.equal(s.envModel, c.model, `${c.raw}: envelope.model '${c.model}' kalmalı → '${s.envModel}'`);
    assert.equal(s.snapModel, c.model, `${c.raw}: snapshot.model '${c.model}' kalmalı → '${s.snapModel}'`);
  }
  // Katalog kimliği sayı kapısına takılmaz (bugünkü ölçülen davranış korunur;
  // "Galaxy" öneki ayrı bir katalog sorunudur, bu dilimin konusu değildir).
  const a55 = i44Surfaces("Arçelik A55 D çamaşır makinesi arıyorum");
  assert.ok(
    (a55.envModel ?? "").includes("A55"),
    `A55 D model kimliği korunmalı → '${a55.envModel}'`,
  );
  // Marka-ardılı sayısız katalog modeli korunur; ekran ölçüsü modelden ayrışır.
  const chicco = i44Surfaces("Chicco Goody Plus bebek arabası arıyorum");
  assert.equal(chicco.envModel, "Goody Plus",
    `Goody Plus modeli korunmalı → '${chicco.envModel}'`);
  const a55tv = i44Surfaces("Arçelik A55 D 55 inç televizyon arıyorum");
  assert.ok((a55tv.envModel ?? "").includes("A55"),
    `A55 D korunmalı → '${a55tv.envModel}'`);
  assert.equal(a55tv.attr("screenSize"), "55",
    `55 yalnız screenSize olmalı → '${a55tv.attr("screenSize")}'`);
  const clio19 = i44Surfaces("Renault Clio 2019 arıyorum");
  assert.equal(clio19.envModel, "Clio", `Clio korunmalı → '${clio19.envModel}'`);
});

check("I44g: katalog markasını izleyen ürün/parça adı model olamaz", () => {
  /**
   * Model kanıt kapısının "markayı izleyen yazım" kuralı yalnız POZİTİF
   * kanıt üretir; markadan sonra gelen ürün türü ya da parça adı bu kuralla
   * model OLAMAZ ("Bosch pompa" → model null). Ürün/parça kimliği (marka,
   * part alanı) bu sırada kaybolmaz.
   */
  const CASES: Array<{ raw: string; brand: string; part: string | null }> = [
    { raw: "Bosch pompa arıyorum", brand: "Bosch", part: "pompa" },
    { raw: "Bosch çamaşır makinesi için pompa arıyorum", brand: "Bosch", part: "pompa" },
    { raw: "Siemens fırın için termostat arıyorum", brand: "Siemens", part: "termostat" },
    { raw: "Arçelik televizyon arıyorum", brand: "Arçelik", part: null },
  ];
  for (const c of CASES) {
    const s = i44Surfaces(c.raw);
    for (const [surface, v] of [
      ["fields.model", s.fieldsModel],
      ["snapshot.model", s.snapModel],
      ["envelope.model", s.envModel],
    ] as const) {
      assert.equal(v, null, `${c.raw}: ${surface} model üretemez → '${v}'`);
    }
    assert.equal(s.fieldsBrand, c.brand, `${c.raw}: marka kaybolamaz → '${s.fieldsBrand}'`);
    if (c.part) {
      assert.ok(
        fold(String(s.attr("part") ?? "")).includes(fold(c.part)),
        `${c.raw}: parça alanı '${c.part}' kalmalı → '${s.attr("part")}'`,
      );
    }
  }
});

check("I44e: negatif kanaryalar — çıplak sayı model/screen üretemez", () => {
  const CASES = [
    "Masa arıyorum 6",
    "Ofis koltuğu arıyorum 100",
    "Sandalye arıyorum 12",
  ];
  for (const raw of CASES) {
    const s = i44Surfaces(raw);
    for (const v of [s.fieldsModel, s.snapModel, s.envModel]) {
      assert.equal(v, null, `${raw}: çıplak sayı exact model olamaz → '${v}'`);
    }
    assert.equal(
      s.attr("screenSize"),
      null,
      `${raw}: birim/bağlam yokken screenSize oluşamaz → '${s.attr("screenSize")}'`,
    );
    assert.ok(!/^\d+$/.test(s.headline.trim()), `${raw}: başlık '${s.headline}' çıplak sayı olamaz`);
  }
  // Ağırlık aralığı ekran boyutu değildir (baby-02 sınıfı)
  const kg = i44Surfaces("Oto koltuğu arıyorum 9-36 kg");
  assert.equal(kg.attr("screenSize"), null, `9-36 kg screenSize üretemez → '${kg.attr("screenSize")}'`);
  // Birim destekli gerçek ekran korunur
  const tv = i44Surfaces("Arçelik 55 inç televizyon arıyorum");
  assert.equal(tv.attr("screenSize"), "55", `55 inç screenSize kalmalı → '${tv.attr("screenSize")}'`);
});

check("I44f: miktar birimi üretim nesnesi sayılamaz (100 kutu sınıfı)", () => {
  /**
   * "Klinik için steril eldiven arıyorum, 100 kutu" — '100 kutu' bir miktar
   * span'idir; sayının birimi olan 'kutu' üretilecek nesne sinyali olamaz.
   * Kategori kararı bu dilimin dışında; burada yalnız sayı-birim sözleşmesi
   * denetlenir. Açık üretim fiili ("kutu ürettirmek") DAVRANIŞI KORUR.
   */
  const s = i44Surfaces("Klinik için steril eldiven arıyorum, 100 kutu");
  assert.notEqual(s.kind, "MANUFACTURED_ITEM",
    `miktar birimi üretim talebi kuramaz → kind='${s.kind}'`);
  assert.equal(s.quantity, 100, `adet bilgisi kaybolamaz → ${s.quantity}`);
  assert.ok(!fold(s.headline).includes("uretim"),
    `başlık üretim talebine dönüşemez → '${s.headline}'`);
  assert.ok(fold(s.text).includes("eldiven"),
    `ürün ifadesi metinde kalmalı → '${s.text}'`);
  // Açık üretim fiili korunur — bastırma yalnız birim bağlamındadır.
  const mfg = i44Surfaces("Logolu karton kutu ürettirmek istiyorum");
  assert.equal(mfg.kind, "MANUFACTURED_ITEM",
    `açık üretim fiili MANUFACTURED_ITEM kalmalı → '${mfg.kind}'`);
  // Filo miktarı: adet yakalanır; 'kiralama' işlem türü bu dilimde AÇIK bırakıldı.
  const filo = i44Surfaces("Şirketim için 10 araçlık filo kiralama arıyorum");
  assert.equal(filo.quantity, 10, `10 araçlık → quantity 10 olmalı → ${filo.quantity}`);
});

if (knownFailNotes.length) {
  console.log(`\nKNOWN_FAIL (bilinen açık — PASS sayılmaz, bataryayı kırmızıya çevirmez):`);
  for (const n of knownFailNotes) console.log(`  - ${n}`);
}
console.log(`\n${passed} passed, ${failed} failed, ${knownFail} known_fail`);
if (failed > 0) process.exit(1);
