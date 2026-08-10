import type { PriceConfidenceLevel, PriceSignalType } from "@/lib/price-intelligence/types";
import {
  CONFIDENCE_V2_THRESHOLDS,
  OVERALL_CONFIDENCE_POLICY,
} from "@/lib/price-intelligence/confidence-config";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import type { CompletenessBreakdown } from "@/lib/price-intelligence/strategy-completeness";

import type { SignalGroupStatistics } from "./signal-group-stats";

export type ConfidenceLevelWithNone = PriceConfidenceLevel | "NONE";

export type ConfidenceDetail = {
  score: number;
  level: ConfidenceLevelWithNone;
  reasons: string[];
  sampleCount: number;
};

function scoreToLevel(
  score: number,
  thresholds: { veryHigh: number; high: number; medium: number; low: number },
): ConfidenceLevelWithNone {
  if (score <= 0) return "NONE";
  if (score >= thresholds.veryHigh) return "VERY_HIGH";
  if (score >= thresholds.high) return "HIGH";
  if (score >= thresholds.medium) return "MEDIUM";
  if (score >= thresholds.low) return "LOW";
  return "VERY_LOW";
}

function isWeakInternalLevel(level: ConfidenceLevelWithNone): boolean {
  return (OVERALL_CONFIDENCE_POLICY.weakInternalLevels as readonly string[]).includes(level);
}

/** Internal source-class weight for overall blend — confirmed > accepted > offers > requests */
function computeInternalClassWeight(input: {
  confirmedCount: number;
  acceptedCount: number;
  offerCount: number;
  requestCount: number;
}): number {
  const { confirmedCount, acceptedCount, offerCount, requestCount } = input;
  if (confirmedCount >= 10) return 1.0;
  if (confirmedCount >= 5) return 0.9;
  if (confirmedCount >= 3) return 0.8;
  if (confirmedCount >= 1) return 0.68;
  if (acceptedCount >= 5) return 0.52;
  if (acceptedCount >= 2) return 0.42;
  if (acceptedCount >= 1) return 0.32;
  if (offerCount >= 10) return 0.28;
  if (offerCount >= 3) return 0.22;
  if (offerCount >= 1) return 0.15;
  if (requestCount > 0) return 0.06;
  return 0;
}

/** External source-class weight — sold transactions outrank asking listings */
function computeExternalClassWeight(input: {
  externalSoldCount: number;
  externalListingCount: number;
}): number {
  const { externalSoldCount, externalListingCount } = input;
  if (externalSoldCount >= 5) return 0.78;
  if (externalSoldCount >= 1) return 0.62;
  if (externalListingCount >= 25) return 0.48;
  if (externalListingCount >= 10) return 0.38;
  if (externalListingCount >= 3) return 0.28;
  if (externalListingCount >= 1) return 0.18;
  return 0;
}

export function computeInternalConfidence(input: {
  confirmedStats: SignalGroupStatistics;
  acceptedStats: SignalGroupStatistics;
  offerStats: SignalGroupStatistics;
  requestStats: SignalGroupStatistics;
  strategyCompleteness: number;
  conditionAmbiguity: boolean;
}): ConfidenceDetail {
  const confirmed = confirmedStatsCount(input.confirmedStats);
  const accepted = input.acceptedStats.rawSampleSize;
  const offers = input.offerStats.rawSampleSize;
  const requests = input.requestStats.rawSampleSize;

  const reasons: string[] = [];
  let score = 0;

  if (confirmed >= 10) {
    score += 0.62;
    reasons.push(`${confirmed} confirmed transactions`);
  } else if (confirmed >= 5) {
    score += 0.45;
    reasons.push(`${confirmed} confirmed transactions`);
  } else if (confirmed >= 3) {
    score += 0.32;
    reasons.push(`${confirmed} confirmed transactions`);
  } else if (confirmed >= 1) {
    score += 0.18;
    reasons.push(`${confirmed} confirmed transaction`);
  }

  if (accepted >= 5) {
    score += 0.36;
    reasons.push(`${accepted} accepted offers`);
  } else if (accepted >= 2) {
    score += 0.2;
    reasons.push(`${accepted} accepted offers`);
  } else if (accepted >= 1) {
    score += 0.1;
  }

  if (offers >= 10) {
    score += 0.15;
    reasons.push(`${offers} Talepo offers`);
  } else if (offers >= 3) {
    score += 0.08;
  } else if (offers >= 1) {
    score += 0.03;
  }

  if (requests > 0 && confirmed === 0 && accepted === 0 && offers <= 2) {
    score *= 0.7;
    reasons.push("mostly request budgets without transaction confirmation");
  }

  score *= 0.7 + input.strategyCompleteness * 0.3;

  if (input.conditionAmbiguity) {
    score *= 0.9;
    reasons.push("condition ambiguity reduces internal confidence");
  }

  score = Math.min(1, Math.round(score * 1000) / 1000);
  const sampleCount = confirmed + accepted + offers;

  if (sampleCount === 0 && requests === 0) {
    return { score: 0, level: "NONE", reasons: ["no internal Talepo signals"], sampleCount: 0 };
  }

  return {
    score,
    level: scoreToLevel(score, CONFIDENCE_V2_THRESHOLDS.internal),
    reasons,
    sampleCount,
  };
}

