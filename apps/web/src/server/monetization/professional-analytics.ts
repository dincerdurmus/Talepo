import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { summarizeOfferCohort } from "@/lib/monetization/performance-metrics";
import type { WorkspacePerformanceMetrics } from "@/lib/monetization/types";

const ACTIVE_REQUEST_STATUSES = [
  "PUBLISHED",
  "RECEIVING_OFFERS",
  "OFFER_SELECTED",
  "IN_PROGRESS",
] as const;

const ACCEPTED_REQUEST_STATUSES = [
  "OFFER_SELECTED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export type AnalyticsOwner =
  | { scope: "personal"; userId: string }
  | { scope: "company"; companyId: string; companyName: string };

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

async function offerLatencyHours(
  owner: AnalyticsOwner,
  from: Date,
  to: Date,
): Promise<number | null> {
  const rows =
    owner.scope === "personal"
      ? await prisma.$queryRaw<{ hours: number | null }[]>`
          SELECT AVG(
            EXTRACT(EPOCH FROM (o."submittedAt" - r."publishedAt")) / 3600.0
          )::float AS hours
          FROM "Offer" o
          INNER JOIN "Request" r ON r.id = o."requestId"
          WHERE o."submittedById" = ${owner.userId}
            AND o."companyId" IS NULL
            AND o.status <> 'DRAFT'
            AND o."submittedAt" IS NOT NULL
            AND o."submittedAt" >= ${from}
            AND o."submittedAt" <= ${to}
            AND r."publishedAt" IS NOT NULL
            AND o."submittedAt" >= r."publishedAt"
        `
      : await prisma.$queryRaw<{ hours: number | null }[]>`
          SELECT AVG(
            EXTRACT(EPOCH FROM (o."submittedAt" - r."publishedAt")) / 3600.0
          )::float AS hours
          FROM "Offer" o
          INNER JOIN "Request" r ON r.id = o."requestId"
          WHERE o."companyId" = ${owner.companyId}
            AND o.status <> 'DRAFT'
            AND o."submittedAt" IS NOT NULL
            AND o."submittedAt" >= ${from}
            AND o."submittedAt" <= ${to}
            AND r."publishedAt" IS NOT NULL
            AND o."submittedAt" >= r."publishedAt"
        `;

  const hours = rows[0]?.hours;
  if (hours == null || !Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * 10) / 10;
}

async function getOfferPerformance(
  owner: AnalyticsOwner,
  from: Date,
  to: Date,
) {
  const grouped = await prisma.offer.groupBy({
    by: ["status"],
    where: submittedCohortWhere(owner, from, to),
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }

  const offers = summarizeOfferCohort(counts);
  const averageOfferLatencyHours = await offerLatencyHours(owner, from, to);

  return { ...offers, averageOfferLatencyHours };
}

async function getPersonalRequestPerformance(
  userId: string,
  from: Date,
  to: Date,
) {
  const publishedWhere = {
    createdById: userId,
    deletedAt: null,
    publishedAt: { gte: from, lte: to },
  } satisfies Prisma.RequestWhereInput;

  const [
    published,
    active,
    withOffers,
    totalOffersReceived,
    acceptedOutcome,
  ] = await Promise.all([
    prisma.request.count({ where: publishedWhere }),
    prisma.request.count({
      where: {
        ...publishedWhere,
        status: { in: [...ACTIVE_REQUEST_STATUSES] },
      },
    }),
    prisma.request.count({
      where: {
        ...publishedWhere,
        offers: { some: { status: { not: "DRAFT" } } },
      },
    }),
    prisma.offer.count({
      where: {
        status: { not: "DRAFT" },
        request: publishedWhere,
      },
    }),
    prisma.request.count({
      where: {
        ...publishedWhere,
        status: { in: [...ACCEPTED_REQUEST_STATUSES] },
      },
    }),
  ]);

  const withoutOffers = Math.max(0, published - withOffers);
  const averageOffersPerRequest =
    published > 0
      ? Math.round((totalOffersReceived / published) * 10) / 10
      : null;

  return {
    published,
    active,
    withOffers,
    withoutOffers,
    totalOffersReceived,
    averageOffersPerRequest,
    acceptedOutcome,
  };
}

export async function getWorkspacePerformance(
  owner: AnalyticsOwner,
  from: Date,
  to: Date,
): Promise<WorkspacePerformanceMetrics> {
  const [offers, requests] = await Promise.all([
    getOfferPerformance(owner, from, to),
    owner.scope === "personal"
      ? getPersonalRequestPerformance(owner.userId, from, to)
      : Promise.resolve(null),
  ]);

  return {
    scope: owner.scope,
    companyName: owner.scope === "company" ? owner.companyName : null,
    requests,
    offers,
  };
}
