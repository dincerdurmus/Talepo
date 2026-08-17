import type { Prisma } from "@/generated/prisma/client";
import type { OfferAcquisitionSource } from "@/lib/offer/offer-attribution";
import { prisma } from "@/lib/prisma";
import {
  verifyOfferAttributionTouch,
  type OfferAttributionTouchPayload,
  type RadarTierAtExposure,
} from "@/server/offer/offer-attribution-touch";

export type ResolvedOfferAttribution = {
  source: OfferAcquisitionSource;
  savedSearchId: string | null;
  alertRuleId: string | null;
  opportunityMatchId: string | null;
  radarTier: RadarTierAtExposure | null;
};

type Tx = Prisma.TransactionClient;

function unknownSnapshot(): ResolvedOfferAttribution {
  return {
    source: "UNKNOWN",
    savedSearchId: null,
    alertRuleId: null,
    opportunityMatchId: null,
    radarTier: null,
  };
}

async function assertFollowOwnership(input: {
  userId: string;
  companyId: string | null;
  savedSearchId?: string;
  alertRuleId?: string;
}): Promise<boolean> {
  if (input.alertRuleId) {
    const rule = await prisma.alertRule.findFirst({
      where: { id: input.alertRuleId },
      select: {
        id: true,
        ownerType: true,
        userId: true,
        companyId: true,
      },
    });
    if (!rule) return false;
    if (rule.ownerType === "USER" && rule.userId === input.userId) return true;
    if (
      rule.ownerType === "COMPANY" &&
      input.companyId &&
      rule.companyId === input.companyId
    ) {
      return true;
    }
    return false;
  }

  if (input.savedSearchId) {
    const search = await prisma.savedSearch.findFirst({
      where: { id: input.savedSearchId },
      select: {
        id: true,
        ownerType: true,
        userId: true,
        companyId: true,
      },
    });
    if (!search) return false;
    if (search.ownerType === "USER" && search.userId === input.userId) {
      return true;
    }
    if (
      search.ownerType === "COMPANY" &&
      input.companyId &&
      search.companyId === input.companyId
    ) {
      return true;
    }
    return false;
  }

  return false;
}

async function assertOpportunityOwnership(input: {
  companyId: string | null;
  requestId: string;
  opportunityMatchId: string;
}): Promise<boolean> {
  if (!input.companyId) return false;
  const match = await prisma.opportunityMatch.findFirst({
    where: {
      id: input.opportunityMatchId,
      companyId: input.companyId,
      requestId: input.requestId,
    },
    select: { id: true },
  });
  return Boolean(match);
}

/**
 * Server-side resolve: signed touch is required for product sources.
 * Client-sent bare source enums are never trusted.
 * Failed / missing / spoofed claims → UNKNOWN (never invent RADAR/FOLLOW/OC).
 */
export async function resolveOfferAttribution(input: {
  userId: string;
  requestId: string;
  companyId: string | null;
  attributionTouch?: string | null;
}): Promise<ResolvedOfferAttribution> {
  const claims = verifyOfferAttributionTouch(input.attributionTouch, {
    userId: input.userId,
    requestId: input.requestId,
  });
  if (!claims) return unknownSnapshot();

  return validateTouchClaims(claims, input);
}

async function validateTouchClaims(
  claims: OfferAttributionTouchPayload,
  input: { userId: string; requestId: string; companyId: string | null },
): Promise<ResolvedOfferAttribution> {
  switch (claims.src) {
    case "RADAR": {
      return {
        source: "RADAR",
        savedSearchId: null,
        alertRuleId: null,
        opportunityMatchId: null,
        radarTier: claims.tier ?? null,
      };
    }
    case "DISCOVERY":
    case "DIRECT": {
      return {
        source: claims.src,
        savedSearchId: null,
        alertRuleId: null,
        opportunityMatchId: null,
        radarTier: null,
      };
    }
    case "FOLLOW": {
      const ok = await assertFollowOwnership({
        userId: input.userId,
        companyId: input.companyId,
        savedSearchId: claims.ssid,
        alertRuleId: claims.arid,
      });
      if (!ok) return unknownSnapshot();
      return {
        source: "FOLLOW",
        savedSearchId: claims.ssid ?? null,
        alertRuleId: claims.arid ?? null,
        opportunityMatchId: null,
        radarTier: null,
      };
    }
    case "OPPORTUNITY": {
      if (!claims.omid) return unknownSnapshot();
      const ok = await assertOpportunityOwnership({
        companyId: input.companyId,
        requestId: input.requestId,
        opportunityMatchId: claims.omid,
      });
      if (!ok) return unknownSnapshot();
      return {
        source: "OPPORTUNITY",
        savedSearchId: null,
        alertRuleId: null,
        opportunityMatchId: claims.omid,
        radarTier: null,
      };
    }
    default:
      return unknownSnapshot();
  }
}

export async function persistOfferAttribution(
  tx: Tx,
  offerId: string,
  snapshot: ResolvedOfferAttribution,
): Promise<void> {
  await tx.offerAttribution.create({
    data: {
      offerId,
      source: snapshot.source,
      savedSearchId: snapshot.savedSearchId,
      alertRuleId: snapshot.alertRuleId,
      opportunityMatchId: snapshot.opportunityMatchId,
      radarTier: snapshot.radarTier,
    },
  });
}
