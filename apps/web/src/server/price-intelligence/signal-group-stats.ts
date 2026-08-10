import type { PriceSignalType, PriceStatistics } from "@/lib/price-intelligence/types";
import {
  getSignalReliabilityWeight,
  getStrategySignalImportance,
} from "@/lib/price-intelligence/confidence-config";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import { computeObservationDecayWeight } from "@/lib/price-intelligence/time-decay";

import { computePriceStatistics } from "./statistics";

export type WeightedObservation = {
  price: number;
  sourceType: PriceSignalType;
  observedAt: Date;
  condition: string | null;
  currency: string;
  decayWeight: number;
  groupWeight: number;
  effectiveWeight: number;
};

export type SignalGroupStatistics = PriceStatistics & {
  signalType: PriceSignalType;
  effectiveWeight: number;
  recencyDaysMedian: number | null;
  reliabilityWeight: number;
  strategyImportance: number;
};

export type SignalGroupBundle = {
  requestStats: SignalGroupStatistics;
  offerStats: SignalGroupStatistics;
  acceptedStats: SignalGroupStatistics;
  confirmedStats: SignalGroupStatistics;
  externalListingStats: SignalGroupStatistics;
  externalSoldStats: SignalGroupStatistics;
  weightedObservations: WeightedObservation[];
  conditionAmbiguity: boolean;
};

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function buildGroupStats(
  signalType: PriceSignalType,
  observations: WeightedObservation[],
  strategy: PriceStrategyKey,
  minSample: number,
): SignalGroupStatistics {
  const prices = observations.map((o) => o.price);
  const base = computePriceStatistics(prices, minSample);
  const effectiveWeight = observations.reduce((sum, o) => sum + o.effectiveWeight, 0);
  const ages = observations.map((o) =>
    Math.max(0, Math.floor((Date.now() - o.observedAt.getTime()) / 86400000)),
  );

  return {
    ...base,
    signalType,
    effectiveWeight: Math.round(effectiveWeight * 1000) / 1000,
    recencyDaysMedian: medianOf(ages),
    reliabilityWeight: getSignalReliabilityWeight(signalType),
    strategyImportance: getStrategySignalImportance(strategy, signalType),
  };
}

export function buildSignalGroupBundle(input: {
  observations: Array<{
    price: number;
    sourceType: PriceSignalType;
    observedAt: Date;
    condition: string | null;
    currency: string;
  }>;
  strategy: PriceStrategyKey;
  referenceDate?: Date;
  minSample?: number;
}): SignalGroupBundle {
  const minSample = input.minSample ?? 1;
  const weightedObservations: WeightedObservation[] = [];

  for (const obs of input.observations) {
    const decayWeight = computeObservationDecayWeight(obs.observedAt, input.referenceDate);
    const reliability = getSignalReliabilityWeight(obs.sourceType);
    const strategyImp = getStrategySignalImportance(input.strategy, obs.sourceType);
    if (strategyImp <= 0) continue;

    const groupWeight = reliability * strategyImp;
    weightedObservations.push({
      ...obs,
      decayWeight,
      groupWeight,
      effectiveWeight: decayWeight * groupWeight,
    });
  }

  const byType = (type: PriceSignalType) =>
    weightedObservations.filter((o) => o.sourceType === type);

  const hasUnknownConditionObs = input.observations.some((o) => !o.condition?.trim());
  const conditionAmbiguity = hasUnknownConditionObs;

  return {
    requestStats: buildGroupStats("TALEPO_REQUEST", byType("TALEPO_REQUEST"), input.strategy, minSample),
    offerStats: buildGroupStats("TALEPO_OFFER", byType("TALEPO_OFFER"), input.strategy, minSample),
    acceptedStats: buildGroupStats("TALEPO_ACCEPTED_OFFER", byType("TALEPO_ACCEPTED_OFFER"), input.strategy, minSample),
    confirmedStats: buildGroupStats("TALEPO_CONFIRMED_TRANSACTION", byType("TALEPO_CONFIRMED_TRANSACTION"), input.strategy, minSample),
    externalListingStats: buildGroupStats("EXTERNAL_LISTING", byType("EXTERNAL_LISTING"), input.strategy, minSample),
    externalSoldStats: buildGroupStats("EXTERNAL_SOLD", byType("EXTERNAL_SOLD"), input.strategy, minSample),
    weightedObservations,
    conditionAmbiguity,
  };
}

export { computePriceStatistics, MIN_AGGREGATE_SAMPLE } from "./statistics";
