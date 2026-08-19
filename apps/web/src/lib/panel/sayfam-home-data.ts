import {
  aggregateIncomingRequestGroups,
  sortIncomingRequestGroups,
  type IncomingRequestGroup,
} from "@/lib/offer/incoming-request-inbox";
import {
  buildIncomingRequestWorkspacePath,
  type IncomingOfferInboxFilter,
} from "@/lib/offer/incoming-offer-inbox";
import { mapIncomingRequestOfferRow, mapIncomingRequestSummary } from "@/lib/offer/incoming-offer-mapper";
import { filterOffersByArchiveView } from "@/lib/offer/offer-archive";
import type { BuyerIncomingOfferRow } from "@/server/offer/load-buyer-incoming-offers";
import { loadBuyerIncomingOffers } from "@/server/offer/load-buyer-incoming-offers";
import { prisma } from "@/lib/prisma";

import {
  getPanelSummary,
  getUnreadMessageCount,
} from "@/lib/panel/get-panel-data";
import type {
  SayfamActivityItem,
  SayfamFocusItem,
  SayfamHomeData,
} from "@/lib/panel/sayfam-home-types";

const ACTIVE_REQUEST_STATUSES = [
  "PUBLISHED",
  "RECEIVING_OFFERS",
  "OFFER_SELECTED",
  "IN_PROGRESS",
] as const;

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

function resolveFocusFilter(group: IncomingRequestGroup): IncomingOfferInboxFilter {
  if (group.actionRequiredCount > 0) return "action_required";
  if (group.unreadCount > 0) return "unread";
  if (group.newCount > 0) return "new";
  if (group.negotiatingCount > 0) return "negotiating";
  return "all";
}

function resolveFocusStatusLabel(group: IncomingRequestGroup): string {
  if (group.actionRequiredCount > 0) return "Yanıtınız bekleniyor";
  if (group.unreadCount > 0 || group.newCount > 0) return "Yeni teklif var";
  if (group.negotiatingCount > 0) return "Pazarlık devam ediyor";
  return "Teklifleri inceleyin";
}

function resolveFocusDetailLabel(group: IncomingRequestGroup): string {
  const parts: string[] = [];
  if (group.totalOffers > 0) {
    parts.push(
      group.totalOffers === 1 ? "1 teklif" : `${group.totalOffers} teklif`,
    );
  }
  if (group.lastActivityLabel) {
    parts.push(`Son güncelleme ${group.lastActivityLabel}`);
  }
  return parts.join(" · ");
}

function mapGroupToFocusItem(group: IncomingRequestGroup): SayfamFocusItem {
  return {
    id: group.request.id,
    requestId: group.request.id,
    title: group.request.title,
    categorySlug: group.request.categorySlug,
    categoryName: group.request.categoryName,
    coverImageUrl: group.request.coverImageUrl,
    statusLabel: resolveFocusStatusLabel(group),
    detailLabel: resolveFocusDetailLabel(group),
    href: buildIncomingRequestWorkspacePath({
      requestId: group.request.id,
      filter: resolveFocusFilter(group),
    }),
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

async function loadWaitingRequestFocus(
  userId: string,
  excludeRequestIds: ReadonlySet<string>,
): Promise<SayfamFocusItem | null> {
  const request = await prisma.request.findFirst({
    where: {
      createdById: userId,
      deletedAt: null,
      status: { in: [...ACTIVE_REQUEST_STATUSES] },
      ...(excludeRequestIds.size > 0
        ? { id: { notIn: [...excludeRequestIds] } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      updatedAt: true,
      category: { select: { slug: true, name: true } },
    },
  });

  if (!request) return null;

  const offerCount = await prisma.offer.count({
    where: {
      requestId: request.id,
      status: { not: "DRAFT" },
      NOT: { submittedById: userId, companyId: null },
    },
  });

  if (offerCount > 0) return null;

  return {
    id: request.id,
    requestId: request.id,
    title: request.title,
    categorySlug: request.category.slug,
    categoryName: request.category.name,
    coverImageUrl: request.coverImageUrl,
    statusLabel: "Teklif bekleniyor",
    detailLabel: `Son güncelleme ${formatRelativeTime(request.updatedAt)}`,
    href: `/panel/taleplerim/${request.id}`,
  };
}

function resolveHeroHint(input: {
  focusCount: number;
  activeRequests: number;
}): string {
  if (input.focusCount > 0) {
    return `${input.focusCount} talebinizde hareket var — odak kartı sırayla döner.`;
  }
  if (input.activeRequests > 0) {
    return "Aktif talepleriniz var — teklifler geldiğinde burada görünür.";
  }
  return "Talep yazın, teklif toplayın, karar verin.";
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

  const focusGroups = sortedGroups.filter(
    (group) => group.sortRank < 4 && group.totalOffers > 0,
  );

  let focusItems = focusGroups.map(mapGroupToFocusItem);

  if (focusItems.length === 0) {
    const coveredIds = new Set(sortedGroups.map((group) => group.request.id));
    const waiting = await loadWaitingRequestFocus(userId, coveredIds);
    if (waiting) focusItems = [waiting];
  }

  const activity: SayfamActivityItem[] = summary.recentNotifications.map(
    (notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      href: `/panel/bildirimler/r/${notification.id}`,
      timeLabel: formatRelativeTime(notification.createdAt),
      unread: notification.status === "UNREAD",
    }),
  );

  return {
    metrics: {
      activeRequests: summary.activeRequests,
      actionRequiredOffers: summary.newOffers,
      unreadMessages,
    },
    focusItems,
    activity,
    heroHint: resolveHeroHint({
      focusCount: focusItems.length,
      activeRequests: summary.activeRequests,
    }),
  };
}

export async function buildSayfamHomeDataUnavailable(): Promise<SayfamHomeData> {
  return {
    metrics: {
      activeRequests: 0,
      actionRequiredOffers: 0,
      unreadMessages: 0,
    },
    focusItems: [],
    activity: [],
    heroHint: "Veritabanına şu an ulaşılamıyor. Kısa süre sonra tekrar deneyin.",
  };
}
