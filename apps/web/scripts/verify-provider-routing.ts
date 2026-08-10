/**
 * Phase 3 — Provider capability & safe routing verification.
 * Run: npx tsx scripts/verify-provider-routing.ts
 *
 * Uses mocked searchImpl — no paid live API calls in fixture matrix.
 */
import assert from "node:assert/strict";

import { listRegistryCategorySlugs } from "../src/lib/price-intelligence/category-registry";
import {
  DATAFORSEO_CAPABILITY,
  INTERNAL_SIGNAL_CAPABILITY,
} from "../src/lib/price-intelligence/provider-capability-registry";
import type { PriceStrategyKey } from "../src/lib/price-intelligence/price-strategy-registry";
import {
  buildPriceStrategyContext,
  resolvePriceStrategy,
} from "../src/lib/price-intelligence/strategy-resolver";
import { computeExternalShoppingSuitability } from "../src/lib/price-intelligence/product-suitability";
import { shouldCallExternalProvider } from "../src/lib/price-intelligence/provider-config";
import { fetchExternalListings } from "../src/server/price-intelligence/fetch-external-listings";
import { resolveProviderCandidates } from "../src/server/price-intelligence/provider-candidate-resolver";
import { normalizeProductFromRequest } from "../src/server/price-intelligence/normalize-product";
import {
  buildProviderCacheKey,
  clearProviderCache,
  getCachedProviderResults,
  setCachedProviderResults,
} from "../src/server/price-intelligence/provider-cache";

type Fixture = {
  label: string;
  categorySlug: string;
  title: string;
  fields: { key: string; value: string }[];
  expectedStrategy: PriceStrategyKey | PriceStrategyKey[];
  expectExternalAttempt: boolean;
  expectExternalCall: boolean;
  expectedRoutingReason?: string;
  note?: string;
};

