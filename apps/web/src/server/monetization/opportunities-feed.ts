import { primaryRequestCoverImageUrl } from "@/lib/panel/request-cover-image";
import { prisma } from "@/lib/prisma";

import { evaluateBudgetOpportunity } from "./budget-opportunity";
import { getCompetitionSignals } from "./competition-signals";
import { matchCompanyToRequest } from "./smart-matching";
import { scoreOpportunity } from "./opportunity-score";
import { buildOpportunityIntelligence, type OpportunityIntelligence } from "./opportunity-intelligence";
import { matchPersonalToRequest } from "./personal-matching";

export type OpportunityFeedItem = {
  requestId: string;
  title: string;
  categoryName: string;
  categorySlug: string | null;
  coverImageUrl: string | null;
  city: string | null;
  isUrgent: boolean;
  budgetLabel: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  offerCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  matchScore: number | null;
  matchReasons: string[];
  opportunityScore: number;
  opportunityClassification: "NORMAL" | "GOOD" | "HOT";
  opportunityReasons: string[];
  competition: "LOW" | "MEDIUM" | "HIGH";
  budgetStatus: "UNKNOWN" | "BELOW_MARKET" | "MARKET" | "ABOVE_MARKET";
  isWatchlisted: boolean;
  recentChanges: { field: string; label: string; oldValue: string | null; newValue: string | null }[];
  intelligence: OpportunityIntelligence;
  context: "PERSONAL" | "WORKSPACE";
};

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

const CHANGE_LABELS: Record<string, string> = {
  budgetMin: "Minimum bütçe",
  budgetMax: "Bütçe",
  isUrgent: "Acil durum",
  deadlineAt: "Teslim tarihi",
  status: "Durum",
};

export async function buildOpportunitiesFeed(
  companyId?: string,
  userId?: string,
  options?: { limit?: number; watchlistOnly?: boolean },
): Promise<OpportunityFeedItem[]> {
  const limit = options?.limit ?? 40;

  const watchlistIds = new Set(
    (
      await prisma.opportunityWatchlistItem.findMany({
        where: companyId ? { companyId } : { id: "__personal_watchlist_deferred__" },
        select: { requestId: true },
      })
    ).map((w) => w.requestId),
  );

  const openWhere = {
    deletedAt: null,
    status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] as ("PUBLISHED" | "RECEIVING_OFFERS")[] },
  };

  let requestIds: string[] = [];

  if (options?.watchlistOnly) {
    requestIds = [...watchlistIds];
  } else {
    const [matches, openRequests] = await Promise.all([
      companyId ? prisma.opportunityMatch.findMany({
        where: { companyId },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: { requestId: true },
      }) : Promise.resolve([] as { requestId: string }[]),
      prisma.request.findMany({
        where: openWhere,
        orderBy: [{ isUrgent: "desc" }, { publishedAt: "desc" }],
        take: limit,
        select: { id: true },
      }),
    ]);
    requestIds = [
      ...new Set([
        ...matches.map((m) => m.requestId),
        ...openRequests.map((r) => r.id),
        ...watchlistIds,
      ]),
    ].slice(0, limit * 2);
  }

  if (requestIds.length === 0) return [];

  const requests = await prisma.request.findMany({
    where: { id: { in: requestIds }, ...openWhere },
    select: {
      id: true,
      title: true,
      city: true,
      isUrgent: true,
      aiScore: true,
      budgetMin: true,
      budgetMax: true,
      currency: true,
      offerCount: true,
      viewCount: true,
      publishedAt: true,
      createdAt: true,
      category: { select: { name: true, slug: true } },
      coverImageUrl: true,
    },
  });

  const changes = await prisma.requestChange.findMany({
    where: {
      requestId: { in: requests.map((r) => r.id) },
      createdAt: { gte: new Date(Date.now() - 14 * 86400000) },
    },
    orderBy: { createdAt: "desc" },
  });

  const changesByRequest = new Map<string, typeof changes>();
  for (const c of changes) {
    const list = changesByRequest.get(c.requestId) ?? [];
    if (list.length < 5) list.push(c);
    changesByRequest.set(c.requestId, list);
  }

  const items: OpportunityFeedItem[] = [];

  for (const req of requests) {
    const match = companyId ? await matchCompanyToRequest(companyId, req.id) : null;
    const personalMatch = !companyId && userId ? await matchPersonalToRequest(userId, req.id) : null;
    const matchScore = companyId ? match?.score ?? null : personalMatch?.score ?? null;
    const matchReasons = companyId ? match?.reasons ?? [] : personalMatch?.reasons ?? [];

    const budgetMin = req.budgetMin?.toNumber() ?? null;
    const budgetMax = req.budgetMax?.toNumber() ?? null;

    const opp = await scoreOpportunity({
      request: {
        id: req.id,
        aiScore: req.aiScore,
        isUrgent: req.isUrgent,
        budgetMin,
        budgetMax,
        offerCount: req.offerCount,
        viewCount: req.viewCount,
        publishedAt: req.publishedAt,
        createdAt: req.createdAt,
      },
      companyId,
    });

    const competition = getCompetitionSignals({
      offerCount: req.offerCount,
      viewCount: req.viewCount,
    });

    const budgetEval = evaluateBudgetOpportunity({
      budgetMin,
      budgetMax,
    });

    const intelligence = buildOpportunityIntelligence({
      context: companyId ? "WORKSPACE" : "PERSONAL",
      matchScore,
      matchReasons,
      isUrgent: req.isUrgent,
      requestCompleteness: req.aiScore,
      ageHours: (Date.now() - (req.publishedAt ?? req.createdAt).getTime()) / 3600000,
      inventoryFit: "UNKNOWN",
      pricePosition: budgetEval.status,
      priceConfidence: budgetEval.confidence,
      offerCount: req.offerCount,
    });

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
      offerCount: req.offerCount,
      publishedAt: req.publishedAt,
      createdAt: req.createdAt,
      matchScore,
      matchReasons,
      opportunityScore: opp.score,
      opportunityClassification: opp.classification,
      opportunityReasons: opp.reasons,
      competition: competition.estimatedCompetition,
      budgetStatus: budgetEval.status,
      isWatchlisted: watchlistIds.has(req.id),
      recentChanges: (changesByRequest.get(req.id) ?? []).map((c) => ({
        field: c.field,
        label: CHANGE_LABELS[c.field] ?? c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
      })),
      intelligence,
      context: companyId ? "WORKSPACE" : "PERSONAL",
    });
  }

  return items
    .sort((a, b) => {
      const classRank = { HOT: 3, GOOD: 2, NORMAL: 1 };
      const diff =
        classRank[b.opportunityClassification] -
        classRank[a.opportunityClassification];
      if (diff !== 0) return diff;
      return b.opportunityScore - a.opportunityScore;
    })
    .slice(0, limit);
}
