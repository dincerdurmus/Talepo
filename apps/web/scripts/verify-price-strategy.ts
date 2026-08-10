/**
 * Price Strategy Shadow Mode — Phase 2 verification.
 * Run: npx tsx scripts/verify-price-strategy.ts
 */
import assert from "node:assert/strict";

import { listRegistryCategorySlugs } from "../src/lib/price-intelligence/category-registry";
import type { PriceStrategyKey } from "../src/lib/price-intelligence/price-strategy-registry";
import {
  getStrategyAttributeProfile,
  listImplementedStrategies,
} from "../src/lib/price-intelligence/price-strategy-registry";
import {
  buildPriceStrategyContext,
  resolvePriceStrategy,
} from "../src/lib/price-intelligence/strategy-resolver";

type Fixture = {
  id: number;
  label: string;
  categorySlug: string;
  title: string;
  fields: { key: string; value: string }[];
  expected: PriceStrategyKey | PriceStrategyKey[];
  note?: string;
};

const FIXTURES: Fixture[] = [
  {
    id: 1,
    label: "Apple iPhone 15 Pro Max 256GB",
    categorySlug: "technology",
    title: "Apple iPhone 15 Pro Max",
    fields: [
      { key: "needType", value: "hardware" },
      { key: "solutionType", value: "Apple iPhone 15 Pro Max 256GB" },
      { key: "specs", value: "256 GB" },
    ],
    expected: "RETAIL_PRODUCT",
  },
  {
    id: 2,
    label: "Dyson V15",
    categorySlug: "appliances",
    title: "Dyson V15 Detect",
    fields: [
      { key: "solutionType", value: "Dyson V15 Detect Absolute" },
      { key: "brandPreference", value: "Dyson" },
    ],
    expected: "RETAIL_PRODUCT",
  },
  {
    id: 3,
    label: "Toyota Corolla Hybrid",
    categorySlug: "automotive",
    title: "Toyota Corolla Hybrid alımı",
    fields: [
      { key: "needType", value: "vehicle" },
      { key: "brand", value: "Toyota" },
      { key: "model", value: "Corolla Hybrid" },
      { key: "modelYear", value: "2023" },
    ],
    expected: "VEHICLE",
  },
  {
    id: 4,
    label: "Bosch fren balatası",
    categorySlug: "automotive",
    title: "Bosch fren balatası",
    fields: [
      { key: "needType", value: "part" },
      { key: "part", value: "Fren balatası" },
      { key: "brand", value: "Bosch" },
    ],
    expected: "AUTO_PART",
  },
  {
    id: 5,
    label: "Otomobil kaplama hizmeti",
    categorySlug: "automotive",
    title: "Otomobil kaplama hizmeti",
    fields: [
      { key: "needType", value: "service" },
      { key: "serviceType", value: "Kaplama / boya koruma" },
    ],
    expected: "SERVICE_SCOPE",
  },
  {
    id: 6,
    label: "3+1 satılık daire",
    categorySlug: "real-estate",
    title: "3+1 satılık daire",
    fields: [
      { key: "listingType", value: "Satılık" },
      { key: "propertyType", value: "Konut" },
      { key: "roomCount", value: "3+1" },
      { key: "city", value: "İstanbul" },
      { key: "area", value: "120" },
    ],
    expected: "REAL_ESTATE_SALE",
  },
  {
    id: 7,
    label: "Kiralık depo",
    categorySlug: "real-estate",
    title: "Kiralık depo",
    fields: [
      { key: "listingType", value: "Kiralık" },
      { key: "propertyType", value: "İş yeri" },
      { key: "city", value: "Ankara" },
      { key: "area", value: "500" },
    ],
    expected: "REAL_ESTATE_RENT",
  },
  {
    id: 8,
    label: "Heidelberg SM 74 baskı makinesi",
    categorySlug: "machinery",
    title: "Heidelberg SM 74 ofset baskı makinesi",
    fields: [
      { key: "needType", value: "machine" },
      { key: "brand", value: "Heidelberg" },
      { key: "model", value: "SM 74" },
      { key: "machineType", value: "Ofset baskı" },
    ],
    expected: "INDUSTRIAL_EQUIPMENT",
  },
  {
    id: 9,
    label: "Makine bakım/onarım hizmeti",
    categorySlug: "machinery",
    title: "CNC makine bakım ve onarım",
    fields: [
      { key: "needType", value: "service" },
      { key: "serviceType", value: "Bakım / onarım" },
      { key: "machineType", value: "CNC" },
    ],
    expected: ["INDUSTRIAL_PARTS_SERVICE", "SERVICE_SCOPE"],
    note: "Taxonomy: machinery+needType=service → INDUSTRIAL_PARTS_SERVICE (preferred)",
  },
  {
    id: 10,
    label: "5000 adet özel baskılı karton kutu",
    categorySlug: "printing",
    title: "Özel baskılı karton kutu",
    fields: [
      { key: "dimensions", value: "30x20x15 cm" },
      { key: "material", value: "Karton" },
      { key: "printType", value: "Ofset" },
      { key: "quantity", value: "5000" },
    ],
    expected: "CUSTOM_MANUFACTURING",
  },
  {
    id: 11,
    label: "200 m² boya badana",
    categorySlug: "services",
    title: "200 m² boya badana",
    fields: [
      { key: "serviceType", value: "Boya / badana" },
      { key: "serviceLocation", value: "İstanbul" },
      { key: "city", value: "İstanbul" },
    ],
    expected: "SERVICE_SCOPE",
  },
  {
    id: 12,
    label: "Toplu standart ofis sandalyesi alımı",
    categorySlug: "furniture",
    title: "Toplu standart ofis sandalyesi alımı",
    fields: [
      { key: "furnitureType", value: "Ofis sandalyesi" },
      { key: "quantity", value: "80" },
      { key: "specs", value: "Ergonomik, ayarlanabilir" },
    ],
    expected: ["B2B_COMMODITY", "RETAIL_PRODUCT"],
    note: "Bulk quantity ≥20 → B2B_COMMODITY preferred",
  },
  {
    id: 13,
    label: "Medikal cihaz",
    categorySlug: "health",
    title: "Medikal cihaz alımı",
    fields: [
      { key: "healthProductType", value: "Medikal cihaz" },
      { key: "productName", value: "Dijital tansiyon aleti" },
      { key: "brand", value: "Omron" },
    ],
    expected: "MEDICAL_DEVICE",
  },
  {
    id: 14,
    label: "Chicco Urban Plus bebek arabası",
    categorySlug: "baby",
    title: "Chicco Urban Plus bebek arabası",
    fields: [
      { key: "productName", value: "Chicco Urban Plus" },
      { key: "brandPreference", value: "Chicco" },
    ],
    expected: "RETAIL_PRODUCT",
  },
  {
    id: 15,
    label: "Bilinmeyen marka + standart model ürün",
    categorySlug: "technology",
    title: "Standart model dizüstü bilgisayar",
    fields: [
      { key: "needType", value: "hardware" },
      { key: "solutionType", value: "Standart Model XYZ-2024" },
      { key: "specs", value: "16 GB RAM, 512 GB SSD" },
    ],
    expected: "RETAIL_PRODUCT",
  },
  {
    id: 16,
    label: "Bilinmeyen gelecekteki kategori",
    categorySlug: "quantum-widgets-future",
    title: "Yeni nesil widget talebi",
    fields: [],
    expected: "UNKNOWN",
  },
];

