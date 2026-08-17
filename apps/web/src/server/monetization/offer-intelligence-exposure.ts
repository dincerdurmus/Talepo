import { isPrismaUniqueViolation } from "@/lib/observability/idempotency";
import { prisma } from "@/lib/prisma";
import {
  getRequestOfferIntelligence,
  OfferIntelligenceLookupError,
} from "@/server/monetization/offer-intelligence";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import {
  OFFER_INTELLIGENCE_STATUSES,
} from "@/lib/monetization/offer-intelligence";

export type RecordOfferIntelligenceExposureResult = {
  recorded: boolean;
  alreadyPresent: boolean;
  offerId: string | null;
};

/**
 * Persist first READY Teklif Zekâsı exposure for the viewer's offer.
 * Client may only send requestId — ownership, plan, and eligibility are re-checked.
 * Does not mutate OfferAttribution, Offer.amount, or negotiations.
 */
export async function recordOfferIntelligenceExposure(input: {
  userId: string;
  requestId: string;
}): Promise<RecordOfferIntelligenceExposureResult> {
  const intelligence = await getRequestOfferIntelligence({
    userId: input.userId,
    requestId: input.requestId,
  });

  if (intelligence.state !== "READY") {
    return { recorded: false, alreadyPresent: false, offerId: null };
  }

  const entitlements = await resolveEntitlements(
    input.userId,
    await getCompanyContextOptions(),
  );
  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const viewerOffer = await prisma.offer.findFirst({
    where: {
      requestId: input.requestId,
      status: { in: [...OFFER_INTELLIGENCE_STATUSES] },
      ...(companyId
        ? { companyId }
        : { submittedById: input.userId, companyId: null }),
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  if (!viewerOffer) {
    return { recorded: false, alreadyPresent: false, offerId: null };
  }

  try {
    await prisma.offerIntelligenceExposure.create({
      data: {
        offerId: viewerOffer.id,
        requestId: input.requestId,
        viewerUserId: input.userId,
        companyId,
      },
    });
    return {
      recorded: true,
      alreadyPresent: false,
      offerId: viewerOffer.id,
    };
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return {
        recorded: false,
        alreadyPresent: true,
        offerId: viewerOffer.id,
      };
    }
    throw error;
  }
}

export { OfferIntelligenceLookupError };
