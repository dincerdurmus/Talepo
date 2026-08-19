import {
  aggregateIncomingRequestGroups,
  sortIncomingRequestGroups,
  type IncomingRequestGroup,
} from "@/lib/offer/incoming-request-inbox";
import { mapIncomingRequestOfferRow, mapIncomingRequestSummary } from "@/lib/offer/incoming-offer-mapper";
import { filterOffersByArchiveView } from "@/lib/offer/offer-archive";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";
import { formatListingBudget } from "@/lib/visuals/category-visuals";
import { prisma } from "@/lib/prisma";
import {
  sortMyRequests,
  toMyRequestCardModel,
  type MyRequestCardModel,
  type MyRequestSignals,
} from "@/lib/panel/my-requests-surface";
import type { BuyerIncomingOfferRow } from "@/server/offer/load-buyer-incoming-offers";
import { loadBuyerIncomingOffers } from "@/server/offer/load-buyer-incoming-offers";

export type MyRequestsHomeData = {
  cards: MyRequestCardModel[];
  hasOpenUrgentWithoutNudge: boolean;
};

function groupWaitingForCounterparty(group: IncomingRequestGroup): boolean {
  return group.offers.some((offer) => {
    const pending = currentPendingNegotiation(offer.negotiations);
    return pending?.proposedBySide === "BUYER";
  });
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

function signalsFromGroup(
  group: IncomingRequestGroup | undefined,
  offers: BuyerIncomingOfferRow[],
  requestId: string,
  status: string,
  offerCount: number,
): MyRequestSignals {
  return {
    status,
    totalOffers: group?.totalOffers ?? offerCount,
    actionRequiredCount: group?.actionRequiredCount ?? 0,
    unreadCount: group?.unreadCount ?? 0,
    newCount: group?.newCount ?? 0,
    negotiatingCount: group?.negotiatingCount ?? 0,
    waitingForCounterparty: group ? groupWaitingForCounterparty(group) : false,
    conversationId: conversationIdForRequest(requestId, offers),
  };
}

export async function loadMyRequestsHome(
  userId: string,
): Promise<MyRequestsHomeData> {
  const [requests, incoming] = await Promise.all([
    prisma.request.findMany({
      where: {
        createdById: userId,
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        city: true,
        district: true,
        budgetMin: true,
        budgetMax: true,
        currency: true,
        coverImageUrl: true,
        isUrgent: true,
        urgentOfferNudgeAt: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { name: true, slug: true } },
        _count: { select: { offers: true } },
      },
    }),
    loadBuyerIncomingOffers(userId),
  ]);

  const activeOffers = filterOffersByArchiveView(
    incoming.offers,
    incoming.archivedOfferIds,
    "active",
  );
  const groups = sortIncomingRequestGroups(
    aggregateIncomingRequestGroups({
      offers: activeOffers.map(mapIncomingRequestOfferRow),
      unreadOfferIds: incoming.unreadOfferIds,
      getRequest: (offer) => {
        const source = activeOffers.find((row) => row.id === offer.id);
        if (!source) {
          throw new Error("Incoming offer row missing for Taleplerim mapping");
        }
        return mapIncomingRequestSummary(source.request);
      },
    }),
  );
  const groupByRequestId = new Map(groups.map((group) => [group.request.id, group]));

  const cards = sortMyRequests(
    requests.map((request) => {
      const group = groupByRequestId.get(request.id);
      const offerCount = group?.totalOffers ?? request._count.offers;
      const lastActivityAt =
        group?.lastActivityAt ??
        request.updatedAt ??
        request.publishedAt ??
        request.createdAt;
      return toMyRequestCardModel({
        id: request.id,
        title: request.title,
        status: request.status,
        categoryName: request.category.name,
        categorySlug: request.category.slug,
        coverImageUrl: request.coverImageUrl,
        city: request.city,
        district: request.district,
        budgetLabel: formatListingBudget(
          request.budgetMin,
          request.budgetMax,
          request.currency,
        ),
        lastActivityAt,
        offerCount,
        isUrgent: request.isUrgent,
        signals: signalsFromGroup(
          group,
          incoming.offers,
          request.id,
          request.status,
          offerCount,
        ),
      });
    }),
  );

  const hasOpenUrgentWithoutNudge = requests.some(
    (request) =>
      request.isUrgent &&
      !request.urgentOfferNudgeAt &&
      (request.status === "PUBLISHED" || request.status === "RECEIVING_OFFERS") &&
      request._count.offers === 0,
  );

  return { cards, hasOpenUrgentWithoutNudge };
}