const FIXTURES: Fixture[] = [
  {
    label: "iPhone",
    categorySlug: "technology",
    title: "Apple iPhone 15 Pro Max",
    fields: [
      { key: "needType", value: "hardware" },
      { key: "solutionType", value: "Apple iPhone 15 Pro Max 256GB" },
      { key: "specs", value: "256 GB" },
    ],
    expectedStrategy: "RETAIL_PRODUCT",
    expectExternalAttempt: true,
    expectExternalCall: true,
  },
  {
    label: "Dyson V15",
    categorySlug: "appliances",
    title: "Dyson V15 Detect",
    fields: [{ key: "solutionType", value: "Dyson V15 Detect Absolute" }],
    expectedStrategy: "RETAIL_PRODUCT",
    expectExternalAttempt: true,
    expectExternalCall: true,
  },
  {
    label: "Toyota whole vehicle",
    categorySlug: "automotive",
    title: "Toyota Corolla Hybrid",
    fields: [
      { key: "needType", value: "vehicle" },
      { key: "brand", value: "Toyota" },
      { key: "model", value: "Corolla Hybrid" },
    ],
    expectedStrategy: "VEHICLE",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "NO_EXTERNAL_PROVIDER_FOR_STRATEGY",
  },
  {
    label: "Bosch brake pad",
    categorySlug: "automotive",
    title: "Bosch fren balatası",
    fields: [
      { key: "needType", value: "part" },
      { key: "part", value: "Fren balatası" },
      { key: "brand", value: "Bosch" },
    ],
    expectedStrategy: "AUTO_PART",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "SUITABILITY_BELOW_THRESHOLD",
    note: "AUTO_PART candidate exists but automotive suitability penalty blocks call",
  },
  {
    label: "Automotive service",
    categorySlug: "automotive",
    title: "Otomobil kaplama hizmeti",
    fields: [
      { key: "needType", value: "service" },
      { key: "serviceType", value: "Kaplama" },
    ],
    expectedStrategy: "SERVICE_SCOPE",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "NO_EXTERNAL_PROVIDER_FOR_STRATEGY",
  },
  {
    label: "Real estate sale",
    categorySlug: "real-estate",
    title: "3+1 satılık daire",
    fields: [
      { key: "listingType", value: "Satılık" },
      { key: "city", value: "İstanbul" },
    ],
    expectedStrategy: "REAL_ESTATE_SALE",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "NO_EXTERNAL_PROVIDER_FOR_STRATEGY",
  },
  {
    label: "Real estate rent",
    categorySlug: "real-estate",
    title: "Kiralık depo",
    fields: [
      { key: "listingType", value: "Kiralık" },
      { key: "city", value: "Ankara" },
    ],
    expectedStrategy: "REAL_ESTATE_RENT",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "NO_EXTERNAL_PROVIDER_FOR_STRATEGY",
  },
  {
    label: "Heidelberg machine",
    categorySlug: "machinery",
    title: "Heidelberg SM 74",
    fields: [
      { key: "needType", value: "machine" },
      { key: "brand", value: "Heidelberg" },
      { key: "model", value: "SM 74" },
    ],
    expectedStrategy: "INDUSTRIAL_EQUIPMENT",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "NO_EXTERNAL_PROVIDER_FOR_STRATEGY",
  },
  {
    label: "Custom printed box",
    categorySlug: "printing",
    title: "Özel baskılı kutu",
    fields: [
      { key: "dimensions", value: "30x20x15 cm" },
      { key: "quantity", value: "5000" },
    ],
    expectedStrategy: "CUSTOM_MANUFACTURING",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "NO_EXTERNAL_PROVIDER_FOR_STRATEGY",
  },
  {
    label: "Painting service",
    categorySlug: "services",
    title: "200 m² boya badana",
    fields: [{ key: "serviceType", value: "Boya / badana" }],
    expectedStrategy: "SERVICE_SCOPE",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "NO_EXTERNAL_PROVIDER_FOR_STRATEGY",
  },
  {
    label: "B2B office chairs",
    categorySlug: "furniture",
    title: "Toplu ofis sandalyesi",
    fields: [
      { key: "quantity", value: "80" },
      { key: "furnitureType", value: "Ofis sandalyesi" },
    ],
    expectedStrategy: ["B2B_COMMODITY", "RETAIL_PRODUCT"],
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: undefined,
    note: "B2B → no provider; retail without identity → identity gate",
  },
  {
    label: "Medical device",
    categorySlug: "health",
    title: "Medikal cihaz",
    fields: [
      { key: "healthProductType", value: "Medikal cihaz" },
      { key: "productName", value: "Dijital tansiyon aleti" },
    ],
    expectedStrategy: "MEDICAL_DEVICE",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "NO_EXTERNAL_PROVIDER_FOR_STRATEGY",
    note: "MEDICAL_DEVICE not granted DataForSEO capability without validation",
  },
  {
    label: "Chicco stroller",
    categorySlug: "baby",
    title: "Chicco Urban Plus",
    fields: [
      { key: "productName", value: "Chicco Urban Plus" },
      { key: "brandPreference", value: "Chicco" },
    ],
    expectedStrategy: "RETAIL_PRODUCT",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "SUITABILITY_BELOW_THRESHOLD",
  },
  {
    label: "Unknown brand retail product",
    categorySlug: "technology",
    title: "Standart model dizüstü",
    fields: [
      { key: "needType", value: "hardware" },
      { key: "solutionType", value: "Standart Model XYZ-2024" },
    ],
    expectedStrategy: "RETAIL_PRODUCT",
    expectExternalAttempt: true,
    expectExternalCall: true,
  },
  {
    label: "Future unknown category",
    categorySlug: "quantum-widgets-future",
    title: "Novel widget",
    fields: [],
    expectedStrategy: "UNKNOWN",
    expectExternalAttempt: true,
    expectExternalCall: false,
    expectedRoutingReason: "STRATEGY_UNKNOWN",
  },
];

