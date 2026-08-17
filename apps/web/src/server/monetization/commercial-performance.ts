import type { Prisma } from "@/generated/prisma/client";
import { BILATERAL_COMPLETED_WHERE } from "@/lib/offer/deal-completion";
import {
  ANALIZ_MIN_CATEGORY_RANK_SAMPLE,
  ANALIZ_MIN_WIN_RATE_SAMPLE,
  averageRelativePriceDelta,
  buildCommercialInsights,
  cohortWinRate,
} from "@/lib/monetization/performance-metrics";
import type {
  CategoryPerformanceRow,
  CommercialPerformanceMetrics,
  CurrencyVolumeMetrics,
} from "@/lib/monetization/types";
import { prisma } from "@/lib/prisma";
import {
  getCompanyTrustSummary,
  getUserTrustSummary,
} from "@/server/offer/trust-summary";
import type { AnalyticsOwner } from "@/server/monetization/professional-analytics";

function offerOwnerWhere(owner: AnalyticsOwner): Prisma.OfferWhereInput {
  if (owner.scope === "personal") {
    return { submittedById: owner.userId, companyId: null };
  }
  return { companyId: owner.companyId };
}

function submittedCohortWhere(
  owner: AnalyticsOwner,
  from: Date,
  to: Date,
): Prisma.OfferWhereInput {
  return {
    ...offerOwnerWhere(owner),
    submittedAt: { gte: from, lte: to },
    status: { not: "DRAFT" },
  };
}

function decimalToNumber(value: { toNumber(): number } | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = value.toNumber();
  return Number.isFinite(n) ? n : null;
}

function toVolumeRow(input: {
  currency: string;
  dealCount: number;
  total: number | null;
  average: number | null;
}): CurrencyVolumeMetrics {
  const total = input.total ?? 0;
  const average =
    input.dealCount > 0 && input.average != null
      ? Math.round(input.average * 100) / 100
      : input.dealCount > 0 && total > 0
        ? Math.round((total / input.dealCount) * 100) / 100
        : null;
  return {
    currency: input.currency,
    dealCount: input.dealCount,
    totalAgreedAmount: Math.round(total * 100) / 100,
    averageAgreedAmount: average,
  };
}

async function loadCategoryRows(
  owner: AnalyticsOwner,
  from: Date,
  to: Date,
): Promise<CategoryPerformanceRow[]> {
  const rows =
    owner.scope === "personal"
      ? await prisma.$queryRaw<
          {
            categoryId: string;
            categoryName: string;
            submitted: number;
            accepted: number;
            completed: number;
          }[]
        >`
          SELECT
            c.id AS "categoryId",
            c.name AS "categoryName",
            COUNT(*)::int AS submitted,
            COUNT(*) FILTER (WHERE o.status = 'ACCEPTED')::int AS accepted,
            COUNT(*) FILTER (
              WHERE d.status = 'COMPLETED'
                AND d."confirmationLevel" = 'BOTH_CONFIRMED'
                AND d."completedAt" IS NOT NULL
                AND d."buyerConfirmedAt" IS NOT NULL
                AND d."supplierConfirmedAt" IS NOT NULL
            )::int AS completed
          FROM "Offer" o
          INNER JOIN "Request" r ON r.id = o."requestId"
          INNER JOIN "Category" c ON c.id = r."categoryId"
          LEFT JOIN "DealOutcome" d ON d."offerId" = o.id
          WHERE o."submittedById" = ${owner.userId}
            AND o."companyId" IS NULL
            AND o.status <> 'DRAFT'
            AND o."submittedAt" IS NOT NULL
            AND o."submittedAt" >= ${from}
            AND o."submittedAt" <= ${to}
          GROUP BY c.id, c.name
          ORDER BY submitted DESC
          LIMIT 8
        `
      : await prisma.$queryRaw<
          {
            categoryId: string;
            categoryName: string;
            submitted: number;
            accepted: number;
            completed: number;
          }[]
        >`
          SELECT
            c.id AS "categoryId",
            c.name AS "categoryName",
            COUNT(*)::int AS submitted,
            COUNT(*) FILTER (WHERE o.status = 'ACCEPTED')::int AS accepted,
            COUNT(*) FILTER (
              WHERE d.status = 'COMPLETED'
                AND d."confirmationLevel" = 'BOTH_CONFIRMED'
                AND d."completedAt" IS NOT NULL
                AND d."buyerConfirmedAt" IS NOT NULL
                AND d."supplierConfirmedAt" IS NOT NULL
            )::int AS completed
          FROM "Offer" o
          INNER JOIN "Request" r ON r.id = o."requestId"
          INNER JOIN "Category" c ON c.id = r."categoryId"
          LEFT JOIN "DealOutcome" d ON d."offerId" = o.id
          WHERE o."companyId" = ${owner.companyId}
            AND o.status <> 'DRAFT'
            AND o."submittedAt" IS NOT NULL
            AND o."submittedAt" >= ${from}
            AND o."submittedAt" <= ${to}
          GROUP BY c.id, c.name
          ORDER BY submitted DESC
          LIMIT 8
        `;

  return rows.map((row) => {
    const win = cohortWinRate(row.accepted, row.submitted);
    return {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      submitted: row.submitted,
      accepted: row.accepted,
      completed: row.completed,
      winRate: win.rate,
      winRatePresentation: win.presentation,
      rankEligible: row.submitted >= ANALIZ_MIN_CATEGORY_RANK_SAMPLE,
    };
  });
}

