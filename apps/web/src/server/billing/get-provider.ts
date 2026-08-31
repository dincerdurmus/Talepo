import { BillingError, BillingErrorCode } from "@/lib/billing/errors";
import type { BillingProvider } from "@/lib/billing/provider";
import {
  isBillingMockAllowed,
  resolveConfiguredProviderId,
} from "@/lib/billing/provider";
import {
  evaluateIyzicoBillingReadiness,
  isIyzicoConfigured,
} from "@/lib/billing/iyzico/config";

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
 * iyzico only when TALEPO_PAYMENT_PROVIDER=iyzico + credentials.
 * Lazy-load iyzico adapter to avoid prisma import in status-only paths.
 */
export function getBillingProvider(): BillingProvider {
  const id = resolveConfiguredProviderId();
  if (id === "mock" && isBillingMockAllowed()) {
    return createMockBillingProvider();
  }
  if (id === "iyzico") {
    // Bilinçli lazy-load (yukarıdaki modül notu): status-only yollar prisma'yı çekmesin.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createIyzicoBillingProvider } = require("./iyzico-provider") as typeof import("./iyzico-provider");
    return createIyzicoBillingProvider();
  }
  return noneProvider;
}

export function getBillingProviderStatus(): {
  providerId: string;
  status:
    | "NONE"
    | "MOCK_DEV"
    | "IYZICO_READY"
    | "IYZICO_CONFIGURED"
    | "EXTERNAL_BLOCKED";
  paymentProviderRequired: boolean;
  billingReady: boolean;
  readinessReasons: string[];
} {
  const id = resolveConfiguredProviderId();
  if (id === "mock") {
    return {
      providerId: "mock",
      status: "MOCK_DEV",
      paymentProviderRequired: false,
      billingReady: true,
      readinessReasons: [],
    };
  }
  if (id === "iyzico") {
    const readiness = evaluateIyzicoBillingReadiness();
    return {
      providerId: "iyzico",
      status: readiness.ready ? "IYZICO_READY" : "IYZICO_CONFIGURED",
      paymentProviderRequired: false,
      billingReady: readiness.ready,
      readinessReasons: readiness.reasons,
    };
  }
  if (
    process.env.TALEPO_PAYMENT_PROVIDER?.trim().toLowerCase() === "iyzico" &&
    !isIyzicoConfigured()
  ) {
    return {
      providerId: "iyzico",
      status: "NONE",
      paymentProviderRequired: true,
      billingReady: false,
      readinessReasons: ["missing_api_or_secret"],
    };
  }
  if (id === "external") {
    return {
      providerId: process.env.TALEPO_PAYMENT_PROVIDER ?? "external",
      status: "EXTERNAL_BLOCKED",
      paymentProviderRequired: true,
      billingReady: false,
      readinessReasons: ["adapter_not_implemented"],
    };
  }
  return {
    providerId: "none",
    status: "NONE",
    paymentProviderRequired: true,
    billingReady: false,
    readinessReasons: ["provider_none"],
  };
}
