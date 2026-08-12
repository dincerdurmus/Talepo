/**
 * Phase 3C — Corporate Opportunity Center query layer.
 * Reuses OpportunityMatch + discoveryProjection — no second matching brain.
 */

import {
  matchBandFromSignals,
  parseDiscoveryProjection,
  taxonomyPathLabels,
  type DiscoveryMatchBand,
} from "@/lib/discovery";
import { prisma } from "@/lib/prisma";

export type CorporateOpportunityFilter =
  | "all"
  | "new"
  | "unassigned"
  | "assigned"
  | "assigned_to_me"
  | "following"
  | "offered";

export type CorporateTeamMemberOption = {
  id: string;
  label: string;
  role: string;
  load: number;
};

export type CorporateOpportunityItem = {
  opportunityId: string;
  requestId: string;
  title: string;
  city: string | null;
  isUrgent: boolean;
  categoryName: string;
  taxonomyPathLabels: string[];
  source: "ALERT_RULE" | "COMPANY_PROFILE" | "INVENTORY";
  status: "NEW" | "VIEWED" | "DISMISSED" | "CONTACTED";
  matchStatus: "NEW" | "VIEWED" | "DISMISSED" | "CONTACTED";
  assignedToMemberId: string | null;
  assignedToLabel: string | null;
  assignedAtProxy: string | null;
  reasonCodes: string[];
  reasonLabels: string[];
  priorityBand: DiscoveryMatchBand | null;
  offerStatus: string | null;
  offerStatusLabel: string | null;
  isWatchlisted: boolean;
  budgetLabel: string | null;
  publishedAt: Date | null;
  createdAt: Date;
};

export type CorporateOpportunitySummary = {
  newCount: number;
  unassignedCount: number;
  assignedCount: number;
  assignedToMeCount: number;
  followingCount: number;
  offeredCount: number;
  trackedCategoryCount: number;
  alertCount: number;
};

export type CorporateOpportunityCenterData = {
  summary: CorporateOpportunitySummary;
  items: CorporateOpportunityItem[];
  teamMembers: CorporateTeamMemberOption[];
  currentMemberId: string | null;
};

const OFFER_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  SUBMITTED: "Teklif verildi",
  VIEWED: "Görüldü",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Geri çekildi",
  EXPIRED: "Süresi doldu",
};

const SOURCE_REASON: Record<string, string> = {
  ALERT_RULE: "Takip / alarm kuralı",
  COMPANY_PROFILE: "Şirket profili",
  INVENTORY: "Envanterinizle eşleşiyor",
};

function formatBudget(
  min: { toNumber(): number } | null,
  max: { toNumber(): number } | null,
  currency: string,
): string | null {
  const a = min?.toNumber() ?? null;
  const b = max?.toNumber() ?? null;
  if (a == null && b == null) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  if (a != null && b != null) return `${fmt(a)} – ${fmt(b)}`;
  return fmt(b ?? a ?? 0);
}

