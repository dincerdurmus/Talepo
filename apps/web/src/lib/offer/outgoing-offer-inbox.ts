import { NEGOTIABLE_OFFER_STATUSES } from "@/lib/offer/offer-negotiation";

export const OUTGOING_OFFER_INBOX_FILTERS = [
  "all",
  "unread",
  "sent",
  "negotiating",
  "accepted",
  "rejected",
] as const;

export type OutgoingOfferInboxFilter =
  (typeof OUTGOING_OFFER_INBOX_FILTERS)[number];

/** Exclusive bucket for one offer. `closed` is Tümü-only (not Reddedilen). */
export type OutgoingOfferInboxBucket =
  | "sent"
  | "negotiating"
  | "accepted"
  | "rejected"
  | "closed";

const DURUM_TO_FILTER = {
  okunmadi: "unread",
  gonderilen: "sent",
  pazarlik: "negotiating",
  kabul: "accepted",
  red: "rejected",
  tumu: "all",
} as const satisfies Record<string, OutgoingOfferInboxFilter>;

const FILTER_TO_DURUM: Record<OutgoingOfferInboxFilter, string | null> = {
  all: null,
  unread: "okunmadi",
  sent: "gonderilen",
  negotiating: "pazarlik",
  accepted: "kabul",
  rejected: "red",
};

export const OUTGOING_OFFER_INBOX_LABELS: Record<
  OutgoingOfferInboxFilter,
  string
> = {
  all: "Tümü",
  unread: "Okunmadı",
  sent: "Gönderilen",
  negotiating: "Pazarlıkta",
  accepted: "Kabul edilen",
  rejected: "Reddedilen",
};

export const OUTGOING_OFFER_INBOX_EMPTY: Record<
  OutgoingOfferInboxFilter,
  string
> = {
  all: "Henüz gönderilmiş teklifiniz yok.",
  unread: "Okunmamış teklif yok.",
  sent: "Bekleyen gönderilmiş teklifiniz yok.",
  negotiating: "Devam eden pazarlığınız yok.",
  accepted: "Henüz kabul edilen teklifiniz yok.",
  rejected: "Reddedilen teklifiniz yok.",
};

export type OutgoingOfferInboxNegotiation = {
  status: string;
  proposedBySide?: string;
  createdAt?: string | Date;
};

export type OutgoingOfferInboxInput = {
  status: string;
  negotiations: OutgoingOfferInboxNegotiation[];
};

export function parseOutgoingOfferInboxDurum(
  raw: string | string[] | undefined | null,
): { filter: OutgoingOfferInboxFilter; explicit: boolean } {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { filter: "all", explicit: false };
  const mapped = DURUM_TO_FILTER[trimmed as keyof typeof DURUM_TO_FILTER];
  if (!mapped) return { filter: "all", explicit: true };
  return { filter: mapped, explicit: true };
}

export function outgoingOfferInboxDurumParam(
  filter: OutgoingOfferInboxFilter,
): string | null {
  return FILTER_TO_DURUM[filter];
}

export function currentPendingNegotiation<
  T extends OutgoingOfferInboxNegotiation,
>(negotiations: T[]): T | undefined {
  const pending = negotiations.filter((row) => row.status === "PENDING");
  if (pending.length === 0) return undefined;
  return pending.reduce((latest, row) => {
    const left = new Date(latest.createdAt ?? 0).getTime();
    const right = new Date(row.createdAt ?? 0).getTime();
    return right >= left ? row : latest;
  });
}

export function classifyOutgoingOfferInbox(
  offer: OutgoingOfferInboxInput,
): OutgoingOfferInboxBucket {
  if (offer.status === "ACCEPTED") return "accepted";
  if (offer.status === "REJECTED") return "rejected";
  if (
    offer.status === "WITHDRAWN" ||
    offer.status === "EXPIRED" ||
    offer.status === "DRAFT"
  ) {
    return "closed";
  }
  if (
    (NEGOTIABLE_OFFER_STATUSES as readonly string[]).includes(offer.status)
  ) {
    return currentPendingNegotiation(offer.negotiations)
      ? "negotiating"
      : "sent";
  }
  return "closed";
}