function norm(slug: string, title: string, fields: { key: string; value: string }[]) {
  return normalizeProductFromRequest({
    categoryId: `cat-${slug}`,
    categorySlug: slug,
    title,
    fieldValues: fields,
  });
}

async function routeFixture(f: Fixture) {
  const normalized = norm(f.categorySlug, f.title, f.fields);
  const strategyRes = resolvePriceStrategy(
    buildPriceStrategyContext({
      categorySlug: f.categorySlug,
      title: f.title,
      fieldValues: f.fields,
    }),
  );
  const candidates = resolveProviderCandidates({
    strategy: strategyRes.strategy,
    categorySlug: f.categorySlug,
    normalized,
  });
  const suitability = computeExternalShoppingSuitability({
    categorySlug: f.categorySlug,
    normalized,
  });

  const mockObs = [
    {
      provider: "dataforseo-google-shopping",
      externalId: "mock-1",
      title: f.title,
      price: 1000,
      currency: "TRY",
      condition: null,
      location: "Turkey",
      url: null,
      observedAt: new Date(),
      sourceType: "EXTERNAL_LISTING" as const,
    },
  ];

  const fetchResult = await fetchExternalListings({
    categorySlug: f.categorySlug,
    categoryId: normalized.categoryId,
    title: f.title,
    normalized,
    strategy: strategyRes.strategy,
    searchImpl: async () => mockObs,
  });

  return {
    strategy: strategyRes.strategy,
    candidates: candidates.providerCandidateIds,
    selected: candidates.selectedProviderId,
    suitability,
    suitabilityPass: shouldCallExternalProvider(suitability),
    fetchResult,
  };
}

