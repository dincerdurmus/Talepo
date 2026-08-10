import {
  CONFIDENCE_V2_THRESHOLDS,
  MARKET_RANGE_POLICY,
} from "@/lib/price-intelligence/confidence-config";
import type { PriceConfidenceLevel } from "@/lib/price-intelligence/types";

import type { ConfidenceDetail } from "./confidence-v2";
import type { SignalGroupStatistics, WeightedObservation } from "./signal-group-stats";

export type WeightedMarketReference = {
  median: number | null;
  p25: number | null;
  p75: number | null;
  effectiveSampleWeight: number;
  insufficientData: boolean;
  contributingSignals: string[];
};

export type MarketRange = {
  low: number;
  median: number;
  high: number;
  currency: string;
};

export type BudgetEvaluationStatus =
  | "BELOW_MARKET"
  | "WITHIN_MARKET"
  | "ABOVE_MARKET"
  | "UNKNOWN";

export type BudgetEvaluation = {
  status: BudgetEvaluationStatus;
  differencePercent: number | null;
  marketMedian: number | null;
  userBudget: number | null;
  confidence: PriceConfidenceLevel | "NONE";
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower] ?? null;
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? 0;
  return a + (b - a) * (idx - lower);
}

/** Weighted median from group medians — not price * weight manipulation */
export function computeWeightedMarketReference(input: {
  groups: Array<{
    signalType: string;
    stats: SignalGroupStatistics;
    includeInReference: boolean;
  }>;
  weightedObservations: WeightedObservation[];
}): WeightedMarketReference {
  const contributingSignals: string[] = [];
  const groupMedians: Array<{ median: number; weight: number; type: string }> = [];

  for (const group of input.groups) {
    if (!group.includeInReference) continue;
    if (group.stats.insufficientData || group.stats.median === null) continue;
    if (group.stats.effectiveWeight <= 0) continue;

    groupMedians.push({
      median: group.stats.median,
      weight: group.stats.effectiveWeight,
      type: group.signalType,
    });
    contributingSignals.push(group.signalType);
  }

  const totalWeight = groupMedians.reduce((s, g) => s + g.weight, 0);

  if (totalWeight < CONFIDENCE_V2_THRESHOLDS.marketRangeMinEffectiveWeight || groupMedians.length === 0) {
    return {
      median: null,
      p25: null,
      p75: null,
      effectiveSampleWeight: Math.round(totalWeight * 1000) / 1000,
      insufficientData: true,
      contributingSignals,
    };
  }

  const refPrices = input.weightedObservations
    .filter((o) => contributingSignals.includes(o.sourceType))
    .map((o) => o.price)
    .sort((a, b) => a - b);

  if (refPrices.length < 3) {
    const weightedMedian =
      groupMedians.reduce((s, g) => s + g.median * g.weight, 0) / totalWeight;
    return {
      median: Math.round(weightedMedian),
      p25: null,
      p75: null,
      effectiveSampleWeight: Math.round(totalWeight * 1000) / 1000,
      insufficientData: refPrices.length === 0,
      contributingSignals,
    };
  }

  return {
    median: percentile(refPrices, 0.5) !== null ? Math.round(percentile(refPrices, 0.5)!) : null,
    p25: percentile(refPrices, 0.25) !== null ? Math.round(percentile(refPrices, 0.25)!) : null,
    p75: percentile(refPrices, 0.75) !== null ? Math.round(percentile(refPrices, 0.75)!) : null,
    effectiveSampleWeight: Math.round(totalWeight * 1000) / 1000,
    insufficientData: false,
    contributingSignals,
  };
}

export function computeMarketRange(input: {
  weightedReference: WeightedMarketReference;
  overallConfidence: ConfidenceDetail;
  currency?: string;
}): MarketRange | null {
  const { weightedReference, overallConfidence } = input;

  if (weightedReference.insufficientData) return null;
  if (overallConfidence.score < CONFIDENCE_V2_THRESHOLDS.marketRangeMinScore) return null;
  if (weightedReference.median === null) return null;

  const low = weightedReference.p25 ?? weightedReference.median;
  const high = weightedReference.p75 ?? weightedReference.median;

  if (low <= 0 || high <= 0) return null;

  return {
    low,
    median: weightedReference.median,
    high,
    currency: input.currency ?? "TRY",
  };
}

export function parseBudgetValue(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function computeBudgetEvaluation(input: {
  userBudget: number | null;
  marketRange: MarketRange | null;
  overallConfidence: ConfidenceDetail;
}): BudgetEvaluation {
  const unknown: BudgetEvaluation = {
    status: "UNKNOWN",
    differencePercent: null,
    marketMedian: input.marketRange?.median ?? null,
    userBudget: input.userBudget,
    confidence: "NONE",
  };

  if (!input.userBudget || !input.marketRange) return unknown;
  if (overallConfidenceInsufficient(input.overallConfidence)) return unknown;

  const { low, median, high } = input.marketRange;
  const tol = MARKET_RANGE_POLICY.withinMarketTolerance;
  const bandLow = low * (1 - tol);
  const bandHigh = high * (1 + tol);

  let status: BudgetEvaluationStatus;
  if (input.userBudget < bandLow) status = "BELOW_MARKET";
  else if (input.userBudget > bandHigh) status = "ABOVE_MARKET";
  else status = "WITHIN_MARKET";

  const differencePercent =
    median > 0
      ? Math.round(((input.userBudget - median) / median) * 1000) / 10
      : null;

  const confLevel = input.overallConfidence.level;
  const confidence: PriceConfidenceLevel | "NONE" =
    confLevel === "NONE" ? "NONE" : confLevel;

  return {
    status,
    differencePercent,
    marketMedian: median,
    userBudget: input.userBudget,
    confidence,
  };
}

function overallConfidenceInsufficient(conf: ConfidenceDetail): boolean {
  return conf.score < CONFIDENCE_V2_THRESHOLDS.marketRangeMinScore;
}

/** Request budgets must not dominate — exclude from reference groups by default */
export function shouldIncludeInMarketReference(signalType: string): boolean {
  return signalType !== "TALEPO_REQUEST";
}
