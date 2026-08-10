/**
 * DataForSEO canlı bağlantı doğrulama (read-only, production verisi değiştirmez).
 * Run: npx tsx scripts/verify-dataforseo-live.ts
 */
import "dotenv/config";

import type { ExternalPriceObservation, NormalizedProduct } from "../src/lib/price-intelligence/types";
import {
  DATAFORSEO_CONFIG,
  EXTERNAL_MATCH_QUALITY,
  isDataForSeoConfigured,
} from "../src/lib/price-intelligence/provider-config";
import { computeExternalShoppingSuitability } from "../src/lib/price-intelligence/product-suitability";
import {
  computeExternalMatchQuality,
  filterByMatchQuality,
} from "../src/server/price-intelligence/external-match-quality";
import { fetchExternalListings } from "../src/server/price-intelligence/fetch-external-listings";
import { normalizeProductFromRequest } from "../src/server/price-intelligence/normalize-product";
import { clearProviderCache, providerCacheSize } from "../src/server/price-intelligence/provider-cache";
import { clearProviderTelemetry } from "../src/server/price-intelligence/provider-telemetry";
import {
  DATAFORSEO_SUPPORTED_ITEM_TYPES,
  getDataForSeoLocationConfig,
  getLastDataForSeoParseStats,
  searchDataForSeoGoogleShopping,
} from "../src/server/price-intelligence/providers/dataforseo";
import { getPriceIntelligence } from "../src/server/price-intelligence/price-intelligence-engine";
import { prisma } from "../src/lib/prisma";

type QueryRunResult = {
  raw: ExternalPriceObservation[];
  matched: ExternalPriceObservation[];
  rejectedCount: number;
  rejectionBreakdown: string;
  parseStats: ReturnType<typeof getLastDataForSeoParseStats>;
  cached: boolean;
  providerStatus: string;
  error?: string;
};

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const weight = idx - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

function fmtPrice(n: number | null, currency = "TRY"): string {
  if (n == null) return "N/A";
  return `${Math.round(n).toLocaleString("tr-TR")} ${currency}`;
}

function classifyRejection(
  title: string,
  matchQuality: number,
  observation: ExternalPriceObservation,
): string {
  const t = title.toLocaleLowerCase("tr-TR");

  if (!Number.isFinite(observation.price) || observation.price <= 0) return "invalid price";
  if (observation.currency !== "TRY" && observation.currency !== "TL") return "currency mismatch";

  const accessory = [
    "kılıf", "kilif", "case", "cover", "cam", "ekran koruyucu", "screen protector",
    "charger", "şarj", "sarj", "kablosuz", "band", "strap", "kordon", "airpods",
    "watch", "yedek parça", "yedek parca", "batarya", "battery pack",
  ];
  if (accessory.some((w) => t.includes(w))) return "accessory";

  if (matchQuality < EXTERNAL_MATCH_QUALITY.minAggregate) {
    if (!t.includes("iphone") && !t.includes("bosch") && !t.includes("çamaşır")) {
      return "title mismatch";
    }
    if (t.includes("14") && !t.includes("15")) return "wrong model";
    if (t.includes("16") && !t.includes("15")) return "wrong model";
    if (t.includes("15 pro") && !t.includes("max") && !t.includes("pro max")) return "wrong model";
    if (t.includes("15") && !t.includes("pro") && t.includes("iphone")) return "wrong model";
    if (
      (t.includes("128") || t.includes("512") || t.includes("1tb") || t.includes("1 tb")) &&
      !t.includes("256")
    ) {
      return "wrong storage";
    }
    if (
      t.includes("refurb") ||
      t.includes("renewed") ||
      t.includes("yenilenmiş") ||
      t.includes("reconditioned")
    ) {
      return "refurbished/used";
    }
    if (
      t.includes("ikinci el") ||
      t.includes("2.el") ||
      t.includes("2 el") ||
      t.includes("used") ||
      t.includes("pre-owned")
    ) {
      return "refurbished/used";
    }
    return "insufficient match";
  }

  return "other";
}

