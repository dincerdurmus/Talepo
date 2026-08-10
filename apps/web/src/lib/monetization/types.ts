/** Typed saved-search / explore filter payload (Premium+). */
export type SavedSearchFilters = {
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

export type CompanyPerformanceMetrics = {
  offersSubmitted: number;
  offersAccepted: number;
  acceptanceRate: number | null;
  averageResponseTimeHours: number | null;
  matchedRequests: number;
  /** Watchlist items added during the selected period */
  watchlistAddsInPeriod: number;
  /** Total active watchlist items (current) */
  activeWatchedRequests: number;
};

export type InventoryImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};