export function offerMatchesOutgoingInboxFilter(
  bucket: OutgoingOfferInboxBucket,
  filter: OutgoingOfferInboxFilter,
  options?: { offerId?: string; unreadOfferIds?: ReadonlySet<string> },
): boolean {
  if (filter === "unread") {
    return Boolean(
      options?.offerId &&
        options.unreadOfferIds?.has(options.offerId),
    );
  }
  if (filter === "all") return true;
  return bucket === filter;
}

export function countOutgoingOfferInbox(
  offers: OutgoingOfferInboxInput[],
  unreadOfferIds?: ReadonlySet<string>,
): Record<OutgoingOfferInboxFilter, number> & { closed: number } {
  const counts = {
    all: offers.length,
    unread: unreadOfferIds
      ? offers.filter((offer) =>
          unreadOfferIds.has((offer as { id?: string }).id ?? ""),
        ).length
      : 0,
    sent: 0,
    negotiating: 0,
    accepted: 0,
    rejected: 0,
    closed: 0,
  };
  for (const offer of offers) {
    counts[classifyOutgoingOfferInbox(offer)] += 1;
  }
  return counts;
}

export function isSellerActionableOutgoingOffer(
  offer: OutgoingOfferInboxInput,
): boolean {
  if (!(NEGOTIABLE_OFFER_STATUSES as readonly string[]).includes(offer.status)) {
    return false;
  }
  const pending = currentPendingNegotiation(offer.negotiations);
  return pending?.proposedBySide === "BUYER";
}

export function countSellerActionableOutgoingOffers(
  offers: OutgoingOfferInboxInput[],
): number {
  return offers.filter(isSellerActionableOutgoingOffer).length;
}

export function sellerActionableOutgoingOffersWhere(scope: {
  userId: string;
  companyId: string | null;
}) {
  return {
    status: { in: [...NEGOTIABLE_OFFER_STATUSES] },
    ...(scope.companyId
      ? { companyId: scope.companyId }
      : { submittedById: scope.userId, companyId: null }),
    negotiations: {
      some: {
        status: "PENDING" as const,
        proposedBySide: "BUYER" as const,
      },
    },
  };
}

export function formatPanelCountBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? "99+" : String(count);
}

export function sellerPendingNegotiationAria(
  count: number,
): string | undefined {
  if (count <= 0) return undefined;
  return `yanıtınızı bekleyen ${count} pazarlık`;
}

export function resolveOutgoingOfferInboxFilter(input: {
  requested: OutgoingOfferInboxFilter;
  explicit: boolean;
  highlightBucket: OutgoingOfferInboxBucket | null;
}): { filter: OutgoingOfferInboxFilter; redirect: boolean } {
  if (input.requested === "unread") {
    return { filter: "unread", redirect: false };
  }

  const highlight = input.highlightBucket;
  const highlightFilter: OutgoingOfferInboxFilter | null =
    highlight === "sent" ||
    highlight === "negotiating" ||
    highlight === "accepted" ||
    highlight === "rejected"
      ? highlight
      : null;

  if (!highlightFilter) {
    return { filter: input.requested, redirect: false };
  }

  if (!input.explicit) {
    return { filter: highlightFilter, redirect: true };
  }

  if (input.requested !== "all" && input.requested !== highlightFilter) {
    return { filter: highlightFilter, redirect: true };
  }

  return { filter: input.requested, redirect: false };
}

export function buildOutgoingOffersPath(input: {
  filter: OutgoingOfferInboxFilter;
  teklif?: string | null;
  tur?: string | null;
  gonderildi?: string | null;
  guncellendi?: string | null;
  archiveView?: boolean;
}): string {
  const params = new URLSearchParams();
  const durum = outgoingOfferInboxDurumParam(input.filter);
  if (durum) {
    params.set("durum", durum);
  } else if (input.teklif || input.tur) {
    params.set("durum", "tumu");
  }
  if (input.archiveView) params.set("gorunum", "arsiv");
  if (input.teklif) params.set("teklif", input.teklif);
  if (input.tur) params.set("tur", input.tur);
  if (input.gonderildi) params.set("gonderildi", input.gonderildi);
  if (input.guncellendi) params.set("guncellendi", input.guncellendi);
  const query = params.toString();
  return query ? `/panel/teklifler?${query}` : "/panel/teklifler";
}
