import { canAccessRequest } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import {
  canRevealOfferStats,
  computeOfferPriceStats,
  emptyOfferIntelligence,
  OFFER_INTELLIGENCE_FEATURE,
  OFFER_INTELLIGENCE_STATUSES,
  toMoney,
  viewerVsMedianPct,
  type OfferIntelligenceDTO,
} from "@/lib/monetization/offer-intelligence";
import { prisma } from "@/lib/prisma";

export class OfferIntelligenceLookupError extends Error {
  code: "NOT_FOUND" | "ACCESS_DENIED";

  constructor(code: "NOT_FOUND" | "ACCESS_DENIED", message: string) {
    super(message);
    this.name = "OfferIntelligenceLookupError";
    this.code = code;
  }
}

const MARKETPLACE_REQUEST_STATUSES = [
  "PUBLISHED",
  "RECEIVING_OFFERS",
  "OFFER_SELECTED",
  "IN_PROGRESS",
] as const;

/**
 * Canonical Offer Intelligence for one request.
 * Viewer identity and competitor rows never leave this function.
 */
export async function getRequestOfferIntelligence(input: {
  userId: string;
  requestId: string;
}): Promise<OfferIntelligenceDTO> {
  const request = await prisma.request.findFirst({
    where: {
      id: input.requestId,
      deletedAt: null,
      status: { in: [...MARKETPLACE_REQUEST_STATUSES] },
    },
    select: {
      id: true,
      createdById: true,
      visibleToSuppliersAt: true,
    },
  });

  if (!request) {
    throw new OfferIntelligenceLookupError("NOT_FOUND", "Talep bulunamadı.");
  }

  if (request.createdById === input.userId) {
    return emptyOfferIntelligence("NOT_APPLICABLE");
  }

  const entitlements = await resolveEntitlements(
    input.userId,
    await getCompanyContextOptions(),
  );

  if (!canAccessRequest(entitlements, request)) {
    throw new OfferIntelligenceLookupError(
      "ACCESS_DENIED",
      "Bu talep henüz erişime açık değil.",
    );
  }

  if (!hasFeature(entitlements.features, OFFER_INTELLIGENCE_FEATURE)) {
    return emptyOfferIntelligence("LOCKED_PLAN");
  }

  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const viewerOffer = await prisma.offer.findFirst({
    where: {
      requestId: request.id,
      status: { in: [...OFFER_INTELLIGENCE_STATUSES] },
      ...(companyId
        ? { companyId }
        : { submittedById: input.userId, companyId: null }),
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      amount: true,
      currency: true,
    },
  });

  if (!viewerOffer) {
    return emptyOfferIntelligence("LOCKED_OWN_OFFER");
  }

  const viewerAmount = toMoney(Number(viewerOffer.amount));
  const currency = viewerOffer.currency;

  const others = await prisma.offer.findMany({
    where: {
      requestId: request.id,
      id: { not: viewerOffer.id },
      status: { in: [...OFFER_INTELLIGENCE_STATUSES] },
      currency,
    },
    select: { amount: true },
  });

  const otherCount = others.length;
  if (!canRevealOfferStats(otherCount)) {
    return emptyOfferIntelligence("INSUFFICIENT_SAMPLE", {
      otherCount,
      viewerAmount,
      currency,
    });
  }

  const stats = computeOfferPriceStats(
    others.map((row) => Number(row.amount)),
  );
  if (!stats) {
    return emptyOfferIntelligence("INSUFFICIENT_SAMPLE", {
      otherCount,
      viewerAmount,
      currency,
    });
  }

  return {
    state: "READY",
    currency,
    otherCount: stats.count,
    min: stats.min,
    max: stats.max,
    median: stats.median,
    average: stats.average,
    viewerAmount,
    viewerVsMedianPct: viewerVsMedianPct(viewerAmount, stats.median),
  };
}
