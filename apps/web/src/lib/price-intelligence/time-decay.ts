import { TIME_DECAY_BUCKETS } from "./confidence-config";

/** Age in whole days from observation to reference date */
export function observationAgeDays(observedAt: Date, referenceDate: Date = new Date()): number {
  const ms = referenceDate.getTime() - observedAt.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/** Configurable time-decay multiplier for an observation age */
export function computeTimeDecayFactor(ageDays: number): number {
  for (const bucket of TIME_DECAY_BUCKETS) {
    if (ageDays <= bucket.maxDays) return bucket.factor;
  }
  return TIME_DECAY_BUCKETS[TIME_DECAY_BUCKETS.length - 1]!.factor;
}

/** Combined decay weight for a single observation */
export function computeObservationDecayWeight(
  observedAt: Date,
  referenceDate?: Date,
): number {
  return computeTimeDecayFactor(observationAgeDays(observedAt, referenceDate));
}
