import { resolveEffectivePlanTier } from "@/lib/membership/plan-tier-utils";
import type { PlanTierId } from "@/lib/membership/plans";
import { prisma } from "@/lib/prisma";
import type { BillingSubjectRef } from "@/lib/billing/types";

/**
 * Diagnostic reconciliation — billing subscription vs membership plan.
 * Not a cron; callable for support/debug.
 */
export async function reconcileBillingEntitlement(subject: BillingSubjectRef) {
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
    const c = await prisma.company.findUnique({
      where: { id: subject.id },
      select: { planTier: true, planExpiresAt: true },
    });
    storedPlan = (c?.planTier as PlanTierId) ?? "STANDARD";
    expiresAt = c?.planExpiresAt ?? null;
  } else {
    const u = await prisma.user.findUnique({
      where: { id: subject.id },
      select: { planTier: true, planExpiresAt: true },
    });
    storedPlan = (u?.planTier as PlanTierId) ?? "STANDARD";
    expiresAt = u?.planExpiresAt ?? null;
  }

  const { effectivePlanTier } = resolveEffectivePlanTier(
    storedPlan,
    expiresAt,
    new Date(),
  );

  const billingActive =
    sub?.status === "ACTIVE" ||
    sub?.status === "CANCEL_AT_PERIOD_END" ||
    sub?.status === "PAST_DUE";

  const expectedTier = billingActive
    ? (sub?.planTier as PlanTierId)
    : "STANDARD";

  const drift =
    billingActive && effectivePlanTier !== expectedTier
      ? true
      : !billingActive && effectivePlanTier !== "STANDARD" && !expiresAt
        ? true
        : false;

  return {
    subject,
    billingStatus: sub?.status ?? "INACTIVE",
    billingPlanTier: sub?.planTier ?? null,
    membershipStoredPlan: storedPlan,
    membershipEffectivePlan: effectivePlanTier,
    drift,
  };
}
