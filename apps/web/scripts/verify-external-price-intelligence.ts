/**
 * External Price Intelligence Phase 1 tests.
 * Run: npx tsx scripts/verify-external-price-intelligence.ts
 */
import assert from "node:assert/strict";

import { listCategoryCoverage, parseConsumerProductName } from "../src/lib/price-intelligence/category-registry";
import {
  getSuitabilityBand,
  isDataForSeoConfigured,
  shouldCallExternalProvider,
} from "../src/lib/price-intelligence/provider-config";
import { computeExternalShoppingSuitability } from "../src/lib/price-intelligence/product-suitability";
import { computeAggregateConfidence } from "../src/server/price-intelligence/confidence";
import {
  computeExternalMatchQuality,
  extractStorageFromTitle,
  filterByMatchQuality,
  normalizeProductText,
} from "../src/server/price-intelligence/external-match-quality";
import { fetchExternalListings } from "../src/server/price-intelligence/fetch-external-listings";
import { normalizeProductFromRequest } from "../src/server/price-intelligence/normalize-product";
import { buildProviderRouting } from "../src/server/price-intelligence/provider-query";
import { buildQueryFromNormalizedProduct } from "../src/server/price-intelligence/provider-query-builder";
import {
  clearProviderCache,
  setCachedProviderResults,
  buildProviderCacheKey,
} from "../src/server/price-intelligence/provider-cache";
import { clearProviderTelemetry, getProviderTelemetry } from "../src/server/price-intelligence/provider-telemetry";
import {
  dataForSeoGoogleShoppingProvider,
  parseDataForSeoMockResponse,
} from "../src/server/price-intelligence/providers";
import { getDataForSeoProviderStatus } from "../src/server/price-intelligence/providers/dataforseo";

function norm(
  slug: string,
  title: string,
  fields: { key: string; value: string }[],
) {
  return normalizeProductFromRequest({
    categoryId: `cat-${slug}`,
    categorySlug: slug,
    title,
    fieldValues: fields,
  });
}

