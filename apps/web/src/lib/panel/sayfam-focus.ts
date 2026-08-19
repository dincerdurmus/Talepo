import type { SayfamActivityItem, SayfamFocusItem } from "@/lib/panel/sayfam-home-types";

export const SAYFAM_CAROUSEL_INTERVAL_MS = 9_000;
export const SAYFAM_ACTIVITY_DEFAULT_OPEN = false;
export const SAYFAM_ACTIVITY_MAX_ITEMS = 6;

export const SAYFAM_ACTIVE_PROCESS_STATUSES = [
  "PUBLISHED",
  "RECEIVING_OFFERS",
  "OFFER_SELECTED",
  "IN_PROGRESS",
] as const;

export const SAYFAM_TERMINAL_REQUEST_STATUSES = new Set([
  "DRAFT",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
  "EXPIRED",
]);

export type SayfamProcessKind =
  | "action_required"
  | "new_offer"
  | "negotiating"
  | "waiting_counterparty"
  | "in_progress"
  | "awaiting_offers";

export const SAYFAM_PROCESS_PRIORITY: Record<SayfamProcessKind, number> = {
  action_required: 0,
  new_offer: 1,
  negotiating: 2,
  waiting_counterparty: 3,
  in_progress: 4,
  awaiting_offers: 5,
};

export const SAYFAM_PROCESS_LABEL: Record<SayfamProcessKind, string> = {
  action_required: "Yanıtınız bekleniyor",
  new_offer: "Yeni teklif var",
  negotiating: "Pazarlık devam ediyor",
  waiting_counterparty: "Karşı tarafın yanıtı bekleniyor",
  in_progress: "Süreç devam ediyor",
  awaiting_offers: "Teklif bekleniyor",
};

export type SayfamProcessSignals = {
  requestStatus: string;
  deleted?: boolean;
  archived?: boolean;
  totalOffers: number;
  actionRequiredCount: number;
  unreadCount: number;
  newCount: number;
  negotiatingCount: number;
  waitingForCounterparty: boolean;
};

export type RankedSayfamFocusItem = SayfamFocusItem & {
  priority: number;
  kind: SayfamProcessKind;
  lastActivityAt: number;
};

export function isSayfamTerminalRequestStatus(status: string): boolean {
  return SAYFAM_TERMINAL_REQUEST_STATUSES.has(status);
}

export function classifySayfamProcess(
  input: SayfamProcessSignals,
): SayfamProcessKind | null {
  if (input.deleted || input.archived) return null;
  if (isSayfamTerminalRequestStatus(input.requestStatus)) return null;
  if (
    !(SAYFAM_ACTIVE_PROCESS_STATUSES as readonly string[]).includes(
      input.requestStatus,
    )
  ) {
    return null;
  }

  if (input.actionRequiredCount > 0) return "action_required";
  if (input.unreadCount > 0 || input.newCount > 0) return "new_offer";
  if (input.waitingForCounterparty) return "waiting_counterparty";
  if (input.negotiatingCount > 0) return "negotiating";
  if (
    input.requestStatus === "OFFER_SELECTED" ||
    input.requestStatus === "IN_PROGRESS"
  ) {
    return "in_progress";
  }
  return "awaiting_offers";
}

export function sayfamProcessStatusLabel(kind: SayfamProcessKind): string {
  return SAYFAM_PROCESS_LABEL[kind];
}

export function sayfamProcessPriority(kind: SayfamProcessKind): number {
  return SAYFAM_PROCESS_PRIORITY[kind];
}

