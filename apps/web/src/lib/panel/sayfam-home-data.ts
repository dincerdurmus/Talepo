import {
  aggregateIncomingRequestGroups,
  sortIncomingRequestGroups,
  type IncomingRequestGroup,
} from "@/lib/offer/incoming-request-inbox";
import { buildIncomingRequestWorkspacePath } from "@/lib/offer/incoming-offer-inbox";
import { mapIncomingRequestOfferRow, mapIncomingRequestSummary } from "@/lib/offer/incoming-offer-mapper";
import { filterOffersByArchiveView } from "@/lib/offer/offer-archive";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";
import type { BuyerIncomingOfferRow } from "@/server/offer/load-buyer-incoming-offers";
import { loadBuyerIncomingOffers } from "@/server/offer/load-buyer-incoming-offers";
import { prisma } from "@/lib/prisma";

import {
  getPanelSummary,
  getUnreadMessageCount,
} from "@/lib/panel/get-panel-data";
import {
  SAYFAM_ACTIVE_PROCESS_STATUSES,
  SAYFAM_ACTIVITY_MAX_ITEMS,
  SAYFAM_UNAVAILABLE_HINT,
  classifySayfamProcess,
  dedupeSayfamFocusByRequest,
  resolveSayfamHeroHint,
  resolveSayfamProcessHref,
  sayfamProcessPriority,
  sayfamProcessStatusLabel,
  sortSayfamFocusItems,
  toSayfamFocusItems,
  type RankedSayfamFocusItem,
  type SayfamProcessKind,
} from "@/lib/panel/sayfam-focus";
import type {
  SayfamActivityItem,
  SayfamHomeData,
} from "@/lib/panel/sayfam-home-types";

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Az önce";
  if (diffHours < 24) return `${diffHours} sa önce`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Dün";
  if (diffDays < 7) return `${diffDays} g`;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function groupWaitingForCounterparty(group: IncomingRequestGroup): boolean {
  return group.offers.some((offer) => {
    const pending = currentPendingNegotiation(offer.negotiations);
    return pending?.proposedBySide === "BUYER";
  });
}

function incomingWorkspacePath(
  requestId: string,
  filter: "action_required" | "unread" | "new" | "negotiating",
) {
  return buildIncomingRequestWorkspacePath({ requestId, filter });
}

function conversationIdForRequest(
  requestId: string,
  offers: BuyerIncomingOfferRow[],
): string | null {
  const accepted = offers.find(
    (row) => row.request.id === requestId && row.status === "ACCEPTED" && row.conversation?.id,
  );
  if (accepted?.conversation?.id) return accepted.conversation.id;
  const any = offers.find(
    (row) => row.request.id === requestId && row.conversation?.id,
  );
  return any?.conversation?.id ?? null;
}

function resolveFocusDetailLabel(input: {
  kind: SayfamProcessKind;
  totalOffers: number;
  lastActivityLabel: string;
}): string {
  const parts: string[] = [];
  if (input.kind !== "awaiting_offers" && input.totalOffers > 0) {
    parts.push(
      input.totalOffers === 1 ? "1 teklif" : `${input.totalOffers} teklif`,
    );
  }
  if (input.lastActivityLabel) {
    parts.push(`Son güncelleme ${input.lastActivityLabel}`);
  }
  return parts.join(" · ");
}

function rankedItemFromSignals(input: {
  requestId: string;
  title: string;
  categorySlug: string | null;
  categoryName: string | null;
  coverImageUrl: string | null;
  requestStatus: string;
  totalOffers: number;
  actionRequiredCount: number;
  unreadCount: number;
  newCount: number;
  negotiatingCount: number;
  waitingForCounterparty: boolean;
  lastActivityAt: Date;
  lastActivityLabel: string;
  conversationId: string | null;
}): RankedSayfamFocusItem | null {
  const kind = classifySayfamProcess({
    requestStatus: input.requestStatus,
    totalOffers: input.totalOffers,
    actionRequiredCount: input.actionRequiredCount,
    unreadCount: input.unreadCount,
    newCount: input.newCount,
    negotiatingCount: input.negotiatingCount,
    waitingForCounterparty: input.waitingForCounterparty,
  });
  if (!kind) return null;

  return {
    id: input.requestId,
    requestId: input.requestId,
    title: input.title,
    categorySlug: input.categorySlug,
    categoryName: input.categoryName,
    coverImageUrl: input.coverImageUrl,
    statusLabel: sayfamProcessStatusLabel(kind),
    detailLabel: resolveFocusDetailLabel({
      kind,
      totalOffers: input.totalOffers,
      lastActivityLabel: input.lastActivityLabel,
    }),
    href: resolveSayfamProcessHref({
      kind,
      requestId: input.requestId,
      unreadCount: input.unreadCount,
      conversationId: input.conversationId,
      incomingWorkspacePath,
    }),
    priority: sayfamProcessPriority(kind),
    kind,
    lastActivityAt: input.lastActivityAt.getTime(),
  };
}

