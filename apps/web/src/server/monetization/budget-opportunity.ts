import type { BudgetOpportunityResult } from "@/lib/monetization/types";

/**
 * Budget vs market evaluation — returns UNKNOWN when no reference data.
 * No fake percentage claims.
 */
export function evaluateBudgetOpportunity(input: {
  budgetMin: number | null;
  budgetMax: number | null;
  categorySlug?: string;
  city?: string | null;
  referenceMedian?: number | null;
}): BudgetOpportunityResult {
  const budget = input.budgetMax ?? input.budgetMin;

  if (budget === null || budget <= 0) {
    return {
      status: "UNKNOWN",
      confidence: 0,
      referenceSource: null,
    };
  }

  if (!input.referenceMedian || input.referenceMedian <= 0) {
    return {
      status: "UNKNOWN",
      confidence: 0,
      referenceSource: null,
    };
  }

  const ratio = budget / input.referenceMedian;
  let status: BudgetOpportunityResult["status"] = "MARKET";
  if (ratio < 0.85) status = "BELOW_MARKET";
  else if (ratio > 1.15) status = "ABOVE_MARKET";

  return {
    status,
    confidence: 0.6,
    referenceSource: "category_city_median",
  };
}
