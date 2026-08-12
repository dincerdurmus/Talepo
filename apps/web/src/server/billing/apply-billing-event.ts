import type { Prisma } from "@/generated/prisma/client";
import { createSubsystemLogger } from "@/lib/observability/logger";
import {
  ProductEventName,
  trackProductEvent,
} from "@/lib/observability/product-events";
import { prisma } from "@/lib/prisma";
import {
  assertSubscriptionTransition,
  canTransitionSubscription,
  targetStatusForEvent,
} from "@/lib/billing/state-machine";
import type {
  CanonicalBillingEvent,
  SubscriptionStatus,
} from "@/lib/billing/types";

import {
  grantBonusCredits,
  reverseBonusCredits,
  syncSubjectPlanFromBilling,
} from "./sync-entitlement-plan";

const log = createSubsystemLogger("billing");

export type ApplyBillingEventResult = {
  outcome: "processed" | "duplicate" | "ignored" | "rejected_transition";
  subscriptionId?: string;
};

/**
 * Canonical billing event processor — webhook authority entrypoint.
 * Idempotent on provider+providerEventId.
 */
export async function applyCanonicalBillingEvent(
  event: CanonicalBillingEvent,
): Promise<ApplyBillingEventResult> {
  const existing = await prisma.billingEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: event.provider,
        providerEventId: event.providerEventId,
      },
    },
    select: { id: true, status: true },
  });

  if (existing?.status === "PROCESSED") {
    log.info("billing.webhook.duplicate", {
      outcome: "skipped",
      context: { providerEventId: event.providerEventId },
    });
    return { outcome: "duplicate" };
  }

  const recorded = existing
    ? existing
    : await prisma.billingEvent.create({
        data: {
          provider: event.provider,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          subjectType: event.subject?.type,
          subjectId: event.subject?.id,
          status: "RECEIVED",
          eventTimestamp: event.occurredAt,
          providerVersion: event.providerVersion ?? null,
          safeMetadata: (event.safeMetadata ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
        select: { id: true, status: true },
      });

  if (event.eventType === "IGNORED" || !event.subject) {
    await prisma.billingEvent.update({
      where: { id: recorded.id },
      data: { status: "IGNORED", processedAt: new Date() },
    });
    return { outcome: "ignored" };
  }

  try {
    const result = await processEvent(event);
    await prisma.billingEvent.update({
      where: { id: recorded.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        subscriptionId: result.subscriptionId ?? null,
        subjectType: event.subject.type,
        subjectId: event.subject.id,
      },
    });
    return { outcome: "processed", subscriptionId: result.subscriptionId };
  } catch (error) {
    await prisma.billingEvent.update({
      where: { id: recorded.id },
      data: {
        status: "FAILED",
        processedAt: new Date(),
        safeMetadata: {
          ...(event.safeMetadata ?? {}),
          errorName: error instanceof Error ? error.name : "unknown",
        } as Prisma.InputJsonValue,
      },
    });
    throw error;
  }
}

async function processEvent(
  event: CanonicalBillingEvent,
): Promise<{ subscriptionId?: string }> {
  const subject = event.subject!;

  if (event.eventType === "CREDIT_PURCHASED" && event.credits) {
    await grantBonusCredits({ subject, credits: event.credits });
    await prisma.creditLedgerEntry.create({
      data: {
        subjectType: subject.type,
        subjectId: subject.id,
        entryType: "PURCHASE",
        credits: event.credits,
        providerEventId: event.providerEventId,
        packId: event.creditPackId ?? null,
      },
    });
    trackProductEvent({
      eventName: ProductEventName.CREDIT_PURCHASED,
      actorType: subject.type === "COMPANY" ? "corporate" : "seller",
      surface: "billing.credit",
      companyId: subject.type === "COMPANY" ? subject.id : undefined,
      metadata: {
        credits: event.credits,
      },
    });
    log.info("billing.credit.granted", {
      outcome: "success",
      companyId: subject.type === "COMPANY" ? subject.id : undefined,
      context: { credits: event.credits },
    });
    return {};
  }

  if (event.eventType === "CREDIT_REFUNDED" && event.credits) {
    await reverseBonusCredits({ subject, credits: event.credits });
    await prisma.creditLedgerEntry.create({
      data: {
        subjectType: subject.type,
        subjectId: subject.id,
        entryType: "REFUND",
        credits: -Math.abs(event.credits),
        providerEventId: event.providerEventId,
        packId: event.creditPackId ?? null,
      },
    });
    return {};
  }

  const targetStatus = targetStatusForEvent(event.eventType);
  if (!targetStatus) {
    return {};
  }

  const existingSub = await prisma.billingSubscription.findFirst({
    where: {
      subjectType: subject.type,
      subjectId: subject.id,
    },
    orderBy: { updatedAt: "desc" },
  });

  const fromStatus = (existingSub?.status ??
    "INACTIVE") as SubscriptionStatus;

  // Out-of-order guard: older providerVersion cannot regress state
  if (
    existingSub?.providerVersion != null &&
    event.providerVersion != null &&
    event.providerVersion < existingSub.providerVersion
  ) {
    log.warn("billing.event.out_of_order", {
      outcome: "skipped",
      context: {
        existing: existingSub.providerVersion,
        incoming: event.providerVersion,
      },
    });
    return { subscriptionId: existingSub.id };
  }

  if (!canTransitionSubscription(fromStatus, targetStatus)) {
    log.warn("billing.transition.rejected", {
      outcome: "denied",
      context: { from: fromStatus, to: targetStatus },
    });
    return { subscriptionId: existingSub?.id };
  }

  assertSubscriptionTransition(fromStatus, targetStatus);

  const planTier = event.planTier ?? existingSub?.planTier ?? "PREMIUM";
  const periodEnd =
    event.currentPeriodEnd ??
    existingSub?.currentPeriodEnd ??
    addMonth(new Date());

  const sub = existingSub
    ? await prisma.billingSubscription.update({
        where: { id: existingSub.id },
        data: {
          status: targetStatus,
          planTier,
          provider: event.provider,
          providerSubscriptionId:
            event.providerSubscriptionId ?? existingSub.providerSubscriptionId,
          providerCustomerId:
            event.providerCustomerId ?? existingSub.providerCustomerId,
          currentPeriodStart:
            event.currentPeriodStart ?? existingSub.currentPeriodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd:
            event.cancelAtPeriodEnd ??
            targetStatus === "CANCEL_AT_PERIOD_END",
          canceledAt:
            targetStatus === "CANCELED" || targetStatus === "EXPIRED"
              ? new Date()
              : existingSub.canceledAt,
          pastDueAt:
            targetStatus === "PAST_DUE" ? new Date() : existingSub.pastDueAt,
          providerVersion: event.providerVersion ?? existingSub.providerVersion,
        },
      })
    : await prisma.billingSubscription.create({
        data: {
          subjectType: subject.type,
          subjectId: subject.id,
          planTier,
          status: targetStatus,
          provider: event.provider,
          providerSubscriptionId: event.providerSubscriptionId,
          providerCustomerId: event.providerCustomerId,
          currentPeriodStart: event.currentPeriodStart ?? new Date(),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: targetStatus === "CANCEL_AT_PERIOD_END",
          providerVersion: event.providerVersion ?? null,
        },
      });

  // Entitlement sync policy:
  // ACTIVE / CANCEL_AT_PERIOD_END → paid plan through period end
  // PAST_DUE → keep plan (grace); do not instant downgrade
  // CANCELED / EXPIRED / INACTIVE → STANDARD
  if (
    targetStatus === "ACTIVE" ||
    targetStatus === "CANCEL_AT_PERIOD_END" ||
    targetStatus === "PAST_DUE"
  ) {
    await syncSubjectPlanFromBilling({
      subject,
      planTier: planTier as "PREMIUM" | "PROFESSIONAL" | "CORPORATE",
      planExpiresAt: periodEnd,
    });
  } else if (
    targetStatus === "CANCELED" ||
    targetStatus === "EXPIRED" ||
    targetStatus === "INACTIVE"
  ) {
    await syncSubjectPlanFromBilling({
      subject,
      planTier: "STANDARD",
      planExpiresAt: null,
    });
  }

  if (
    event.eventType === "SUBSCRIPTION_ACTIVATED" ||
    event.eventType === "CHECKOUT_COMPLETED"
  ) {
    trackProductEvent({
      eventName: ProductEventName.SUBSCRIPTION_ACTIVATED,
      actorType: subject.type === "COMPANY" ? "corporate" : "seller",
      surface: "billing.subscription",
      companyId: subject.type === "COMPANY" ? subject.id : undefined,
      metadata: { planTier, status: targetStatus },
    });
  }
  if (
    event.eventType === "SUBSCRIPTION_CANCELED" ||
    event.eventType === "SUBSCRIPTION_CANCEL_AT_PERIOD_END"
  ) {
    trackProductEvent({
      eventName: ProductEventName.SUBSCRIPTION_CANCELED,
      actorType: subject.type === "COMPANY" ? "corporate" : "seller",
      surface: "billing.subscription",
      companyId: subject.type === "COMPANY" ? subject.id : undefined,
      metadata: { status: targetStatus },
    });
  }
  if (event.eventType === "PAYMENT_FAILED") {
    trackProductEvent({
      eventName: ProductEventName.PAYMENT_FAILED,
      actorType: subject.type === "COMPANY" ? "corporate" : "seller",
      surface: "billing.subscription",
      companyId: subject.type === "COMPANY" ? subject.id : undefined,
      metadata: { status: targetStatus },
    });
  }

  log.info("billing.subscription.updated", {
    outcome: "success",
    companyId: subject.type === "COMPANY" ? subject.id : undefined,
    context: {
      status: targetStatus,
      planTier,
      subscriptionId: sub.id,
    },
  });

  return { subscriptionId: sub.id };
}

function addMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}
