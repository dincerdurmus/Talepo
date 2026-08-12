import { BillingError, BillingErrorCode } from "@/lib/billing/errors";
import type { BillingProvider } from "@/lib/billing/provider";
import {
  isBillingMockAllowed,
  resolveConfiguredProviderId,
} from "@/lib/billing/provider";

import { createMockBillingProvider } from "./mock-provider";

const noneProvider: BillingProvider = {
  id: "none",
  async createCheckoutSession() {
    throw new BillingError({
      code: BillingErrorCode.PAYMENT_PROVIDER_REQUIRED,
      userMessage:
        "Ödeme sağlayıcısı henüz bağlanmadı. Production ödeme için provider yapılandırması gerekir.",
    });
  },
  async createCreditPurchase() {
    throw new BillingError({
      code: BillingErrorCode.PAYMENT_PROVIDER_REQUIRED,
      userMessage:
        "Kredi satın alma için ödeme sağlayıcısı yapılandırılmamış.",
    });
  },
  async verifyWebhook() {
    return { ok: false, reason: "no_provider" };
  },
  async parseWebhookEvent() {
    return [];
  },
};

/**
 * Resolve active billing provider.
 * Never invents Stripe/iyzico without credentials + adapter.
 */
export function getBillingProvider(): BillingProvider {
  const id = resolveConfiguredProviderId();
  if (id === "mock" && isBillingMockAllowed()) {
    return createMockBillingProvider();
  }
  // "external" reserved — adapters not implemented until vendor chosen
  return noneProvider;
}

export function getBillingProviderStatus(): {
  providerId: string;
  status: "NONE" | "MOCK_DEV" | "EXTERNAL_BLOCKED";
  paymentProviderRequired: boolean;
} {
  const id = resolveConfiguredProviderId();
  if (id === "mock") {
    return {
      providerId: "mock",
      status: "MOCK_DEV",
      paymentProviderRequired: false,
    };
  }
  if (id === "external") {
    return {
      providerId: process.env.TALEPO_PAYMENT_PROVIDER ?? "external",
      status: "EXTERNAL_BLOCKED",
      paymentProviderRequired: true,
    };
  }
  return {
    providerId: "none",
    status: "NONE",
    paymentProviderRequired: true,
  };
}
