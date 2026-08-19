import {
  appendAttributionTouch,
  type OfferAcquisitionSource,
} from "@/lib/offer/offer-attribution";
import { offerFormHref } from "@/lib/panel/offer-form-href";
import { OPPORTUNITY_REQUEST_DETAIL_BASE } from "@/lib/panel/opportunity-request-detail-href";
import {
  issueOfferAttributionTouch,
  type RadarTierAtExposure,
} from "@/server/offer/offer-attribution-touch";

export function attributedRequestDetailHref(input: {
  userId: string;
  requestId: string;
  source: Exclude<OfferAcquisitionSource, "UNKNOWN">;
  savedSearchId?: string | null;
  alertRuleId?: string | null;
  opportunityMatchId?: string | null;
  radarTier?: RadarTierAtExposure | null;
  pathSuffix?: "" | "/teklif";
}): string {
  const base = `${OPPORTUNITY_REQUEST_DETAIL_BASE}/${input.requestId}${input.pathSuffix ?? ""}`;
  const touch = issueOfferAttributionTouch({
    userId: input.userId,
    requestId: input.requestId,
    source: input.source,
    savedSearchId: input.savedSearchId,
    alertRuleId: input.alertRuleId,
    opportunityMatchId: input.opportunityMatchId,
    radarTier: input.radarTier,
  });
  return appendAttributionTouch(base, touch);
}

export function attributedOfferFormHref(input: {
  userId: string;
  requestId: string;
  source: Exclude<OfferAcquisitionSource, "UNKNOWN">;
  savedSearchId?: string | null;
  alertRuleId?: string | null;
  opportunityMatchId?: string | null;
  radarTier?: RadarTierAtExposure | null;
}): string {
  const touch = issueOfferAttributionTouch({
    userId: input.userId,
    requestId: input.requestId,
    source: input.source,
    savedSearchId: input.savedSearchId,
    alertRuleId: input.alertRuleId,
    opportunityMatchId: input.opportunityMatchId,
    radarTier: input.radarTier,
  });
  return appendAttributionTouch(offerFormHref(input.requestId), touch);
}
