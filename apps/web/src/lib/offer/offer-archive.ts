import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";
import { NEGOTIABLE_OFFER_STATUSES } from "@/lib/offer/offer-negotiation";
import type { OutgoingOfferInboxInput } from "@/lib/offer/outgoing-offer-inbox";

/** Terminal offer states eligible for personal archive. */
export const ARCHIVABLE_OFFER_STATUSES = [
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
] as const;

export type OfferArchiveScope = {
  userId: string;
  companyId: string | null;
};

export function isArchivableOfferStatus(status: string): boolean {
  return (ARCHIVABLE_OFFER_STATUSES as readonly string[]).includes(status);
}

export function isActiveNegotiationOffer(offer: OutgoingOfferInboxInput): boolean {
  if (!(NEGOTIABLE_OFFER_STATUSES as readonly string[]).includes(offer.status)) {
    return false;
  }
  return Boolean(currentPendingNegotiation(offer.negotiations));
}

export function canArchiveOffer(input: {
  offer: OutgoingOfferInboxInput;
  isUnread: boolean;
  isActionRequired: boolean;
  dealCompleted?: boolean;
}): boolean {
  if (input.isUnread || input.isActionRequired) return false;
  if (isActiveNegotiationOffer(input.offer)) return false;
  if (isArchivableOfferStatus(input.offer.status)) return true;
  return Boolean(input.dealCompleted);
}

export function offerArchiveWhere(scope: OfferArchiveScope) {
  return {
    userId: scope.userId,
    companyId: scope.companyId,
  };
}

export type OfferArchiveView = "active" | "archive";

export function parseOfferArchiveView(
  raw: string | string[] | undefined | null,
): OfferArchiveView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() === "arsiv" ? "archive" : "active";
}

export function buildOfferArchiveParam(view: OfferArchiveView): string | null {
  return view === "archive" ? "arsiv" : null;
}

export function filterOffersByArchiveView<T extends { id: string }>(
  offers: T[],
  archivedOfferIds: ReadonlySet<string>,
  view: OfferArchiveView,
): T[] {
  if (view === "archive") {
    return offers.filter((offer) => archivedOfferIds.has(offer.id));
  }
  return offers.filter((offer) => !archivedOfferIds.has(offer.id));
}
