import { resolveEffectivePlanTier } from "@/lib/membership/plan-tier-utils";
import type { PlanTierId } from "@/lib/membership/plans";
import { prisma } from "@/lib/prisma";
import type { BillingSnapshot, BillingSubjectRef } from "@/lib/billing/types";

function maskId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export async function getBillingSnapshot(
  subject: BillingSubjectRef,
): Promise<BillingSnapshot> {
  const sub = await prisma.billingSubscription.findUnique({
    where: {
      subjectType_subjectId: {
        subjectType: subject.type,
        subjectId: subject.id,
      },
    },
  });

  let storedPlan: PlanTierId = "STANDARD";
  let expiresAt: Date | null = null;

  if (subject.type === "COMPANY") {
    const company = await prisma.company.findUnique({
      where: { id: subject.id },
      select: { planTier: true, planExpiresAt: true },
    });
    storedPlan = (company?.planTier as PlanTierId) ?? "STANDARD";
    expiresAt = company?.planExpiresAt ?? null;
  } else {
    const user = await prisma.user.findUnique({
      where: { id: subject.id },
      select: { planTier: true, planExpiresAt: true },
    });
    storedPlan = (user?.planTier as PlanTierId) ?? "STANDARD";
    expiresAt = user?.planExpiresAt ?? null;
  }

  const { effectivePlanTier } = resolveEffectivePlanTier(
    storedPlan,
    expiresAt,
    new Date(),
  );

  const lastEvent = await prisma.billingEvent.findFirst({
    where: {
      subjectType: subject.type,
      subjectId: subject.id,
      status: "PROCESSED",
    },
    orderBy: { createdAt: "desc" },
    select: { eventType: true, createdAt: true },
  });

  return {
    subject,
    planTier: (sub?.planTier as PlanTierId) ?? storedPlan,
    effectivePlanTier,
    subscriptionStatus: (sub?.status as BillingSnapshot["subscriptionStatus"]) ?? "INACTIVE",
    provider: (sub?.provider as BillingSnapshot["provider"]) ?? null,
    providerSubscriptionIdMasked: maskId(sub?.providerSubscriptionId),
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    lastBillingEventType: lastEvent?.eventType ?? null,
    lastBillingEventAt: lastEvent?.createdAt?.toISOString() ?? null,
    pendingCheckout: sub?.status === "PENDING",
  };
}
