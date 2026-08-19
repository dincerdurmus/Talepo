import { formatOfferMoney } from "@/lib/offer/budget-offer-compare";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import { negotiationRoundCount } from "@/lib/offer/negotiation-history";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

export type ProcessHistoryEvent = {
  id: string;
  at: string;
  sortAt: number;
  rank: number;
  title: string;
  detail?: string;
};

export type ConcludedProcessSummary = {
  outcomeLabel: string;
  agreedAmountLabel: string | null;
  lastActionLabel: string;
  sellerName: string | null;
  offerCount: number;
  negotiationRoundCount: number;
  conversationHref: string | null;
  reviewHref: string | null;
};

export type ConcludedOfferHistoryItem = {
  id: string;
  sellerName: string;
  status: string;
  statusLabel: string;
  accepted: boolean;
  originalAmount: number;
  currency: string;
  offerCreatedAt: string;
  negotiations: OfferNegotiationDto[];
  mediaIds: string[];
  conversationHref: string | null;
};

export type ConcludedProcessModel = {
  summary: ConcludedProcessSummary;
  events: ProcessHistoryEvent[];
  offers: ConcludedOfferHistoryItem[];
};

const OFFER_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Geri çekildi",
  EXPIRED: "Süresi doldu",
  SUBMITTED: "Gönderildi",
  VIEWED: "Görüldü",
  DRAFT: "Taslak",
};

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatWhen(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function publicSellerName(input: {
  companyName?: string | null;
  submittedByName?: string | null;
}): string {
  const company = input.companyName?.trim();
  if (company) return company;
  const person = input.submittedByName?.trim();
  if (person) return person;
  return "Satıcı";
}

export function concludedOfferStatusLabel(status: string) {
  return OFFER_STATUS_LABEL[status] ?? "Teklif";
}

export function buildConcludedProcessHistory(input: {
  status: string;
  createdAt: Date | string;
  publishedAt?: Date | string | null;
  completedAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  offers: Array<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: Date | string;
    submittedAt?: Date | string | null;
    acceptedAt?: Date | string | null;
    companyName?: string | null;
    submittedByName?: string | null;
    mediaIds?: string[];
    conversationId?: string | null;
    conversationCreatedAt?: Date | string | null;
    negotiations: OfferNegotiationDto[];
  }>;
  dealOutcomes?: Array<{
    status: string;
    agreedPrice?: number | null;
    currency: string;
    completedAt?: Date | string | null;
    buyerConfirmedAt?: Date | string | null;
    supplierConfirmedAt?: Date | string | null;
    conversationId?: string | null;
    reviews?: Array<{
      id: string;
      reviewerSide: "BUYER" | "PROVIDER";
      createdAt: Date | string;
    }>;
  }>;
}): ConcludedProcessModel {
  const events: ProcessHistoryEvent[] = [];

  const createdAtTime = toTime(input.createdAt);
  if (createdAtTime != null) {
    events.push({
      id: "created",
      at: formatWhen(input.createdAt),
      sortAt: createdAtTime,
      rank: 0,
      title: "Talep oluşturuldu",
    });
  }

  const publishedAtTime = toTime(input.publishedAt);
  if (publishedAtTime != null && input.publishedAt) {
    events.push({
      id: "published",
      at: formatWhen(input.publishedAt),
      sortAt: publishedAtTime,
      rank: 1,
      title: "Talep yayınlandı",
    });
  }

  const submittedOffers = input.offers.filter((offer) => offer.status !== "DRAFT");
  const offerTimes = submittedOffers
    .map((offer) => toTime(offer.submittedAt ?? offer.createdAt))
    .filter((time): time is number => time != null);
  if (submittedOffers.length > 0 && offerTimes.length > 0) {
    const firstOffer = Math.min(...offerTimes);
    const firstRow = submittedOffers.find(
      (offer) => toTime(offer.submittedAt ?? offer.createdAt) === firstOffer,
    );
    events.push({
      id: "offers-arrived",
      at: firstRow ? formatWhen(firstRow.submittedAt ?? firstRow.createdAt) : "",
      sortAt: firstOffer,
      rank: 2,
      title: "Teklifler geldi",
      detail:
        submittedOffers.length === 1
          ? "1 teklif"
          : `${submittedOffers.length} teklif`,
    });
  }

  const negotiationRows = submittedOffers.flatMap((offer) => offer.negotiations);
  const firstNegotiationTime = negotiationRows
    .map((row) => toTime(row.createdAt))
    .filter((time): time is number => time != null)
    .sort((left, right) => left - right)[0];
  if (negotiationRows.length > 0 && firstNegotiationTime != null) {
    const firstRow = negotiationRows.find(
      (row) => toTime(row.createdAt) === firstNegotiationTime,
    );
    events.push({
      id: "negotiations",
      at: firstRow ? formatWhen(firstRow.createdAt) : "",
      sortAt: firstNegotiationTime,
      rank: 3,
      title: "Pazarlık turları başladı",
      detail:
        negotiationRows.length === 1
          ? "1 tur"
          : `${negotiationRows.length} tur`,
    });
  }

  const acceptedOffer = submittedOffers.find((offer) => offer.status === "ACCEPTED");
  const acceptedAtTime = toTime(acceptedOffer?.acceptedAt);
  if (acceptedOffer && acceptedAtTime != null && acceptedOffer.acceptedAt) {
    events.push({
      id: "offer-accepted",
      at: formatWhen(acceptedOffer.acceptedAt),
      sortAt: acceptedAtTime,
      rank: 4,
      title: "Teklif kabul edildi",
      detail: publicSellerName(acceptedOffer),
    });
  }

  const cancelledAtTime = toTime(input.cancelledAt);
  if (input.status === "CANCELLED" && cancelledAtTime != null && input.cancelledAt) {
    events.push({
      id: "cancelled",
      at: formatWhen(input.cancelledAt),
      sortAt: cancelledAtTime,
      rank: 5,
      title: "Süreç iptal edildi",
    });
  }

  const conversationOffer = submittedOffers.find((offer) => offer.conversationId);
  const conversationTime = toTime(conversationOffer?.conversationCreatedAt);
  if (conversationOffer?.conversationId && conversationTime != null) {
    events.push({
      id: "messaging",
      at: conversationOffer.conversationCreatedAt
        ? formatWhen(conversationOffer.conversationCreatedAt)
        : "",
      sortAt: conversationTime,
      rank: 6,
      title: "Mesajlaşma başladı",
    });
  }

  const deal = input.dealOutcomes?.[0];
  const buyerConfirmTime = toTime(deal?.buyerConfirmedAt);
  if (deal?.buyerConfirmedAt && buyerConfirmTime != null) {
    events.push({
      id: "buyer-confirmed",
      at: formatWhen(deal.buyerConfirmedAt),
      sortAt: buyerConfirmTime,
      rank: 7,
      title: "Alıcı işlemi onayladı",
    });
  }
  const supplierConfirmTime = toTime(deal?.supplierConfirmedAt);
  if (deal?.supplierConfirmedAt && supplierConfirmTime != null) {
    events.push({
      id: "supplier-confirmed",
      at: formatWhen(deal.supplierConfirmedAt),
      sortAt: supplierConfirmTime,
      rank: 8,
      title: "Satıcı işlemi onayladı",
    });
  }

  const reviews = deal?.reviews ?? [];
  for (const review of reviews) {
    const reviewTime = toTime(review.createdAt);
    if (reviewTime == null) continue;
    events.push({
      id: `review-${review.id}`,
      at: formatWhen(review.createdAt),
      sortAt: reviewTime,
      rank: 9,
      title:
        review.reviewerSide === "BUYER"
          ? "Alıcı değerlendirmesi kaydedildi"
          : "Satıcı değerlendirmesi kaydedildi",
    });
  }

  const completedAtTime = toTime(input.completedAt ?? deal?.completedAt);
  const completedSource = input.completedAt ?? deal?.completedAt;
  if (
    input.status === "COMPLETED" &&
    completedAtTime != null &&
    completedSource
  ) {
    events.push({
      id: "completed",
      at: formatWhen(completedSource),
      sortAt: completedAtTime,
      rank: 10,
      title: "Süreç tamamlandı",
    });
  }

  const createdEvent = events.find((event) => event.id === "created");
  const publishedEvent = events.find((event) => event.id === "published");
  if (
    createdEvent &&
    publishedEvent &&
    publishedEvent.sortAt < createdEvent.sortAt
  ) {
    publishedEvent.sortAt = createdEvent.sortAt;
  }

  events.sort((left, right) => {
    if (left.sortAt !== right.sortAt) return left.sortAt - right.sortAt;
    return left.rank - right.rank;
  });

  const commercialAmount = acceptedOffer
    ? resolveOfferCommercialAmount({
        offerAmount: acceptedOffer.amount,
        acceptedNegotiationAmount:
          acceptedOffer.negotiations.find((row) => row.status === "ACCEPTED")
            ?.amount ?? null,
      })
    : null;
  const agreedFromDeal =
    deal?.agreedPrice != null && Number.isFinite(deal.agreedPrice)
      ? deal.agreedPrice
      : null;
  const agreedAmount = agreedFromDeal ?? commercialAmount;
  const agreedCurrency = deal?.currency ?? acceptedOffer?.currency ?? "TRY";

  const lastEvent = events.at(-1);
  const conversationHref = conversationOffer?.conversationId
    ? `/panel/mesajlar/${conversationOffer.conversationId}`
    : deal?.conversationId
      ? `/panel/mesajlar/${deal.conversationId}`
      : null;

  const offers: ConcludedOfferHistoryItem[] = [...submittedOffers]
    .sort((left, right) => {
      if (left.status === "ACCEPTED" && right.status !== "ACCEPTED") return -1;
      if (right.status === "ACCEPTED" && left.status !== "ACCEPTED") return 1;
      return toTime(right.createdAt)! - toTime(left.createdAt)!;
    })
    .map((offer) => ({
      id: offer.id,
      sellerName: publicSellerName(offer),
      status: offer.status,
      statusLabel: concludedOfferStatusLabel(offer.status),
      accepted: offer.status === "ACCEPTED",
      originalAmount: offer.amount,
      currency: offer.currency,
      offerCreatedAt: toIso(offer.createdAt),
      negotiations: offer.negotiations,
      mediaIds: offer.mediaIds ?? [],
      conversationHref: offer.conversationId
        ? `/panel/mesajlar/${offer.conversationId}`
        : null,
    }));

  return {
    summary: {
      outcomeLabel:
        input.status === "CANCELLED" ? "İptal edildi" : "Tamamlandı",
      agreedAmountLabel:
        agreedAmount != null
          ? formatOfferMoney(agreedAmount, agreedCurrency)
          : null,
      lastActionLabel: lastEvent?.at || formatWhen(input.createdAt),
      sellerName: acceptedOffer
        ? publicSellerName(acceptedOffer)
        : submittedOffers[0]
          ? publicSellerName(submittedOffers[0])
          : null,
      offerCount: submittedOffers.length,
      negotiationRoundCount: negotiationRoundCount(negotiationRows),
      conversationHref,
      reviewHref: reviews.length > 0 ? conversationHref : null,
    },
    events,
    offers,
  };
}
