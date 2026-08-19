import { formatRequestQuantity } from "@/lib/offer/budget-offer-compare";
import type { IncomingOfferCardData } from "@/components/panel/IncomingOfferCard";
import type { IncomingRequestSummaryData } from "@/components/panel/IncomingOfferCompareGroup";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";
import {
  toOfferNegotiationDtos,
} from "@/lib/offer/offer-negotiation";
import { formatListingBudget } from "@/lib/visuals/category-visuals";
import type { BuyerIncomingOfferRow } from "@/server/offer/load-buyer-incoming-offers";

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapNegotiations(
  rows: BuyerIncomingOfferRow["negotiations"],
): OfferNegotiationDto[] {
  return toOfferNegotiationDtos(
    rows.map((row) => ({
      ...row,
      proposedBySide: row.proposedBySide as OfferNegotiationDto["proposedBySide"],
      status: row.status as OfferNegotiationDto["status"],
    })),
  );
}

export function mapIncomingOfferCardData(
  offer: BuyerIncomingOfferRow,
): IncomingOfferCardData {
  return {
    id: offer.id,
    amount: Number(offer.amount),
    currency: offer.currency,
    deliveryDays: offer.deliveryDays,
    title: offer.title,
    description: offer.description,
    status: offer.status,
    companyName: offer.company?.name ?? null,
    companyVerified: Boolean(offer.company?.isVerified),
    submittedByName: offer.submittedBy.name,
    conversationId: offer.conversation?.id ?? null,
    mediaIds: offer.media.map((item) => item.id),
    negotiations: mapNegotiations(offer.negotiations),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
  };
}

export function mapIncomingRequestSummary(
  request: BuyerIncomingOfferRow["request"],
): IncomingRequestSummaryData {
  const quantity = request.fieldValues[0];
  const budgetMin = toNumber(request.budgetMin);
  const budgetMax = toNumber(request.budgetMax);
  return {
    id: request.id,
    title: request.title,
    city: request.city,
    status: request.status,
    coverImageUrl: request.coverImageUrl,
    categorySlug: request.category.slug,
    categoryName: request.category.name,
    quantityLabel: formatRequestQuantity({
      textValue: quantity?.textValue ?? null,
      numberValue: toNumber(quantity?.numberValue),
    }),
    budgetMin,
    budgetMax,
    currency: request.currency,
    budgetLabel: formatListingBudget(budgetMin, budgetMax, request.currency),
  };
}

export function mapIncomingRequestOfferRow(offer: BuyerIncomingOfferRow) {
  return {
    id: offer.id,
    amount: Number(offer.amount),
    currency: offer.currency,
    deliveryDays: offer.deliveryDays,
    status: offer.status,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    negotiations: mapNegotiations(offer.negotiations),
  };
}
