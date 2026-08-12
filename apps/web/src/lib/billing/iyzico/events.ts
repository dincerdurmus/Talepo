import { OFFER_CREDIT_PACKS } from "@/lib/membership/plans";
import type {
  BillingSubjectRef,
  CanonicalBillingEvent,
  CanonicalBillingEventType,
} from "@/lib/billing/types";

import { parseIyzicoConversationId } from "./conversation";
import { resolvePlanTierFromIyzicoPricingPlan } from "./plan-mapping";

/**
 * Official subscription webhook event types (docs):
 * - subscription.order.success
 * - subscription.order.failure
 *
 * HPP credit checkout:
 * - CHECKOUT_FORM_AUTH (+ status SUCCESS/FAILURE)
 */
export async function mapIyzicoWebhookToCanonicalEvents(input: {
  payload: Record<string, unknown>;
  subjectResolver?: (providerSubscriptionId: string) => Promise<{
    subject?: BillingSubjectRef;
    planTier?: CanonicalBillingEvent["planTier"];
    alreadyActive?: boolean;
    conversationId?: string | null;
  } | null>;
}): Promise<CanonicalBillingEvent[]> {
  const payload = input.payload;
  const eventType = String(payload.iyziEventType ?? payload.eventType ?? "");
  const eventTimeRaw = payload.iyziEventTime;
  const occurredAt =
    typeof eventTimeRaw === "number"
      ? new Date(eventTimeRaw)
      : typeof eventTimeRaw === "string" && /^\d+$/.test(eventTimeRaw)
        ? new Date(Number(eventTimeRaw))
        : new Date();
  const providerVersion =
    typeof eventTimeRaw === "number"
      ? eventTimeRaw
      : typeof eventTimeRaw === "string" && /^\d+$/.test(eventTimeRaw)
        ? Number(eventTimeRaw)
        : undefined;

  if (
    eventType === "subscription.order.success" ||
    eventType === "subscription.order.failure"
  ) {
    return mapSubscriptionOrderEvent({
      payload,
      eventType,
      occurredAt,
      providerVersion,
      subjectResolver: input.subjectResolver,
    });
  }

  // One-time Checkout Form (credits)
  if (
    eventType === "CHECKOUT_FORM_AUTH" ||
    eventType === "CREDIT_PAYMENT_AUTH"
  ) {
    return [
      mapCheckoutFormAuthEvent({
        payload,
        eventType,
        occurredAt,
        providerVersion,
      }),
    ];
  }

  // Unknown — safe ignore
  const iyziReferenceCode = String(payload.iyziReferenceCode ?? "");
  return [
    {
      provider: "iyzico",
      providerEventId: iyziReferenceCode || `ignored_${eventType}_${Date.now()}`,
      eventType: "IGNORED",
      occurredAt,
      providerVersion,
      safeMetadata: { iyziEventType: eventType },
    },
  ];
}

