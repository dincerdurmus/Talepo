import type { PriceIntelligenceResult } from "@/lib/price-intelligence/types";

/** Sanitized preview payload — no raw offers, no company identity */
export function sanitizePreviewIntelligence(result: PriceIntelligenceResult) {
  return {
    strategy: result.strategy,
    completeness: result.completeness,
    marketRange: result.marketRange ?? null,
    weightedReference: result.weightedReference ?? null,
    overallConfidence: result.overallConfidence,
    internalConfidence: result.internalConfidence,
    externalConfidence: result.externalConfidence,
    budgetEvaluation: result.budgetEvaluation,
    confidenceReasons: result.confidenceReasons,
    insufficientData: result.insufficientData,
    external: result.external
      ? {
          provider: result.external.providerId,
          fetchedCount: result.external.fetchedCount,
          averageMatchQuality: result.external.suitabilityScore,
          routingReason: result.external.externalRoutingReason,
          fromCache: result.external.cached,
        }
      : undefined,
    sources: result.sources,
    offerPriceStats: { rawSampleSize: result.offerPriceStats.rawSampleSize },
    acceptedOfferStats: { rawSampleSize: result.acceptedOfferStats.rawSampleSize },
    confirmedTransactionStats: {
      rawSampleSize: result.confirmedTransactionStats.rawSampleSize,
    },
    externalListingStats: {
      rawSampleSize: result.externalListingStats.rawSampleSize,
    },
  };
}
