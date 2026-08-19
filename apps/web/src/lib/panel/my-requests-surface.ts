import { buildIncomingRequestWorkspacePath } from "@/lib/offer/incoming-offer-inbox";
import {
  classifySayfamProcess,
  SAYFAM_ACTIVE_PROCESS_STATUSES,
  type SayfamProcessKind,
} from "@/lib/panel/sayfam-focus";

/** Mirrors `canEditRequestStatus` in update-request.ts. Not a second authority. */
export const MY_REQUEST_EDITABLE_STATUSES = new Set([
  "DRAFT",
  "PUBLISHED",
  "RECEIVING_OFFERS",
]);

/** Mirrors `canDeleteRequestStatus` in delete-request.ts. Not a second authority. */
export const MY_REQUEST_DELETE_BLOCKED_STATUSES = new Set([
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
]);

export const MY_REQUEST_FILTERS = [
  "all",
  "active",
  "concluded",
  "expired",
  "draft",
] as const;

export type MyRequestFilter = (typeof MY_REQUEST_FILTERS)[number];

export const MY_REQUEST_PRIMARY_FILTERS: readonly MyRequestFilter[] = [
  "all",
  "active",
  "concluded",
  "expired",
];

export const MY_REQUEST_SECONDARY_FILTERS: readonly MyRequestFilter[] = [
  "draft",
];

export type MyRequestLifecycle = "active" | "draft" | "concluded" | "expired";

export type MyRequestLane =
  | "action_required"
  | "new_offer"
  | "negotiating"
  | "in_progress"
  | "awaiting_offers"
  | "draft"
  | "concluded";

export const MY_REQUEST_LIFECYCLE_PRIORITY: Record<MyRequestLifecycle, number> =
  {
    active: 0,
    draft: 1,
    expired: 2,
    concluded: 3,
  };

export const MY_REQUEST_LANE_PRIORITY: Record<MyRequestLane, number> = {
  action_required: 0,
  new_offer: 1,
  negotiating: 2,
  in_progress: 3,
  awaiting_offers: 4,
  draft: 5,
  concluded: 6,
};

export const MY_REQUEST_FILTER_LABEL: Record<MyRequestFilter, string> = {
  all: "Tümü",
  active: "Aktif",
  concluded: "Sonuçlanan",
  expired: "Süresi dolan",
  draft: "Taslaklar",
};

export const MY_REQUEST_FILTER_EMPTY: Record<MyRequestFilter, string> = {
  all: "Henüz talebiniz yok.",
  active: "Aktif talebiniz yok.",
  concluded: "Sonuçlanan talebiniz yok.",
  expired: "Süresi dolan talebiniz yok.",
  draft: "Taslak talebiniz yok.",
};

const DURUM_TO_FILTER = {
  tumu: "all",
  aktif: "active",
  sonuclanan: "concluded",
  suresi: "expired",
  taslak: "draft",
} as const satisfies Record<string, MyRequestFilter>;

const FILTER_TO_DURUM: Record<MyRequestFilter, string | null> = {
  all: null,
  active: "aktif",
  concluded: "sonuclanan",
  expired: "suresi",
  draft: "taslak",
};

export const MY_REQUEST_ACTIVE_STATUSES = new Set<string>(
  SAYFAM_ACTIVE_PROCESS_STATUSES,
);

export const MY_REQUEST_CONCLUDED_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

export const MY_REQUEST_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayında",
  RECEIVING_OFFERS: "Teklif alıyor",
  OFFER_SELECTED: "Süreç devam ediyor",
  IN_PROGRESS: "Süreç devam ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal edildi",
  EXPIRED: "Süresi doldu",
};

export type MyRequestSignals = {
  status: string;
  deleted?: boolean;
  totalOffers: number;
  actionRequiredCount: number;
  unreadCount: number;
  newCount: number;
  negotiatingCount: number;
  waitingForCounterparty: boolean;
  conversationId: string | null;
};

export type MyRequestPrimaryCta = {
  kind: "review_offers" | "messages" | "view" | "view_process" | "continue_edit";
  label: string;
  href: string;
};