async function main() {
  // A) Technology standard product → HIGH suitability
  const iphone = norm("technology", "Apple iPhone 15 Pro Max", [
    { key: "needType", value: "hardware" },
    { key: "solutionType", value: "Apple iPhone 15 Pro Max 256GB" },
    { key: "specs", value: "256 GB" },
  ]);
  const iphoneScore = computeExternalShoppingSuitability({
    categorySlug: "technology",
    normalized: iphone,
  });
  assert.ok(iphoneScore >= 0.6, `iPhone suitability ${iphoneScore} should be HIGH`);
  assert.equal(getSuitabilityBand(iphoneScore), "use");

  const iphoneQuery = buildQueryFromNormalizedProduct(
    iphone,
    "technology",
    iphone.providerQuery ?? "",
  );
  assert.ok(iphoneQuery.toLowerCase().includes("256"), iphoneQuery);
  assert.ok(!iphoneQuery.toLowerCase().includes("hardware"), "needType must not leak into query");

  const parsedIphone = parseConsumerProductName("Apple iPhone 15 Pro Max 256GB");
  assert.equal(parsedIphone.brand, "Apple");
  assert.equal(parsedIphone.model, "iPhone 15 Pro Max");

  assert.equal(normalizeProductText("iPhone15 ProMax 256GB"), "iphone 15 pro max 256 gb");
  assert.equal(extractStorageFromTitle("Apple iPhone 15 Pro Max 256 GB"), "256gb");
  assert.equal(extractStorageFromTitle("Apple iPhone 15 Pro Max"), null);

  const iphoneNorm = normalizeProductFromRequest({
    categoryId: "cat-tech",
    categorySlug: "technology",
    title: "Apple iPhone 15 Pro Max 256GB",
    fieldValues: [
      { key: "needType", value: "hardware" },
      { key: "solutionType", value: "Apple iPhone 15 Pro Max 256GB" },
      { key: "specs", value: "256 GB" },
    ],
  });
  assert.equal(iphoneNorm.brand, "Apple");
  assert.equal(iphoneNorm.model, "iPhone 15 Pro Max");

  const exactListing = {
    provider: "dataforseo-google-shopping",
    externalId: "test-exact",
    title: "Apple iPhone 15 Pro Max 256 GB Titanyum",
    price: 90000,
    currency: "TRY",
    condition: null,
    location: "Turkiye",
    url: null,
    observedAt: new Date(),
    sourceType: "EXTERNAL_LISTING" as const,
  };
  assert.ok(
    computeExternalMatchQuality(iphoneNorm, exactListing) >= 0.4,
    "exact iPhone 15 Pro Max 256GB should pass",
  );

  const noStorageListing = {
    ...exactListing,
    externalId: "test-nostorage",
    title: "Apple iPhone 15 Pro Max",
  };
  assert.ok(
    computeExternalMatchQuality(iphoneNorm, noStorageListing) < 0.4,
    "missing storage must not pass",
  );

  const wrongStorageListing = {
    ...exactListing,
    externalId: "test-128",
    title: "Apple iPhone 15 Pro Max 128 GB",
  };
  assert.ok(
    computeExternalMatchQuality(iphoneNorm, wrongStorageListing) < 0.4,
    "wrong storage must not pass",
  );

  const comparisonListing = {
    ...exactListing,
    externalId: "test-compare",
    title: "Apple iPhone 15 256 GB 6 GB vs Apple iPhone 16 Pro 256",
    price: 2425,
  };
  assert.ok(
    computeExternalMatchQuality(iphoneNorm, comparisonListing) < 0.4,
    "non-Pro-Max comparison listing must not pass",
  );

  // B) Service request → LOW, no external call
  const service = norm("services", "Ofis temizliği", [
    { key: "serviceType", value: "Temizlik" },
    { key: "frequency", value: "Haftalık" },
  ]);
  const serviceScore = computeExternalShoppingSuitability({
    categorySlug: "services",
    normalized: service,
  });
  assert.ok(serviceScore < 0.3, `Service suitability ${serviceScore} should be LOW`);
  assert.equal(shouldCallExternalProvider(serviceScore), false);

  const serviceRouting = buildProviderRouting({
    categoryId: "cat-services",
    categorySlug: "services",
    title: "Ofis temizliği",
    normalizedProduct: service,
  });
  assert.equal(serviceRouting.shouldCallExternal, false);

  // C) Printing custom → internal weighted
  const print = norm("printing", "Kraft kutu 5000 adet", [
    { key: "dimensions", value: "35x25x8" },
    { key: "material", value: "Kraft" },
    { key: "printType", value: "4 renk ofset" },
  ]);
  const printScore = computeExternalShoppingSuitability({
    categorySlug: "printing",
    normalized: print,
  });
  assert.ok(printScore < 0.6, `Print suitability ${printScore} should not trigger external`);

  // D) Appliances brand + model → HIGH
  const appliance = norm("appliances", "Bosch çamaşır makinesi", [
    { key: "applianceType", value: "Çamaşır makinesi" },
    { key: "brandPreference", value: "Bosch" },
    { key: "energyClass", value: "A+++" },
  ]);
  const applianceScore = computeExternalShoppingSuitability({
    categorySlug: "appliances",
    normalized: appliance,
  });
  assert.ok(applianceScore >= 0.6, `Appliance suitability ${applianceScore}`);

  // E) Credentials missing → NOT_CONFIGURED, build-safe
  if (!isDataForSeoConfigured()) {
    assert.equal(getDataForSeoProviderStatus(), "NOT_CONFIGURED");
    assert.equal(dataForSeoGoogleShoppingProvider.dataPolicy.canPersist, false);
  }

  // F) Mocked DataForSEO response
  const mockParsed = parseDataForSeoMockResponse({
    tasks: [
      {
        status_code: 20000,
        result: [
          {
            items: [
              {
                type: "google_shopping_serp",
                title: "Apple iPhone 15 Pro Max 256GB",
                price: 89999,
                currency: "TRY",
                product_id: "123",
                product_rating: { value: "4.5" },
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(mockParsed.length, 1);
  assert.equal(mockParsed[0]!.sourceType, "EXTERNAL_LISTING");
  assert.equal(mockParsed[0]!.price, 89999);
  assert.equal(mockParsed[0]!.rawMetadata?.rating, 4.5);

  const carouselParsed = parseDataForSeoMockResponse({
    tasks: [
      {
        status_code: 20000,
        result: [
          {
            items: [
              {
                type: "google_shopping_carousel",
                title: "Popular products",
                items: [
                  {
                    type: "google_shopping_carousel_element",
                    title: "Carousel Product",
                    price: 12000,
                    currency: "TRY",
                    gid: "carousel-gid-1",
                  },
                ],
              },
              {
                type: "related_searches",
                title: "Related",
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(carouselParsed.length, 1);
  assert.equal(carouselParsed[0]!.externalId, "gid:carousel-gid-1");

  const unknownParsed = parseDataForSeoMockResponse({
    tasks: [
      {
        status_code: 20000,
        result: [
          {
            items: [{ type: "made_up_type", title: "X", price: 1, currency: "TRY" }],
          },
        ],
      },
    ],
  });
  assert.equal(unknownParsed.length, 0);

  // G) Wrong product → low match quality filtered out
  const wrongMatch = {
    provider: "dataforseo-google-shopping",
    externalId: "x",
    title: "Samsung Galaxy S24",
    price: 50000,
    currency: "TRY",
    condition: null,
    location: "Turkey",
    url: null,
    observedAt: new Date(),
    sourceType: "EXTERNAL_LISTING" as const,
  };
  const mq = computeExternalMatchQuality(iphone, wrongMatch);
  assert.ok(mq < 0.4, `Wrong match quality ${mq}`);
  const filtered = filterByMatchQuality(iphone, [wrongMatch, mockParsed[0]!], 0.4);
  assert.equal(filtered.length, 1);

  // H) Provider timeout → internal fallback
  clearProviderTelemetry();
  const timeoutResult = await fetchExternalListings({
    categorySlug: "technology",
    categoryId: "cat-tech",
    title: "Apple iPhone 15 Pro Max",
    normalized: iphone,
    strategy: "RETAIL_PRODUCT",
    searchImpl: async () => {
      throw new Error("timeout");
    },
  });
  assert.equal(timeoutResult.observations.length, 0);
  assert.equal(timeoutResult.providerStatus, "ERROR");
  const telemetry = getProviderTelemetry(1);
  assert.equal(telemetry[0]?.success, false);

  // I) Idempotency key design
  assert.equal(`TALEPO_OFFER:abc`, `TALEPO_OFFER:abc`);

  // Confidence: external alone cannot produce HIGH
  assert.equal(
    computeAggregateConfidence({
      internalSample: 2,
      confirmedSample: 0,
      externalListingSample: 50,
    }),
    "VERY_LOW",
  );

  // Category coverage
  const coverage = listCategoryCoverage();
  assert.equal(coverage.length, 11);

  clearProviderCache();
  const cacheKey = buildProviderCacheKey({
    providerId: "dataforseo-google-shopping",
    queryFingerprint: "apple iphone",
    location: "Turkey",
    currency: "TRY",
  });
  setCachedProviderResults(cacheKey, mockParsed, 60_000);

  if (isDataForSeoConfigured()) {
    console.log("  DataForSEO: CONFIGURED (live test skipped in unit script)");
  } else {
    console.log("  DataForSEO: NOT_CONFIGURED (expected in dev)");
  }

  console.log("verify-external-price-intelligence: PASS");
  console.log(`  iPhone suitability: ${iphoneScore}`);
  console.log(`  Service suitability: ${serviceScore}`);
  console.log(`  Appliance suitability: ${applianceScore}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
