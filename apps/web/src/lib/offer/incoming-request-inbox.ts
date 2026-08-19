import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import {
  classifyIncomingOfferInbox,
  isBuyerActionableIncomingOffer,
  offerMatchesIncomingInboxFilter,
  type IncomingOfferInboxFilter,
} from "@/lib/offer/incoming-offer-inbox";
import type { OutgoingOfferInboxInput } from "@/lib/offer/outgoing-offer-inbox";
import {
  formatOfferRelativeTime,
  resolveOfferLastActivityAt,
} from "@/lib/offer/offer-compare-rail";
import { formatOfferMoney } from "@/lib/offer/budget-offer-compare";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

export type IncomingRequestOfferRow = Omit<
  OutgoingOfferInboxInput,
  "negotiations"
> & {
  id: string;
  amount: number;
  currency: string;
  deliveryDays: number | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  negotiations: OfferNegotiationDto[];
};

export type IncomingRequestSummary = {
  id: string;
  title: string;
  city: string | null;
  status: string;
  coverImageUrl: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  budgetLabel: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
};

export type IncomingRequestGroup = {
  request: IncomingRequestSummary;
  offers: IncomingRequestOfferRow[];
  totalOffers: number;
  unreadCount: number;
  newCount: number;
  actionRequiredCount: number;
  negotiatingCount: number;
  concludedCount: number;
  priceMin: number | null;
  priceMax: number | null;
  priceRangeLabel: string | null;
  lastActivityAt: Date;
  lastActivityLabel: string;
  sortRank: number;
};

function resolveOfferDisplayAmount(offer: IncomingRequestOfferRow): number | null {
  const accepted = offer.negotiations.find((row) => row.status === "ACCEPTED");
  const pending = offer.negotiations.find((row) => row.status === "PENDING");
  if (pending) return pending.amount;
  if (offer.status === "ACCEPTED") {
    return resolveOfferCommercialAmount({
      offerAmount: offer.amount,
      acceptedNegotiationAmount: accepted?.amount ?? null,
    });
  }
  return Number.isFinite(offer.amount) ? offer.amount : null;
}

function offerLastActivity(offer: IncomingRequestOfferRow): Date {
  return (
    resolveOfferLastActivityAt({
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      negotiations: offer.negotiations,
    }) ?? new Date(offer.createdAt)
  );
}

export function aggregateIncomingRequestGroups(input: {
  offers: IncomingRequestOfferRow[];
  unreadOfferIds: ReadonlySet<string>;
  getRequest: (offer: IncomingRequestOfferRow) => IncomingRequestSummary;
}): IncomingRequestGroup[] {
  const byRequest = new Map<string, IncomingRequestGroup>();

  for (const offer of input.offers) {
    const request = input.getRequest(offer);
    const bucket = byRequest.get(request.id) ?? {
      request,
      offers: [],
      totalOffers: 0,
      unreadCount: 0,
      newCount: 0,
      actionRequiredCount: 0,
      negotiatingCount: 0,
      concludedCount: 0,
      priceMin: null,
      priceMax: null,
      priceRangeLabel: null,
      lastActivityAt: new Date(0),
      lastActivityLabel: "",
      sortRank: 0,
    };

    bucket.offers.push(offer);
    bucket.totalOffers += 1;

    if (input.unreadOfferIds.has(offer.id)) bucket.unreadCount += 1;

    const classified = classifyIncomingOfferInbox(offer);
    if (classified === "new") bucket.newCount += 1;
    if (classified === "negotiating") bucket.negotiatingCount += 1;
    if (classified === "accepted" || classified === "rejected") {
      bucket.concludedCount += 1;
    }
    if (isBuyerActionableIncomingOffer(offer)) bucket.actionRequiredCount += 1;

    const amount = resolveOfferDisplayAmount(offer);
    if (amount != null) {
      bucket.priceMin =
        bucket.priceMin == null ? amount : Math.min(bucket.priceMin, amount);
      bucket.priceMax =
        bucket.priceMax == null ? amount : Math.max(bucket.priceMax, amount);
    }

    const activity = offerLastActivity(offer);
    if (activity.getTime() > bucket.lastActivityAt.getTime()) {
      bucket.lastActivityAt = activity;
    }

    byRequest.set(request.id, bucket);
  }

  return [...byRequest.values()].map((group) => {
    const priceRangeLabel =
      group.priceMin != null && group.priceMax != null
        ? group.priceMin === group.priceMax
          ? formatOfferMoney(group.priceMin, group.request.currency)
          : `${formatOfferMoney(group.priceMin, group.request.currency)} – ${formatOfferMoney(group.priceMax, group.request.currency)}`
        : null;

    const sortRank =
      group.actionRequiredCount > 0
        ? 0
        : group.unreadCount > 0 || group.newCount > 0
          ? 1
          : group.negotiatingCount > 0
            ? 2
            : group.concludedCount === group.totalOffers
              ? 4
              : 3;

    return {
      ...group,
      priceRangeLabel,
      lastActivityLabel: formatOfferRelativeTime(group.lastActivityAt) ?? "",
      sortRank,
    };
  });
}

export function sortIncomingRequestGroups(
  groups: IncomingRequestGroup[],
): IncomingRequestGroup[] {
  return [...groups].sort((a, b) => {
    if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
    return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
  });
}

export function requestGroupMatchesInboxFilter(
  group: IncomingRequestGroup,
  filter: IncomingOfferInboxFilter,
  unreadOfferIds: ReadonlySet<string>,
): boolean {
  return group.offers.some((offer) =>
    offerMatchesIncomingInboxFilter(classifyIncomingOfferInbox(offer), filter, {
      offerId: offer.id,
      unreadOfferIds,
      offer,
    }),
  );
}

export function countIncomingRequestInboxFilters(
  groups: IncomingRequestGroup[],
  unreadOfferIds: ReadonlySet<string>,
): Record<IncomingOfferInboxFilter, number> {
  const filters: IncomingOfferInboxFilter[] = [
    "all",
    "unread",
    "new",
    "action_required",
    "negotiating",
    "concluded",
  ];
  const counts = {} as Record<IncomingOfferInboxFilter, number>;
  for (const filter of filters) {
    counts[filter] = groups.filter((group) =>
      requestGroupMatchesInboxFilter(group, filter, unreadOfferIds),
    ).length;
  }
  return counts;
}

export function countArchivedRequestGroups(
  allOffers: IncomingRequestOfferRow[],
  archivedOfferIds: ReadonlySet<string>,
  getRequestId: (offer: IncomingRequestOfferRow) => string,
): number {
  const requestIds = new Set<string>();
  for (const offer of allOffers) {
    if (archivedOfferIds.has(offer.id)) {
      requestIds.add(getRequestId(offer));
    }
  }
  return requestIds.size;
}