export type MyRequestCardModel = {
  id: string;
  title: string;
  status: string;
  lifecycle: MyRequestLifecycle;
  lane: MyRequestLane;
  statusLabel: string;
  nextStep: string;
  categoryName: string;
  categorySlug: string;
  coverImageUrl: string | null;
  locationLabel: string | null;
  budgetLabel: string | null;
  lastActivityAt: number;
  lastActivityLabel: string;
  offerCount: number;
  newCount: number;
  actionRequiredCount: number;
  hasNegotiationSignal: boolean;
  hasMessageSignal: boolean;
  isUrgent: boolean;
  primaryCta: MyRequestPrimaryCta;
  canEdit: boolean;
  editHref: string;
  viewHref: string;
  canDelete: boolean;
  canCloneAsDraft: boolean;
};

export function parseMyRequestsFilter(
  raw: string | string[] | undefined | null,
): MyRequestFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "all";
  return DURUM_TO_FILTER[trimmed as keyof typeof DURUM_TO_FILTER] ?? "all";
}

export function buildMyRequestsPath(filter: MyRequestFilter): string {
  const durum = FILTER_TO_DURUM[filter];
  return durum ? `/panel/taleplerim?durum=${durum}` : "/panel/taleplerim";
}

export function classifyMyRequestLifecycle(status: string): MyRequestLifecycle {
  if (status === "DRAFT") return "draft";
  if (status === "EXPIRED") return "expired";
  if (MY_REQUEST_CONCLUDED_STATUSES.has(status)) return "concluded";
  return "active";
}

export function canDeleteMyRequestStatus(status: string): boolean {
  return !MY_REQUEST_DELETE_BLOCKED_STATUSES.has(status);
}

/** Mirrors `canCloneRequestAsDraft` — COMPLETED/CANCELLED only, never EXPIRED. */
export function canCloneMyRequestAsDraft(status: string): boolean {
  return MY_REQUEST_CONCLUDED_STATUSES.has(status);
}

export function classifyMyRequestLane(input: MyRequestSignals): MyRequestLane {
  const lifecycle = classifyMyRequestLifecycle(input.status);
  if (lifecycle === "draft") return "draft";
  if (lifecycle === "concluded" || lifecycle === "expired") return "concluded";

  const kind = classifySayfamProcess({
    requestStatus: input.status,
    totalOffers: input.totalOffers,
    actionRequiredCount: input.actionRequiredCount,
    unreadCount: input.unreadCount,
    newCount: input.newCount,
    negotiatingCount: input.negotiatingCount,
    waitingForCounterparty: input.waitingForCounterparty,
  });

  return laneFromProcessKind(kind, input.status);
}

function laneFromProcessKind(
  kind: SayfamProcessKind | null,
  status: string,
): MyRequestLane {
  if (kind === "action_required") return "action_required";
  if (kind === "new_offer") return "new_offer";
  if (kind === "negotiating" || kind === "waiting_counterparty") {
    return "negotiating";
  }
  if (kind === "in_progress") return "in_progress";
  if (kind === "awaiting_offers") return "awaiting_offers";
  if (status === "OFFER_SELECTED" || status === "IN_PROGRESS") {
    return "in_progress";
  }
  return "awaiting_offers";
}

export function myRequestStatusLabel(status: string): string {
  return MY_REQUEST_STATUS_LABEL[status] ?? "Talep";
}

export function myRequestNextStep(input: {
  lifecycle: MyRequestLifecycle;
  lane: MyRequestLane;
  offerCount: number;
}): string {
  if (input.lifecycle === "draft") {
    return "Düzenlemeye devam edip yayınlayın.";
  }
  if (input.lifecycle === "expired") {
    return "Bu talebin süresi doldu.";
  }
  if (input.lifecycle === "concluded") {
    return "Bu talep sonuçlandı.";
  }

  switch (input.lane) {
    case "action_required":
      return "Teklifleri inceleyip yanıtlayın.";
    case "new_offer":
      return "Gelen teklifi inceleyin.";
    case "negotiating":
      return "Pazarlığı buradan sürdürün.";
    case "in_progress":
      return "Anlaşılan süreci mesajlardan takip edin.";
    case "awaiting_offers":
      return input.offerCount > 0
        ? "Teklifler toplanıyor."
        : "Satıcıların teklifini bekliyorsunuz.";
    default:
      return "Talebinizi buradan takip edin.";
  }
}