async function mapSubscriptionOrderEvent(input: {
  payload: Record<string, unknown>;
  eventType: string;
  occurredAt: Date;
  providerVersion?: number;
  subjectResolver?: (providerSubscriptionId: string) => Promise<{
    subject?: BillingSubjectRef;
    planTier?: CanonicalBillingEvent["planTier"];
    alreadyActive?: boolean;
    conversationId?: string | null;
  } | null>;
}): Promise<CanonicalBillingEvent[]> {
  const subscriptionReferenceCode = String(
    input.payload.subscriptionReferenceCode ?? "",
  );
  const orderReferenceCode = String(input.payload.orderReferenceCode ?? "");
  const iyziReferenceCode = String(input.payload.iyziReferenceCode ?? "");
  const providerEventId =
    iyziReferenceCode ||
    `${input.eventType}:${subscriptionReferenceCode}:${orderReferenceCode}`;

  let subject: BillingSubjectRef | undefined;
  let planTier: CanonicalBillingEvent["planTier"];
  let alreadyActive = false;

  if (input.subjectResolver && subscriptionReferenceCode) {
    const resolved = await input.subjectResolver(subscriptionReferenceCode);
    subject = resolved?.subject;
    planTier = resolved?.planTier;
    alreadyActive = Boolean(resolved?.alreadyActive);
    if (!subject && resolved?.conversationId) {
      const parsed = parseIyzicoConversationId(resolved.conversationId);
      if (parsed?.kind === "sub") {
        subject = parsed.subject;
        planTier = parsed.planTier;
      }
    }
  }

  const pricingPlanReferenceCode = String(
    input.payload.pricingPlanReferenceCode ?? "",
  );
  if (!planTier && pricingPlanReferenceCode) {
    planTier =
      resolvePlanTierFromIyzicoPricingPlan(pricingPlanReferenceCode) ??
      undefined;
  }

  let canonicalType: CanonicalBillingEventType;
  if (input.eventType === "subscription.order.failure") {
    canonicalType = "PAYMENT_FAILED";
  } else if (alreadyActive) {
    canonicalType = "SUBSCRIPTION_RENEWED";
  } else {
    canonicalType = "SUBSCRIPTION_ACTIVATED";
  }

  return [
    {
      provider: "iyzico",
      providerEventId,
      eventType: canonicalType,
      occurredAt: input.occurredAt,
      subject,
      planTier,
      providerSubscriptionId: subscriptionReferenceCode || undefined,
      providerCustomerId: String(
        input.payload.customerReferenceCode ?? "",
      ) || undefined,
      providerVersion: input.providerVersion,
      safeMetadata: {
        iyziEventType: input.eventType,
        orderReferenceCode,
      },
    },
  ];
}

function mapCheckoutFormAuthEvent(input: {
  payload: Record<string, unknown>;
  eventType: string;
  occurredAt: Date;
  providerVersion?: number;
}): CanonicalBillingEvent {
  const iyziReferenceCode = String(input.payload.iyziReferenceCode ?? "");
  const paymentId = String(
    input.payload.iyziPaymentId ?? input.payload.paymentId ?? "",
  );
  const conversationId = String(input.payload.paymentConversationId ?? "");
  const status = String(input.payload.status ?? "").toUpperCase();
  const providerEventId =
    iyziReferenceCode || `hpp_${paymentId}_${conversationId}_${status}`;

  const parsed = parseIyzicoConversationId(conversationId);
  if (status !== "SUCCESS") {
    return {
      provider: "iyzico",
      providerEventId,
      eventType: status === "FAILURE" ? "PAYMENT_FAILED" : "IGNORED",
      occurredAt: input.occurredAt,
      subject: parsed?.subject,
      providerVersion: input.providerVersion,
      safeMetadata: {
        iyziEventType: input.eventType,
        status,
        kind: parsed?.kind,
      },
    };
  }

  if (parsed?.kind === "crd") {
    const pack =
      OFFER_CREDIT_PACKS[parsed.packId as keyof typeof OFFER_CREDIT_PACKS];
    return {
      provider: "iyzico",
      providerEventId,
      eventType: "CREDIT_PURCHASED",
      occurredAt: input.occurredAt,
      subject: parsed.subject,
      creditPackId: parsed.packId,
      credits: pack?.credits,
      providerVersion: input.providerVersion,
      safeMetadata: {
        iyziEventType: input.eventType,
        status,
        paymentId,
      },
    };
  }

  if (parsed?.kind === "sub") {
    // Subscription one-time CF auth is uncommon; treat success as activation hint.
    return {
      provider: "iyzico",
      providerEventId,
      eventType: "SUBSCRIPTION_ACTIVATED",
      occurredAt: input.occurredAt,
      subject: parsed.subject,
      planTier: parsed.planTier,
      providerVersion: input.providerVersion,
      safeMetadata: { iyziEventType: input.eventType, status },
    };
  }

  return {
    provider: "iyzico",
    providerEventId,
    eventType: "IGNORED",
    occurredAt: input.occurredAt,
    providerVersion: input.providerVersion,
    safeMetadata: { iyziEventType: input.eventType, status },
  };
}
