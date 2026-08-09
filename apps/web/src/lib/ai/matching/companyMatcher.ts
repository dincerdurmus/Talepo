import type { MatchEstimate, ParsedRequest } from "../types";

/**
 * Client-side fallback estimate. Live counts come from
 * GET /api/matching/estimate after parse.
 */
export function estimateCompanyMatches(request: ParsedRequest): MatchEstimate {
  const baseCounts: Record<string, number> = {
    printing: 8,
    automotive: 10,
    machinery: 6,
    furniture: 9,
    technology: 11,
    appliances: 9,
    health: 7,
    baby: 6,
    "home-kitchen": 8,
    services: 7,
    "real-estate": 8,
  };

  const estimatedCompanyCount = baseCounts[request.categoryId] ?? 5;
  const expectedOfferCount = Math.max(
    2,
    Math.round(estimatedCompanyCount * 0.4),
  );

  return {
    estimatedCompanyCount,
    expectedOfferCount,
    explanation:
      "Ön tahmin. Yayınlanınca eşleşen firmalara gerçek bildirim gider; canlı sayı API’den güncellenir.",
  };
}
