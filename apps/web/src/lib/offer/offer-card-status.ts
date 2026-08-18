import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import { isBuyerActionableIncomingOffer } from "@/lib/offer/incoming-offer-inbox";
import { isSellerActionableOutgoingOffer } from "@/lib/offer/outgoing-offer-inbox";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";

export type OfferCardViewer = "buyer" | "seller";

export type OfferCardStatusHeader =
  | "Yeni teklif"
  | "Yanıtınız bekleniyor"
  | "Alıcının yanıtı bekleniyor"
  | "Satıcının yanıtı bekleniyor"
  | "Kabul edildi"
  | "Reddedildi"
  | "Sonuçlandı";

export type OfferCardInput = {
  status: string;
  negotiations: OfferNegotiationDto[];
};

export function buyerActionRequiredOffer(input: OfferCardInput) {
  return isBuyerActionableIncomingOffer(input);
}

export function sellerActionRequiredOffer(input: OfferCardInput) {
  return isSellerActionableOutgoingOffer(input);
}

export function isActionRequiredOffer(
  viewer: OfferCardViewer,
  input: OfferCardInput,
) {
  return viewer === "buyer"
    ? buyerActionRequiredOffer(input)
    : sellerActionRequiredOffer(input);
}

export function resolveOfferCardStatusHeader(
  viewer: OfferCardViewer,
  input: OfferCardInput,
  options?: { isUnread?: boolean },
): OfferCardStatusHeader {
  const pending = currentPendingNegotiation(input.negotiations);
  const actionRequired = isActionRequiredOffer(viewer, input);

  if (input.status === "ACCEPTED") return "Kabul edildi";
  if (input.status === "REJECTED") return "Reddedildi";
  if (
    input.status === "WITHDRAWN" ||
    input.status === "EXPIRED" ||
    input.status === "DRAFT"
  ) {
    return "Sonuçlandı";
  }

  if (actionRequired) {
    if (
      viewer === "buyer" &&
      options?.isUnread &&
      input.status === "SUBMITTED" &&
      !pending
    ) {
      return "Yeni teklif";
    }
    return "Yanıtınız bekleniyor";
  }

  if (pending) {
    return viewer === "buyer"
      ? "Satıcının yanıtı bekleniyor"
      : "Alıcının yanıtı bekleniyor";
  }

  if (options?.isUnread && viewer === "buyer" && input.status === "SUBMITTED") {
    return "Yeni teklif";
  }

  if (["SUBMITTED", "VIEWED"].includes(input.status)) {
    return viewer === "buyer"
      ? "Satıcının yanıtı bekleniyor"
      : "Alıcının yanıtı bekleniyor";
  }

  return "Sonuçlandı";
}

export function resolveOfferPriceCaption(
  viewer: OfferCardViewer,
  input: {
    status: string;
    amount: number;
    currency: string;
    negotiations: OfferNegotiationDto[];
  },
) {
  const pending = currentPendingNegotiation(input.negotiations);
  const accepted = input.negotiations.find((row) => row.status === "ACCEPTED");
  const commercialAmount = resolveOfferCommercialAmount({
    offerAmount: input.amount,
    acceptedNegotiationAmount: accepted?.amount ?? null,
  });

  if (pending) {
    const mine =
      viewer === "buyer"
        ? pending.proposedBySide === "BUYER"
        : pending.proposedBySide === "PROVIDER";
    if (mine) return "Son öneriniz";
    return viewer === "buyer" ? "Satıcının son önerisi" : "Alıcının son önerisi";
  }

  if (input.status === "ACCEPTED" && commercialAmount !== input.amount) {
    return "Anlaşılan fiyat";
  }

  return viewer === "buyer" ? "İlk teklif" : "İlk teklifiniz";
}

export function shouldOfferGroupDefaultOpen(input: {
  viewer: OfferCardViewer;
  offer: OfferCardInput;
  isUnread: boolean;
  isDeepLinked: boolean;
  isActionRequired: boolean;
}) {
  if (input.isDeepLinked || input.isUnread || input.isActionRequired) {
    return true;
  }

  const pending = currentPendingNegotiation(input.offer.negotiations);
  if (pending) {
    const myTurn =
      input.viewer === "buyer"
        ? pending.proposedBySide === "PROVIDER"
        : pending.proposedBySide === "BUYER";
    if (myTurn) return true;
  }

  if (
    input.offer.status === "SUBMITTED" &&
    input.viewer === "buyer" &&
    !pending
  ) {
    return true;
  }

  if (["ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"].includes(input.offer.status)) {
    return false;
  }

  if (pending) {
    const waitingOnCounterpart =
      input.viewer === "buyer"
        ? pending.proposedBySide === "BUYER"
        : pending.proposedBySide === "PROVIDER";
    if (waitingOnCounterpart) return false;
  }

  return !["SUBMITTED", "VIEWED"].includes(input.offer.status)
    ? false
    : Boolean(pending);
}

/**
 * Identity of the offer state that produced the current unread events.
 *
 * Every notification type in `offer-event-unread` is emitted by an offer status
 * change (OFFER_ACCEPTED, OFFER_REJECTED) or by a negotiation round being
 * created or answered (COUNTER_OFFER_*), so status plus negotiation ids and
 * statuses identify the unread generation. A locally applied "seen" state is
 * valid only for the generation it was applied to: when a genuinely new offer
 * event arrives, the generation changes and the offer becomes unread again.
 */
export function offerUnreadGeneration(offer: OfferCardInput) {
  return [
    offer.status,
    ...offer.negotiations.map(
      (negotiation) => `${negotiation.id}:${negotiation.status}`,
    ),
  ].join("|");
}
