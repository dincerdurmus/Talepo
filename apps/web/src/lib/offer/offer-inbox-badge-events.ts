import type { OfferInboxRole } from "@/lib/offer/offer-event-unread";

export const OFFER_INBOX_BADGE_EVENT = "talepo:offer-inbox-badge";

export type OfferInboxBadgeEventDetail =
  | { role: OfferInboxRole; mode: "decrement"; offerId?: string }
  | { role: OfferInboxRole; mode: "clear" };

export function dispatchOfferInboxBadgeUpdate(detail: OfferInboxBadgeEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OfferInboxBadgeEventDetail>(OFFER_INBOX_BADGE_EVENT, {
      detail,
    }),
  );
}
