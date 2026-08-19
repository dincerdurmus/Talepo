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
  "unread",
  "new",
  "action_required",
  "negotiating",
  "concluded",
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
  okunmadi: "unread",
  yanit: "action_required",
  pazarlik: "negotiating",
  sonuclanan: "concluded",
  kabul: "concluded",
  red: "concluded",
  tumu: "all",
} as const satisfies Record<string, IncomingOfferInboxFilter>;

const FILTER_TO_DURUM: Record<IncomingOfferInboxFilter, string | null> = {
  all: null,
  unread: "okunmadi",
  new: "yeni",
  action_required: "yanit",
  negotiating: "pazarlik",
  concluded: "sonuclanan",
};

export const INCOMING_OFFER_INBOX_LABELS: Record<
  IncomingOfferInboxFilter,
  string
> = {
  all: "Tümü",
  unread: "Okunmadı",
  new: "Yeni teklifler",
  action_required: "Yanıtınız beklenenler",
  negotiating: "Pazarlıkta",
  concluded: "Sonuçlananlar",
};

export const INCOMING_OFFER_INBOX_EMPTY: Record<
  IncomingOfferInboxFilter,
  string
> = {
  all: "Henüz gelen teklif yok.",
  unread: "Okunmamış teklif bulunan talep yok.",
  new: "Yeni teklif bulunan talep yok.",
  action_required: "Yanıtınızı bekleyen teklif bulunan talep yok.",
  negotiating: "Pazarlıktaki teklif bulunan talep yok.",
  concluded: "Sonuçlanmış teklif bulunan talep yok.",
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
  options?: {
    offerId?: string;
    unreadOfferIds?: ReadonlySet<string>;
    offer?: OutgoingOfferInboxInput;
  },
): boolean {
  if (filter === "unread") {
    return Boolean(
      options?.offerId &&
        options.unreadOfferIds?.has(options.offerId),
    );
  }
  if (filter === "action_required") {
    return Boolean(options?.offer && isBuyerActionableIncomingOffer(options.offer));
  }
  if (filter === "concluded") {
    return bucket === "accepted" || bucket === "rejected" || bucket === "closed";
  }
  if (filter === "all") return true;
  if (filter === "new") return bucket === "new";
  return bucket === filter;
}

export function countIncomingOfferInbox(
  offers: OutgoingOfferInboxInput[],
  unreadOfferIds?: ReadonlySet<string>,
) {
  const outgoing = countOutgoingOfferInbox(offers);
  const unreadCount = unreadOfferIds
    ? offers.filter((offer) =>
        unreadOfferIds.has((offer as { id?: string }).id ?? ""),
      ).length
    : 0;
  return {
    all: outgoing.all,
    unread: unreadCount,
    new: outgoing.sent,
    action_required: offers.filter(isBuyerActionableIncomingOffer).length,
    negotiating: outgoing.negotiating,
    concluded: outgoing.accepted + outgoing.rejected + outgoing.closed,
  };
}

export function resolveIncomingOfferInboxFilter(input: {
  requested: IncomingOfferInboxFilter;
  explicit: boolean;
  highlightBucket: IncomingOfferInboxBucket | null;
}) {
  if (
    input.requested === "unread" ||
    input.requested === "action_required" ||
    input.requested === "concluded"
  ) {
    return { filter: input.requested, redirect: false };
  }

  const mapped =
    input.highlightBucket === "new"
      ? ("sent" as const)
      : input.highlightBucket === "accepted" ||
          input.highlightBucket === "rejected" ||
          input.highlightBucket === "closed"
        ? ("closed" as const)
        : input.highlightBucket;
  const resolved = resolveOutgoingOfferInboxFilter({
    requested: input.requested === "new" ? "sent" : input.requested,
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

export function buildIncomingOffersInboxPath(input: {
  filter: IncomingOfferInboxFilter;
  archiveView?: boolean;
}): string {
  const params = new URLSearchParams();
  const durum = FILTER_TO_DURUM[input.filter];
  if (durum) params.set("durum", durum);
  if (input.archiveView) params.set("gorunum", "arsiv");
  const query = params.toString();
  return query ? `/panel/gelen-teklifler?${query}` : "/panel/gelen-teklifler";
}

export function buildIncomingRequestWorkspacePath(input: {
  requestId: string;
  filter?: IncomingOfferInboxFilter;
  teklif?: string | null;
  tur?: string | null;
  archiveView?: boolean;
}): string {
  const params = new URLSearchParams();
  const durum = input.filter ? FILTER_TO_DURUM[input.filter] : null;
  if (durum) params.set("durum", durum);
  if (input.archiveView) params.set("gorunum", "arsiv");
  if (input.teklif) params.set("teklif", input.teklif);
  if (input.tur) params.set("tur", input.tur);
  const query = params.toString();
  return query
    ? `/panel/gelen-teklifler/${input.requestId}?${query}`
    : `/panel/gelen-teklifler/${input.requestId}`;
}

/** @deprecated Use buildIncomingOffersInboxPath or buildIncomingRequestWorkspacePath */
export function buildIncomingOffersPath(input: {
  filter: IncomingOfferInboxFilter;
  teklif?: string | null;
  tur?: string | null;
  archiveView?: boolean;
  requestId?: string | null;
}): string {
  if (input.requestId) {
    return buildIncomingRequestWorkspacePath({
      requestId: input.requestId,
      filter: input.filter,
      teklif: input.teklif,
      tur: input.tur,
      archiveView: input.archiveView,
    });
  }
  if (input.teklif || input.tur) {
    const params = new URLSearchParams();
    const durum = FILTER_TO_DURUM[input.filter];
    if (durum) params.set("durum", durum);
    else params.set("durum", "tumu");
    if (input.archiveView) params.set("gorunum", "arsiv");
    if (input.teklif) params.set("teklif", input.teklif);
    if (input.tur) params.set("tur", input.tur);
    return `/panel/gelen-teklifler?${params.toString()}`;
  }
  return buildIncomingOffersInboxPath({
    filter: input.filter,
    archiveView: input.archiveView,
  });
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
