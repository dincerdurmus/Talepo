import type { CanonicalDiscoveryFilter } from "@/lib/discovery";
import type { WinRatePresentation } from "./performance-metrics";

/** Typed saved-search / explore filter payload (Premium+). */
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

export type InventoryImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};
