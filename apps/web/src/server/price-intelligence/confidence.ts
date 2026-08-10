import type { PriceConfidenceLevel } from "@/lib/price-intelligence/types";

import { MIN_AGGREGATE_SAMPLE } from "./statistics";

const SIGNAL_WEIGHTS: Record<string, number> = {
  TALEPO_CONFIRMED_TRANSACTION: 1.0,
  TALEPO_ACCEPTED_OFFER: 0.75,
  TALEPO_OFFER: 0.55,
  TALEPO_REQUEST: 0.35,
  EXTERNAL_SOLD: 0.85,
  EXTERNAL_LISTING: 0.25,
};

export function getSignalWeight(sourceType: string): number {
  return SIGNAL_WEIGHTS[sourceType] ?? 0.2;
}

export function computeAggregateConfidence(input: {
  internalSample: number;
  confirmedSample: number;
  externalListingSample?: number;
}): PriceConfidenceLevel {
  // External listing count alone must not inflate confidence
  void input.externalListingSample;

  if (input.internalSample < MIN_AGGREGATE_SAMPLE) return "VERY_LOW";
  if (input.internalSample < 10) return "LOW";
  if (input.confirmedSample >= 3 && input.internalSample >= 15) return "HIGH";
  if (input.internalSample >= 20) return "MEDIUM";
  if (input.internalSample >= MIN_AGGREGATE_SAMPLE) return "LOW";
  return "VERY_LOW";
}
