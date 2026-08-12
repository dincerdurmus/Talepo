import { prisma } from "@/lib/prisma";
import { BillingError, BillingErrorCode } from "@/lib/billing/errors";
import type { BillingSubjectRef } from "@/lib/billing/types";

/**
 * Billing mutate permission:
 * - USER subject: must be the actor
 * - COMPANY subject: OWNER or ADMIN active membership
 */
export async function assertCanMutateBilling(input: {
  actorUserId: string;
  subject: BillingSubjectRef;
}): Promise<void> {
  if (input.subject.type === "USER") {
    if (input.subject.id !== input.actorUserId) {
      throw new BillingError({
        code: BillingErrorCode.BILLING_FORBIDDEN,
        userMessage: "Bu abonelik üzerinde işlem yapamazsınız.",
      });
    }
    return;
  }

  const membership = await prisma.companyMember.findFirst({
    where: {
      companyId: input.subject.id,
      userId: input.actorUserId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new BillingError({
      code: BillingErrorCode.BILLING_FORBIDDEN,
      userMessage: "Plan/ödeme işlemleri için OWNER veya ADMIN rolü gerekir.",
    });
  }
}
