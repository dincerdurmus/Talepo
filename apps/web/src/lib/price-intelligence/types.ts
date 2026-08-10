import type { ProductIdentifiers, SemanticFieldClass } from "@/lib/product-identity/types";

import type { NormalizedCondition } from "./condition-utils";
import type { CompletenessBreakdown } from "./strategy-completeness";
import type { PriceStrategyResolution } from "./strategy-resolver";

export type { PriceStrategyKey } from "./price-strategy-registry";
export type { PriceStrategyResolution } from "./strategy-resolver";
export type { CompletenessBreakdown } from "./strategy-completeness";
export type { NormalizedCondition } from "./condition-utils";

export type PriceSignalType =
  | "EXTERNAL_LISTING"
  | "TALEPO_REQUEST"
  | "TALEPO_OFFER"
  | "TALEPO_ACCEPTED_OFFER"
  | "TALEPO_CONFIRMED_TRANSACTION"
  | "EXTERNAL_SOLD";

export type DealOutcomeStatus =
  | "PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "PRICE_DISAGREEMENT"
  | "PRODUCT_UNAVAILABLE"
  | "NO_RESPONSE"
  | "OTHER";

export type TransactionConfirmationLevel =
  | "NONE"
  | "BUYER_CONFIRMED"
  | "SUPPLIER_CONFIRMED"
  | "BOTH_CONFIRMED"
  | "PAYMENT_VERIFIED";

export type PriceConfidenceLevel =
  | "VERY_LOW"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH";

export type ConfidenceLevelWithNone = PriceConfidenceLevel | "NONE";

export type ConfidenceDetail = {
  score: number;
  level: ConfidenceLevelWithNone;
  reasons: string[];
  sampleCount: number;
};

export type SignalGroupStatistics = PriceStatistics & {
  signalType: PriceSignalType;
  effectiveWeight: number;
  recencyDaysMedian: number | null;
  reliabilityWeight: number;
  strategyImportance: number;
};

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
  confidence: ConfidenceLevelWithNone;
};

export type NormalizedProduct = {
  categoryId: string;
  brand: string | null;
  model: string | null;
  variant: string | null;
  /** Extended identity — Global Product Identity V1 */
  series?: string | null;
  productType?: string | null;
  identifiers?: ProductIdentifiers;
  semanticFields?: Record<string, SemanticFieldClass>;
  brandConfidence?: number;
  condition: string | null;
  attributes: Record<string, string>;
  fingerprint: string | null;
  confidence: number;
  providerQuery?: string;
};

export type PriceStatistics = {
  sampleSize: number;
  rawSampleSize: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  min: number | null;
  max: number | null;
  insufficientData: boolean;
};

export type PriceIntelligenceResult = {
  sampleSize: number;
  insufficientData: boolean;
  confidence: PriceConfidenceLevel;
  windowDays: number;
  requestPriceStats: PriceStatistics;
  offerPriceStats: PriceStatistics;
  acceptedOfferStats: PriceStatistics;
  confirmedTransactionStats: PriceStatistics;
  externalListingStats: PriceStatistics;
  externalSoldStats: PriceStatistics;
  sources: PriceIntelligenceSources;
  external?: ExternalIntelligenceMeta;
  signalSummary?: {
    talepoLabel: string;
    externalLabel: string;
    totalSignals: number;
  };
  /** Resolved price strategy + confidence (Phase 2+) */
  strategy?: PriceStrategyResolution;
  /** Phase 4 — Confidence V2 */
  internalConfidence?: ConfidenceDetail;
  externalConfidence?: ConfidenceDetail;
  overallConfidence?: ConfidenceDetail;
  confidenceReasons?: string[];
  /** Phase 4 — request completeness for first-release UX */
  completeness?: CompletenessBreakdown;
  /** Phase 4 — weighted market reference */
  weightedReference?: WeightedMarketReference;
  /** Phase 4 — market range (only when sufficient confidence) */
  marketRange?: MarketRange | null;
  /** Phase 4 — budget vs market evaluation */
  budgetEvaluation?: BudgetEvaluation;
  /** Normalized request condition used for isolation */
  condition?: NormalizedCondition;
  conditionAmbiguity?: boolean;
};

export type ExternalPriceObservation = {
  provider: string;
  externalId: string;
  title: string;
  price: number;
  currency: string;
  condition: string | null;
  location: string | null;
  url: string | null;
  observedAt: Date;
  sourceType: "EXTERNAL_LISTING" | "EXTERNAL_SOLD";
  rawMetadata?: Record<string, unknown>;
};

export type PriceIntelligenceSources = {
  talepoRequests: number;
  talepoOffers: number;
  acceptedOffers: number;
  confirmedTransactions: number;
  externalListings: number;
  externalSold: number;
};

export type ExternalIntelligenceMeta = {
  attempted: boolean;
  providerId: string | null;
  providerStatus: "CONFIGURED" | "NOT_CONFIGURED" | "SKIPPED" | "ERROR" | "NOT_REQUESTED";
  suitabilityScore: number;
  query: string | null;
  fetchedCount: number;
  cached: boolean;
  errorMessage?: string;
  /** Phase 3 — strategy-aware routing diagnostics */
  externalProviderAttempted?: boolean;
  externalProviderUsed?: string | null;
  externalRoutingReason?: ExternalRoutingReason;
  providerCandidates?: string[];
};

export type ProviderCapability =
  | "LISTING_PRICE"
  | "SOLD_PRICE"
  | "HISTORICAL_PRICE";

export type ExternalDataPolicy = {
  canPersist: boolean;
  retentionPolicy: string | null;
  termsReference: string | null;
};

/** Phase 3 — external provider routing diagnostic reasons */
export type ExternalRoutingReason =
  | "NOT_REQUESTED"
  | "STRATEGY_INTERNAL_ONLY"
  | "STRATEGY_UNKNOWN"
  | "NO_EXTERNAL_PROVIDER_FOR_STRATEGY"
  | "IDENTITY_REQUIREMENTS_NOT_MET"
  | "PROVIDER_NOT_CONFIGURED"
  | "SUITABILITY_BELOW_THRESHOLD"
  | "EMPTY_PROVIDER_QUERY"
  | "EXTERNAL_CALL_ALLOWED"
  | "PROVIDER_ERROR";