function aggregateActiveGroups(
  offers: BuyerIncomingOfferRow[],
  unreadOfferIds: ReadonlySet<string>,
) {
  const activeOffers = offers.filter((row) => row.status !== "DRAFT");
  return sortIncomingRequestGroups(
    aggregateIncomingRequestGroups({
      offers: activeOffers.map(mapIncomingRequestOfferRow),
      unreadOfferIds,
      getRequest: (offer) => {
        const source = activeOffers.find((row) => row.id === offer.id);
        if (!source) {
          throw new Error("Incoming offer row missing for request mapping");
        }
        const summary = mapIncomingRequestSummary(source.request);
        return {
          id: summary.id,
          title: summary.title,
          city: summary.city,
          status: summary.status,
          coverImageUrl: summary.coverImageUrl,
          categorySlug: summary.categorySlug,
          categoryName: summary.categoryName,
          budgetLabel: summary.budgetLabel,
          budgetMin: summary.budgetMin,
          budgetMax: summary.budgetMax,
          currency: summary.currency,
        };
      },
    }),
  );
}

function mapGroupToRankedItem(
  group: IncomingRequestGroup,
  offers: BuyerIncomingOfferRow[],
): RankedSayfamFocusItem | null {
  return rankedItemFromSignals({
    requestId: group.request.id,
    title: group.request.title,
    categorySlug: group.request.categorySlug,
    categoryName: group.request.categoryName,
    coverImageUrl: group.request.coverImageUrl,
    requestStatus: group.request.status,
    totalOffers: group.totalOffers,
    actionRequiredCount: group.actionRequiredCount,
    unreadCount: group.unreadCount,
    newCount: group.newCount,
    negotiatingCount: group.negotiatingCount,
    waitingForCounterparty: groupWaitingForCounterparty(group),
    lastActivityAt: group.lastActivityAt,
    lastActivityLabel: group.lastActivityLabel,
    conversationId: conversationIdForRequest(group.request.id, offers),
  });
}

async function loadRemainingActiveProcesses(
  userId: string,
  coveredRequestIds: ReadonlySet<string>,
): Promise<RankedSayfamFocusItem[]> {
  const requests = await prisma.request.findMany({
    where: {
      createdById: userId,
      deletedAt: null,
      status: { in: [...SAYFAM_ACTIVE_PROCESS_STATUSES] },
      ...(coveredRequestIds.size > 0
        ? { id: { notIn: [...coveredRequestIds] } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 24,
    select: {
      id: true,
      title: true,
      status: true,
      coverImageUrl: true,
      updatedAt: true,
      category: { select: { slug: true, name: true } },
      offers: {
        where: { status: "ACCEPTED" },
        take: 1,
        select: { conversation: { select: { id: true } } },
      },
    },
  });

  return requests
    .map((request) =>
      rankedItemFromSignals({
        requestId: request.id,
        title: request.title,
        categorySlug: request.category.slug,
        categoryName: request.category.name,
        coverImageUrl: request.coverImageUrl,
        requestStatus: request.status,
        totalOffers: 0,
        actionRequiredCount: 0,
        unreadCount: 0,
        newCount: 0,
        negotiatingCount: 0,
        waitingForCounterparty: false,
        lastActivityAt: request.updatedAt,
        lastActivityLabel: formatRelativeTime(request.updatedAt),
        conversationId: request.offers[0]?.conversation?.id ?? null,
      }),
    )
    .filter((item): item is RankedSayfamFocusItem => item != null);
}

export async function buildSayfamHomeData(userId: string): Promise<SayfamHomeData> {
  const [summary, unreadMessages, incoming] = await Promise.all([
    getPanelSummary(userId),
    getUnreadMessageCount(userId),
    loadBuyerIncomingOffers(userId),
  ]);

  const visibleOffers = filterOffersByArchiveView(
    incoming.offers,
    incoming.archivedOfferIds,
    "active",
  );

  const sortedGroups = aggregateActiveGroups(
    visibleOffers,
    incoming.unreadOfferIds,
  );

  const fromOffers = sortedGroups
    .map((group) => mapGroupToRankedItem(group, visibleOffers))
    .filter((item): item is RankedSayfamFocusItem => item != null);

  const remaining = await loadRemainingActiveProcesses(
    userId,
    new Set(fromOffers.map((item) => item.requestId)),
  );

  const focusItems = toSayfamFocusItems(
    sortSayfamFocusItems(dedupeSayfamFocusByRequest([...fromOffers, ...remaining])),
  );

  const seenActivity = new Set<string>();
  const activity: SayfamActivityItem[] = [];
  for (const notification of summary.recentNotifications) {
    if (seenActivity.has(notification.id)) continue;
    seenActivity.add(notification.id);
    if (activity.length >= SAYFAM_ACTIVITY_MAX_ITEMS) break;
    activity.push({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      href: `/panel/bildirimler/r/${notification.id}`,
      timeLabel: formatRelativeTime(notification.createdAt),
      unread: notification.status === "UNREAD",
    });
  }

  return {
    metrics: {
      activeRequests: summary.activeRequests,
      actionRequiredOffers: summary.newOffers,
      unreadMessages,
    },
    unreadNotifications: summary.unreadNotifications,
    focusItems,
    activity,
    heroHint: resolveSayfamHeroHint(),
  };
}

export async function buildSayfamHomeDataUnavailable(): Promise<SayfamHomeData> {
  return {
    metrics: {
      activeRequests: 0,
      actionRequiredOffers: 0,
      unreadMessages: 0,
    },
    unreadNotifications: 0,
    focusItems: [],
    activity: [],
    heroHint: SAYFAM_UNAVAILABLE_HINT,
  };
}
