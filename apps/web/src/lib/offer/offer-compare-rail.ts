import {
  budgetCompareCopy,
  compareBuyerBudgetToOffer,
  formatOfferMoney,
} from "@/lib/offer/budget-offer-compare";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import {
  isActionRequiredOffer,
  type OfferCardInput,
  type OfferCardViewer,
} from "@/lib/offer/offer-card-status";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";
import {
  compareNegotiationPrices,
  negotiationCompareCopy,
} from "@/lib/offer/negotiation-price-compare";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";

export type OfferCompareRailDiff = {
  deltaLabel: string;
  relativeLabel: string;
  tone: "amber" | "teal" | "neutral";
};

export function resolveOfferCompareTurn(
  viewer: OfferCardViewer,
  input: OfferCardInput,
): string {
  if (isActionRequiredOffer(viewer, input)) return "Sıra sizde";

  const pending = currentPendingNegotiation(input.negotiations);
  if (!pending) {
    if (["SUBMITTED", "VIEWED"].includes(input.status)) {
      return viewer === "buyer" ? "Sıra satıcıda" : "Sıra alıcıda";
    }
    return "Sonuçlandı";
  }

  const myTurn =
    viewer === "buyer"
      ? pending.proposedBySide === "PROVIDER"
      : pending.proposedBySide === "BUYER";
  if (myTurn) return "Sıra sizde";
  return viewer === "buyer" ? "Sıra satıcıda" : "Sıra alıcıda";
}

export function resolveOfferDecisionAmount(input: {
  status: string;
  amount: number;
  currency: string;
  negotiations: OfferNegotiationDto[];
}): number | null {
  const pending = currentPendingNegotiation(input.negotiations);
  const accepted = input.negotiations.find((row) => row.status === "ACCEPTED");
  const commercial = resolveOfferCommercialAmount({
    offerAmount: input.amount,
    acceptedNegotiationAmount: accepted?.amount ?? null,
  });
  if (pending) return pending.amount;
  if (input.status === "ACCEPTED") return commercial;
  if (Number.isFinite(input.amount)) return input.amount;
  return null;
}

export function resolveOfferCompareDiff(input: {
  status: string;
  amount: number;
  currency: string;
  negotiations: OfferNegotiationDto[];
  budgetMin?: number | string | null;
  budgetMax?: number | string | null;
  requestCurrency?: string | null;
}): OfferCompareRailDiff {
  const pending = currentPendingNegotiation(input.negotiations);
  const decisionAmount = resolveOfferDecisionAmount(input);

  if (pending) {
    const result = compareNegotiationPrices({
      originalAmount: input.amount,
      pendingAmount: pending.amount,
      originalCurrency: input.currency,
      pendingCurrency: input.currency,
    });
    return negotiationCompareCopy(result, input.currency);
  }

  if (input.status === "ACCEPTED") {
    const accepted = input.negotiations.find((row) => row.status === "ACCEPTED");
    const commercial = resolveOfferCommercialAmount({
      offerAmount: input.amount,
      acceptedNegotiationAmount: accepted?.amount ?? null,
    });
    const result = compareBuyerBudgetToOffer({
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      requestCurrency: input.requestCurrency,
      offerAmount: commercial,
      offerCurrency: input.currency,
    });
    return budgetCompareCopy(result, input.currency);
  }

  const result = compareBuyerBudgetToOffer({
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    requestCurrency: input.requestCurrency,
    offerAmount: decisionAmount,
    offerCurrency: input.currency,
  });
  return budgetCompareCopy(result, input.currency);
}

export function formatOfferDecisionPrice(
  amount: number | null,
  currency: string,
): string {
  if (amount == null) return "—";
  return formatOfferMoney(amount, currency);
}

export function countNegotiationRounds(negotiations: OfferNegotiationDto[]): number {
  return negotiations.filter((row) => row.status !== "SUPERSEDED").length;
}

export function resolveOfferLastActivityAt(input: {
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  negotiations: OfferNegotiationDto[];
}): Date | null {
  const candidates: number[] = [];
  if (input.createdAt) candidates.push(new Date(input.createdAt).getTime());
  if (input.updatedAt) candidates.push(new Date(input.updatedAt).getTime());
  for (const row of input.negotiations) {
    if (row.createdAt) candidates.push(new Date(row.createdAt).getTime());
    if (row.respondedAt) candidates.push(new Date(row.respondedAt).getTime());
  }
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates));
}

export function formatOfferRelativeTime(date: Date | null): string | null {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