function confirmedStatsCount(stats: SignalGroupStatistics): number {
  return stats.rawSampleSize;
}

export function computeExternalConfidence(input: {
  externalListingStats: SignalGroupStatistics;
  externalSoldStats: SignalGroupStatistics;
  strategy: PriceStrategyKey;
  externalMatchedCount: number;
  averageMatchQuality: number | null;
  providerSuitability: number;
  strategyCompleteness: number;
  identityConfidence: number;
}): ConfidenceDetail {
  const reasons: string[] = [];

  if (
    input.strategy === "UNKNOWN" ||
    input.strategy === "INTERNAL_ONLY" ||
    input.strategy === "USED_PRODUCT" ||
    input.strategy === "MEDICAL_DEVICE"
  ) {
    return {
      score: 0,
      level: "NONE",
      reasons: [`external not applicable for strategy=${input.strategy}`],
      sampleCount: 0,
    };
  }

  const matched = input.externalMatchedCount;
  if (matched < CONFIDENCE_V2_THRESHOLDS.externalMinMatchedCount) {
    return {
      score: 0,
      level: "NONE",
      reasons: ["no matched external listings"],
      sampleCount: 0,
    };
  }

  let score = 0;
  if (matched >= 25) {
    score += 0.35;
    reasons.push(`${matched} matched external listings`);
  } else if (matched >= 10) {
    score += 0.25;
    reasons.push(`${matched} matched external listings`);
  } else if (matched >= 3) {
    score += 0.15;
    reasons.push(`${matched} matched external listings`);
  } else {
    score += 0.08;
    reasons.push(`${matched} matched external listing(s)`);
  }

  const mq = input.averageMatchQuality ?? 0.5;
  score += mq * 0.25;
  if (mq >= 0.7) reasons.push("high match quality");
  else if (mq >= 0.5) reasons.push("moderate match quality");

  score += input.providerSuitability * 0.15;
  score += input.identityConfidence * 0.1;
  score *= 0.8 + input.strategyCompleteness * 0.2;

  if (input.externalSoldStats.rawSampleSize > 0) {
    score += 0.1;
    reasons.push("external sold signals present");
  }

  score = Math.min(1, Math.round(score * 1000) / 1000);

  return {
    score,
    level: scoreToLevel(score, CONFIDENCE_V2_THRESHOLDS.external),
    reasons,
    sampleCount: matched,
  };
}

export function computeOverallConfidence(input: {
  internal: ConfidenceDetail;
  external: ConfidenceDetail;
  confirmedCount: number;
  acceptedCount: number;
  offerCount: number;
  requestCount: number;
  externalSoldCount: number;
  strategy: PriceStrategyKey;
}): ConfidenceDetail {
  const reasons: string[] = [];

  if (input.internal.level === "NONE" && input.external.level === "NONE") {
    return {
      score: 0,
      level: "NONE",
      reasons: ["insufficient internal and external signals"],
      sampleCount: 0,
    };
  }

  const internalClassW = computeInternalClassWeight({
    confirmedCount: input.confirmedCount,
    acceptedCount: input.acceptedCount,
    offerCount: input.offerCount,
    requestCount: input.requestCount,
  });

  const externalClassW = computeExternalClassWeight({
    externalSoldCount: input.externalSoldCount,
    externalListingCount: input.external.sampleCount,
  });

  const totalClassW = internalClassW + externalClassW;
  let score =
    totalClassW > 0
      ? Math.round(
          ((input.internal.score * internalClassW + input.external.score * externalClassW) /
            totalClassW) *
            1000,
        ) / 1000
      : Math.max(input.internal.score, input.external.score);

  if (input.confirmedCount >= 5) {
    score = Math.max(score, input.internal.score * 0.85);
    reasons.push("confirmed Talepo transactions dominate");
  } else if (input.confirmedCount >= 1) {
    score = Math.max(score, input.internal.score * 0.7);
    reasons.push("confirmed transactions weighted strongly");
  }

  // Listing-only cap: weak internal + zero confirmed + no sold external + no accepted lift
  const listingOnlyExternal =
    input.external.sampleCount > 0 &&
    input.externalSoldCount === 0;
  const acceptedLiftsCap =
    input.acceptedCount >= OVERALL_CONFIDENCE_POLICY.acceptedLiftCapMin;
  const requestOnlyInternal =
    input.requestCount > 0 &&
    input.confirmedCount === 0 &&
    input.acceptedCount === 0 &&
    input.offerCount === 0;

  if (
    input.confirmedCount === 0 &&
    listingOnlyExternal &&
    isWeakInternalLevel(input.internal.level) &&
    !acceptedLiftsCap
  ) {
    const cap = OVERALL_CONFIDENCE_POLICY.listingOnlyWeakInternalMaxScore;
    if (score > cap) {
      score = cap;
      reasons.push("asking/listing-only external data caps overall confidence at MEDIUM");
    }
  }

  if (requestOnlyInternal) {
    score = Math.min(score, CONFIDENCE_V2_THRESHOLDS.overall.low);
    reasons.push("request budget alone cannot raise overall confidence");
  }

  // Accepted offers are transaction-adjacent — can lift overall when external also present
  if (
    input.confirmedCount === 0 &&
    input.acceptedCount >= 3 &&
    input.external.sampleCount > 0
  ) {
    score = Math.max(score, CONFIDENCE_V2_THRESHOLDS.overall.medium);
    reasons.push("accepted offers with external listings support MEDIUM overall confidence");
  }

  if (input.internal.sampleCount > 0) reasons.push(`internal sample=${input.internal.sampleCount}`);
  if (input.external.sampleCount > 0) reasons.push(`external sample=${input.external.sampleCount}`);

  return {
    score,
    level: scoreToLevel(score, CONFIDENCE_V2_THRESHOLDS.overall),
    reasons,
    sampleCount: input.internal.sampleCount + input.external.sampleCount,
  };
}

