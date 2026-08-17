import type { FeatureKey } from "@/lib/membership/entitlements";

/**
 * Offer Intelligence (Teklif Zekâsı) — anonymous price stats on one request.
 * Not Price Intelligence. Not competition_signals (count-only).
 *
 * Eligible other offers: SUBMITTED | VIEWED | ACCEPTED | REJECTED
 * Excluded: DRAFT (never submitted), WITHDRAWN (left the market), EXPIRED.
 * Privacy threshold uses OTHER offers only (viewer amount excluded).
 */
export const OFFER_INTELLIGENCE_FEATURE: FeatureKey = "professional_analytics";

export const OFFER_INTELLIGENCE_MIN_OTHERS = 3;

export const OFFER_INTELLIGENCE_STATUSES = [
  "SUBMITTED",
  "VIEWED",
  "ACCEPTED",
  "REJECTED",
] as const;

export type OfferIntelligenceState =
  | "LOCKED_PLAN"
  | "LOCKED_OWN_OFFER"
  | "INSUFFICIENT_SAMPLE"
  | "READY"
  | "NOT_APPLICABLE";

export type OfferPriceStats = {
  count: number;
  min: number;
  max: number;
  median: number;
  average: number;
};

export type OfferIntelligenceDTO = {
  state: OfferIntelligenceState;
  currency: string | null;
  otherCount: number | null;
  min: number | null;
  max: number | null;
  median: number | null;
  average: number | null;
  viewerAmount: number | null;
  viewerVsMedianPct: number | null;
};

export function emptyOfferIntelligence(
  state: OfferIntelligenceState,
  extras?: Partial<OfferIntelligenceDTO>,
): OfferIntelligenceDTO {
  return {
    state,
    currency: extras?.currency ?? null,
    otherCount: extras?.otherCount ?? null,
    min: null,
    max: null,
    median: null,
    average: null,
    viewerAmount: extras?.viewerAmount ?? null,
    viewerVsMedianPct: null,
  };
}

export function toMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeOfferPriceStats(amounts: number[]): OfferPriceStats | null {
  if (amounts.length === 0) return null;

  const sorted = amounts.map(toMoney).sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0]!;
  const max = sorted[count - 1]!;
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const average = toMoney(sum / count);

  const mid = Math.floor(count / 2);
  const median =
    count % 2 === 1
      ? sorted[mid]!
      : toMoney((sorted[mid - 1]! + sorted[mid]!) / 2);

  return { count, min, max, median, average };
}

/** ((viewer - median) / median) * 100. Null when median is 0. */
export function viewerVsMedianPct(
  viewerAmount: number,
  median: number,
): number | null {
  if (!Number.isFinite(viewerAmount) || !Number.isFinite(median) || median === 0) {
    return null;
  }
  return Math.round(((viewerAmount - median) / median) * 1000) / 10;
}

export function canRevealOfferStats(otherCount: number): boolean {
  return otherCount >= OFFER_INTELLIGENCE_MIN_OTHERS;
}
