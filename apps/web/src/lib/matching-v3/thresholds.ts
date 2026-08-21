/**
 * Tier thresholds — INITIAL / UNCALIBRATED.
 * Do not treat these as production-tuned cutoffs.
 */

import type { MatchTier } from "./types";
import { CALIBRATION_STATUS } from "./matcher-version";

export const SCORE_WEIGHTS = {
  category_exact: 28,
  category_ancestor: 16,
  category_candidate: 14,
  taxonomy_leaf: 18,
  product: 22,
  brand: 18,
  family_model: 14,
  attribute: 8,
  inventory: 16,
  explicit_follow: 20,
  location: 10,
  budget: 6,
  timing: 4,
  lexical: 10,
  negative_conflict: -40,
} as const;

/** Uncalibrated tier cutoffs (inclusive lower bounds on totalScore). */
export const TIER_THRESHOLDS = {
  EXACT: 70,
  STRONG: 50,
  NEAR: 30,
  REVIEW: 15,
  NO_MATCH: 0,
} as const;

export type ThresholdConfig = {
  calibrationStatus: typeof CALIBRATION_STATUS;
  weights: typeof SCORE_WEIGHTS;
  tiers: typeof TIER_THRESHOLDS;
};

export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  calibrationStatus: CALIBRATION_STATUS,
  weights: SCORE_WEIGHTS,
  tiers: TIER_THRESHOLDS,
};

export function tierFromScore(
  totalScore: number,
  hasConflict: boolean,
  config: ThresholdConfig = DEFAULT_THRESHOLD_CONFIG,
): MatchTier {
  if (hasConflict && totalScore < config.tiers.STRONG) {
    return totalScore >= config.tiers.REVIEW ? "REVIEW" : "NO_MATCH";
  }
  if (totalScore >= config.tiers.EXACT) return "EXACT";
  if (totalScore >= config.tiers.STRONG) return "STRONG";
  if (totalScore >= config.tiers.NEAR) return "NEAR";
  if (totalScore >= config.tiers.REVIEW) return "REVIEW";
  return "NO_MATCH";
}
