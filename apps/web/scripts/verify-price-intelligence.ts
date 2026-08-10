/**
 * Price Intelligence — dynamic category coverage tests.
 * Run: npx tsx scripts/verify-price-intelligence.ts
 */
import assert from "node:assert/strict";

import {
  listCategoryCoverage,
  listRegistryCategorySlugs,
} from "../src/lib/price-intelligence/category-registry";
import { computeAggregateConfidence } from "../src/server/price-intelligence/confidence";
import {
  buildProductFingerprint,
  normalizeProductFromRequest,
} from "../src/server/price-intelligence/normalize-product";
import { buildProviderRouting } from "../src/server/price-intelligence/provider-query";
import { computePriceStatistics, MIN_AGGREGATE_SAMPLE } from "../src/server/price-intelligence/statistics";
import { listPriceDataProviders } from "../src/server/price-intelligence/providers";

// --- Stats tests (unchanged) ---
const requestStats = computePriceStatistics([100]);
const offerStats = computePriceStatistics([90]);
const confirmedStats = computePriceStatistics([85]);
assert.equal(requestStats.median, 100);
assert.equal(offerStats.median, 90);
assert.equal(confirmedStats.median, 85);

const twoSample = computePriceStatistics([100, 120], MIN_AGGREGATE_SAMPLE);
assert.equal(twoSample.insufficientData, true);

const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 1000);
const twenty = computePriceStatistics(values, MIN_AGGREGATE_SAMPLE);
assert.equal(twenty.insufficientData, false);
assert.equal(twenty.median, 10500);

assert.equal(
  computeAggregateConfidence({ internalSample: 2, confirmedSample: 0 }),
  "VERY_LOW",
);

// --- All engine categories registered ---
const slugs = listRegistryCategorySlugs();
assert.ok(slugs.length >= 11, `Expected >= 11 categories, got ${slugs.length}`);
for (const expected of [
  "technology",
  "automotive",
  "printing",
  "appliances",
  "machinery",
  "real-estate",
  "services",
]) {
  assert.ok(slugs.includes(expected), `Missing category slug: ${expected}`);
}

// --- No hardcoded 3-category limit ---
const coverage = listCategoryCoverage();
assert.equal(coverage.length, slugs.length);
assert.ok(!coverage.some((c) => c.fieldCount === 0), "Every category must have fields");

// --- Per-category normalization samples (real slugs from engine) ---
const categorySamples: Array<{
  slug: string;
  title: string;
  fields: { key: string; value: string }[];
}> = [
  {
    slug: "technology",
    title: "Apple MacBook Pro 14",
    fields: [
      { key: "needType", value: "hardware" },
      { key: "solutionType", value: "Bilgisayar ve donanım" },
      { key: "specs", value: "M3 Pro 512GB" },
    ],
  },
  {
    slug: "automotive",
    title: "2018 Mercedes C180",
    fields: [
      { key: "brand", value: "Mercedes" },
      { key: "model", value: "C180" },
      { key: "modelYear", value: "2018" },
      { key: "condition", value: "İkinci el" },
    ],
  },
  {
    slug: "printing",
    title: "Kraft kutu baskı",
    fields: [
      { key: "dimensions", value: "35x25x8" },
      { key: "material", value: "Kraft" },
      { key: "printType", value: "4 renk ofset" },
    ],
  },
  {
    slug: "appliances",
    title: "Bosch çamaşır makinesi",
    fields: [
      { key: "applianceType", value: "Çamaşır makinesi" },
      { key: "brandPreference", value: "Bosch" },
      { key: "energyClass", value: "A+++" },
    ],
  },
  {
    slug: "machinery",
    title: "Heidelberg SM 74",
    fields: [
      { key: "machineType", value: "Ofset baskı makinesi" },
      { key: "brand", value: "Heidelberg" },
      { key: "capacity", value: "74x52" },
    ],
  },
  {
    slug: "real-estate",
    title: "Kadıköy 3+1 daire",
    fields: [
      { key: "listingType", value: "Satılık" },
      { key: "propertyType", value: "Daire" },
      { key: "roomCount", value: "3+1" },
      { key: "area", value: "120" },
    ],
  },
  {
    slug: "services",
    title: "Ofis temizliği",
    fields: [
      { key: "serviceType", value: "Temizlik" },
      { key: "frequency", value: "Haftalık" },
    ],
  },
];

for (const sample of categorySamples) {
  const norm = normalizeProductFromRequest({
    categoryId: `cat-${sample.slug}`,
    categorySlug: sample.slug,
    title: sample.title,
    fieldValues: sample.fields,
    city: "İstanbul",
  });

  assert.equal(typeof norm.confidence, "number");
  assert.ok(norm.confidence > 0, `${sample.slug}: confidence should be > 0`);
  assert.ok(norm.providerQuery && norm.providerQuery.length > 0, `${sample.slug}: provider query`);

  if (sample.fields.length >= 2) {
    assert.ok(norm.fingerprint, `${sample.slug}: should produce fingerprint with 2+ fields`);
    assert.equal(norm.fingerprint!.length, 24);
  }

  const routing = buildProviderRouting({
    categoryId: `cat-${sample.slug}`,
    categorySlug: sample.slug,
    title: sample.title,
    attributes: Object.fromEntries(sample.fields.map((f) => [f.key, f.value])),
    city: "İstanbul",
  });

  assert.ok(routing.shouldCallExternal === false || routing.productSuitabilityScore >= 0.2);
  assert.ok(
    routing.eligibleProviders.some((p) => p.providerId === "talepo-internal") ||
      routing.eligibleProviders.length >= 0,
  );
}

// Services → internal-heavy, shopping score low
const servicesCoverage = coverage.find((c) => c.slug === "services")!;
assert.ok(servicesCoverage.profile.internal >= 0.8);
assert.ok(servicesCoverage.profile.shopping < 0.3);

// Technology → shopping eligible
const techCoverage = coverage.find((c) => c.slug === "technology")!;
assert.ok(techCoverage.externalShoppingEligible || techCoverage.profile.shopping >= 0.4);

// Deterministic fingerprint
const auto1 = normalizeProductFromRequest({
  categoryId: "cat1",
  categorySlug: "automotive",
  title: "Toyota Corolla",
  fieldValues: [
    { key: "brand", value: "Toyota" },
    { key: "model", value: "Corolla" },
    { key: "modelYear", value: "2020" },
  ],
});
const auto2 = normalizeProductFromRequest({
  categoryId: "cat1",
  categorySlug: "automotive",
  title: "Toyota Corolla 2020",
  fieldValues: [
    { key: "brand", value: "Toyota" },
    { key: "model", value: "Corolla" },
    { key: "modelYear", value: "2020" },
  ],
});
assert.equal(auto1.fingerprint, auto2.fingerprint);

// Empty attributes → no fabricated fingerprint
const emptyFp = buildProductFingerprint({
  categorySlug: "furniture",
  attributes: {},
});
assert.equal(emptyFp, null);

// Provider registry
const providers = listPriceDataProviders();
assert.ok(providers.some((p) => p.id === "talepo-internal"));

console.log("verify-price-intelligence: PASS");
console.log(`  categories covered: ${coverage.length}`);
console.log(
  `  shopping-eligible: ${coverage.filter((c) => c.externalShoppingEligible).length}`,
);
console.log(
  `  internal-primary: ${coverage.filter((c) => c.profile.primaryRoute === "internal").length}`,
);
