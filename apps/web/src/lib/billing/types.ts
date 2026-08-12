import type { PlanTierId } from "@/lib/membership/plans";

/** Billing lifecycle — separate from entitlement feature matrix. */
export type SubscriptionStatus =
  | "INACTIVE"
  | "PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCEL_AT_PERIOD_END"
  | "CANCELED"
  | "EXPIRED";

export type BillingSubjectType = "USER" | "COMPANY";

export type BillingProviderId = "none" | "mock" | "iyzico" | "external";

export type CanonicalBillingEventType =
  | "CHECKOUT_STARTED"
  | "CHECKOUT_COMPLETED"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_RENEWED"
  | "SUBSCRIPTION_UPDATED"
  | "SUBSCRIPTION_PAST_DUE"
  | "SUBSCRIPTION_CANCEL_AT_PERIOD_END"
  | "SUBSCRIPTION_CANCELED"
  | "SUBSCRIPTION_EXPIRED"
  | "PAYMENT_FAILED"
  | "CREDIT_PURCHASED"
  | "CREDIT_REFUNDED"
  | "REFUND"
  | "IGNORED";

export type BillingSubjectRef = {
  type: BillingSubjectType;
  id: string;
};

export type CheckoutSessionRequest = {
  subject: BillingSubjectRef;
  planTier: PlanTierId;
  successUrl: string;
  cancelUrl: string;
  actorUserId: string;
};

export type CheckoutSessionResult = {
  provider: BillingProviderId;
  checkoutUrl: string;
  providerSessionId: string;
  status: "PENDING";
  /** Hosted CF HTML snippet when paymentPageUrl is unavailable (iyzico). */
  checkoutFormContent?: string;
  token?: string;
};

export type CreditPurchaseRequest = {
  subject: BillingSubjectRef;
  packId: string;
  credits: number;
  successUrl: string;
  cancelUrl: string;
  actorUserId: string;
};

export type CreditPurchaseResult = {
  provider: BillingProviderId;
  checkoutUrl: string;
  providerSessionId: string;
  status: "PENDING";
  checkoutFormContent?: string;
  token?: string;
};

export type CanonicalBillingEvent = {
  provider: BillingProviderId;
  providerEventId: string;
  eventType: CanonicalBillingEventType;
  occurredAt: Date;
  subject?: BillingSubjectRef;
  planTier?: PlanTierId;
  creditPackId?: string;
  credits?: number;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  /** Monotonic-ish ordering hint from provider when available. */
  providerVersion?: number;
  safeMetadata?: Record<string, unknown>;
};

export type WebhookVerifyResult =
  | { ok: true; rawBody: string; signature: string | null }
  | { ok: false; reason: string };

export type BillingSnapshot = {
  subject: BillingSubjectRef;
  planTier: PlanTierId;
  effectivePlanTier: PlanTierId;
  subscriptionStatus: SubscriptionStatus;
  provider: BillingProviderId | null;
  providerSubscriptionIdMasked: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastBillingEventType: string | null;
  lastBillingEventAt: string | null;
  pendingCheckout: boolean;
};
