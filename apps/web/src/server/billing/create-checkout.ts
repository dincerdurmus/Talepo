import { assertCheckoutPlan } from "@/lib/billing/plan-mapping";
import type { PlanTierId } from "@/lib/membership/plans";
import { createSubsystemLogger } from "@/lib/observability/logger";
import {
  ProductEventName,
  trackProductEvent,
} from "@/lib/observability/product-events";
import { prisma } from "@/lib/prisma";
import type { BillingSubjectRef } from "@/lib/billing/types";

import { assertCanMutateBilling } from "./assert-billing-permission";
import { getBillingProvider } from "./get-provider";

const log = createSubsystemLogger("billing");

export async function createPlanCheckout(input: {
  actorUserId: string;
  subject: BillingSubjectRef;
  planTier: PlanTierId;
  successUrl: string;
  cancelUrl: string;
}) {
  await assertCanMutateBilling({
    actorUserId: input.actorUserId,
    subject: input.subject,
  });

  // Server-side mapping only — ignore any client price
  assertCheckoutPlan(input.planTier);

  const provider = getBillingProvider();
  const session = await provider.createCheckoutSession({
    subject: input.subject,
    planTier: input.planTier,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    actorUserId: input.actorUserId,
  });

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
      planTier: input.planTier,
      status: "PENDING",
      provider: session.provider,
    },
    update: {
      planTier: input.planTier,
      status: "PENDING",
      provider: session.provider,
    },
  });

  trackProductEvent({
    eventName: ProductEventName.CHECKOUT_STARTED,
    actorType: input.subject.type === "COMPANY" ? "corporate" : "seller",
    surface: "billing.checkout",
    companyId:
      input.subject.type === "COMPANY" ? input.subject.id : undefined,
    metadata: { planTier: input.planTier, provider: session.provider },
  });

  log.info("billing.checkout.started", {
    outcome: "success",
    userId: input.actorUserId,
    companyId:
      input.subject.type === "COMPANY" ? input.subject.id : undefined,
    context: { planTier: input.planTier, provider: session.provider },
  });

  return session;
}