function reasonLabelsFromMatch(
  source: string,
  reasons: unknown,
  pathLabels: string[],
): { codes: string[]; labels: string[] } {
  const codes: string[] = [];
  const labels: string[] = [];
  if (source === "INVENTORY") {
    codes.push("INVENTORY_RELEVANT");
    labels.push(SOURCE_REASON.INVENTORY);
  }
  if (source === "ALERT_RULE") {
    codes.push("TRACKED_CATEGORY");
    labels.push(SOURCE_REASON.ALERT_RULE);
  }
  if (pathLabels.length) {
    codes.push("TAXONOMY_MATCH");
    labels.push("Ürün grubunuzla eşleşiyor");
  }
  if (Array.isArray(reasons)) {
    for (const r of reasons.slice(0, 8)) {
      if (typeof r !== "string") continue;
      if (
        /TAXONOMY_EXACT|TAXONOMY_ANCESTOR|canonical|taxonomy|CANONICAL/i.test(r)
      ) {
        codes.push("TAXONOMY_MATCH");
      }
      if (/ENTITY_BRAND_MATCH|ENTITY_MODEL_MATCH|COMPATIBILITY_TARGET/i.test(r)) {
        codes.push("ENTITY_MATCH");
      }
      if (/SUBJECT_MATCH/i.test(r)) {
        codes.push("SUBJECT_MATCH");
      }
      if (/PREFERENCE_MATCH/i.test(r)) {
        codes.push("PREFERENCE_MATCH");
      }
      if (/LEGACY_FALLBACK/i.test(r)) {
        codes.push("LEGACY_FALLBACK");
      }
      if (/istanbul|şehir|city|konum|LOCATION/i.test(r)) {
        codes.push("LOCATION_MATCH");
        labels.push("Konum eşleşiyor");
      }
      if (/acil|urgent/i.test(r)) {
        codes.push("URGENT_REQUEST");
        labels.push("Acil talep");
      }
      if (/INVENTORY_RELEVANT|envanter|inventory/i.test(r)) {
        codes.push("INVENTORY_RELEVANT");
      }
      // Human labels from evaluator (Turkish) — skip raw reason codes
      if (
        !labels.includes(r) &&
        !/^[A-Z][A-Z0-9_]+$/.test(r) &&
        !/LEGACY_FALLBACK|score|%/i.test(r) &&
        labels.length < 4
      ) {
        labels.push(r);
      }
    }
  }
  return {
    codes: [...new Set(codes)],
    labels: [...new Set(labels)].slice(0, 4),
  };
}

