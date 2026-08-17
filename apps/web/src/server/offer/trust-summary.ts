import {
  emptyTrustSummary,
  roundAverageRating,
  type TrustSummary,
} from "@/lib/offer/deal-review";
import { prisma } from "@/lib/prisma";
import {
  countCompletedTransactions,
  loadCompletedTransactionCounts,
} from "@/server/price-intelligence/deal-outcome";

export type TrustComment = {
  rating: number;
  comment: string;
  reviewerSide: "BUYER" | "PROVIDER";
  createdAt: string;
};

export type TrustSummaryWithComments = TrustSummary & {
  recentComments: TrustComment[];
};

function emptySummary(completedTransactions = 0): TrustSummaryWithComments {
  return {
    ...emptyTrustSummary(),
    completedTransactions,
    recentComments: [],
  };
}

function fromAgg(
  completedTransactions: number,
  reviewCount: number,
  avg: number | null,
  recentComments: TrustComment[] = [],
): TrustSummaryWithComments {
  return {
    completedTransactions,
    reviewCount,
    averageRating:
      reviewCount > 0 && avg != null ? roundAverageRating(avg) : null,
    recentComments,
  };
}

/** Personal provider trust: completed personal offers + buyer→user reviews. */
export async function getUserTrustSummary(
  userId: string,
): Promise<TrustSummaryWithComments> {
  const [completedTransactions, agg, recent] = await Promise.all([
    countCompletedTransactions({ personalProviderUserId: userId }),
    prisma.dealReview.aggregate({
      where: {
        targetType: "USER",
        targetUserId: userId,
        reviewerSide: "BUYER",
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.dealReview.findMany({
      where: {
        targetType: "USER",
        targetUserId: userId,
        reviewerSide: "BUYER",
        comment: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        rating: true,
        comment: true,
        reviewerSide: true,
        createdAt: true,
      },
    }),
  ]);

  return fromAgg(
    completedTransactions,
    agg._count._all,
    agg._avg.rating,
    recent
      .filter((row) => Boolean(row.comment))
      .map((row) => ({
        rating: row.rating,
        comment: row.comment as string,
        reviewerSide: row.reviewerSide,
        createdAt: row.createdAt.toISOString(),
      })),
  );
}

export async function getCompanyTrustSummary(
  companyId: string,
): Promise<TrustSummaryWithComments> {
  const [completedTransactions, agg, recent] = await Promise.all([
    countCompletedTransactions({ companyId }),
    prisma.dealReview.aggregate({
      where: {
        targetType: "COMPANY",
        targetCompanyId: companyId,
        reviewerSide: "BUYER",
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.dealReview.findMany({
      where: {
        targetType: "COMPANY",
        targetCompanyId: companyId,
        reviewerSide: "BUYER",
        comment: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        rating: true,
        comment: true,
        reviewerSide: true,
        createdAt: true,
      },
    }),
  ]);

  return fromAgg(
    completedTransactions,
    agg._count._all,
    agg._avg.rating,
    recent
      .filter((row) => Boolean(row.comment))
      .map((row) => ({
        rating: row.rating,
        comment: row.comment as string,
        reviewerSide: row.reviewerSide,
        createdAt: row.createdAt.toISOString(),
      })),
  );
}

export async function getBuyerTrustSummary(
  userId: string,
): Promise<TrustSummaryWithComments> {
  const [completedTransactions, agg] = await Promise.all([
    countCompletedTransactions({ buyerUserId: userId }),
    prisma.dealReview.aggregate({
      where: {
        targetType: "USER",
        targetUserId: userId,
        reviewerSide: "PROVIDER",
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);
  return fromAgg(completedTransactions, agg._count._all, agg._avg.rating);
}

export async function loadProviderTrustSummaries(input: {
  personalUserIds: string[];
  companyIds: string[];
}) {
  const personalIds = [...new Set(input.personalUserIds.filter(Boolean))];
  const companyIds = [...new Set(input.companyIds.filter(Boolean))];
  const personal = new Map<string, TrustSummary>();
  const company = new Map<string, TrustSummary>();

  for (const id of personalIds) personal.set(id, emptySummary());
  for (const id of companyIds) company.set(id, emptySummary());

  const [completedCounts, reviews] = await Promise.all([
    loadCompletedTransactionCounts({
      personalUserIds: personalIds,
      companyIds,
    }),
    personalIds.length || companyIds.length
      ? prisma.dealReview.findMany({
          where: {
            reviewerSide: "BUYER",
            OR: [
              ...(personalIds.length
                ? [{ targetType: "USER" as const, targetUserId: { in: personalIds } }]
                : []),
              ...(companyIds.length
                ? [
                    {
                      targetType: "COMPANY" as const,
                      targetCompanyId: { in: companyIds },
                    },
                  ]
                : []),
            ],
          },
          select: {
            rating: true,
            targetType: true,
            targetUserId: true,
            targetCompanyId: true,
          },
        })
      : Promise.resolve([]),
  ]);

  for (const [id, n] of completedCounts.personal) {
    personal.set(id, { ...emptySummary(n) });
  }
  for (const [id, n] of completedCounts.company) {
    company.set(id, { ...emptySummary(n) });
  }

  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of reviews) {
    const key =
      row.targetType === "COMPANY" && row.targetCompanyId
        ? `c:${row.targetCompanyId}`
        : row.targetUserId
          ? `u:${row.targetUserId}`
          : null;
    if (!key) continue;
    const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += row.rating;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  for (const [key, bucket] of buckets) {
    const avg = roundAverageRating(bucket.sum / bucket.count);
    if (key.startsWith("c:")) {
      const id = key.slice(2);
      const current = company.get(id) ?? emptySummary();
      company.set(id, {
        ...current,
        reviewCount: bucket.count,
        averageRating: avg,
      });
    } else {
      const id = key.slice(2);
      const current = personal.get(id) ?? emptySummary();
      personal.set(id, {
        ...current,
        reviewCount: bucket.count,
        averageRating: avg,
      });
    }
  }

  return { personal, company };
}

export function trustForOfferProvider(
  maps: {
    personal: Map<string, TrustSummary>;
    company: Map<string, TrustSummary>;
  },
  offer: { company?: { id: string } | null; submittedBy: { id: string } },
): TrustSummary {
  if (offer.company) {
    return maps.company.get(offer.company.id) ?? emptyTrustSummary();
  }
  return maps.personal.get(offer.submittedBy.id) ?? emptyTrustSummary();
}
