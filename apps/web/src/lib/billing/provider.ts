import type {
  BillingProviderId,
  CanonicalBillingEvent,
  CheckoutSessionRequest,
  CheckoutSessionResult,
  CreditPurchaseRequest,
  CreditPurchaseResult,
  WebhookVerifyResult,
} from "./types";

/**
 * Provider-neutral billing adapter.
 * Business logic never imports Stripe/iyzico SDKs directly.
 */
export type BillingProvider = {
  id: BillingProviderId;
  createCheckoutSession(
    input: CheckoutSessionRequest,
  ): Promise<CheckoutSessionResult>;
  createCreditPurchase(
    input: CreditPurchaseRequest,
  ): Promise<CreditPurchaseResult>;
  verifyWebhook(input: {
    headers: Headers;
    rawBody: string;
  }): Promise<WebhookVerifyResult>;
  parseWebhookEvent(input: {
    rawBody: string;
    headers: Headers;
  }): Promise<CanonicalBillingEvent[]>;
  cancelSubscription?(input: {
    providerSubscriptionId: string;
    atPeriodEnd: boolean;
  }): Promise<{ ok: boolean }>;
  getSubscriptionStatus?(providerSubscriptionId: string): Promise<{
    status: string;
    currentPeriodEnd?: Date;
  }>;
};

export function isBillingMockAllowed(
  nodeEnv = process.env.NODE_ENV ?? "development",
): boolean {
  if (nodeEnv === "production") return false;
  return process.env.ALLOW_MOCK_BILLING === "true";
}

export function resolveConfiguredProviderId(): BillingProviderId {
  const configured = process.env.TALEPO_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "none") {
    if (isBillingMockAllowed()) return "mock";
    return "none";
  }
  // Real vendors require explicit credentials — do not invent integrations.
  if (configured === "mock") {
    return isBillingMockAllowed() ? "mock" : "none";
  }
  // Future: stripe | iyzico | paytr | paddle when adapters + secrets exist
  const hasExternalSecrets =
    Boolean(process.env.STRIPE_SECRET_KEY?.trim()) ||
    Boolean(process.env.IYZICO_API_KEY?.trim()) ||
    Boolean(process.env.PAYTR_MERCHANT_KEY?.trim()) ||
    Boolean(process.env.PADDLE_API_KEY?.trim());
  if (hasExternalSecrets && configured !== "mock") {
    return "external";
  }
  if (isBillingMockAllowed()) return "mock";
  return "none";
}