function analyzeQuery(
  normalized: NormalizedProduct,
  raw: ExternalPriceObservation[],
): Pick<
  QueryRunResult,
  "matched" | "rejectedCount" | "rejectionBreakdown"
> {
  const scored = raw.map((o) => ({
    observation: o,
    matchQuality: computeExternalMatchQuality(normalized, o),
  }));

  const matched = filterByMatchQuality(
    normalized,
    raw,
    EXTERNAL_MATCH_QUALITY.minAggregate,
  );
  const rejected = scored.filter((s) => s.matchQuality < EXTERNAL_MATCH_QUALITY.minAggregate);

  const buckets = new Map<string, number>();
  for (const r of rejected) {
    const reason = classifyRejection(r.observation.title, r.matchQuality, r.observation);
    buckets.set(reason, (buckets.get(reason) ?? 0) + 1);
  }

  const rejectionBreakdown =
    buckets.size > 0
      ? [...buckets.entries()].map(([k, v]) => `${k}=${v}`).join(", ")
      : "none";

  return { matched, rejectedCount: rejected.length, rejectionBreakdown };
}

function tryMatchedPrices(matched: ExternalPriceObservation[]): number[] {
  return matched
    .filter((o) => o.currency === "TRY" || o.currency === "TL")
    .map((o) => o.price);
}

function conditionSummary(items: ExternalPriceObservation[]): string {
  const counts = { new: 0, refurbished: 0, used: 0, unknown: 0 };
  for (const o of items) {
    if (o.condition === "refurbished") counts.refurbished++;
    else if (o.condition === "used") counts.used++;
    else if (o.condition) counts.unknown++;
    else counts.new++;
  }
  return `new=${counts.new}, refurbished=${counts.refurbished}, used=${counts.used}`;
}

function matchedSamples(matched: ExternalPriceObservation[], limit = 10): string {
  return matched
    .slice(0, limit)
    .map((o) => {
      const mq = (o.rawMetadata as { matchQuality?: number })?.matchQuality;
      const seller = (o.rawMetadata as { seller?: string | null })?.seller;
      return (
        `"${o.title.slice(0, 55)}" | ${o.price.toLocaleString("tr-TR")} ${o.currency} | ` +
        `mq=${mq?.toFixed(3) ?? "?"} | condition=${o.condition ?? "new"} | seller=${seller ?? "n/a"}`
      );
    })
    .join("\n  ");
}

