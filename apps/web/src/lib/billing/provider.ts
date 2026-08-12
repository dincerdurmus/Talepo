import type {
  BillingProviderId,
  CanonicalBillingEvent,
  CheckoutSessionRequest,
  CheckoutSessionResult,
  CreditPurchaseRequest,
  CreditPurchaseResult,
  WebhookVerifyResult,
} from "./types";
import { isIyzicoConfigured } from "./iyzico/config";

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

export function resolveConfiguredProviderId(
  env: NodeJS.ProcessEnv = process.env,
  nodeEnv = env.NODE_ENV ?? process.env.NODE_ENV ?? "development",
): BillingProviderId {
  const configured = env.TALEPO_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "none") {
    if (isBillingMockAllowed(nodeEnv)) return "mock";
    return "none";
  }
  if (configured === "mock") {
    return isBillingMockAllowed(nodeEnv) ? "mock" : "none";
  }
  if (configured === "iyzico") {
    return isIyzicoConfigured(env) ? "iyzico" : "none";
  }
  // Other vendors not implemented — do not invent adapters.
  if (
    configured === "stripe" ||
    configured === "paytr" ||
    configured === "paddle"
  ) {
    return "external";
  }
  if (isBillingMockAllowed(nodeEnv)) return "mock";
  return "none";
}