/**
 * Professional commercial intelligence for the selected window.
 * Uses DealOutcome.agreedPrice for money and bilateral completion only.
 * No source attribution claims (discovery feed, saved search, opportunity match).
 */
export async function getCommercialPerformance(
  owner: AnalyticsOwner,
  from: Date,
  to: Date,
): Promise<CommercialPerformanceMetrics> {
  const offerWhere = offerOwnerWhere(owner);
  const cohortWhere = submittedCohortWhere(owner, from, to);
  const completedWhere = {
    ...BILATERAL_COMPLETED_WHERE,
    completedAt: { gte: from, lte: to },
    offer: offerWhere,
  } satisfies Prisma.DealOutcomeWhereInput;

  const [
    completedDeals,
    completedFromSubmittedCohort,
    submitted,
    accepted,
    volumeGroups,
    negotiatedCompleted,
    negotiatedPriceRows,
    categories,
    trustRaw,
  ] = await Promise.all([
    prisma.dealOutcome.count({ where: completedWhere }),
    prisma.offer.count({
      where: {
        ...cohortWhere,
        dealOutcome: { ...BILATERAL_COMPLETED_WHERE },
      },
    }),
    prisma.offer.count({ where: cohortWhere }),
    prisma.offer.count({
      where: { ...cohortWhere, status: "ACCEPTED" },
    }),
    prisma.dealOutcome.groupBy({
      by: ["currency"],
      where: {
        ...completedWhere,
        agreedPrice: { not: null },
      },
      _sum: { agreedPrice: true },
      _avg: { agreedPrice: true },
      _count: { _all: true },
    }),
    prisma.dealOutcome.count({
      where: {
        ...completedWhere,
        offer: {
          ...offerWhere,
          negotiations: { some: { status: "ACCEPTED" } },
        },
      },
    }),
    prisma.dealOutcome.findMany({
      where: {
        ...completedWhere,
        agreedPrice: { not: null },
        offer: {
          ...offerWhere,
          negotiations: { some: { status: "ACCEPTED" } },
        },
      },
      select: {
        agreedPrice: true,
        offer: { select: { amount: true } },
      },
    }),
    loadCategoryRows(owner, from, to),
    owner.scope === "personal"
      ? getUserTrustSummary(owner.userId)
      : getCompanyTrustSummary(owner.companyId),
  ]);

  const volumesByCurrency = volumeGroups
    .map((row) =>
      toVolumeRow({
        currency: row.currency,
        dealCount: row._count._all,
        total: decimalToNumber(row._sum.agreedPrice),
        average: decimalToNumber(row._avg.agreedPrice),
      }),
    )
    .filter((row) => row.dealCount > 0)
    .sort((a, b) => b.dealCount - a.dealCount);

  const mixedCurrency = volumesByCurrency.length > 1;
  const primaryVolume =
    volumesByCurrency.length === 1 ? volumesByCurrency[0] : null;

  const directCompleted = Math.max(0, completedDeals - negotiatedCompleted);

  const negotiationPriceDelta = averageRelativePriceDelta(
    negotiatedPriceRows.map((row) => ({
      firstAmount: Number(row.offer.amount),
      agreedAmount: decimalToNumber(row.agreedPrice) ?? 0,
    })),
  );

  const completion = cohortWinRate(
    completedFromSubmittedCohort,
    submitted,
    ANALIZ_MIN_WIN_RATE_SAMPLE,
  );

  const topCategory =
    categories.find((row) => row.rankEligible) ??
    (categories[0] && categories[0].submitted > 0 ? categories[0] : null);

  const insights = buildCommercialInsights({
    submitted,
    accepted,
    completedInWindow: completedDeals,
    completedFromSubmittedCohort,
    negotiatedCompleted,
    directCompleted,
    negotiationDelta: negotiationPriceDelta,
    negotiationDeltaSample: negotiatedPriceRows.length,
    primaryVolumeTotal: primaryVolume?.totalAgreedAmount ?? null,
    primaryVolumeCurrency: primaryVolume?.currency ?? null,
    topCategory: topCategory
      ? {
          name: topCategory.categoryName,
          submitted: topCategory.submitted,
          accepted: topCategory.accepted,
        }
      : null,
  });

  return {
    completedDeals,
    completedFromSubmittedCohort,
    completionRate: completion.rate,
    completionRatePresentation: completion.presentation,
    volumesByCurrency,
    primaryVolume,
    mixedCurrency,
    directCompleted,
    negotiatedCompleted,
    negotiationPriceDelta,
    negotiationPriceDeltaSample: negotiatedPriceRows.length,
    categories,
    insights,
    trust: {
      completedTransactions: trustRaw.completedTransactions,
      reviewCount: trustRaw.reviewCount,
      averageRating: trustRaw.averageRating,
    },
  };
}
