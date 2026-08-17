export const NEGOTIABLE_OFFER_STATUSES = ["SUBMITTED", "VIEWED"] as const;

export const OPEN_REQUEST_FOR_OFFER_STATUSES = [
  "PUBLISHED",
  "RECEIVING_OFFERS",
] as const;

export const OFFER_NEGOTIATION_SAME_AMOUNT_MESSAGE =
  "Aynı tutarı karşı teklif olarak gönderemezsiniz. Kabul edin veya farklı bir tutar önerin.";

export const OFFER_NEGOTIATION_TURN_MESSAGE =
  "Sıra karşı tarafta. Kendi karşı teklifinize yanıt veremezsiniz.";

export const OFFER_NEGOTIATION_PROVIDER_FIRST_MESSAGE =
  "İlk karşı teklifi yalnız talep sahibi başlatabilir.";

export const OFFER_NEGOTIATION_PENDING_EXISTS_MESSAGE =
  "Bu teklifte zaten yanıt bekleyen bir karşı teklif var.";

export const OFFER_NEGOTIATION_CLOSED_MESSAGE =
  "Bu teklifte artık pazarlık yapılamaz.";

/** User-facing reject when a client still posts action=negotiate (legacy chat). */
export const LEGACY_CHAT_NEGOTIATE_CLOSED_MESSAGE =
  "Sohbet üzerinden pazarlık kapatıldı. Fiyat için karşı teklif kullanın; mesajlaşma anlaşmadan sonra açılır.";

export type OfferNegotiationDto = {
  id: string;
  amount: number;
  currency: string;
  proposedBySide: "BUYER" | "PROVIDER";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED" | "CANCELLED";
  createdAt: string;
};

export const offerNegotiationListInclude = {
  orderBy: { createdAt: "asc" as const },
  select: {
    id: true,
    amount: true,
    currency: true,
    proposedBySide: true,
    status: true,
    createdAt: true,
  },
};

export function toOfferNegotiationDtos(
  rows: Array<{
    id: string;
    amount: unknown;
    currency: string;
    proposedBySide: OfferNegotiationDto["proposedBySide"];
    status: OfferNegotiationDto["status"];
    createdAt: Date;
  }>,
): OfferNegotiationDto[] {
  return rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    proposedBySide: row.proposedBySide,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}