export function resolveMyRequestPrimaryCta(input: {
  requestId: string;
  lifecycle: MyRequestLifecycle;
  lane: MyRequestLane;
  conversationId: string | null;
  unreadCount: number;
}): MyRequestPrimaryCta {
  const viewHref = `/panel/taleplerim/${input.requestId}`;
  const editHref = `/panel/taleplerim/${input.requestId}/duzenle`;

  if (input.lifecycle === "draft") {
    return {
      kind: "continue_edit",
      label: "Düzenlemeye devam et",
      href: editHref,
    };
  }

  if (input.lifecycle === "concluded") {
    return {
      kind: "view_process",
      label: "Süreci görüntüle",
      href: `${viewHref}#surec`,
    };
  }

  if (input.lifecycle === "expired") {
    return {
      kind: "view",
      label: "Talebi görüntüle",
      href: viewHref,
    };
  }

  if (input.lane === "in_progress" && input.conversationId) {
    return {
      kind: "messages",
      label: "Mesajlara git",
      href: `/panel/mesajlar/${input.conversationId}`,
    };
  }

  if (
    input.lane === "action_required" ||
    input.lane === "new_offer" ||
    input.lane === "negotiating"
  ) {
    const filter =
      input.lane === "action_required"
        ? "action_required"
        : input.lane === "new_offer"
          ? input.unreadCount > 0
            ? "unread"
            : "new"
          : "negotiating";
    return {
      kind: "review_offers",
      label: "Teklifleri incele",
      href: buildIncomingRequestWorkspacePath({
        requestId: input.requestId,
        filter,
      }),
    };
  }

  return {
    kind: "view",
    label: "Talebi görüntüle",
    href: viewHref,
  };
}

export function requestMatchesMyFilter(
  card: Pick<MyRequestCardModel, "lifecycle" | "status">,
  filter: MyRequestFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return card.lifecycle === "active";
    case "concluded":
      return card.lifecycle === "concluded";
    case "expired":
      return card.lifecycle === "expired";
    case "draft":
      return card.lifecycle === "draft";
  }
}

export function exclusiveLifecycleFilters(
  card: Pick<MyRequestCardModel, "lifecycle" | "status">,
): MyRequestFilter[] {
  return MY_REQUEST_FILTERS.filter(
    (filter) => filter !== "all" && requestMatchesMyFilter(card, filter),
  );
}

export function countMyRequestFilters(
  cards: readonly Pick<MyRequestCardModel, "id" | "lifecycle" | "status">[],
): Record<MyRequestFilter, number> {
  const counts = {
    all: 0,
    active: 0,
    concluded: 0,
    expired: 0,
    draft: 0,
  } satisfies Record<MyRequestFilter, number>;

  const seen = {
    all: new Set<string>(),
    active: new Set<string>(),
    concluded: new Set<string>(),
    expired: new Set<string>(),
    draft: new Set<string>(),
  } satisfies Record<MyRequestFilter, Set<string>>;

  for (const card of cards) {
    for (const filter of MY_REQUEST_FILTERS) {
      if (!requestMatchesMyFilter(card, filter)) continue;
      if (seen[filter].has(card.id)) continue;
      seen[filter].add(card.id);
      counts[filter] += 1;
    }
  }

  return counts;
}

export function filterMyRequests<
  T extends Pick<MyRequestCardModel, "lifecycle" | "status">,
>(cards: readonly T[], filter: MyRequestFilter): T[] {
  return cards.filter((card) => requestMatchesMyFilter(card, filter));
}

export function sortMyRequests<
  T extends Pick<
    MyRequestCardModel,
    "lifecycle" | "lane" | "lastActivityAt"
  >,
>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => {
    const life = MY_REQUEST_LIFECYCLE_PRIORITY[a.lifecycle];
    const lifeRight = MY_REQUEST_LIFECYCLE_PRIORITY[b.lifecycle];
    if (life !== lifeRight) return life - lifeRight;
    const left = MY_REQUEST_LANE_PRIORITY[a.lane];
    const right = MY_REQUEST_LANE_PRIORITY[b.lane];
    if (left !== right) return left - right;
    return b.lastActivityAt - a.lastActivityAt;
  });
}

