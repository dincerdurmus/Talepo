import type { SubscriptionStatus } from "./types";
import { BillingError, BillingErrorCode } from "./errors";

/**
 * Allowed transitions. Unknown / regression transitions are rejected.
 * Out-of-order provider events must not move ACTIVE → PENDING, etc.
 */
const ALLOWED: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  INACTIVE: ["PENDING", "ACTIVE"],
  PENDING: ["ACTIVE", "CANCELED", "INACTIVE", "EXPIRED"],
  ACTIVE: [
    "PAST_DUE",
    "CANCEL_AT_PERIOD_END",
    "CANCELED",
    "EXPIRED",
    "ACTIVE", // renewal / update
  ],
  PAST_DUE: ["ACTIVE", "CANCELED", "EXPIRED", "PAST_DUE"],
  CANCEL_AT_PERIOD_END: [
    "CANCELED",
    "EXPIRED",
    "ACTIVE", // undo cancel
    "CANCEL_AT_PERIOD_END",
  ],
  CANCELED: ["INACTIVE", "PENDING", "ACTIVE"],
  EXPIRED: ["INACTIVE", "PENDING", "ACTIVE"],
};

export function canTransitionSubscription(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertSubscriptionTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): void {
  if (!canTransitionSubscription(from, to)) {
    throw new BillingError({
      code: BillingErrorCode.INVALID_TRANSITION,
      userMessage: "Geçersiz abonelik durum geçişi.",
      diagnostic: `${from}->${to}`,
    });
  }
}

/** Map canonical event → target status (null = no status change). */
export function targetStatusForEvent(
  eventType: string,
): SubscriptionStatus | null {
  switch (eventType) {
    case "CHECKOUT_STARTED":
      return "PENDING";
    case "CHECKOUT_COMPLETED":
    case "SUBSCRIPTION_ACTIVATED":
    case "SUBSCRIPTION_RENEWED":
      return "ACTIVE";
    case "SUBSCRIPTION_PAST_DUE":
    case "PAYMENT_FAILED":
      return "PAST_DUE";
    case "SUBSCRIPTION_CANCEL_AT_PERIOD_END":
      return "CANCEL_AT_PERIOD_END";
    case "SUBSCRIPTION_CANCELED":
      return "CANCELED";
    case "SUBSCRIPTION_EXPIRED":
      return "EXPIRED";
    default:
      return null;
  }
}
