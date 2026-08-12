import { OFFER_CREDIT_PACKS } from "@/lib/membership/plans";
import { BillingError, BillingErrorCode } from "@/lib/billing/errors";
import type { BillingProvider } from "@/lib/billing/provider";
import {
  loadIyzicoConfig,
  type IyzicoConfig,
} from "@/lib/billing/iyzico/config";
import { iyzicoRequest } from "@/lib/billing/iyzico/client";
import {
  buildCreditConversationId,
  buildSubscriptionConversationId,
  parseIyzicoConversationId,
} from "@/lib/billing/iyzico/conversation";
import { mapIyzicoWebhookToCanonicalEvents } from "@/lib/billing/iyzico/events";
import { formatTryIntegerMajor } from "@/lib/billing/iyzico/money";
import { assertIyzicoPlanMapping } from "@/lib/billing/iyzico/plan-mapping";
import {
  getIyzicoSignatureV3Header,
  verifyIyzicoWebhookSignatureV3,
} from "@/lib/billing/iyzico/webhook-signature";
import type {
  CanonicalBillingEvent,
  CheckoutSessionResult,
  CreditPurchaseResult,
} from "@/lib/billing/types";
import { prisma } from "@/lib/prisma";

import { buildIyzicoCheckoutCustomer } from "./iyzico-customer";

type SubCfInitResponse = {
  status?: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  errorCode?: string;
  errorMessage?: string;
};

type CfInitResponse = {
  status?: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  signature?: string;
  errorCode?: string;
  errorMessage?: string;
};

type SubDetailResponse = {
  status?: string;
  data?: {
    items?: Array<{
      referenceCode?: string;
      subscriptionStatus?: string;
      pricingPlanReferenceCode?: string;
      customerReferenceCode?: string;
      endDate?: number;
      orders?: Array<{
        paymentAttempts?: Array<{ conversationId?: string }>;
      }>;
    }>;
    referenceCode?: string;
    subscriptionStatus?: string;
    pricingPlanReferenceCode?: string;
    customerReferenceCode?: string;
    endDate?: number;
    orders?: Array<{
      paymentAttempts?: Array<{ conversationId?: string }>;
    }>;
  };
};

function requireConfig(): IyzicoConfig {
  const config = loadIyzicoConfig();
  if (!config) {
    throw new BillingError({
      code: BillingErrorCode.PAYMENT_PROVIDER_REQUIRED,
      userMessage: "iyzico kimlik bilgileri yapılandırılmamış.",
    });
  }
  return config;
}

function hostCheckoutUrl(callbackBase: string | null, token: string): string {
  const base = (callbackBase || "").replace(/\/$/, "");
  if (!base) {
    return `/panel/plan/odeme?token=${encodeURIComponent(token)}`;
  }
  return `${base}/panel/plan/odeme?token=${encodeURIComponent(token)}`;
}

