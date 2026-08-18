import { formatOfferMoney } from "@/lib/offer/budget-offer-compare";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

export type NegotiationHistoryViewer = "buyer" | "seller";

export type NegotiationHistoryEvent = {
  id: string;
  negotiationId?: string;
  at: string;
  title: string;
  detail?: string;
  amountLabel?: string;
  tone: "neutral" | "amber" | "teal" | "rose";
};

function counterpart(side: "BUYER" | "PROVIDER"): "BUYER" | "PROVIDER" {
  return side === "BUYER" ? "PROVIDER" : "BUYER";
}

export function negotiationActorLabel(
  viewer: NegotiationHistoryViewer,
  side: "BUYER" | "PROVIDER",
): "Siz" | "Alıcı" | "Satıcı" {
  if (viewer === "buyer") {
    return side === "BUYER" ? "Siz" : "Satıcı";
  }
  return side === "PROVIDER" ? "Siz" : "Alıcı";
}

export function proposalTitle(
  viewer: NegotiationHistoryViewer,
  side: "BUYER" | "PROVIDER",
) {
  const actor = negotiationActorLabel(viewer, side);
  if (actor === "Siz") return "Sizin öneriniz";
  return side === "BUYER" ? "Alıcının önerisi" : "Satıcının önerisi";
}

export function rejectionTitle(
  viewer: NegotiationHistoryViewer,
  proposedBySide: "BUYER" | "PROVIDER",
) {
  const rejector = negotiationActorLabel(viewer, counterpart(proposedBySide));
  if (rejector === "Siz") return "Bu öneriyi reddettiniz";
  return `Bu öneri ${rejector.toLocaleLowerCase("tr-TR")} tarafından reddedildi`;
}

function formatWhen(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function pendingTurnDetail(
  viewer: NegotiationHistoryViewer,
  proposedBySide: "BUYER" | "PROVIDER",
) {
  const waitingFor = counterpart(proposedBySide);
  const actor = negotiationActorLabel(viewer, waitingFor);
  if (actor === "Siz") return "Sıra sizde";
  return waitingFor === "BUYER" ? "Sıra alıcıda" : "Sıra satıcıda";
}

export function buildNegotiationHistory(input: {
  viewer: NegotiationHistoryViewer;
  originalAmount: number;
  currency: string;
  offerStatus: string;
  offerCreatedAt?: string | Date | null;
  negotiations: OfferNegotiationDto[];
}): NegotiationHistoryEvent[] {
  const events: NegotiationHistoryEvent[] = [];
  const firstAt =
    input.offerCreatedAt ??
    input.negotiations[0]?.createdAt ??
    new Date().toISOString();
  events.push({
    id: "original-offer",
    at: formatWhen(firstAt),
    title: input.viewer === "seller" ? "İlk teklifiniz" : "İlk teklif",
    amountLabel: formatOfferMoney(input.originalAmount, input.currency),
    tone: "neutral",
  });

  const rows = [...input.negotiations].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  for (const row of rows) {
    events.push({
      id: `${row.id}-proposed`,
      negotiationId: row.id,
      at: formatWhen(row.createdAt),
      title: proposalTitle(input.viewer, row.proposedBySide),
      amountLabel: formatOfferMoney(row.amount, row.currency),
      detail:
        row.status === "PENDING"
          ? pendingTurnDetail(input.viewer, row.proposedBySide)
          : row.status === "SUPERSEDED"
            ? "Yerine yeni bir tur geldi"
            : undefined,
      tone: row.status === "PENDING" ? "amber" : "neutral",
    });

    if (row.status === "REJECTED") {
      events.push({
        id: `${row.id}-rejected`,
        negotiationId: row.id,
        at: formatWhen(row.respondedAt ?? row.createdAt),
        title: rejectionTitle(input.viewer, row.proposedBySide),
        tone: "rose",
      });
    }

    if (row.status === "ACCEPTED") {
      events.push({
        id: `${row.id}-accepted`,
        negotiationId: row.id,
        at: formatWhen(row.respondedAt ?? row.createdAt),
        title:
          negotiationActorLabel(input.viewer, counterpart(row.proposedBySide)) ===
          "Siz"
            ? "Bu öneriyi kabul ettiniz"
            : "Bu öneri kabul edildi",
        amountLabel: formatOfferMoney(row.amount, row.currency),
        tone: "teal",
      });
    }

    if (row.status === "CANCELLED") {
      events.push({
        id: `${row.id}-cancelled`,
        negotiationId: row.id,
        at: formatWhen(row.respondedAt ?? row.createdAt),
        title: "Bu tur iptal edildi",
        tone: "neutral",
      });
    }
  }

  if (input.offerStatus === "REJECTED") {
    events.push({
      id: "offer-rejected",
      at: formatWhen(rows.at(-1)?.respondedAt ?? rows.at(-1)?.createdAt ?? firstAt),
      title: "Teklif reddedildi",
      tone: "rose",
    });
  }

  if (input.offerStatus === "ACCEPTED") {
    const accepted = rows.find((row) => row.status === "ACCEPTED");
    const agreed = resolveOfferCommercialAmount({
      offerAmount: input.originalAmount,
      acceptedNegotiationAmount: accepted?.amount ?? null,
    });
    events.push({
      id: "offer-accepted",
      negotiationId: accepted?.id,
      at: formatWhen(accepted?.respondedAt ?? accepted?.createdAt ?? firstAt),
      title: "Teklif kabul edildi",
      detail: "Anlaşılan fiyat",
      amountLabel: formatOfferMoney(agreed, input.currency),
      tone: "teal",
    });
  }

  return events;
}

export function negotiationRoundCount(negotiations: OfferNegotiationDto[]) {
  return negotiations.length;
}

export function historyShouldAutoOpen(
  negotiations: OfferNegotiationDto[],
  highlightNegotiationId?: string | null,
) {
  if (!highlightNegotiationId) return false;
  return negotiations.some((row) => row.id === highlightNegotiationId);
}

export function currentTurnCopy(
  viewer: NegotiationHistoryViewer,
  offerStatus: string,
  negotiations: OfferNegotiationDto[],
): string | null {
  if (!["SUBMITTED", "VIEWED"].includes(offerStatus)) return null;
  const pending = currentPendingNegotiation(negotiations);
  if (!pending) return null;
  return pendingTurnDetail(viewer, pending.proposedBySide);
}
