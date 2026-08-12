import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { BillingProvider } from "@/lib/billing/provider";
import { isBillingMockAllowed } from "@/lib/billing/provider";
import { BillingError, BillingErrorCode } from "@/lib/billing/errors";
import type { CanonicalBillingEvent } from "@/lib/billing/types";

function mockSecret(): string {
  return process.env.TALEPO_MOCK_BILLING_SECRET?.trim() || "talepo-mock-billing-dev";
}

export function signMockWebhook(rawBody: string): string {
  return createHmac("sha256", mockSecret()).update(rawBody).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Dev/test only billing adapter.
 * Production path must never resolve to this provider.
 */
export function createMockBillingProvider(): BillingProvider {
  return {
    id: "mock",

    async createCheckoutSession(input) {
      if (!isBillingMockAllowed()) {
        throw new BillingError({
          code: BillingErrorCode.PAYMENT_PROVIDER_REQUIRED,
          userMessage: "Ödeme sağlayıcısı yapılandırılmamış.",
        });
      }
      const sessionId = `mock_sess_${randomUUID()}`;
      const url = new URL(input.successUrl);
      url.searchParams.set("billing", "pending");
      url.searchParams.set("session", sessionId);
      url.searchParams.set("plan", input.planTier);
      return {
        provider: "mock",
        checkoutUrl: url.toString(),
        providerSessionId: sessionId,
        status: "PENDING",
      };
    },

    async createCreditPurchase(input) {
      if (!isBillingMockAllowed()) {
        throw new BillingError({
          code: BillingErrorCode.PAYMENT_PROVIDER_REQUIRED,
          userMessage: "Ödeme sağlayıcısı yapılandırılmamış.",
        });
      }
      const sessionId = `mock_credit_${randomUUID()}`;
      const url = new URL(input.successUrl);
      url.searchParams.set("billing", "pending");
      url.searchParams.set("session", sessionId);
      url.searchParams.set("credits", String(input.credits));
      return {
        provider: "mock",
        checkoutUrl: url.toString(),
        providerSessionId: sessionId,
        status: "PENDING",
      };
    },

    async verifyWebhook({ headers, rawBody }) {
      if (!isBillingMockAllowed()) {
        return { ok: false, reason: "mock_disabled" };
      }
      const signature = headers.get("x-talepo-mock-signature");
      if (!signature) return { ok: false, reason: "missing_signature" };
      const expected = signMockWebhook(rawBody);
      if (!safeEqual(signature, expected)) {
        return { ok: false, reason: "invalid_signature" };
      }
      return { ok: true, rawBody, signature };
    },

    async parseWebhookEvent({ rawBody }) {
      const parsed = JSON.parse(rawBody) as {
        id?: string;
        type?: string;
        subjectType?: "USER" | "COMPANY";
        subjectId?: string;
        planTier?: "PREMIUM" | "PROFESSIONAL" | "CORPORATE";
        credits?: number;
        creditPackId?: string;
        providerSubscriptionId?: string;
        currentPeriodEnd?: string;
        cancelAtPeriodEnd?: boolean;
        providerVersion?: number;
      };

      const eventType = mapMockType(parsed.type ?? "");
      const event: CanonicalBillingEvent = {
        provider: "mock",
        providerEventId: parsed.id || `mock_evt_${randomUUID()}`,
        eventType,
        occurredAt: new Date(),
        subject:
          parsed.subjectType && parsed.subjectId
            ? { type: parsed.subjectType, id: parsed.subjectId }
            : undefined,
        planTier: parsed.planTier,
        credits: parsed.credits,
        creditPackId: parsed.creditPackId,
        providerSubscriptionId: parsed.providerSubscriptionId,
        currentPeriodEnd: parsed.currentPeriodEnd
          ? new Date(parsed.currentPeriodEnd)
          : undefined,
        cancelAtPeriodEnd: parsed.cancelAtPeriodEnd,
        providerVersion: parsed.providerVersion,
        safeMetadata: { mock: true },
      };
      return [event];
    },
  };
}

function mapMockType(type: string): CanonicalBillingEvent["eventType"] {
  switch (type) {
    case "checkout.completed":
      return "CHECKOUT_COMPLETED";
    case "subscription.activated":
      return "SUBSCRIPTION_ACTIVATED";
    case "subscription.renewed":
      return "SUBSCRIPTION_RENEWED";
    case "subscription.past_due":
      return "SUBSCRIPTION_PAST_DUE";
    case "subscription.cancel_at_period_end":
      return "SUBSCRIPTION_CANCEL_AT_PERIOD_END";
    case "subscription.canceled":
      return "SUBSCRIPTION_CANCELED";
    case "subscription.expired":
      return "SUBSCRIPTION_EXPIRED";
    case "payment.failed":
      return "PAYMENT_FAILED";
    case "credit.purchased":
      return "CREDIT_PURCHASED";
    case "credit.refunded":
      return "CREDIT_REFUNDED";
    default:
      return "IGNORED";
  }
}
