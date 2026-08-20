import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CheckCircle2,
  Eye,
  Handshake,
  MessageCircle,
  Package,
  RefreshCw,
  Star,
  Tag,
  UserPlus,
  Users,
  X,
} from "lucide-react";

export type NotificationIconKind =
  | "message"
  | "offer"
  | "update"
  | "negotiate"
  | "declined"
  | "complete"
  | "invite"
  | "joined"
  | "request"
  | "review"
  | "viewed"
  | "fallback";

export function notificationIconKind(
  type: string,
  title: string,
): NotificationIconKind {
  if (type === "NEW_MESSAGE") return "message";
  if (type === "NEW_OFFER" && title === "Teklif güncellendi") return "update";
  if (type === "NEW_OFFER") return "offer";
  if (type === "OFFER_VIEWED") return "viewed";
  if (
    type === "OFFER_NEGOTIATE" ||
    type === "COUNTER_OFFER_RECEIVED" ||
    type === "COUNTER_OFFER_ACCEPTED"
  ) {
    return "negotiate";
  }
  if (type === "OFFER_REJECTED" || type === "COUNTER_OFFER_REJECTED") {
    return "declined";
  }
  if (type === "OFFER_ACCEPTED" || type === "DEAL_COMPLETED") {
    return "complete";
  }
  if (type === "DEAL_COMPLETION_REQUESTED") return "complete";
  if (type === "DEAL_REVIEW_RECEIVED") return "review";
  if (type === "COMPANY_INVITATION") return "invite";
  if (type === "COMPANY_MEMBER_JOINED") return "joined";
  if (type === "REQUEST_PUBLISHED" || type === "NEW_REQUEST_MATCH") {
    return "request";
  }
  return "fallback";
}

export const NOTIFICATION_ICONS: Record<NotificationIconKind, LucideIcon> = {
  message: MessageCircle,
  offer: Tag,
  update: RefreshCw,
  negotiate: Handshake,
  declined: X,
  complete: CheckCircle2,
  invite: UserPlus,
  joined: Users,
  request: Package,
  review: Star,
  viewed: Eye,
  fallback: Bell,
};

export function notificationIcon(kind: NotificationIconKind): LucideIcon {
  return NOTIFICATION_ICONS[kind];
}

export function extractQuotedSubject(message: string): string | null {
  const match = /[“"]([^”"]{2,120})[”"]/.exec(message);
  const value = match?.[1]?.trim() ?? "";
  return value || null;
}

export function buildNotificationRowCopy(input: {
  title: string;
  message: string;
  requestTitle: string | null;
}): {
  title: string;
  context: string | null;
  detail: string | null;
} {
  const context =
    input.requestTitle?.trim() || extractQuotedSubject(input.message);
  let detail = input.message.trim();

  if (context) {
    const quoted = new RegExp(`[“"]${escapeRegExp(context)}[”"]\\s*`, "g");
    detail = detail.replace(quoted, "").trim();
    detail = detail
      .replace(
        new RegExp(
          `^${escapeRegExp(context)}(?:\\s+talebi(?:niz)?)?\\s*(?:için|talebiniz için)?\\s*`,
          "i",
        ),
        "",
      )
      .replace(/^(talebinize|talebiniz için)\s+/i, "")
      .replace(/^talebi(?:niz)?\s+/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[,·]\s*/, "")
      .trim();
  }

  if (!detail || normalize(detail) === normalize(input.title)) {
    return { title: input.title, context, detail: null };
  }

  return { title: input.title, context, detail };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
