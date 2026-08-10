import type { ProductIdentifiers, SemanticFieldClass } from "@/lib/product-identity/types";

import type { PriceStrategyResolution } from "./strategy-resolver";

export type { PriceStrategyKey } from "./price-strategy-registry";
export type { PriceStrategyResolution } from "./strategy-resolver";

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
  /** Shadow mode — does not affect provider routing in Phase 2 */
  strategy?: PriceStrategyResolution;
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