/** Backward-compatible aggregate confidence — maps to overall V2 level */
export function computeAggregateConfidence(input: {
  internalSample: number;
  confirmedSample: number;
  externalListingSample?: number;
  overallScore?: number;
}): PriceConfidenceLevel {
  if (input.overallScore !== undefined) {
    const level = scoreToLevel(input.overallScore, CONFIDENCE_V2_THRESHOLDS.overall);
    return level === "NONE" ? "VERY_LOW" : level;
  }

  if (input.internalSample < 5) return "VERY_LOW";
  if (input.internalSample < 10) return "LOW";
  if (input.confirmedSample >= 3 && input.internalSample >= 15) return "HIGH";
  if (input.internalSample >= 20) return "MEDIUM";
  if (input.internalSample >= 5) return "LOW";
  return "VERY_LOW";
}

export type ConfidenceV2Result = {
  internalConfidence: ConfidenceDetail;
  externalConfidence: ConfidenceDetail;
  overallConfidence: ConfidenceDetail;
  confidenceReasons: string[];
};

export function buildConfidenceV2(input: {
  signalGroups: {
    confirmedStats: SignalGroupStatistics;
    acceptedStats: SignalGroupStatistics;
    offerStats: SignalGroupStatistics;
    requestStats: SignalGroupStatistics;
    externalListingStats: SignalGroupStatistics;
    externalSoldStats: SignalGroupStatistics;
    conditionAmbiguity: boolean;
  };
  strategy: PriceStrategyKey;
  completeness: CompletenessBreakdown;
  externalMatchedCount: number;
  averageMatchQuality: number | null;
  providerSuitability: number;
  identityConfidence: number;
}): ConfidenceV2Result {
  const internalConfidence = computeInternalConfidence({
    confirmedStats: input.signalGroups.confirmedStats,
    acceptedStats: input.signalGroups.acceptedStats,
    offerStats: input.signalGroups.offerStats,
    requestStats: input.signalGroups.requestStats,
    strategyCompleteness: input.completeness.score,
    conditionAmbiguity: input.signalGroups.conditionAmbiguity,
  });

  const externalConfidence = computeExternalConfidence({
    externalListingStats: input.signalGroups.externalListingStats,
    externalSoldStats: input.signalGroups.externalSoldStats,
    strategy: input.strategy,
    externalMatchedCount: input.externalMatchedCount,
    averageMatchQuality: input.averageMatchQuality,
    providerSuitability: input.providerSuitability,
    strategyCompleteness: input.completeness.score,
    identityConfidence: input.identityConfidence,
  });

  const overallConfidence = computeOverallConfidence({
    internal: internalConfidence,
    external: externalConfidence,
    confirmedCount: input.signalGroups.confirmedStats.rawSampleSize,
    acceptedCount: input.signalGroups.acceptedStats.rawSampleSize,
    offerCount: input.signalGroups.offerStats.rawSampleSize,
    requestCount: input.signalGroups.requestStats.rawSampleSize,
    externalSoldCount: input.signalGroups.externalSoldStats.rawSampleSize,
    strategy: input.strategy,
  });

  const confidenceReasons = [
    ...overallConfidence.reasons,
    ...internalConfidence.reasons.map((r) => `internal: ${r}`),
    ...externalConfidence.reasons.map((r) => `external: ${r}`),
  ].slice(0, 8);

  return {
    internalConfidence,
    externalConfidence,
    overallConfidence,
    confidenceReasons,
  };
}

export { getSignalReliabilityWeight } from "@/lib/price-intelligence/confidence-config";

export type { PriceSignalType };
