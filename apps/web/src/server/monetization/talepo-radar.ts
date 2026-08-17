import { primaryRequestCoverImageUrl } from "@/lib/panel/request-cover-image";
import { buildSupplierVisibilityFilter } from "@/lib/membership/assert-entitlement";
import type { EntitlementContext } from "@/lib/membership/types";
import {
  RADAR_CANDIDATE_TAKE,
  RADAR_ELIGIBLE_OFFER_STATUSES,
  RADAR_MIN_ELIGIBLE_OFFERS,
  RADAR_VELOCITY_WINDOW_HOURS,
  classifyRadarSignal,
  compareRadarItems,
} from "@/lib/monetization/talepo-radar";
import { prisma } from "@/lib/prisma";

import type { OpportunityFeedItem } from "./opportunities-feed";
import type { OpportunityIntelligence } from "./opportunity-intelligence";
import { attributedRequestDetailHref } from "@/server/offer/attributed-request-href";

function radarNeutralIntelligence(
  context: "PERSONAL" | "WORKSPACE",
): OpportunityIntelligence {
  return {
    context,
    opportunityScore: 0,
    confidence: 1,
    fitLevel: "UNKNOWN",
    reasons: [],
    risks: [],
    signals: [],
    recommendedAction: "REVIEW_REQUEST",
    recommendedActionReason:
      "Bu talep olağan dışı ilgi görüyor. İncelemeye değer olabilir.",
    urgency: "UNKNOWN",
    urgencyReason: "",
    pricePosition: "UNKNOWN",
    inventoryFit: "UNKNOWN",
    nextBestAction: "Talep detayını incele.",
  };
}

function formatBudget(
  min: number | null,
  max: number | null,
  currency: string,
): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(max ?? min ?? 0);
}

/**
 * Marketplace activity feed for Talepo Radar.
 * Does not use SavedSearch / AlertRule / personal match.
 * Request.offerCount is a cheap prefilter only; displayed count is eligible recount.
 */
export async function loadTalepoRadarFeed(input: {
  userId: string;
  companyId?: string | null;
  entitlements: EntitlementContext;
  limit?: number;
}): Promise<OpportunityFeedItem[]> {
  const limit = input.limit ?? RADAR_CANDIDATE_TAKE;
  const companyId = input.companyId ?? null;
  const visibility = buildSupplierVisibilityFilter(input.entitlements);

  const candidates = await prisma.request.findMany({
    where: {
      deletedAt: null,
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      createdById: { not: input.userId },
      offerCount: { gte: RADAR_MIN_ELIGIBLE_OFFERS },
      ...visibility,
      ...(companyId
        ? {
            OR: [{ companyId: null }, { companyId: { not: companyId } }],
          }
        : {}),
    },
    orderBy: [{ offerCount: "desc" }, { publishedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      city: true,
      isUrgent: true,
      budgetMin: true,
      budgetMax: true,
      currency: true,
      publishedAt: true,
      createdAt: true,
      category: { select: { name: true, slug: true } },
      coverImageUrl: true,
    },
  });

  if (candidates.length === 0) return [];

  const ids = candidates.map((row) => row.id);
  const windowStart = new Date(
    Date.now() - RADAR_VELOCITY_WINDOW_HOURS * 60 * 60 * 1000,
  );

  const [eligibleGroups, recentGroups, offeredRows] = await Promise.all([
    prisma.offer.groupBy({
      by: ["requestId"],
      where: {
        requestId: { in: ids },
        status: { in: [...RADAR_ELIGIBLE_OFFER_STATUSES] },
      },
      _count: { _all: true },
    }),
    prisma.offer.groupBy({
      by: ["requestId"],
      where: {
        requestId: { in: ids },
        status: { in: [...RADAR_ELIGIBLE_OFFER_STATUSES] },
        submittedAt: { gte: windowStart },
      },
      _count: { _all: true },
    }),
    prisma.offer.findMany({
      where: {
        requestId: { in: ids },
        status: { in: [...RADAR_ELIGIBLE_OFFER_STATUSES] },
        ...(companyId
          ? { companyId }
          : { submittedById: input.userId, companyId: null }),
      },
      select: { requestId: true },
      distinct: ["requestId"],
    }),
  ]);

  const eligibleByRequest = new Map(
    eligibleGroups.map((row) => [row.requestId, row._count._all]),
  );
  const recentByRequest = new Map(
    recentGroups.map((row) => [row.requestId, row._count._all]),
  );
  const alreadyOffered = new Set(offeredRows.map((row) => row.requestId));
  const context = companyId ? "WORKSPACE" : "PERSONAL";

  const items: OpportunityFeedItem[] = [];

  for (const req of candidates) {
    const eligibleOfferCount = eligibleByRequest.get(req.id) ?? 0;
    const recentOfferCount = recentByRequest.get(req.id) ?? 0;
    const signal = classifyRadarSignal({
      eligibleOfferCount,
      recentOfferCount,
    });
    if (!signal) continue;

    const budgetMin = req.budgetMin?.toNumber() ?? null;
    const budgetMax = req.budgetMax?.toNumber() ?? null;
    const offered = alreadyOffered.has(req.id);

    items.push({
      requestId: req.id,
      title: req.title,
      categoryName: req.category.name,
      categorySlug: req.category.slug,
      coverImageUrl: primaryRequestCoverImageUrl(req.coverImageUrl),
      city: req.city,
      isUrgent: req.isUrgent,
      budgetLabel: formatBudget(budgetMin, budgetMax, req.currency),
      budgetMin,
      budgetMax,
      offerCount: eligibleOfferCount,
      publishedAt: req.publishedAt,
      createdAt: req.createdAt,
      matchScore: null,
      matchReasons: [signal.reason],
      opportunityScore: 0,
      opportunityClassification: "NORMAL",
      opportunityReasons: [],
      competition:
        eligibleOfferCount >= 6
          ? "HIGH"
          : eligibleOfferCount >= 3
            ? "MEDIUM"
            : "LOW",
      budgetStatus: "UNKNOWN",
      isWatchlisted: false,
      alreadyOffered: offered,
      recentChanges: [],
      intelligence: radarNeutralIntelligence(context),
      context,
      radar: {
        tier: signal.tier,
        reason: signal.reason,
        label: signal.label,
        eligibleOfferCount,
        recentOfferCount,
        alreadyOffered: offered,
      },
      attributedDetailHref: attributedRequestDetailHref({
        userId: input.userId,
        requestId: req.id,
        source: "RADAR",
        radarTier: signal.tier,
      }),
    });
  }

  items.sort((a, b) =>
    compareRadarItems(
      {
        tier: a.radar?.tier ?? "NONE",
        alreadyOffered: a.radar?.alreadyOffered ?? false,
        recentOfferCount: a.radar?.recentOfferCount ?? null,
        eligibleOfferCount: a.radar?.eligibleOfferCount ?? a.offerCount,
        publishedAtMs: new Date(a.publishedAt ?? a.createdAt).getTime(),
      },
      {
        tier: b.radar?.tier ?? "NONE",
        alreadyOffered: b.radar?.alreadyOffered ?? false,
        recentOfferCount: b.radar?.recentOfferCount ?? null,
        eligibleOfferCount: b.radar?.eligibleOfferCount ?? b.offerCount,
        publishedAtMs: new Date(b.publishedAt ?? b.createdAt).getTime(),
      },
    ),
  );

  return items;
}
