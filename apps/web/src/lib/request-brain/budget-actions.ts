import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";

/** Strategies where budget common field is meaningful for market comparison */
const BUDGET_MEANINGFUL_STRATEGIES = new Set<PriceStrategyKey>([
  "RETAIL_PRODUCT",
  "USED_PRODUCT",
  "VEHICLE",
  "AUTO_PART",
  "REAL_ESTATE_SALE",
  "REAL_ESTATE_RENT",
  "INDUSTRIAL_EQUIPMENT",
  "CUSTOM_MANUFACTURING",
  "B2B_COMMODITY",
  "SERVICE_SCOPE",
]);

export function isBudgetMeaningfulForStrategy(strategy: PriceStrategyKey | null | undefined): boolean {
  if (!strategy) return false;
  return BUDGET_MEANINGFUL_STRATEGIES.has(strategy);
}

export function isMarketRangeReliable(input: {
  marketMedian: number | null | undefined;
  overallConfidenceLevel?: string | null;
}): boolean {
  if (input.marketMedian == null || !Number.isFinite(input.marketMedian) || input.marketMedian <= 0) {
    return false;
  }
  const level = input.overallConfidenceLevel ?? "NONE";
  return level !== "NONE" && level !== "VERY_LOW";
}

export function formatBudgetFromMedian(median: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(median);
}

/** Strategy-aware budget input hint — not category hardcodes. */
export function budgetPlaceholderForStrategy(
  strategy: PriceStrategyKey | null | undefined,
): string {
  switch (strategy) {
    case "REAL_ESTATE_RENT":
      return "Örn. 25.000 TL / ay";
    case "REAL_ESTATE_SALE":
      return "Örn. ₺3.500.000";
    case "VEHICLE":
    case "USED_PRODUCT":
      return "Örn. ₺1.250.000";
    case "CUSTOM_MANUFACTURING":
    case "B2B_COMMODITY":
      return "Örn. ₺50.000 toplam veya birim";
    case "SERVICE_SCOPE":
      return "Örn. ₺35.000";
    default:
      return "Örn. ₺50.000";
  }
}