function resolveFixture(f: Fixture) {
  return resolvePriceStrategy(
    buildPriceStrategyContext({
      categorySlug: f.categorySlug,
      title: f.title,
      fieldValues: f.fields,
    }),
  );
}

function matchesExpected(actual: PriceStrategyKey, expected: PriceStrategyKey | PriceStrategyKey[]) {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

async function main() {
  console.log("=== Price Strategy Phase 2 Verify ===\n");

  // Registry sanity
  const strategies = listImplementedStrategies();
  assert.equal(strategies.length, 14, "14 strategy keys expected");
  for (const key of strategies) {
    const profile = getStrategyAttributeProfile(key);
    assert.equal(profile.strategy, key);
  }
  console.log(`Registry: ${strategies.length} strategies with attribute profiles — OK\n`);

  // Test matrix
  console.log("TEST MATRIX:");
  let passCount = 0;
  let failCount = 0;
  const rows: string[] = [];

  for (const f of FIXTURES) {
    const result = resolveFixture(f);
    const pass = matchesExpected(result.strategy, f.expected);
    if (pass) passCount++;
    else failCount++;

    const expectedLabel = Array.isArray(f.expected) ? f.expected.join("|") : f.expected;
    const status = pass ? "PASS" : "FAIL";
    rows.push(
      `${f.id}. ${f.label} → expected=${expectedLabel} actual=${result.strategy} conf=${result.strategyConfidence} [${status}]`,
    );
    if (f.note) rows.push(`   note: ${f.note}`);
    if (!pass) {
      rows.push(`   reasons: ${result.strategyReasons.join("; ")}`);
    }
  }

  for (const row of rows) console.log(row);
  console.log(`\nMatrix: ${passCount}/${FIXTURES.length} PASS\n`);

  // UNKNOWN fallback
  const unknownCase = resolveFixture(FIXTURES[15]!);
  assert.equal(unknownCase.strategy, "UNKNOWN");
  assert.ok(unknownCase.strategyConfidence <= 0.5, "UNKNOWN should have low confidence");
  console.log("UNKNOWN FALLBACK: PASS\n");

  // All active categories
  const slugs = listRegistryCategorySlugs();
  assert.equal(slugs.length, 11, "Expected 11 active categories");
  console.log("ALL ACTIVE CATEGORIES:");
  for (const slug of slugs) {
    const ctx = buildPriceStrategyContext({
      categorySlug: slug,
      title: `${slug} sample request`,
      fieldValues: [{ key: "city", value: "İstanbul" }],
    });
    const r = resolvePriceStrategy(ctx);
    const safe = r.strategy !== undefined && r.strategyConfidence >= 0;
    console.log(`  ${slug} → ${r.strategy} (conf=${r.strategyConfidence}) ${safe ? "OK" : "FAIL"}`);
    assert.ok(safe, `${slug} should resolve without error`);
  }
  console.log("");

  // Future category safety
  const future = resolvePriceStrategy(
    buildPriceStrategyContext({
      categorySlug: "not-yet-defined-category-2099",
      title: "Novel product",
      fieldValues: [],
    }),
  );
  assert.equal(future.strategy, "UNKNOWN");
  console.log("FUTURE CATEGORY SAFETY: PASS\n");

  assert.equal(failCount, 0, `${failCount} fixture(s) failed`);
  console.log("STRATEGY VERIFY: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