export function formatMyRequestLocation(
  city?: string | null,
  district?: string | null,
): string | null {
  const cityLabel = city?.trim() ?? "";
  const districtLabel = district?.trim() ?? "";
  if (!cityLabel && !districtLabel) return null;
  if (!districtLabel) return cityLabel;
  if (!cityLabel) return districtLabel;
  if (
    cityLabel.includes(districtLabel) ||
    districtLabel.includes(cityLabel)
  ) {
    return cityLabel.length >= districtLabel.length ? cityLabel : districtLabel;
  }
  return `${cityLabel} · ${districtLabel}`;
}

export function formatMyRequestActivityLabel(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Dün";
  if (days < 7) return `${days} gün önce`;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function toMyRequestCardModel(input: {
  id: string;
  title: string;
  status: string;
  categoryName: string;
  categorySlug: string;
  coverImageUrl: string | null;
  city?: string | null;
  district?: string | null;
  budgetLabel: string | null;
  lastActivityAt: Date;
  offerCount: number;
  isUrgent: boolean;
  signals: MyRequestSignals;
}): MyRequestCardModel {
  const lifecycle = classifyMyRequestLifecycle(input.status);
  const lane = classifyMyRequestLane(input.signals);
  const viewHref = `/panel/taleplerim/${input.id}`;
  const editHref = `/panel/taleplerim/${input.id}/duzenle`;
  const canEdit = MY_REQUEST_EDITABLE_STATUSES.has(input.status);

  return {
    id: input.id,
    title: input.title,
    status: input.status,
    lifecycle,
    lane,
    statusLabel: myRequestStatusLabel(input.status),
    nextStep: myRequestNextStep({
      lifecycle,
      lane,
      offerCount: input.offerCount,
    }),
    categoryName: input.categoryName,
    categorySlug: input.categorySlug,
    coverImageUrl: input.coverImageUrl,
    locationLabel: formatMyRequestLocation(input.city, input.district),
    budgetLabel: input.budgetLabel,
    lastActivityAt: input.lastActivityAt.getTime(),
    lastActivityLabel: formatMyRequestActivityLabel(input.lastActivityAt),
    offerCount: input.offerCount,
    newCount: input.signals.newCount,
    actionRequiredCount: input.signals.actionRequiredCount,
    hasNegotiationSignal:
      lane === "negotiating" || input.signals.negotiatingCount > 0,
    hasMessageSignal: Boolean(input.signals.conversationId),
    isUrgent: input.isUrgent,
    primaryCta: resolveMyRequestPrimaryCta({
      requestId: input.id,
      lifecycle,
      lane,
      conversationId: input.signals.conversationId,
      unreadCount: input.signals.unreadCount,
    }),
    canEdit,
    editHref,
    viewHref,
    canDelete: canDeleteMyRequestStatus(input.status),
    canCloneAsDraft: canCloneMyRequestAsDraft(input.status),
  };
}

export type MyRequestBannerSummary = {
  totalCount: number;
  activeCount: number;
  concludedCount: number;
  expiredCount: number;
};

export function summarizeMyRequestBanner(
  cards: readonly Pick<MyRequestCardModel, "id" | "lifecycle">[],
): MyRequestBannerSummary {
  const seen = new Set<string>();
  let totalCount = 0;
  let activeCount = 0;
  let concludedCount = 0;
  let expiredCount = 0;

  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    totalCount += 1;
    if (card.lifecycle === "active") activeCount += 1;
    else if (card.lifecycle === "concluded") concludedCount += 1;
    else if (card.lifecycle === "expired") expiredCount += 1;
  }

  return { totalCount, activeCount, concludedCount, expiredCount };
}

export function myRequestBannerTotalLabel(totalCount: number): string | null {
  if (totalCount <= 0) return null;
  return totalCount === 1 ? "Toplam 1 talep" : `Toplam ${totalCount} talep`;
}

export function myRequestBannerMixCopy(
  activeCount: number,
  concludedCount: number,
): string {
  const active =
    activeCount === 1 ? "1 aktif" : `${activeCount} aktif`;
  const concluded =
    concludedCount === 1
      ? "1 sonuçlanan"
      : `${concludedCount} sonuçlanan`;
  return `${active} · ${concluded}`;
}

export function myRequestBannerExpiredCopy(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? "1 talebin süresi doldu"
    : `${count} talebin süresi doldu`;
}
