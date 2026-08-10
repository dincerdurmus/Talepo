import { prisma } from "@/lib/prisma";
import type { CompanyPerformanceMetrics } from "@/lib/monetization/types";

export async function getCompanyPerformance(
  companyId: string,
  from: Date,
  to: Date,
): Promise<CompanyPerformanceMetrics> {
  const [
    offersSubmitted,
    offersAccepted,
    matchedRequests,
    watchlistAddsInPeriod,
    activeWatchedRequests,
  ] = await Promise.all([
    prisma.offer.count({
      where: {
        companyId,
        submittedAt: { gte: from, lte: to },
        status: { notIn: ["DRAFT", "WITHDRAWN"] },
      },
    }),
    prisma.offer.count({
      where: {
        companyId,
        acceptedAt: { gte: from, lte: to },
        status: "ACCEPTED",
      },
    }),
    prisma.requestMatch.count({
      where: {
        companyId,
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.opportunityWatchlistItem.count({
      where: { companyId, createdAt: { gte: from, lte: to } },
    }),
    prisma.opportunityWatchlistItem.count({
      where: { companyId },
    }),
  ]);

  const submittedOffers = await prisma.offer.findMany({
    where: {
      companyId,
      submittedAt: { gte: from, lte: to, not: null },
      status: { notIn: ["DRAFT", "WITHDRAWN"] },
    },
    select: { submittedAt: true, createdAt: true },
    take: 500,
  });

  let totalResponseMs = 0;
  let responseCount = 0;
  for (const offer of submittedOffers) {
    if (!offer.submittedAt) continue;
    totalResponseMs +=
      offer.submittedAt.getTime() - offer.createdAt.getTime();
    responseCount += 1;
  }

  const averageResponseTimeHours =
    responseCount > 0
      ? Math.round((totalResponseMs / responseCount / (1000 * 60 * 60)) * 10) /
        10
      : null;

  return {
    offersSubmitted,
    offersAccepted,
    acceptanceRate:
      offersSubmitted > 0 ? offersAccepted / offersSubmitted : null,
    averageResponseTimeHours,
    matchedRequests,
    watchlistAddsInPeriod,
    activeWatchedRequests,
  };
}
