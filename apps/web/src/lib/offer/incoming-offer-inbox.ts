import {
  classifyOutgoingOfferInbox,
  countOutgoingOfferInbox,
  currentPendingNegotiation,
  resolveOutgoingOfferInboxFilter,
} from "@/lib/offer/outgoing-offer-inbox";
import { NEGOTIABLE_OFFER_STATUSES } from "@/lib/offer/offer-negotiation";
import type { OutgoingOfferInboxInput } from "@/lib/offer/outgoing-offer-inbox";

export const INCOMING_OFFER_INBOX_FILTERS = [
  "all",
  "new",
  "negotiating",
  "accepted",
  "rejected",
] as const;

export type IncomingOfferInboxFilter =
  (typeof INCOMING_OFFER_INBOX_FILTERS)[number];

export type IncomingOfferInboxBucket =
  | "new"
  | "negotiating"
  | "accepted"
  | "rejected"
  | "closed";

const DURUM_TO_FILTER = {
  yeni: "new",
  pazarlik: "negotiating",
  kabul: "accepted",
  red: "rejected",
  tumu: "all",
} as const satisfies Record<string, IncomingOfferInboxFilter>;

const FILTER_TO_DURUM: Record<IncomingOfferInboxFilter, string | null> = {
  all: null,
  new: "yeni",
  negotiating: "pazarlik",
  accepted: "kabul",
  rejected: "red",
};

export const INCOMING_OFFER_INBOX_LABELS: Record<
  IncomingOfferInboxFilter,
  string
> = {
  all: "Tümü",
  new: "Yeni teklifler",
  negotiating: "Pazarlıkta",
  accepted: "Kabul edilen",
  rejected: "Reddedilen",
};

export const INCOMING_OFFER_INBOX_EMPTY: Record<
  IncomingOfferInboxFilter,
  string
> = {
  all: "Henüz gelen teklif yok.",
  new: "Yanıtınızı bekleyen yeni teklif yok.",
  negotiating: "Devam eden pazarlığınız yok.",
  accepted: "Henüz kabul ettiğiniz teklif yok.",
  rejected: "Reddedilen teklif yok.",
};

export function parseIncomingOfferInboxDurum(
  raw: string | string[] | undefined | null,
): { filter: IncomingOfferInboxFilter; explicit: boolean } {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { filter: "all", explicit: false };
  const mapped = DURUM_TO_FILTER[trimmed as keyof typeof DURUM_TO_FILTER];
  if (!mapped) return { filter: "all", explicit: true };
  return { filter: mapped, explicit: true };
}

export function classifyIncomingOfferInbox(
  offer: OutgoingOfferInboxInput,
): IncomingOfferInboxBucket {
  const bucket = classifyOutgoingOfferInbox(offer);
  if (bucket === "sent") return "new";
  return bucket;
}

export function offerMatchesIncomingInboxFilter(
  bucket: IncomingOfferInboxBucket,
  filter: IncomingOfferInboxFilter,
): boolean {
  if (filter === "all") return true;
  return bucket === filter;
}

export function countIncomingOfferInbox(offers: OutgoingOfferInboxInput[]) {
  const outgoing = countOutgoingOfferInbox(offers);
  return {
    all: outgoing.all,
    new: outgoing.sent,
    negotiating: outgoing.negotiating,
    accepted: outgoing.accepted,
    rejected: outgoing.rejected,
    closed: outgoing.closed,
  };
}

export function resolveIncomingOfferInboxFilter(input: {
  requested: IncomingOfferInboxFilter;
  explicit: boolean;
  highlightBucket: IncomingOfferInboxBucket | null;
}) {
  const mapped =
    input.highlightBucket === "new"
      ? ("sent" as const)
      : input.highlightBucket;
  const resolved = resolveOutgoingOfferInboxFilter({
    requested:
      input.requested === "new" ? "sent" : input.requested,
    explicit: input.explicit,
    highlightBucket: mapped === "closed" ? "closed" : mapped,
  });
  return {
    filter:
      resolved.filter === "sent"
        ? ("new" as const)
        : (resolved.filter as IncomingOfferInboxFilter),
    redirect: resolved.redirect,
  };
}

export function buildIncomingOffersPath(input: {
  filter: IncomingOfferInboxFilter;
  teklif?: string | null;
  tur?: string | null;
}): string {
  const params = new URLSearchParams();
  const durum = FILTER_TO_DURUM[input.filter];
  if (durum) params.set("durum", durum);
  else if (input.teklif || input.tur) params.set("durum", "tumu");
  if (input.teklif) params.set("teklif", input.teklif);
  if (input.tur) params.set("tur", input.tur);
  const query = params.toString();
  return query ? `/panel/gelen-teklifler?${query}` : "/panel/gelen-teklifler";
}

export function isBuyerActionableIncomingOffer(offer: OutgoingOfferInboxInput) {
  if (!(NEGOTIABLE_OFFER_STATUSES as readonly string[]).includes(offer.status)) {
    return false;
  }
  const pending = currentPendingNegotiation(offer.negotiations);
  if (!pending) return true;
  return pending.proposedBySide === "PROVIDER";
}

export function buyerActionableIncomingOffersWhere(userId: string) {
  return {
    request: { createdById: userId, deletedAt: null },
    status: { in: [...NEGOTIABLE_OFFER_STATUSES] },
    NOT: { submittedById: userId, companyId: null },
    OR: [
      { negotiations: { none: { status: "PENDING" as const } } },
      {
        negotiations: {
          some: {
            status: "PENDING" as const,
            proposedBySide: "PROVIDER" as const,
          },
        },
      },
    ],
  };
}