export function createIyzicoBillingProvider(): BillingProvider {
  return {
    id: "iyzico",

    async createCheckoutSession(input) {
      const config = requireConfig();
      const pricingPlanReferenceCode = assertIyzicoPlanMapping(input.planTier);
      const customer = await buildIyzicoCheckoutCustomer({
        actorUserId: input.actorUserId,
        subject: input.subject,
      });
      const conversationId = buildSubscriptionConversationId({
        subject: input.subject,
        planTier: input.planTier,
      });
      const callbackBase = config.callbackBaseUrl?.replace(/\/$/, "") || "";
      if (!callbackBase) {
        throw new BillingError({
          code: BillingErrorCode.CHECKOUT_FAILED,
          userMessage: "Ödeme geri dönüş adresi yapılandırılmamış.",
          diagnostic: "missing_callback_base_url",
        });
      }
      const callbackUrl = `${callbackBase}/api/billing/callback?flow=subscription`;

      const result = await iyzicoRequest<SubCfInitResponse>({
        config,
        method: "POST",
        path: "/v2/subscription/checkoutform/initialize",
        operation: "subscription.checkoutform.initialize",
        body: {
          locale: "tr",
          conversationId,
          callbackUrl,
          pricingPlanReferenceCode,
          subscriptionInitialStatus: "ACTIVE",
          customer: {
            name: customer.name,
            surname: customer.surname,
            email: customer.email,
            gsmNumber: customer.gsmNumber,
            identityNumber: customer.identityNumber,
            billingAddress: customer.billingAddress,
          },
        },
      });

      if (result.status !== "success" || !result.token) {
        throw new BillingError({
          code: BillingErrorCode.CHECKOUT_FAILED,
          userMessage: "Ödeme oturumu oluşturulamadı. Lütfen tekrar deneyin.",
          diagnostic: result.errorCode || result.errorMessage || "cf_init_failed",
        });
      }

      const checkoutUrl =
        result.paymentPageUrl ||
        hostCheckoutUrl(config.callbackBaseUrl, result.token);

      return {
        provider: "iyzico",
        checkoutUrl,
        providerSessionId: result.token,
        status: "PENDING",
        checkoutFormContent: result.checkoutFormContent,
        token: result.token,
      } satisfies CheckoutSessionResult;
    },

    async createCreditPurchase(input) {
      const config = requireConfig();
      const pack =
        OFFER_CREDIT_PACKS[input.packId as keyof typeof OFFER_CREDIT_PACKS];
      if (!pack) {
        throw new BillingError({
          code: BillingErrorCode.PLAN_MAPPING_INVALID,
          userMessage: "Geçersiz kredi paketi.",
        });
      }
      // Server amount authority — ignore any client amount
      const price = formatTryIntegerMajor(pack.priceTry);
      const customer = await buildIyzicoCheckoutCustomer({
        actorUserId: input.actorUserId,
        subject: input.subject,
      });
      const conversationId = buildCreditConversationId({
        subject: input.subject,
        packId: input.packId,
      });
      const callbackBase = config.callbackBaseUrl?.replace(/\/$/, "") || "";
      const callbackUrl = `${callbackBase}/api/billing/callback?flow=credit`;

      const result = await iyzicoRequest<CfInitResponse>({
        config,
        method: "POST",
        path: "/payment/iyzipos/checkoutform/initialize/auth/ecom",
        operation: "payment.checkoutform.initialize",
        body: {
          locale: "tr",
          conversationId,
          price,
          paidPrice: price,
          currency: "TRY",
          basketId: `credit_${input.packId}`,
          paymentGroup: "PRODUCT",
          callbackUrl,
          enabledInstallments: [1],
          buyer: {
            id: customer.buyerId,
            name: customer.name,
            surname: customer.surname,
            identityNumber: customer.identityNumber,
            email: customer.email,
            gsmNumber: customer.gsmNumber,
            registrationAddress: customer.registrationAddress,
            city: customer.city,
            country: customer.country,
            ip: customer.ip || "127.0.0.1",
          },
          billingAddress: customer.billingAddress,
          shippingAddress: customer.billingAddress,
          basketItems: [
            {
              id: input.packId,
              price,
              name: pack.label,
              category1: "Credits",
              itemType: "VIRTUAL",
            },
          ],
        },
      });

      if (result.status !== "success" || !result.token) {
        throw new BillingError({
          code: BillingErrorCode.CHECKOUT_FAILED,
          userMessage: "Kredi ödeme oturumu oluşturulamadı.",
          diagnostic: result.errorCode || result.errorMessage || "cf_init_failed",
        });
      }

      const session: CreditPurchaseResult = {
        provider: "iyzico",
        checkoutUrl:
          result.paymentPageUrl ||
          hostCheckoutUrl(config.callbackBaseUrl, result.token),
        providerSessionId: result.token,
        status: "PENDING",
        checkoutFormContent: result.checkoutFormContent,
        token: result.token,
      };
      return session;
    },

    async verifyWebhook(input) {
      const config = loadIyzicoConfig();
      if (!config) {
        return { ok: false, reason: "iyzico_not_configured" };
      }
      const signature = getIyzicoSignatureV3Header(input.headers);
      // Production: missing V3 signature is reject (legacy unsigned not accepted)
      if (!signature) {
        return { ok: false, reason: "missing_signature_v3" };
      }
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(input.rawBody) as Record<string, unknown>;
      } catch {
        return { ok: false, reason: "invalid_json" };
      }
      const verified = verifyIyzicoWebhookSignatureV3({
        secretKey: config.secretKey,
        merchantId: config.merchantId,
        signatureHeader: signature,
        payload,
      });
      if (!verified.ok) {
        return { ok: false, reason: verified.reason };
      }
      return { ok: true, rawBody: input.rawBody, signature };
    },

    async parseWebhookEvent(input) {
      const payload = JSON.parse(input.rawBody) as Record<string, unknown>;
      const mapped = await mapIyzicoWebhookToCanonicalEvents({
        payload,
        subjectResolver: resolveSubjectForSubscription,
      });
      return mapped;
    },

    async cancelSubscription(input) {
      const config = requireConfig();
      // Official cancel is immediate. Talepo keeps entitlement until period end
      // via CANCEL_AT_PERIOD_END in business layer after this call.
      const result = await iyzicoRequest<{ status?: string }>({
        config,
        method: "POST",
        path: `/v2/subscription/subscriptions/${encodeURIComponent(input.providerSubscriptionId)}/cancel`,
        operation: "subscription.cancel",
        body: {
          subscriptionReferenceCode: input.providerSubscriptionId,
        },
      });
      return { ok: result.status === "success" };
    },

    async getSubscriptionStatus(providerSubscriptionId) {
      const config = requireConfig();
      const result = await iyzicoRequest<SubDetailResponse>({
        config,
        method: "GET",
        path: `/v2/subscription/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
        operation: "subscription.retrieve",
      });
      const item = extractSubscriptionItem(result);
      return {
        status: item?.subscriptionStatus ?? "UNKNOWN",
        currentPeriodEnd:
          typeof item?.endDate === "number" ? new Date(item.endDate) : undefined,
      };
    },
  };
}

function extractSubscriptionItem(result: SubDetailResponse) {
  if (result.data?.items?.[0]) return result.data.items[0];
  if (result.data?.referenceCode || result.data?.subscriptionStatus) {
    return result.data;
  }
  return null;
}

async function resolveSubjectForSubscription(providerSubscriptionId: string) {
  const existing = await prisma.billingSubscription.findFirst({
    where: { providerSubscriptionId },
    select: {
      subjectType: true,
      subjectId: true,
      planTier: true,
      status: true,
    },
  });
  if (existing) {
    return {
      subject: {
        type: existing.subjectType,
        id: existing.subjectId,
      },
      planTier: existing.planTier as CanonicalBillingEvent["planTier"],
      alreadyActive:
        existing.status === "ACTIVE" ||
        existing.status === "CANCEL_AT_PERIOD_END",
      conversationId: null as string | null,
    };
  }

  // Recovery: retrieve subscription and parse conversationId from payment attempts
  try {
    const config = loadIyzicoConfig();
    if (!config) return null;
    const detail = await iyzicoRequest<SubDetailResponse>({
      config,
      method: "GET",
      path: `/v2/subscription/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
      operation: "subscription.retrieve.recovery",
    });
    const item = extractSubscriptionItem(detail);
    const conversationId =
      item?.orders
        ?.flatMap((o) => o.paymentAttempts ?? [])
        .map((a) => a.conversationId)
        .find(Boolean) ?? null;
    const parsed = parseIyzicoConversationId(conversationId);
    if (parsed?.kind === "sub") {
      await prisma.billingSubscription.upsert({
        where: {
          subjectType_subjectId: {
            subjectType: parsed.subject.type,
            subjectId: parsed.subject.id,
          },
        },
        create: {
          subjectType: parsed.subject.type,
          subjectId: parsed.subject.id,
          planTier: parsed.planTier,
          status: "PENDING",
          provider: "iyzico",
          providerSubscriptionId,
          providerCustomerId: item?.customerReferenceCode ?? null,
        },
        update: {
          provider: "iyzico",
          providerSubscriptionId,
          providerCustomerId: item?.customerReferenceCode ?? null,
          planTier: parsed.planTier,
        },
      });
      return {
        subject: parsed.subject,
        planTier: parsed.planTier,
        alreadyActive: false,
        conversationId,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Server-side CF retrieve for callback linking — does NOT activate entitlement. */
export async function retrieveIyzicoSubscriptionCheckoutResult(token: string) {
  const config = requireConfig();
  return iyzicoRequest<SubDetailResponse & { token?: string }>({
    config,
    method: "GET",
    path: `/v2/subscription/checkoutform/${encodeURIComponent(token)}`,
    operation: "subscription.checkoutform.retrieve",
  });
}

export async function retrieveIyzicoPaymentCheckoutResult(token: string) {
  const config = requireConfig();
  return iyzicoRequest<{
    status?: string;
    paymentStatus?: string;
    conversationId?: string;
    paymentId?: string;
  }>({
    config,
    method: "POST",
    path: "/payment/iyzipos/checkoutform/auth/ecom/detail",
    operation: "payment.checkoutform.retrieve",
    body: { locale: "tr", token },
  });
}
