import { prisma } from "@/lib/prisma";
import type { MarketInsightResult } from "@/lib/monetization/types";

const MIN_AGGREGATE_COUNT = 5;

/**
 * Anonymized aggregate of published Request rows — not Price Intelligence.
 * Trend is not inferred; always UNKNOWN (no previous-period comparison).
 */
export async function generateMarketInsight(input: {
  categoryId?: string;
  city?: string;
  from: Date;
  to: Date;
}): Promise<MarketInsightResult> {
  const where = {
    deletedAt: null,
    publishedAt: { gte: input.from, lte: input.to },
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.city ? { city: input.city } : {}),
  };

  const [requestCount, budgetAgg, offerAgg] = await Promise.all([
    prisma.request.count({ where }),
    prisma.request.aggregate({
      where: { ...where, budgetMax: { not: null } },
      _avg: { budgetMax: true },
    }),
    prisma.request.aggregate({
      where,
      _sum: { offerCount: true },
    }),
  ]);

  if (requestCount < MIN_AGGREGATE_COUNT) {
    return {
      requestCount,
      averageBudget: null,
      medianBudget: null,
      offerCount: 0,
      averageOffersPerRequest: null,
      trend: "UNKNOWN",
      insufficientData: true,
    };
  }

  const avgMax = budgetAgg._avg.budgetMax;
  const averageBudget =
    avgMax == null ? null : Math.round(Number(avgMax));
  const totalOffers = offerAgg._sum.offerCount ?? 0;

  return {
    requestCount,
    averageBudget,
    medianBudget: null,
    offerCount: totalOffers,
    averageOffersPerRequest:
      requestCount > 0
        ? Math.round((totalOffers / requestCount) * 10) / 10
        : null,
    trend: "UNKNOWN",
    insufficientData: false,
  };
}