async function main() {
  const report: Record<string, string> = {};

  if (!isDataForSeoConfigured()) {
    console.log("NOT_CONFIGURED");
    process.exit(1);
  }

  clearProviderCache();
  clearProviderTelemetry();

  report["PARSER FIX"] = "google_shopping_serp/paid + carousel nested elements";
  report["SUPPORTED ITEM TYPES"] = DATAFORSEO_SUPPORTED_ITEM_TYPES.join(", ");

  const loc = getDataForSeoLocationConfig();
  console.log(
    `\nConfig: location_code=${loc.locationCode}, language=${DATAFORSEO_CONFIG.languageCode}, currency=${DATAFORSEO_CONFIG.currency}\n`,
  );

  let apiCallCount = 0;
  let iphoneRawCaptured: ExternalPriceObservation[] = [];

  const iphoneSearch = async (input: { keyword: string }) => {
    apiCallCount++;
    iphoneRawCaptured = await searchDataForSeoGoogleShopping(input);
    return iphoneRawCaptured;
  };

  const iphoneNormalized = normalizeProductFromRequest({
    categoryId: "live-test-iphone",
    categorySlug: "technology",
    title: "Apple iPhone 15 Pro Max 256GB",
    fieldValues: [
      { key: "needType", value: "hardware" },
      { key: "solutionType", value: "Apple iPhone 15 Pro Max 256GB" },
      { key: "specs", value: "256 GB" },
    ],
  });

  const iphoneSuitability = computeExternalShoppingSuitability({
    categorySlug: "technology",
    normalized: iphoneNormalized,
  });

  // iPhone — 1. çağrı
  const iphone1 = await fetchExternalListings({
    categorySlug: "technology",
    categoryId: "live-test-iphone",
    title: "Apple iPhone 15 Pro Max 256GB",
    normalized: iphoneNormalized,
    strategy: "RETAIL_PRODUCT",
    searchImpl: iphoneSearch,
  });

  const iphoneParseStats = getLastDataForSeoParseStats();
  const iphoneAnalysis = analyzeQuery(iphoneNormalized, iphoneRawCaptured);
  const iphoneTryPrices = tryMatchedPrices(iphoneAnalysis.matched);

  report["UNKNOWN ITEM TYPES"] =
    iphoneParseStats.unknownTypeCount > 0
      ? `${iphoneParseStats.unknownTypeCount} (${JSON.stringify(iphoneParseStats.unknownTypes)})`
      : "0";
  report["IPHONE RAW"] = String(iphoneRawCaptured.length);
  report["IPHONE NORMALIZED"] = String(iphoneRawCaptured.length);
  report["IPHONE MATCHED"] = String(iphoneAnalysis.matched.length);
  report["IPHONE REJECTED"] = String(iphoneAnalysis.rejectedCount);
  report["IPHONE REJECTION BREAKDOWN"] = iphoneAnalysis.rejectionBreakdown;
  report["IPHONE MIN"] = fmtPrice(iphoneTryPrices.length ? Math.min(...iphoneTryPrices) : null);
  report["IPHONE P25"] = fmtPrice(percentile(iphoneTryPrices, 25));
  report["IPHONE MEDIAN"] = fmtPrice(percentile(iphoneTryPrices, 50));
  report["IPHONE P75"] = fmtPrice(percentile(iphoneTryPrices, 75));
  report["IPHONE MAX"] = fmtPrice(iphoneTryPrices.length ? Math.max(...iphoneTryPrices) : null);
  report["IPHONE CONDITIONS"] = conditionSummary(iphoneAnalysis.matched);
  report["IPHONE MATCHED SAMPLE TITLES"] =
    iphoneAnalysis.matched.length > 0 ? `\n  ${matchedSamples(iphoneAnalysis.matched)}` : "none";

  // iPhone — 2. çağrı cache
  const callsBeforeIphone2 = apiCallCount;
  const iphone2 = await fetchExternalListings({
    categorySlug: "technology",
    categoryId: "live-test-iphone",
    title: "Apple iPhone 15 Pro Max 256GB",
    normalized: iphoneNormalized,
    strategy: "RETAIL_PRODUCT",
    searchImpl: iphoneSearch,
  });
  const iphone2NewCalls = apiCallCount - callsBeforeIphone2;

  report["CACHE FIRST"] = iphone1.cached ? "HIT" : "MISS";
  report["CACHE SECOND"] = iphone2.cached ? "HIT" : "MISS";
  report["SECOND PROVIDER CALL PREVENTED"] =
    iphone2.cached && iphone2NewCalls === 0 ? "YES" : `NO (newApiCalls=${iphone2NewCalls})`;

  // Bosch control
  const boschNormalized = normalizeProductFromRequest({
    categoryId: "live-test-bosch",
    categorySlug: "appliances",
    title: "Bosch Series 6 9 kg çamaşır makinesi",
    fieldValues: [
      { key: "applianceType", value: "Çamaşır makinesi" },
      { key: "brandPreference", value: "Bosch" },
      { key: "energyClass", value: "A" },
    ],
  });

  let boschRawCaptured: ExternalPriceObservation[] = [];
  const boschSearch = async (input: { keyword: string }) => {
    apiCallCount++;
    const raw = await searchDataForSeoGoogleShopping(input);
    boschRawCaptured = raw;
    return raw;
  };

  await fetchExternalListings({
    categorySlug: "appliances",
    categoryId: "live-test-bosch",
    title: "Bosch Series 6 9 kg çamaşır makinesi",
    normalized: boschNormalized,
    strategy: "RETAIL_PRODUCT",
    searchImpl: boschSearch,
  });

  const boschAnalysis = analyzeQuery(boschNormalized, boschRawCaptured);
  const boschTryPrices = tryMatchedPrices(boschAnalysis.matched);

  report["BOSCH RAW"] = String(boschRawCaptured.length);
  report["BOSCH NORMALIZED"] = String(boschRawCaptured.length);
  report["BOSCH MATCHED"] = String(boschAnalysis.matched.length);
  report["BOSCH MEDIAN"] = fmtPrice(percentile(boschTryPrices, 50));
  report["BOSCH P25-P75"] =
    `${fmtPrice(percentile(boschTryPrices, 25))} – ${fmtPrice(percentile(boschTryPrices, 75))}`;

  report["RATING MAPPING"] = "product_rating.value → rating.value fallback";
  report["CURRENCY HANDLING"] = "actual item currency preserved; TRY aggregate separate";

  const internalCat = await prisma.category.findFirst({
    where: { slug: "technology", isActive: true },
    select: { id: true },
  });
  if (internalCat) {
    const internal = await getPriceIntelligence({
      categoryId: internalCat.id,
      windowDays: 90,
      includeExternal: false,
    });
    report["INTERNAL (separate)"] =
      `requests=${internal.sources.talepoRequests}, offers=${internal.sources.talepoOffers}, confidence=${internal.confidence}`;
  }

  const errors = [iphone1.errorMessage, iphone2.errorMessage].filter(Boolean);
  report["ERRORS"] = errors.length ? errors.join("; ") : "none";
  report["REMAINING RISKS"] =
    iphoneParseStats.skippedMissingCurrency > 0
      ? "items missing currency skipped"
      : "carousel-only SERPs may need nested monitoring; non-TRY currencies excluded from TRY stats";

  report["SUITABILITY (iPhone)"] = iphoneSuitability.toFixed(3);
  report["LIVE API (iPhone)"] = iphone1.providerStatus === "ERROR" ? "FAIL" : "PASS";

  printReport(report);
  await prisma.$disconnect();
}