async function main() {
  console.log("=== Phase 3 Provider Routing Verify ===\n");

  // Capability model sanity
  assert.ok(DATAFORSEO_CAPABILITY.supportedStrategies.includes("RETAIL_PRODUCT"));
  assert.ok(DATAFORSEO_CAPABILITY.supportedStrategies.includes("AUTO_PART"));
  assert.ok(!DATAFORSEO_CAPABILITY.supportedStrategies.includes("USED_PRODUCT"));
  assert.ok(!DATAFORSEO_CAPABILITY.supportedStrategies.includes("MEDICAL_DEVICE"));
  assert.ok(INTERNAL_SIGNAL_CAPABILITY.canPersist);
  console.log("Provider capability model: OK");
  console.log(`  DataForSEO strategies: ${DATAFORSEO_CAPABILITY.supportedStrategies.join(", ")}\n`);

  // INTERNAL_ONLY test
  const internalOnly = resolveProviderCandidates({
    strategy: "INTERNAL_ONLY",
    categorySlug: "technology",
    normalized: norm("technology", "Test", [
      { key: "solutionType", value: "Apple iPhone" },
    ]),
  });
  assert.equal(internalOnly.routingReason, "STRATEGY_INTERNAL_ONLY");
  assert.equal(internalOnly.selectedProviderId, null);
  console.log("INTERNAL_ONLY behavior: PASS (no external candidates)\n");

  // Routing matrix
  console.log("ROUTING MATRIX:");
  let pass = 0;
  let fail = 0;

  for (const f of FIXTURES) {
    const r = await routeFixture(f);
    const expectedStrategies = Array.isArray(f.expectedStrategy)
      ? f.expectedStrategy
      : [f.expectedStrategy];
    const strategyOk = expectedStrategies.includes(r.strategy);
    const callOk = f.expectExternalCall
      ? r.fetchResult.externalProviderUsed !== null
      : r.fetchResult.externalProviderUsed === null;
    const reasonOk = f.expectedRoutingReason
      ? r.fetchResult.routingReason === f.expectedRoutingReason
      : true;
    const ok = strategyOk && callOk && reasonOk;

    if (ok) pass++;
    else fail++;

    console.log(
      `${f.label}: strategy=${r.strategy} candidates=[${r.candidates.join(",")}] selected=${r.selected ?? "none"} attempted=${r.fetchResult.externalProviderAttempted} used=${r.fetchResult.externalProviderUsed ?? "none"} reason=${r.fetchResult.routingReason} suitability=${r.suitability.toFixed(3)} [${ok ? "PASS" : "FAIL"}]`,
    );
    if (f.note) console.log(`  note: ${f.note}`);
    if (!ok) {
      console.log(
        `  expected: strategy=${f.expectedStrategy} call=${f.expectExternalCall} reason=${f.expectedRoutingReason ?? "any"}`,
      );
    }
  }

  console.log(`\nMatrix: ${pass}/${FIXTURES.length} PASS\n`);

  // Cache regression
  clearProviderCache();
  const iphoneNorm = norm("technology", "Apple iPhone 15 Pro Max", [
    { key: "needType", value: "hardware" },
    { key: "solutionType", value: "Apple iPhone 15 Pro Max 256GB" },
  ]);
  const mockObs = [
    {
      provider: "dataforseo-google-shopping",
      externalId: "cache-test",
      title: "Apple iPhone 15 Pro Max 256GB",
      price: 75000,
      currency: "TRY",
      condition: null,
      location: "Turkey",
      url: null,
      observedAt: new Date(),
      sourceType: "EXTERNAL_LISTING" as const,
    },
  ];
  const r1 = await fetchExternalListings({
    categorySlug: "technology",
    categoryId: iphoneNorm.categoryId,
    title: "Apple iPhone 15 Pro Max",
    normalized: iphoneNorm,
    strategy: "RETAIL_PRODUCT",
    searchImpl: async () => mockObs,
  });
  assert.equal(r1.cached, false);
  const r2 = await fetchExternalListings({
    categorySlug: "technology",
    categoryId: iphoneNorm.categoryId,
    title: "Apple iPhone 15 Pro Max",
    normalized: iphoneNorm,
    strategy: "RETAIL_PRODUCT",
    searchImpl: async () => {
      throw new Error("should not call live API on cache hit");
    },
  });
  assert.equal(r2.cached, true);
  assert.ok(r2.observations.length > 0);
  console.log("Cache regression: PASS\n");

  // All active categories — no category-specific provider code
  const slugs = listRegistryCategorySlugs();
  assert.equal(slugs.length, 11);
  console.log("ALL ACTIVE CATEGORY SAFETY:");
  for (const slug of slugs) {
    const n = norm(slug, `${slug} sample`, [{ key: "city", value: "İstanbul" }]);
    const s = resolvePriceStrategy(
      buildPriceStrategyContext({ categorySlug: slug, title: n.attributes.city ?? "sample" }),
    );
    const c = resolveProviderCandidates({ strategy: s.strategy, categorySlug: slug, normalized: n });
    console.log(`  ${slug} → strategy=${s.strategy} candidates=[${c.providerCandidateIds.join(",")}]`);
  }
  console.log("\nFUTURE CATEGORY SAFETY:");
  const future = resolveProviderCandidates({
    strategy: "UNKNOWN",
    categorySlug: "future-cat-2099",
    normalized: norm("future-cat-2099", "x", []),
  });
  assert.equal(future.routingReason, "STRATEGY_UNKNOWN");
  console.log("  UNKNOWN → STRATEGY_UNKNOWN: PASS\n");

  // Cost control — max 1 provider per request (mock counter)
  let callCount = 0;
  await fetchExternalListings({
    categorySlug: "technology",
    categoryId: "cat-tech",
    title: "Apple iPhone 15 Pro Max",
    normalized: iphoneNorm,
    strategy: "RETAIL_PRODUCT",
    searchImpl: async () => {
      callCount++;
      return mockObs;
    },
  });
  assert.ok(callCount <= 2, "Max 1 provider + optional fallback query inside adapter");
  console.log(`Cost control: searchImpl invoked ${callCount} time(s) (≤2 with fallback): PASS\n`);

  assert.equal(fail, 0, `${fail} routing fixture(s) failed`);
  console.log("ROUTING VERIFY: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
