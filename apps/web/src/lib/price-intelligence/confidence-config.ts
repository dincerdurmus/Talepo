import type { PriceSignalType } from "./types";
import type { PriceStrategyKey } from "./price-strategy-registry";

/** Talepo + external signal base reliability — single source of truth */
export const SIGNAL_RELIABILITY_WEIGHTS: Record<PriceSignalType, number> = {
  TALEPO_CONFIRMED_TRANSACTION: 1.0,
  TALEPO_ACCEPTED_OFFER: 0.75,
  TALEPO_OFFER: 0.55,
  TALEPO_REQUEST: 0.35,
  EXTERNAL_SOLD: 0.85,
  EXTERNAL_LISTING: 0.25,
};

/** Time decay buckets — age in days → multiplier */
export const TIME_DECAY_BUCKETS: ReadonlyArray<{ maxDays: number; factor: number }> = [
  { maxDays: 30, factor: 1.0 },
  { maxDays: 90, factor: 0.85 },
  { maxDays: 180, factor: 0.65 },
  { maxDays: 365, factor: 0.45 },
  { maxDays: Infinity, factor: 0.2 },
];

export const CONFIDENCE_V2_THRESHOLDS = {
  internal: { veryHigh: 0.85, high: 0.7, medium: 0.5, low: 0.3 },
  external: { veryHigh: 0.8, high: 0.65, medium: 0.45, low: 0.25 },
  overall: { veryHigh: 0.8, high: 0.65, medium: 0.5, low: 0.3 },
  /** Minimum overall score to emit marketRange */
  marketRangeMinScore: 0.45,
  /** Minimum effective weighted sample to emit marketRange */
  marketRangeMinEffectiveWeight: 1.5,
  /** Minimum external matched count for external confidence above NONE */
  externalMinMatchedCount: 1,
} as const;

/**
 * Overall confidence calibration — source-class based, not strategy-specific.
 * Asking/listing prices must not produce HIGH overall without transaction evidence.
 */
export const OVERALL_CONFIDENCE_POLICY = {
  /** Score ceiling when listing-only external + weak internal + zero confirmed */
  listingOnlyWeakInternalMaxScore: 0.64,
  /** Internal levels treated as weak for listing-only cap */
  weakInternalLevels: ["NONE", "VERY_LOW"] as const,
  /** Accepted offers that lift listing-only cap (transaction-adjacent signals) */
  acceptedLiftCapMin: 1,
} as const;

export const COMPLETENESS_WEIGHTS = {
  required: 0.55,
  important: 0.35,
  optional: 0.1,
} as const;

export const MARKET_RANGE_POLICY = {
  useP25AsLow: true,
  useMedianAsCenter: true,
  useP75AsHigh: true,
  /** Budget evaluation tolerance band around market range (fraction) */
  withinMarketTolerance: 0.08,
} as const;

/**
 * Strategy-specific signal importance multipliers (0 = ignore for weighted reference).
 * Category-agnostic — keyed by price strategy only.
 */
export const STRATEGY_SIGNAL_IMPORTANCE: Record<
  PriceStrategyKey,
  Partial<Record<PriceSignalType, number>>
> = {
  RETAIL_PRODUCT: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.9,
    TALEPO_OFFER: 0.75,
    TALEPO_REQUEST: 0.15,
    EXTERNAL_LISTING: 0.8,
    EXTERNAL_SOLD: 0.9,
  },
  USED_PRODUCT: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.9,
    TALEPO_OFFER: 0.7,
    TALEPO_REQUEST: 0.15,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
  VEHICLE: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.95,
    TALEPO_OFFER: 0.8,
    TALEPO_REQUEST: 0.1,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
  AUTO_PART: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.9,
    TALEPO_OFFER: 0.75,
    TALEPO_REQUEST: 0.15,
    EXTERNAL_LISTING: 0.5,
    EXTERNAL_SOLD: 0.7,
  },
  REAL_ESTATE_SALE: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.95,
    TALEPO_OFFER: 0.85,
    TALEPO_REQUEST: 0.1,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
  REAL_ESTATE_RENT: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.95,
    TALEPO_OFFER: 0.85,
    TALEPO_REQUEST: 0.1,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
  INDUSTRIAL_EQUIPMENT: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.95,
    TALEPO_OFFER: 0.85,
    TALEPO_REQUEST: 0.1,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
  INDUSTRIAL_PARTS_SERVICE: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.95,
    TALEPO_OFFER: 0.9,
    TALEPO_REQUEST: 0.1,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
  CUSTOM_MANUFACTURING: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.95,
    TALEPO_OFFER: 0.9,
    TALEPO_REQUEST: 0.1,
    EXTERNAL_LISTING: 0.05,
    EXTERNAL_SOLD: 0,
  },
  SERVICE_SCOPE: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.95,
    TALEPO_OFFER: 0.9,
    TALEPO_REQUEST: 0.1,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
  B2B_COMMODITY: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.9,
    TALEPO_OFFER: 0.8,
    TALEPO_REQUEST: 0.15,
    EXTERNAL_LISTING: 0.2,
    EXTERNAL_SOLD: 0.3,
  },
  MEDICAL_DEVICE: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.9,
    TALEPO_OFFER: 0.75,
    TALEPO_REQUEST: 0.15,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
  INTERNAL_ONLY: {
    TALEPO_CONFIRMED_TRANSACTION: 1.0,
    TALEPO_ACCEPTED_OFFER: 0.85,
    TALEPO_OFFER: 0.7,
    TALEPO_REQUEST: 0.2,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
  UNKNOWN: {
    TALEPO_CONFIRMED_TRANSACTION: 0.8,
    TALEPO_ACCEPTED_OFFER: 0.7,
    TALEPO_OFFER: 0.6,
    TALEPO_REQUEST: 0.15,
    EXTERNAL_LISTING: 0,
    EXTERNAL_SOLD: 0,
  },
};

export function getStrategySignalImportance(
  strategy: PriceStrategyKey,
  signalType: PriceSignalType,
): number {
  return STRATEGY_SIGNAL_IMPORTANCE[strategy]?.[signalType] ?? 0;
}

export function getSignalReliabilityWeight(signalType: PriceSignalType): number {
  return SIGNAL_RELIABILITY_WEIGHTS[signalType] ?? 0.2;
}
