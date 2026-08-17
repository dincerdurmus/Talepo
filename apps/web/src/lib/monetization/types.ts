import type { CanonicalDiscoveryFilter } from "@/lib/discovery";
import type { WinRatePresentation } from "./performance-metrics";

/** Typed saved-search / explore filter payload (Professional+). */
export type SavedSearchFilters = {
  /** Phase 3A — optional versioned envelope (1 = legacy flat + optional canonical). */
  version?: 1;
  categorySlug?: string;
  categoryId?: string;
  city?: string;
  district?: string;
  budgetMin?: number;
  budgetMax?: number;
  urgent?: boolean;
  keyword?: string;
  createdAfter?: string;
  attributes?: Record<string, string | number | boolean>;
  /** Phase 3A — typed taxonomy/constraint filter (URL is derived, not SoT). */
  canonical?: CanonicalDiscoveryFilter;
};

export type MatchResult = {
  companyId: string;
  requestId: string;
  score: number;
  reasons: string[];
};

export type OpportunityClassification = "NORMAL" | "GOOD" | "HOT";

export type OpportunityScoreResult = {
  score: number;
  classification: OpportunityClassification;
  reasons: string[];
};

export type BudgetOpportunityStatus =
  | "UNKNOWN"
  | "BELOW_MARKET"
  | "MARKET"
  | "ABOVE_MARKET";

export type BudgetOpportunityResult = {
  status: BudgetOpportunityStatus;
  confidence: number;
  referenceSource: string | null;
};

export type CompetitionLevel = "LOW" | "MEDIUM" | "HIGH";

export type CompetitionSignalResult = {
  offerCount: number;
  viewCount: number | null;
  estimatedCompetition: CompetitionLevel;
};

export type MarketInsightResult = {
  requestCount: number;
  averageBudget: number | null;
  medianBudget: number | null;
  offerCount: number;
  averageOffersPerRequest: number | null;
  trend: "UP" | "DOWN" | "FLAT" | "UNKNOWN";
  insufficientData: boolean;
};

export type OfferPerformanceMetrics = {
  submitted: number;
  accepted: number;
  pending: number;
  rejected: number;
  unsuccessful: number;
  winRate: number | null;
  winRatePresentation: WinRatePresentation;
  /** Bilateral completed deals with completedAt in the selected window. */
  completedTransactions: number;
  /** Request.publishedAt → Offer.submittedAt average; null when no reliable pairs. */
  averageOfferLatencyHours: number | null;
};

export type RequestPerformanceMetrics = {
  published: number;
  active: number;
  withOffers: number;
  withoutOffers: number;
  totalOffersReceived: number;
  averageOffersPerRequest: number | null;
  acceptedOutcome: number;
};

export type WorkspacePerformanceMetrics = {
  scope: "personal" | "company";
  companyName: string | null;
  requests: RequestPerformanceMetrics | null;
  offers: OfferPerformanceMetrics;
};

export type CurrencyVolumeMetrics = {
  currency: string;
  dealCount: number;
  totalAgreedAmount: number;
  averageAgreedAmount: number | null;
};

export type CategoryPerformanceRow = {
  categoryId: string;
  categoryName: string;
  submitted: number;
  accepted: number;
  completed: number;
  winRate: number | null;
  winRatePresentation: WinRatePresentation;
  rankEligible: boolean;
};

export type CommercialInsightDto = {
  id: string;
  text: string;
};

export type TrustAnalyticsSummary = {
  completedTransactions: number;
  reviewCount: number;
  averageRating: number | null;
};

/**
 * Professional commercial intelligence — deterministic.
 * Source rows require persisted OfferAttribution (no inferred Radar/Follow claims).
 */
export type CommercialPerformanceMetrics = {
  /** Bilateral completed deals with completedAt in window. */
  completedDeals: number;
  /** Offers submitted in window that later have a bilateral completed DealOutcome. */
  completedFromSubmittedCohort: number;
  completionRate: number | null;
  completionRatePresentation: WinRatePresentation;
  volumesByCurrency: CurrencyVolumeMetrics[];
  /** Present only when a single currency exists in the window. */
  primaryVolume: CurrencyVolumeMetrics | null;
  mixedCurrency: boolean;
  directCompleted: number;
  negotiatedCompleted: number;
  /**
   * Mean (agreedPrice - Offer.amount) / Offer.amount on negotiated completed deals.
   * Negative means final agreed price below the original submitted offer amount.
   */
  negotiationPriceDelta: number | null;
  negotiationPriceDeltaSample: number;
  categories: CategoryPerformanceRow[];
  insights: CommercialInsightDto[];
  /** Lifetime trust snapshot (revealed reviews only). */
  trust: TrustAnalyticsSummary;
  /**
   * Source performance from persisted OfferAttribution only.
   * UNKNOWN is omitted from the product UI list.
   */
  sourcePerformance: SourcePerformanceRow[];
};

export type SourcePerformanceRow = {
  source: "RADAR" | "FOLLOW" | "OPPORTUNITY" | "DISCOVERY";
  label: string;
  submitted: number;
  accepted: number;
  completed: number;
  winRate: number | null;
  winRatePresentation: WinRatePresentation;
  volumesByCurrency: CurrencyVolumeMetrics[];
  primaryVolume: CurrencyVolumeMetrics | null;
  mixedCurrency: boolean;
};

export type InventoryImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};
