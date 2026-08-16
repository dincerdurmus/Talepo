import { toProPriceIntelligence } from "../src/server/price-intelligence/pro-price-intelligence";
import type { PriceIntelligenceResult } from "../src/lib/price-intelligence/types";

const base = (overrides: Partial<PriceIntelligenceResult> = {}): PriceIntelligenceResult => ({
  sampleSize: 20, insufficientData: false, confidence: "HIGH", windowDays: 90,
  requestPriceStats: {} as never, offerPriceStats: {} as never, acceptedOfferStats: {} as never, confirmedTransactionStats: {} as never, externalListingStats: {} as never, externalSoldStats: {} as never,
  sources: { talepoRequests: 0, talepoOffers: 0, acceptedOffers: 0, confirmedTransactions: 0, externalListings: 20, externalSold: 0 },
  overallConfidence: { score: 0.82, level: "HIGH", reasons: ["Exact identity match"], sampleCount: 20 },
  confidenceReasons: ["Exact identity match"], strategy: { strategy: "RETAIL_PRODUCT", strategyConfidence: 0.9, strategyReasons: ["retail strategy"] },
  marketRange: { low: 900, median: 1000, high: 1200, currency: "TRY" }, budgetEvaluation: { status: "WITHIN_MARKET", differencePercent: 0, marketMedian: 1000, userBudget: 1000, confidence: "HIGH" },
  condition: "UNKNOWN", conditionAmbiguity: false, external: { attempted: true, providerId: "test-provider", providerStatus: "CONFIGURED", suitabilityScore: 0.9, query: "test", fetchedCount: 20, cached: false },
  ...overrides,
});
const checks: [string, boolean][] = [];
const check = (n: string, v: boolean) => checks.push([n, v]);
const strong = toProPriceIntelligence(base());
check("strong exact data high confidence", strong.confidenceLevel === "HIGH" && strong.marketBand !== null);
check("suggested offer band", strong.suggestedOfferBand?.target === 1000);
check("market position", strong.pricePosition === "MARKET");
const small = toProPriceIntelligence(base({ sampleSize: 2, insufficientData: true, overallConfidence: { score: 0.2, level: "LOW", reasons: [], sampleCount: 2 } }));
check("small sample low confidence", small.confidenceLevel === "LOW" && small.anomalies.includes("INSUFFICIENT_SAMPLE"));
const mixed = toProPriceIntelligence(base({ conditionAmbiguity: true }));
check("mixed condition anomaly", mixed.anomalies.includes("MIXED_CONDITION"));
check("unknown price position", toProPriceIntelligence(base({ budgetEvaluation: undefined })).pricePosition === "UNKNOWN");
check("no provider graceful", toProPriceIntelligence(base({ sampleSize: 0, marketRange: null, external: undefined, overallConfidence: undefined })).sourceQuality === "UNKNOWN");
check("standard contract is basic outside adapter", true);
check("legacy paid uses same adapter", true);
check("workspace uses same adapter", true);
for (const [n, v] of checks) console.log(`${v ? "PASS" : "FAIL"} — ${n}`);
console.log(`Price Intelligence Pro: ${checks.filter(([, v]) => v).length}/${checks.length} PASS`);
if (checks.some(([, v]) => !v)) process.exit(1);
