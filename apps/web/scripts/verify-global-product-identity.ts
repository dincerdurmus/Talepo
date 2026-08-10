/**
 * Global Product Identity & Matching Engine V1 verification.
 * Run: npx tsx scripts/verify-global-product-identity.ts
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { listCategoryCoverage } from "../src/lib/price-intelligence/category-registry";
import { computeExternalShoppingSuitability } from "../src/lib/price-intelligence/product-suitability";
import {
  EXTERNAL_MATCH_QUALITY,
  isDataForSeoConfigured,
} from "../src/lib/price-intelligence/provider-config";
import type { ExternalPriceObservation, NormalizedProduct } from "../src/lib/price-intelligence/types";
import { buildProductIdentity } from "../src/lib/product-identity/identity-builder";
import { matchProductToExternal } from "../src/lib/product-identity/matching-engine";
import { normalizeExternalProduct } from "../src/lib/product-identity/external-product";
import { normalizeModelText } from "../src/lib/product-identity/model-normalization";
import {
  extractStorageFromText,
  normalizeStorageValue,
  storageValuesEquivalent,
} from "../src/lib/product-identity/unit-normalization";
import { detectAccessory } from "../src/lib/product-identity/accessory-detection";
import { normalizeCondition } from "../src/lib/product-identity/condition";
import { modelIdentityTokenConflict } from "../src/lib/product-identity/model-identity-tokens";
import { splitProductNameString } from "../src/lib/product-identity/brand-extraction";
import {
  computeExternalMatchQuality,
  filterByMatchQuality,
} from "../src/server/price-intelligence/external-match-quality";
import { normalizeProductFromRequest } from "../src/server/price-intelligence/normalize-product";
import { fetchExternalListings } from "../src/server/price-intelligence/fetch-external-listings";
import { buildProviderRouting } from "../src/server/price-intelligence/provider-query";
import { clearProviderCache } from "../src/server/price-intelligence/provider-cache";

type TestCase = {
  label: string;
  categorySlug: string;
  title: string;
  fields: { key: string; value: string; label?: string }[];
  expectBrand?: string | null;
  expectModel?: string | null;
  expectVariant?: string | null;
  expectSuitabilityMin?: number;
  expectSuitabilityMax?: number;
  expectExternalCall?: boolean;
};

type MatchAuditRow = {
  title: string;
  matchQuality: number;
  passed: boolean;
  label: "TRUE_POSITIVE" | "FALSE_POSITIVE" | "TRUE_NEGATIVE" | "FALSE_NEGATIVE";
  reason: string;
};

function norm(
  slug: string,
  title: string,
  fields: { key: string; value: string; label?: string }[],
): NormalizedProduct {
  return normalizeProductFromRequest({
    categoryId: `cat-${slug}`,
    categorySlug: slug,
    title,
    fieldValues: fields,
  });
}

function obs(title: string, price = 50000, extra: Partial<ExternalPriceObservation> = {}): ExternalPriceObservation {
  return {
    provider: "dataforseo-google-shopping",
    externalId: `test-${title.slice(0, 20)}`,
    title,
    price,
    currency: "TRY",
    condition: null,
    location: "Turkiye",
    url: null,
    observedAt: new Date(),
    sourceType: "EXTERNAL_LISTING",
    ...extra,
  };
}

function auditListing(
  normalized: NormalizedProduct,
  title: string,
  expectedPass: boolean,
): MatchAuditRow {
  const listing = obs(title);
  const ext = normalizeExternalProduct(listing);
  const result = matchProductToExternal(normalized, ext, EXTERNAL_MATCH_QUALITY.minAggregate);
  const passed = result.passed;

  let label: MatchAuditRow["label"];
  if (expectedPass && passed) label = "TRUE_POSITIVE";
  else if (!expectedPass && !passed) label = "TRUE_NEGATIVE";
  else if (!expectedPass && passed) label = "FALSE_POSITIVE";
  else label = "FALSE_NEGATIVE";

  return {
    title,
    matchQuality: result.score,
    passed,
    label,
    reason: [...result.reasons, ...result.mismatches].join("; ") || "—",
  };
}

async function runLiveQuery(
  normalized: NormalizedProduct,
  categorySlug: string,
  title: string,
): Promise<{ raw: number; matched: number; sampleTitles: string[] }> {
  clearProviderCache();
  const result = await fetchExternalListings({
    categorySlug,
    categoryId: normalized.categoryId,
    title,
    normalized,
  });
  const matched = filterByMatchQuality(
    normalized,
    result.observations,
    EXTERNAL_MATCH_QUALITY.minAggregate,
  );
  return {
    raw: result.observations.length,
    matched: matched.length,
    sampleTitles: matched.slice(0, 5).map((o) => o.title),
  };
}

async function main() {
  const reportLines: string[] = [];
  const log = (line: string) => {
    console.log(line);
    reportLines.push(line);
  };

  log("# Global Product Identity V1.1 — Test Run");
  log(`Date: ${new Date().toISOString()}`);
  log("");

  // --- Unit: model normalization ---
  assert.equal(normalizeModelText("SM74"), "sm 74");
  assert.equal(normalizeModelText("V15Detect"), "v15 detect");
  assert.equal(normalizeModelText("iPhone15 ProMax"), "iphone 15 pro max");
  assert.equal(normalizeModelText("WGG244Z0TR"), "wgg244z0tr");
  assert.ok(storageValuesEquivalent("256GB", "256 GB"));
  assert.ok(storageValuesEquivalent("1TB", "1024 GB") === false, "1TB != 1024GB token policy");
  assert.equal(extractStorageFromText("Apple iPhone 15 Pro Max 256 GB"), "256gb");
  assert.equal(normalizeCondition("yeni"), "NEW");
  assert.equal(normalizeCondition("refurbished"), "REFURBISHED");

  // --- V1.1: Generic model identity conflict (Example brand) ---
  log("## V1.1 Model identity conflict (brand-independent)");
  const conflictCases: Array<{ req: string; ext: string; label: string }> = [
    { req: "V15", ext: "Example V12", label: "V15 vs V12" },
    { req: "S24 Ultra", ext: "Example S23 Ultra", label: "S24 vs S23" },
    { req: "DHP486", ext: "Example DHP484", label: "DHP486 vs DHP484" },
    { req: "XR-900 Pro", ext: "Example XR-800 Pro", label: "XR-900 vs XR-800" },
  ];
  for (const c of conflictCases) {
    const conflict = modelIdentityTokenConflict(c.req, c.ext);
    assert.ok(conflict.conflict, `${c.label} should HARD REJECT`);
    log(`- ${c.label}: conflict=${conflict.conflict} (${conflict.reason})`);
  }
  log("");

  // --- V1.1: Brand extraction fixtures (no catalog) ---
  log("## V1.1 Brand extraction");
  const brandFixtures: Array<{ input: string; brand: string; model: string }> = [
    { input: "Novexa XR-900 Pro", brand: "Novexa", model: "XR-900 Pro" },
    { input: "DeWalt DCD996", brand: "DeWalt", model: "DCD996" },
    { input: "iRobot Roomba j7+", brand: "iRobot", model: "Roomba j7+" },
    { input: "LaCie Rugged Mini", brand: "LaCie", model: "Rugged Mini" },
    { input: "UnknownCorp ZX500", brand: "UnknownCorp", model: "ZX500" },
    { input: "Samsung Galaxy S24 Ultra", brand: "Samsung", model: "Galaxy S24 Ultra" },
  ];
  for (const f of brandFixtures) {
    const split = splitProductNameString(f.input);
    assert.equal(split.brand, f.brand, `brand: ${f.input}`);
    assert.ok(split.model?.includes(f.model.split(" ")[0]!), `model: ${f.input}`);
    log(`- ${f.input} → brand=${split.brand}, model=${split.model}`);
  }
  log("");

  // --- V1.1: Accessory detection ---
  log("## V1.1 Accessory detection");
  const accessoryFixtures: Array<{ title: string; expect: boolean }> = [
    { title: "Şarjlı süpürge", expect: false },
    { title: "Şarjlı matkap", expect: false },
    { title: "Süpürge filtresi", expect: true },
    { title: "Matkap şarj cihazı", expect: true },
    { title: "Telefon kılıfı", expect: true },
    { title: "Çamaşır makinesi", expect: false },
  ];
  for (const f of accessoryFixtures) {
    const result = detectAccessory({ title: f.title });
    assert.equal(result.isAccessory, f.expect, `accessory: ${f.title}`);
    log(`- "${f.title}" → accessory=${result.isAccessory}`);
  }
  log("");

  // --- V1.1: Acceptance criteria (Chicco, Samsung, DeWalt, Dyson) ---
  log("## V1.1 Acceptance criteria");

  const samsung = norm("technology", "Samsung Galaxy S24 Ultra 256 GB", [
    { key: "needType", value: "hardware" },
    { key: "solutionType", value: "Samsung Galaxy S24 Ultra 256GB" },
    { key: "specs", value: "256 GB" },
  ]);
  assert.equal(samsung.brand, "Samsung", "Samsung brand");
  assert.ok(samsung.model?.includes("Galaxy S24 Ultra"), "Samsung model");
  log(`- Samsung: brand=${samsung.brand}, model=${samsung.model}`);

  const dewalt = norm("technology", "DeWalt DCD996", [
    { key: "solutionType", value: "DeWalt DCD996 akülü matkap" },
  ]);
  assert.equal(dewalt.brand, "DeWalt", "DeWalt brand");
  assert.ok(dewalt.model?.includes("DCD996"), "DeWalt model");
  log(`- DeWalt: brand=${dewalt.brand}, model=${dewalt.model}`);

  const chicco = norm("baby", "Chicco Urban Plus bebek arabası", [
    { key: "babyProductType", value: "Bebek arabası / puset" },
    { key: "brandPreference", value: "Chicco" },
    { key: "features", value: "Urban Plus katlanır bebek arabası" },
  ]);
  assert.equal(chicco.brand, "Chicco", "Chicco brand");
  assert.ok(
    chicco.model?.includes("Urban Plus") ||
      chicco.variant?.includes("Urban Plus") ||
      chicco.series?.includes("Urban Plus"),
    "Chicco Urban Plus in identity",
  );
  log(`- Chicco: brand=${chicco.brand}, model=${chicco.model}, productType=${chicco.productType}`);

  const dyson = norm("home-kitchen", "Dyson V15 Detect Absolute", [
    { key: "kitchenProductType", value: "Elektrikli süpürge" },
    { key: "productName", value: "Dyson V15 Detect Absolute" },
  ]);
  const dysonFp = auditListing(dyson, "Dyson V12 Detect Slim", false);
  assert.equal(dysonFp.label, "TRUE_NEGATIVE", "Dyson V12 must not match V15");
  assert.ok(!dysonFp.passed, "Dyson V12 rejected");
  log(`- Dyson V12→V15: ${dysonFp.label} (mq=${dysonFp.matchQuality}, reason=${dysonFp.reason})`);
  log("");

  const splitDyson = splitProductNameString("Dyson V15 Detect Absolute");
  assert.equal(splitDyson.brand, "Dyson");
  assert.ok(splitDyson.model?.includes("V15"));

  const splitPhilips = splitProductNameString("Philips LatteGo 5400");
  assert.equal(splitPhilips.brand, "Philips");

  const splitUnknown = splitProductNameString("Novexa XR-900 Pro");
  assert.equal(splitUnknown.brand, "Novexa");

  // --- Test cases by brand/category ---
  const cases: TestCase[] = [
    {
      label: "Apple iPhone (technology)",
      categorySlug: "technology",
      title: "Apple iPhone 15 Pro Max",
      fields: [
        { key: "needType", value: "hardware" },
        { key: "solutionType", value: "Apple iPhone 15 Pro Max 256GB" },
        { key: "specs", value: "256 GB" },
      ],
      expectBrand: "Apple",
      expectModel: "iPhone 15 Pro Max",
      expectSuitabilityMin: 0.6,
      expectExternalCall: true,
    },
    {
      label: "Dyson V15 (home-kitchen)",
      categorySlug: "home-kitchen",
      title: "Dyson V15 Detect Absolute",
      fields: [
        { key: "kitchenProductType", value: "Elektrikli süpürge" },
        { key: "productName", value: "Dyson V15 Detect Absolute" },
      ],
      expectBrand: "Dyson",
      expectModel: "V15 Detect Absolute",
    },
    {
      label: "Philips LatteGo (home-kitchen)",
      categorySlug: "home-kitchen",
      title: "Philips LatteGo 5400",
      fields: [
        { key: "kitchenProductType", value: "Kahve makinesi" },
        { key: "productName", value: "Philips LatteGo 5400" },
      ],
      expectBrand: "Philips",
    },
    {
      label: "Bosch washing machine (appliances)",
      categorySlug: "appliances",
      title: "Bosch Series 6 9 kg çamaşır makinesi",
      fields: [
        { key: "applianceType", value: "Çamaşır makinesi" },
        { key: "brandPreference", value: "Bosch" },
        { key: "capacity", value: "9 kg" },
        { key: "specs", value: "Series 6" },
      ],
      expectBrand: "Bosch",
      expectSuitabilityMin: 0.5,
      expectExternalCall: true,
    },
    {
      label: "Toyota Corolla (automotive)",
      categorySlug: "automotive",
      title: "Toyota Corolla 2024 Hybrid Dream",
      fields: [
        { key: "brand", value: "Toyota" },
        { key: "model", value: "Corolla" },
        { key: "modelYear", value: "2024" },
        { key: "specs", value: "Hybrid Dream" },
      ],
      expectBrand: "Toyota",
      expectModel: "Corolla",
      expectVariant: "2024",
      expectSuitabilityMax: 0.55,
      expectExternalCall: false,
    },
    {
      label: "Unknown brand Novexa (technology)",
      categorySlug: "technology",
      title: "Novexa XR-900 Pro",
      fields: [
        { key: "brand", value: "Novexa" },
        { key: "model", value: "XR-900 Pro" },
        { key: "specs", value: "512 GB" },
      ],
      expectBrand: "Novexa",
      expectModel: "XR-900 Pro",
    },
    {
      label: "Services skip",
      categorySlug: "services",
      title: "Ofis temizliği",
      fields: [{ key: "serviceType", value: "Temizlik" }],
      expectSuitabilityMax: 0.35,
      expectExternalCall: false,
    },
    {
      label: "Printing skip",
      categorySlug: "printing",
      title: "Kraft kutu baskı",
      fields: [
        { key: "dimensions", value: "35x25x8" },
        { key: "printType", value: "4 renk" },
      ],
      expectSuitabilityMax: 0.55,
    },
    {
      label: "Machinery",
      categorySlug: "machinery",
      title: "Heidelberg SM 74 ofset baskı",
      fields: [
        { key: "machineType", value: "Ofset baskı makinesi" },
        { key: "brand", value: "Heidelberg" },
        { key: "model", value: "SM 74" },
      ],
      expectBrand: "Heidelberg",
      expectModel: "SM 74",
    },
    {
      label: "Baby category",
      categorySlug: "baby",
      title: "Bebek arabası",
      fields: [
        { key: "babyProductType", value: "Bebek arabası" },
        { key: "brandPreference", value: "Chicco" },
      ],
      expectBrand: "Chicco",
    },
    {
      label: "Furniture",
      categorySlug: "furniture",
      title: "Yemek masası",
      fields: [
        { key: "furnitureType", value: "Masa" },
        { key: "dimensions", value: "160x80 cm" },
      ],
    },
  ];

  log("## Multi-brand / Multi-category normalization");
  log("");

  for (const tc of cases) {
    const normalized = norm(tc.categorySlug, tc.title, tc.fields);
    const identity = buildProductIdentity({
      categoryId: `cat-${tc.categorySlug}`,
      categorySlug: tc.categorySlug,
      title: tc.title,
      fieldValues: tc.fields,
    });

    if (tc.expectBrand !== undefined) {
      assert.equal(normalized.brand, tc.expectBrand, `${tc.label} brand`);
    }
    if (tc.expectModel !== undefined) {
      assert.equal(normalized.model, tc.expectModel, `${tc.label} model`);
    }

    const suitability = computeExternalShoppingSuitability({
      categorySlug: tc.categorySlug,
      normalized,
    });

    if (tc.expectSuitabilityMin != null) {
      assert.ok(suitability >= tc.expectSuitabilityMin, `${tc.label} suitability ${suitability}`);
    }
    if (tc.expectSuitabilityMax != null) {
      assert.ok(suitability <= tc.expectSuitabilityMax, `${tc.label} suitability ${suitability}`);
    }

    const routing = buildProviderRouting({
      categoryId: normalized.categoryId,
      categorySlug: tc.categorySlug,
      title: tc.title,
      normalizedProduct: normalized,
    });

    if (tc.expectExternalCall === false) {
      assert.equal(routing.shouldCallExternal, false, `${tc.label} should skip external`);
    }

    log(`### ${tc.label}`);
    log(`- INPUT: ${tc.title}`);
    log(`- BRAND: ${normalized.brand ?? "null"} (confidence ${identity.brandConfidence})`);
    log(`- MODEL: ${normalized.model ?? "null"}`);
    log(`- VARIANT/SERIES: ${normalized.variant ?? identity.series ?? "null"}`);
    log(`- ATTRIBUTES: ${JSON.stringify(normalized.attributes)}`);
    log(`- PROVIDER SUITABILITY: ${suitability} | external call: ${routing.shouldCallExternal}`);
    log(`- PROVIDER QUERY: ${normalized.providerQuery ?? "—"}`);
    log("");
  }

  // --- iPhone regression ---
  log("## iPhone regression (generic engine)");
  const iphone = norm("technology", "Apple iPhone 15 Pro Max", [
    { key: "needType", value: "hardware" },
    { key: "solutionType", value: "Apple iPhone 15 Pro Max 256GB" },
    { key: "specs", value: "256 GB" },
  ]);

  const iphoneTests: Array<{ title: string; expectPass: boolean; note: string }> = [
    { title: "Apple iPhone 15 Pro Max 256 GB Titanyum", expectPass: true, note: "correct" },
    { title: "Apple iPhone 15 Pro Max", expectPass: false, note: "missing storage" },
    { title: "Apple iPhone 15 Pro Max 128 GB", expectPass: false, note: "wrong storage" },
    { title: "Apple iPhone 15 Pro 256 GB", expectPass: false, note: "wrong model (Pro not Pro Max)" },
    { title: "Apple iPhone 15 256 GB", expectPass: false, note: "wrong model" },
    { title: "Apple iPhone 15 Plus 256 GB", expectPass: false, note: "wrong model Plus" },
    { title: "Apple iPhone 17 Pro Max 256 GB", expectPass: false, note: "wrong generation" },
    { title: "Apple iPhone 15 Pro Max 256 GB Yenilenmiş", expectPass: false, note: "refurbished" },
    { title: "Apple iPhone 15 256 GB 6 GB vs Apple iPhone 16 Pro 256", expectPass: false, note: "comparison" },
    { title: "Apple iPhone 15 Pro Max 256 GB Kılıf", expectPass: false, note: "accessory" },
  ];

  for (const t of iphoneTests) {
    const row = auditListing(iphone, t.title, t.expectPass);
    assert.equal(row.label.startsWith("FALSE"), false, `iPhone: ${t.note} → ${row.label}`);
    log(`- ${t.note}: ${row.label} (mq=${row.matchQuality}) — ${t.title}`);
  }
  log("");

  // --- Accessory detection (legacy samples) ---
  assert.ok(
    detectAccessory({ title: "Dyson V15 filter replacement", requestModel: "V15 Detect" }).isAccessory,
  );
  assert.ok(
    detectAccessory({ title: "Bosch drain hose", requestModel: "Series 6" }).isAccessory,
  );

  // --- Bosch audit (rule-based sample) ---
  log("## Bosch 40/40 audit (sample titles)");
  const bosch = norm("appliances", "Bosch Series 6 9 kg çamaşır makinesi", [
    { key: "applianceType", value: "Çamaşır makinesi" },
    { key: "brandPreference", value: "Bosch" },
    { key: "capacity", value: "9 kg" },
    { key: "specs", value: "Series 6" },
  ]);

  const boschSamples: Array<{ title: string; expectPass: boolean }> = [
    { title: "Bosch WGG244Z0TR Serie 6 9 kg çamaşır makinesi", expectPass: true },
    { title: "Bosch Serie 6 WGG244Z0TR 9kg Çamaşır Makinesi", expectPass: true },
    { title: "Bosch Series 6 9 kg washing machine", expectPass: true },
    { title: "Bosch çamaşır makinesi 9 kg A+++", expectPass: true },
    { title: "Bosch Serie 6 9 kg", expectPass: true },
    { title: "Bosch WAT284X0TR Serie 4 7 kg çamaşır makinesi", expectPass: false },
    { title: "Bosch 9 kg kurutma makinesi", expectPass: false },
    { title: "Bosch çamaşır makinesi hortumu", expectPass: false },
    { title: "Bosch deterjan", expectPass: false },
    { title: "Siemens Serie 6 9 kg çamaşır makinesi", expectPass: false },
    { title: "Samsung 9 kg çamaşır makinesi", expectPass: false },
    { title: "Bosch Series 6 8 kg çamaşır makinesi", expectPass: false },
    { title: "Bosch Series 6 9 kg bulaşık makinesi", expectPass: false },
    { title: "Bosch WGG244Z0TR yedek parça", expectPass: false },
    { title: "Bosch Serie 6 9 kg çamaşır makinesi kapağı", expectPass: false },
    { title: "Arçelik 9 kg çamaşır makinesi", expectPass: false },
    { title: "Bosch WGG244Z0TR", expectPass: true },
    { title: "Bosch 9kg washing machine Series 6", expectPass: true },
    { title: "Bosch çamaşır makinesi 7 kg", expectPass: false },
    { title: "Bosch Serie 6 9kg", expectPass: true },
  ];

  let boschTp = 0;
  let boschFp = 0;
  let boschTn = 0;
  let boschFn = 0;

  for (const s of boschSamples) {
    const row = auditListing(bosch, s.title, s.expectPass);
    if (row.label === "TRUE_POSITIVE") boschTp++;
    if (row.label === "FALSE_POSITIVE") boschFp++;
    if (row.label === "TRUE_NEGATIVE") boschTn++;
    if (row.label === "FALSE_NEGATIVE") boschFn++;
    log(`- [${row.label}] mq=${row.matchQuality} — ${s.title}`);
  }

  log("");
  log(`Bosch sample audit: TP=${boschTp} FP=${boschFp} TN=${boschTn} FN=${boschFn}`);
  assert.ok(boschFp === 0, `Bosch false positives: ${boschFp}`);
  log("");

  // --- Live API (optional) ---
  log("## Live provider results (if configured)");
  if (isDataForSeoConfigured()) {
    const iphoneLive = await runLiveQuery(iphone, "technology", "Apple iPhone 15 Pro Max");
    log(`- Apple iPhone: RAW=${iphoneLive.raw} MATCHED=${iphoneLive.matched}`);
    for (const t of iphoneLive.sampleTitles) log(`  - ${t}`);

    const boschLive = await runLiveQuery(
      bosch,
      "appliances",
      "Bosch Series 6 9 kg çamaşır makinesi",
    );
    log(`- Bosch: RAW=${boschLive.raw} MATCHED=${boschLive.matched}`);
    for (const t of boschLive.sampleTitles.slice(0, 8)) log(`  - ${t}`);

    const toyota = norm("automotive", "Toyota Corolla 2024 Hybrid Dream", [
      { key: "brand", value: "Toyota" },
      { key: "model", value: "Corolla" },
      { key: "modelYear", value: "2024" },
    ]);
    const toyotaRouting = buildProviderRouting({
      categoryId: toyota.categoryId,
      categorySlug: "automotive",
      title: "Toyota Corolla 2024",
      normalizedProduct: toyota,
    });
    log(`- Toyota: normalized brand=${toyota.brand} model=${toyota.model}; external=${toyotaRouting.shouldCallExternal}`);
  } else {
    log("- DataForSEO NOT_CONFIGURED — live section skipped");
  }

  log("");
  log("verify-global-product-identity: PASS (V1.1)");

  const outPath = join(process.cwd(), "TALEPO-GLOBAL-PRODUCT-IDENTITY-V1-TEST-OUTPUT.txt");
  writeFileSync(outPath, reportLines.join("\n"), "utf8");
  console.log(`Report snippet written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