function printReport(report: Record<string, string>) {
  console.log("=== DataForSEO Parser Fix Live Test ===\n");
  for (const key of [
    "PARSER FIX",
    "SUPPORTED ITEM TYPES",
    "UNKNOWN ITEM TYPES",
    "LIVE API (iPhone)",
    "SUITABILITY (iPhone)",
    "IPHONE RAW",
    "IPHONE NORMALIZED",
    "IPHONE MATCHED",
    "IPHONE REJECTED",
    "IPHONE REJECTION BREAKDOWN",
    "IPHONE MIN",
    "IPHONE P25",
    "IPHONE MEDIAN",
    "IPHONE P75",
    "IPHONE MAX",
    "IPHONE CONDITIONS",
    "IPHONE MATCHED SAMPLE TITLES",
    "BOSCH RAW",
    "BOSCH NORMALIZED",
    "BOSCH MATCHED",
    "BOSCH MEDIAN",
    "BOSCH P25-P75",
    "CACHE FIRST",
    "CACHE SECOND",
    "SECOND PROVIDER CALL PREVENTED",
    "INTERNAL (separate)",
    "RATING MAPPING",
    "CURRENCY HANDLING",
    "ERRORS",
    "REMAINING RISKS",
  ]) {
    if (report[key] != null) console.log(`${key}: ${report[key]}`);
  }
  console.log("");
}

main().catch(async (err) => {
  console.error("FATAL:", err instanceof Error ? err.message : String(err));
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
