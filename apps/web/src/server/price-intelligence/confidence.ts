import type { PriceConfidenceLevel } from "@/lib/price-intelligence/types";

import { CONFIDENCE_V2_THRESHOLDS } from "@/lib/price-intelligence/confidence-config";

import { MIN_AGGREGATE_SAMPLE } from "./statistics";

export {
  getSignalReliabilityWeight,
  SIGNAL_RELIABILITY_WEIGHTS,
} from "@/lib/price-intelligence/confidence-config";

export { computeAggregateConfidence } from "./confidence-v2";

/** @deprecated Use getSignalReliabilityWeight from confidence-config */
export function getSignalWeight(sourceType: string): number {
  const weights: Record<string, number> = {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.75,
    TALEPO_OFFER: 0.55,
    TALEPO_REQUEST: 0.35,
    EXTERNAL_SOLD: 0.85,
    EXTERNAL_LISTING: 0.25,
  };
  return weights[sourceType] ?? 0.2;
}

export { MIN_AGGREGATE_SAMPLE, CONFIDENCE_V2_THRESHOLDS };

export type { PriceConfidenceLevel };
