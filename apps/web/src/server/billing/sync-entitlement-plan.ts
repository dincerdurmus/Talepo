import type { PlanTierId } from "@/lib/membership/plans";
import { prisma } from "@/lib/prisma";

import type { BillingSubjectRef } from "@/lib/billing/types";

/**
 * Billing → membership sync.
 * featuresForPlan remains SoT for features; we only set planTier + expiry.
 */
export async function syncSubjectPlanFromBilling(input: {
  subject: BillingSubjectRef;
  planTier: PlanTierId;
  planExpiresAt: Date | null;
}): Promise<void> {
  if (input.subject.type === "COMPANY") {
    await prisma.company.update({
      where: { id: input.subject.id },
      data: {
        planTier: input.planTier,
        planExpiresAt: input.planExpiresAt,
      },
    });
    return;
  }

  await prisma.user.update({
    where: { id: input.subject.id },
    data: {
      planTier: input.planTier,
      planExpiresAt: input.planExpiresAt,
    },
  });
}

export async function grantBonusCredits(input: {
  subject: BillingSubjectRef;
  credits: number;
}): Promise<void> {
  if (input.credits <= 0) return;
  if (input.subject.type === "COMPANY") {
    await prisma.company.update({
      where: { id: input.subject.id },
      data: { bonusOfferCredits: { increment: input.credits } },
    });
    return;
  }
  await prisma.user.update({
    where: { id: input.subject.id },
    data: { bonusOfferCredits: { increment: input.credits } },
  });
}

export async function reverseBonusCredits(input: {
  subject: BillingSubjectRef;
  credits: number;
}): Promise<void> {
  if (input.credits <= 0) return;
  if (input.subject.type === "COMPANY") {
    await prisma.company.update({
      where: { id: input.subject.id },
      data: { bonusOfferCredits: { decrement: input.credits } },
    });
    return;
  }
  await prisma.user.update({
    where: { id: input.subject.id },
    data: { bonusOfferCredits: { decrement: input.credits } },
  });
}
