import { OFFER_CREDIT_PACKS } from "@/lib/membership/plans";
import { BillingError, BillingErrorCode } from "@/lib/billing/errors";
import { createSubsystemLogger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import type { BillingSubjectRef } from "@/lib/billing/types";

import { assertCanMutateBilling } from "./assert-billing-permission";
import { getBillingProvider } from "./get-provider";

const log = createSubsystemLogger("billing");

export async function createCreditCheckout(input: {
  actorUserId: string;
  subject: BillingSubjectRef;
  packId: keyof typeof OFFER_CREDIT_PACKS;
  successUrl: string;
  cancelUrl: string;
}) {
  await assertCanMutateBilling({
    actorUserId: input.actorUserId,
    subject: input.subject,
  });

  const pack = OFFER_CREDIT_PACKS[input.packId];
  if (!pack) {
    throw new BillingError({
      code: BillingErrorCode.PLAN_MAPPING_INVALID,
      userMessage: "Geçersiz kredi paketi.",
    });
  }

  const provider = getBillingProvider();
  const session = await provider.createCreditPurchase({
    subject: input.subject,
    packId: input.packId,
    credits: pack.credits,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    actorUserId: input.actorUserId,
  });

  // Ensure subscription row exists for subject (credits don't require ACTIVE sub)
  await prisma.billingSubscription.upsert({
    where: {
      subjectType_subjectId: {
        subjectType: input.subject.type,
        subjectId: input.subject.id,
      },
    },
    create: {
      subjectType: input.subject.type,
      subjectId: input.subject.id,
      planTier: "STANDARD",
      status: "INACTIVE",
      provider: session.provider,
    },
    update: {
      provider: session.provider,
    },
  });

  log.info("billing.credit.checkout.started", {
    outcome: "success",
    userId: input.actorUserId,
    companyId:
      input.subject.type === "COMPANY" ? input.subject.id : undefined,
    context: { packId: input.packId, credits: pack.credits },
  });

  return { ...session, credits: pack.credits, packId: input.packId };
}