export async function buildCorporateOpportunityCenter(input: {
  companyId: string;
  userId: string;
  filter?: CorporateOpportunityFilter;
  limit?: number;
}): Promise<CorporateOpportunityCenterData> {
  const limit = input.limit ?? 40;
  const filter = input.filter ?? "all";

  const currentMember = await prisma.companyMember.findFirst({
    where: {
      companyId: input.companyId,
      userId: input.userId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const [
    matches,
    watchlist,
    offers,
    team,
    trackedCategoryCount,
    alertCount,
  ] = await Promise.all([
    prisma.opportunityMatch.findMany({
      where: {
        companyId: input.companyId,
        status: { not: "DISMISSED" },
      },
      orderBy: [{ createdAt: "desc" }, { score: "desc" }],
      take: 120,
      include: {
        request: {
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
            discoveryProjection: true,
            category: { select: { name: true } },
          },
        },
        assignedToMember: {
          select: {
            id: true,
            role: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.opportunityWatchlistItem.findMany({
      where: { companyId: input.companyId },
      select: { requestId: true },
    }),
    prisma.offer.findMany({
      where: {
        companyId: input.companyId,
        status: { notIn: ["DRAFT", "WITHDRAWN"] },
      },
      select: { requestId: true, status: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.companyMember.findMany({
      where: { companyId: input.companyId, status: "ACTIVE" },
      select: {
        id: true,
        role: true,
        user: { select: { name: true, email: true } },
        _count: { select: { assignedOpportunities: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.savedSearch.count({
      where: { companyId: input.companyId, isActive: true },
    }),
    prisma.alertRule.count({
      where: { companyId: input.companyId, isActive: true },
    }),
  ]);

  const watchSet = new Set(watchlist.map((w) => w.requestId));
  const offerByRequest = new Map<string, string>();
  for (const o of offers) {
    if (!offerByRequest.has(o.requestId)) {
      offerByRequest.set(o.requestId, o.status);
    }
  }

  // Deduplicate by requestId — prefer ALERT_RULE > INVENTORY > PROFILE
  const sourceRank = { ALERT_RULE: 0, INVENTORY: 1, COMPANY_PROFILE: 2 } as const;
  const bestByRequest = new Map<string, (typeof matches)[number]>();
  for (const m of matches) {
    const prev = bestByRequest.get(m.requestId);
    if (!prev || sourceRank[m.source] < sourceRank[prev.source]) {
      bestByRequest.set(m.requestId, m);
    }
  }

  let items: CorporateOpportunityItem[] = [];
  for (const m of bestByRequest.values()) {
    const projection = parseDiscoveryProjection(m.request.discoveryProjection);
    const pathLabels = projection
      ? taxonomyPathLabels(projection.taxonomyNodeIds)
      : [];
    const { codes, labels } = reasonLabelsFromMatch(
      m.source,
      m.reasons,
      pathLabels,
    );
    if (m.request.isUrgent) {
      codes.push("URGENT_REQUEST");
      if (!labels.includes("Acil talep")) labels.push("Acil talep");
    }
    if (m.request.city) {
      codes.push("LOCATION_MATCH");
    }

    const offerStatus = offerByRequest.get(m.requestId) ?? null;
    const assigneeLabel = m.assignedToMember
      ? m.assignedToMember.user.name?.trim() ||
        m.assignedToMember.user.email ||
        "Üye"
      : null;

    const priorityBand = matchBandFromSignals({
      matchPath: projection ? "CANONICAL_MATCH" : "LEGACY_FALLBACK",
      reasonCodes: codes,
      hasTaxonomy: pathLabels.length > 0,
      hasLocation: Boolean(m.request.city),
    });

    items.push({
      opportunityId: m.id,
      requestId: m.requestId,
      title: m.request.title,
      city: m.request.city,
      isUrgent: m.request.isUrgent,
      categoryName: m.request.category.name,
      taxonomyPathLabels: pathLabels,
      source: m.source,
      status: m.status,
      matchStatus: m.status,
      assignedToMemberId: m.assignedToMemberId,
      assignedToLabel: assigneeLabel,
      assignedAtProxy: m.assignedToMemberId ? m.updatedAt.toISOString() : null,
      reasonCodes: [...new Set(codes)],
      reasonLabels: labels.slice(0, 4),
      priorityBand,
      offerStatus,
      offerStatusLabel: offerStatus ? OFFER_LABELS[offerStatus] ?? offerStatus : null,
      isWatchlisted: watchSet.has(m.requestId),
      budgetLabel: formatBudget(
        m.request.budgetMin,
        m.request.budgetMax,
        m.request.currency,
      ),
      publishedAt: m.request.publishedAt,
      createdAt: m.createdAt,
    });
  }

  const summary: CorporateOpportunitySummary = {
    newCount: items.filter((i) => i.matchStatus === "NEW").length,
    unassignedCount: items.filter((i) => !i.assignedToMemberId).length,
    assignedCount: items.filter((i) => Boolean(i.assignedToMemberId)).length,
    assignedToMeCount: items.filter(
      (i) =>
        currentMember && i.assignedToMemberId === currentMember.id,
    ).length,
    followingCount: items.filter((i) => i.isWatchlisted).length,
    offeredCount: items.filter((i) => Boolean(i.offerStatus)).length,
    trackedCategoryCount,
    alertCount,
  };

  if (filter === "new") {
    items = items.filter((i) => i.matchStatus === "NEW");
  } else if (filter === "unassigned") {
    items = items.filter((i) => !i.assignedToMemberId);
  } else if (filter === "assigned") {
    items = items.filter((i) => Boolean(i.assignedToMemberId));
  } else if (filter === "assigned_to_me") {
    items = items.filter(
      (i) => currentMember && i.assignedToMemberId === currentMember.id,
    );
  } else if (filter === "following") {
    items = items.filter((i) => i.isWatchlisted);
  } else if (filter === "offered") {
    items = items.filter((i) => Boolean(i.offerStatus));
  }

  items = items.slice(0, limit);

  const teamMembers: CorporateTeamMemberOption[] = team.map((m) => ({
    id: m.id,
    label: m.user.name?.trim() || m.user.email || "Üye",
    role: m.role,
    load: m._count.assignedOpportunities,
  }));

  return {
    summary,
    items,
    teamMembers,
    currentMemberId: currentMember?.id ?? null,
  };
}
