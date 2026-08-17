import { moneyAmountCents } from "@/lib/offer/submitted-commercial-lock";

/**
 * Commercial amount for an accepted deal.
 * Original Offer.amount is never overwritten; an ACCEPTED negotiation wins.
 */
export function resolveOfferCommercialAmount(input: {
  offerAmount: number | string;
  acceptedNegotiationAmount?: number | string | null;
}): number {
  const negotiated = input.acceptedNegotiationAmount;
  if (negotiated != null && negotiated !== "") {
    const value = Number(negotiated);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return Number(input.offerAmount);
}

export function negotiationAmountsEqual(
  left: number | string,
  right: number | string,
) {
  return moneyAmountCents(left) === moneyAmountCents(right);
}

export function roundOfferAmount(value: number) {
  return moneyAmountCents(value) / 100;
}