export function resolveSayfamProcessHref(input: {
  kind: SayfamProcessKind;
  requestId: string;
  unreadCount: number;
  conversationId: string | null;
  incomingWorkspacePath: (
    requestId: string,
    filter: "action_required" | "unread" | "new" | "negotiating",
  ) => string;
}): string {
  if (input.kind === "awaiting_offers") {
    return `/panel/taleplerim/${input.requestId}`;
  }
  if (input.kind === "in_progress") {
    return input.conversationId
      ? `/panel/mesajlar/${input.conversationId}`
      : `/panel/taleplerim/${input.requestId}`;
  }
  if (input.kind === "action_required") {
    return input.incomingWorkspacePath(input.requestId, "action_required");
  }
  if (input.kind === "new_offer") {
    return input.incomingWorkspacePath(
      input.requestId,
      input.unreadCount > 0 ? "unread" : "new",
    );
  }
  return input.incomingWorkspacePath(input.requestId, "negotiating");
}

export function dedupeSayfamFocusByRequest(
  items: readonly RankedSayfamFocusItem[],
): RankedSayfamFocusItem[] {
  const byId = new Map<string, RankedSayfamFocusItem>();
  for (const item of items) {
    const existing = byId.get(item.requestId);
    if (!existing || item.priority < existing.priority) {
      byId.set(item.requestId, item);
    }
  }
  return [...byId.values()];
}

export function sortSayfamFocusItems(
  items: readonly RankedSayfamFocusItem[],
): RankedSayfamFocusItem[] {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.lastActivityAt - a.lastActivityAt;
  });
}

export function toSayfamFocusItems(
  items: readonly RankedSayfamFocusItem[],
): SayfamFocusItem[] {
  return items.map((item) => ({
    id: item.id,
    requestId: item.requestId,
    title: item.title,
    categorySlug: item.categorySlug,
    categoryName: item.categoryName,
    coverImageUrl: item.coverImageUrl,
    statusLabel: item.statusLabel,
    detailLabel: item.detailLabel,
    href: item.href,
  }));
}

export function shouldShowSayfamCarouselControls(count: number): boolean {
  return count >= 2;
}

export const SAYFAM_HERO_HINT =
  "Hazırsan kaldığın yerden devam edelim.";

export const SAYFAM_UNAVAILABLE_HINT =
  "Veritabanına şu an ulaşılamıyor. Kısa süre sonra tekrar deneyin.";

const FORBIDDEN_COPY_DASH = /[—–]|--/;

export function sayfamCopyHasForbiddenDash(text: string): boolean {
  return FORBIDDEN_COPY_DASH.test(text);
}

export function sayfamGreetingFirstName(
  name: string | null | undefined,
): string | null {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0] ?? "";
  if (!first) return null;
  if (first.includes("@") || first.includes("/") || first.includes("\\")) {
    return null;
  }
  if (/^[0-9a-f-]{16,}$/i.test(first)) return null;
  if (/^(test|preview|user|undefined|null)$/i.test(first)) return null;
  if (first.length > 32) return null;
  return first;
}

export function sayfamGreetingTitle(firstName: string | null): string {
  return firstName ? `Merhaba, ${firstName}` : "Merhaba";
}

export function resolveSayfamHeroHint(): string {
  return SAYFAM_HERO_HINT;
}

export function getLatestSayfamActivity(
  items: readonly SayfamActivityItem[],
): SayfamActivityItem | null {
  return items[0] ?? null;
}

export function shouldShowSayfamActivityDisclosure(count: number): boolean {
  return count > 0;
}

export function countUnreadSayfamActivity(
  items: readonly SayfamActivityItem[],
): number {
  const seen = new Set<string>();
  let unread = 0;
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (item.unread) unread += 1;
  }
  return unread;
}

export function shouldShowSayfamUnreadBadge(unreadCount: number): boolean {
  return unreadCount > 0;
}

export function nextUnreadCountAfterMarkingRead(
  items: readonly SayfamActivityItem[],
  notificationId: string,
): number {
  return countUnreadSayfamActivity(
    items.map((item) =>
      item.id === notificationId ? { ...item, unread: false } : item,
    ),
  );
}

export function sayfamActivityOpensMutateNotifications(): boolean {
  return false;
}
