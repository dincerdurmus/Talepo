import { prisma } from "@/lib/prisma";
import type { MarketInsightResult } from "@/lib/monetization/types";

const MIN_AGGREGATE_COUNT = 5;

/**
 * Anonymized aggregate market insight — no individual user/company exposure.
 */
export async function generateMarketInsight(input: {
  categoryId?: string;
  city?: string;
  from: Date;
  to: Date;
}): Promise<MarketInsightResult> {
  const requests = await prisma.request.findMany({
    where: {
      deletedAt: null,
      publishedAt: { gte: input.from, lte: input.to },
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.city ? { city: input.city } : {}),
    },
    select: {
      budgetMin: true,
      budgetMax: true,
      offerCount: true,
      publishedAt: true,
    },
    take: 1000,
  });

  if (requests.length < MIN_AGGREGATE_COUNT) {
    return {
      requestCount: requests.length,
      averageBudget: null,
      medianBudget: null,
      offerCount: 0,
      averageOffersPerRequest: null,
      trend: "UNKNOWN",
      insufficientData: true,
    };
  }

  const budgets: number[] = [];
  let totalOffers = 0;

  for (const r of requests) {
    const b = r.budgetMax?.toNumber() ?? r.budgetMin?.toNumber();
    if (b !== undefined && b !== null) budgets.push(b);
    totalOffers += r.offerCount;
  }

  budgets.sort((a, b) => a - b);
  const medianBudget =
    budgets.length > 0
      ? budgets[Math.floor(budgets.length / 2)] ?? null
      : null;
  const averageBudget =
    budgets.length > 0
      ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length)
      : null;

  const mid = Math.floor(requests.length / 2);
  const firstHalf = requests.slice(0, mid).length;
  const secondHalf = requests.length - mid;
  let trend: MarketInsightResult["trend"] = "FLAT";
  if (secondHalf > firstHalf * 1.15) trend = "UP";
  else if (secondHalf < firstHalf * 0.85) trend = "DOWN";

  return {
    requestCount: requests.length,
    averageBudget,
    medianBudget,
    offerCount: totalOffers,
    averageOffersPerRequest:
      requests.length > 0
        ? Math.round((totalOffers / requests.length) * 10) / 10
        : null,
    trend,
    insufficientData: false,
  };
}
