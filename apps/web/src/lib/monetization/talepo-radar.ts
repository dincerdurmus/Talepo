/**
 * Talepo Radar V1 — deterministic marketplace activity policy.
 * Not matching, not AI, not Offer Intelligence, not opportunityScore.
 *
 * Eligible offer statuses stay aligned with Teklif Zekâsı.
 */

import type { FeatureKey } from "@/lib/membership/entitlements";
import { OFFER_INTELLIGENCE_STATUSES } from "@/lib/monetization/offer-intelligence";

export const TALEPO_RADAR_FEATURE: FeatureKey = "talepo_radar";

export const RADAR_ELIGIBLE_OFFER_STATUSES = OFFER_INTELLIGENCE_STATUSES;

/** Open request must have at least this many eligible offers. */
export const RADAR_MIN_ELIGIBLE_OFFERS = 10;

/** Higher volume bar for HOT when velocity is unavailable or modest. */
export const RADAR_HOT_ELIGIBLE_OFFERS = 20;

export const RADAR_VELOCITY_WINDOW_HOURS = 6;

/** Recent eligible offers in the velocity window → FAST. */
export const RADAR_FAST_RECENT_OFFERS = 6;

/** Recent eligible offers in the velocity window → HOT. */
export const RADAR_HOT_RECENT_OFFERS = 10;

/** Cheap Request.offerCount prefilter + page cap. */
export const RADAR_CANDIDATE_TAKE = 40;

export const RADAR_BRAND_LINE = "Gözden Kaçar, Talepo’dan Kaçmaz";

export const RADAR_BRAND_SUBLINE =
  "Takip alanlarınızın dışında bile platformda dikkat çeken talepleri yakalar.";

export type RadarTier = "NONE" | "RADAR" | "FAST" | "HOT";

export type RadarClassification = {
  tier: Exclude<RadarTier, "NONE">;
  eligibleOfferCount: number;
  recentOfferCount: number | null;
  reason: string;
  label: string;
};

export const RADAR_TIER_LABEL: Record<Exclude<RadarTier, "NONE">, string> = {
  RADAR: "Dikkat çekiyor",
  FAST: "Hızla hareketleniyor",
  HOT: "Çok yoğun ilgi",
};

export function radarTierRank(tier: RadarTier): number {
  if (tier === "HOT") return 3;
  if (tier === "FAST") return 2;
  if (tier === "RADAR") return 1;
  return 0;
}

export function classifyRadarTier(input: {
  eligibleOfferCount: number;
  recentOfferCount: number | null;
}): RadarTier {
  if (input.eligibleOfferCount < RADAR_MIN_ELIGIBLE_OFFERS) return "NONE";

  const recent = input.recentOfferCount;
  const hotByCount = input.eligibleOfferCount >= RADAR_HOT_ELIGIBLE_OFFERS;
  const hotByVelocity =
    recent != null && recent >= RADAR_HOT_RECENT_OFFERS;
  if (hotByCount || hotByVelocity) return "HOT";

  if (recent != null && recent >= RADAR_FAST_RECENT_OFFERS) return "FAST";
  return "RADAR";
}

export function formatRadarReason(input: {
  eligibleOfferCount: number;
  recentOfferCount: number | null;
  windowHours?: number;
}): string {
  const windowHours = input.windowHours ?? RADAR_VELOCITY_WINDOW_HOURS;
  if (input.recentOfferCount != null && input.recentOfferCount > 0) {
    return `Son ${windowHours} saatte ${input.recentOfferCount} teklif`;
  }
  return `${input.eligibleOfferCount} teklif · Olağan dışı ilgi`;
}

export function classifyRadarSignal(input: {
  eligibleOfferCount: number;
  recentOfferCount: number | null;
}): RadarClassification | null {
  const tier = classifyRadarTier(input);
  if (tier === "NONE") return null;
  return {
    tier,
    eligibleOfferCount: input.eligibleOfferCount,
    recentOfferCount: input.recentOfferCount,
    reason: formatRadarReason(input),
    label: RADAR_TIER_LABEL[tier],
  };
}

export function compareRadarItems(
  a: {
    tier: RadarTier;
    alreadyOffered: boolean;
    recentOfferCount: number | null;
    eligibleOfferCount: number;
    publishedAtMs: number;
  },
  b: {
    tier: RadarTier;
    alreadyOffered: boolean;
    recentOfferCount: number | null;
    eligibleOfferCount: number;
    publishedAtMs: number;
  },
): number {
  const tierDiff = radarTierRank(b.tier) - radarTierRank(a.tier);
  if (tierDiff !== 0) return tierDiff;
  if (a.alreadyOffered !== b.alreadyOffered) {
    return a.alreadyOffered ? 1 : -1;
  }
  const recentDiff = (b.recentOfferCount ?? -1) - (a.recentOfferCount ?? -1);
  if (recentDiff !== 0) return recentDiff;
  const countDiff = b.eligibleOfferCount - a.eligibleOfferCount;
  if (countDiff !== 0) return countDiff;
  return b.publishedAtMs - a.publishedAtMs;
}
