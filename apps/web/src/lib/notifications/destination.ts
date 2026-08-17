/**
 * Safe notification click destinations.
 * Never trust actionUrl as an open redirect; never treat Notification.id as Request.id.
 */

export const NOTIFICATION_MISSING_TARGET_HREF =
  "/panel/bildirimler?hedef=bulunamadi";

const PLACEHOLDER_IDS = new Set(["undefined", "null", "nan", ""]);

export type NotificationDestinationInput = {
  type: string;
  actionUrl: string | null;
  requestId: string | null;
  offerId: string | null;
  companyId: string | null;
};

export function sanitizePanelActionUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      value = `${parsed.pathname}${parsed.search}`;
    } catch {
      return null;
    }
  }

  if (!value.startsWith("/")) {
    if (value.startsWith("panel/")) value = `/${value}`;
    else if (
      value.startsWith("taleplerim/") ||
      value.startsWith("talepler/") ||
      value.startsWith("teklifler") ||
      value.startsWith("gelen-teklifler") ||
      value.startsWith("mesajlar/") ||
      value.startsWith("ekip")
    ) {
      value = `/panel/${value}`;
    } else {
      return null;
    }
  }

  if (
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("://") ||
    /[<>]/.test(value)
  ) {
    return null;
  }

  if (!value.startsWith("/panel/") && value !== "/panel") {
    return null;
  }

  const pathOnly = value.split("?")[0] ?? value;
  const last = pathOnly.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
  if (PLACEHOLDER_IDS.has(last)) return null;

  return value;
}

export function deriveNotificationPath(
  input: NotificationDestinationInput,
): string | null {
  switch (input.type) {
    case "REQUEST_PUBLISHED":
      return input.requestId ? `/panel/taleplerim/${input.requestId}` : null;
    case "NEW_REQUEST_MATCH":
      return input.requestId ? `/panel/talepler/${input.requestId}` : null;
    case "NEW_OFFER":
      return "/panel/gelen-teklifler";
    case "OFFER_ACCEPTED":
    case "OFFER_NEGOTIATE":
    case "OFFER_REJECTED":
    case "OFFER_VIEWED":
    case "COUNTER_OFFER_RECEIVED":
    case "COUNTER_OFFER_ACCEPTED":
    case "COUNTER_OFFER_REJECTED":
      return "/panel/teklifler";
    case "DEAL_COMPLETION_REQUESTED":
    case "DEAL_COMPLETED":
    case "DEAL_REVIEW_RECEIVED":
    case "NEW_MESSAGE":
      return "/panel/mesajlar";
    case "COMPANY_MEMBER_JOINED":
      return "/panel/ekip";
    case "COMPANY_INVITATION":
      return "/panel/bildirimler";
    default:
      if (input.requestId) return `/panel/talepler/${input.requestId}`;
      return null;
  }
}

export function resolveNotificationDestination(
  input: NotificationDestinationInput,
): string {
  const fromUrl = sanitizePanelActionUrl(input.actionUrl);
  if (fromUrl) return fromUrl;

  return deriveNotificationPath(input) ?? "/panel/bildirimler";
}

export function parseOwnedRequestDetailPath(path: string) {
  const match = /^\/panel\/taleplerim\/([^/?#]+)/.exec(path.split("?")[0] ?? path);
  if (!match) return null;
  const id = match[1];
  if (!id || PLACEHOLDER_IDS.has(id.toLowerCase())) return null;
  return id;
}

export function parseOpenRequestDetailPath(path: string) {
  const match = /^\/panel\/talepler\/([^/?#]+)/.exec(path.split("?")[0] ?? path);
  if (!match) return null;
  const id = match[1];
  if (!id || PLACEHOLDER_IDS.has(id.toLowerCase())) return null;
  return id;
}
