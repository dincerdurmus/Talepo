import type { CompletenessBreakdown } from "@/lib/price-intelligence/strategy-completeness";
import type { PriceStrategyResolution } from "@/lib/price-intelligence/strategy-resolver";
import type {
  BudgetEvaluation,
  ConfidenceDetail,
  MarketRange,
  PriceIntelligenceResult,
  WeightedMarketReference,
} from "@/lib/price-intelligence/types";

/** Explicit analysis lifecycle for request creation UX */
export type RequestAnalysisStatus =
  | "IDLE"
  | "PARSING"
  | "READY_FOR_REVIEW"
  | "PRICE_ANALYZING"
  | "PRICE_READY"
  | "PRICE_INSUFFICIENT"
  | "PRICE_ERROR"
  | "PUBLISHING"
  | "PUBLISHED";

export type RequestDraft = {
  title: string;
  rawText: string;
  categorySlug: string;
  city: string;
  district: string | null;
  budget: string;
  fieldValues: Record<string, string>;
};

export type QuestionCandidate = {
  fieldKey: string;
  label: string;
  reason: string;
  publishImpact: number;
  matchingImpact: number;
  priceImpact: number;
  confidenceImpact: number;
  priorityScore: number;
  inputType: "text" | "number" | "select";
  options?: { label: string; value: string }[];
  placeholder?: string;
  quickChoices?: { label: string; value: string }[];
  pickerOnly?: boolean;
};

export type MarketIntelligenceSnapshot = {
  marketRange: MarketRange | null;
  weightedReference: WeightedMarketReference | null;
  overallConfidence: ConfidenceDetail | null;
  internalConfidence: ConfidenceDetail | null;
  externalConfidence: ConfidenceDetail | null;
  budgetEvaluation: BudgetEvaluation | null;
  confidenceReasons: string[];
  sourceCounts: {
    externalListings: number;
    talepoOffers: number;
    acceptedOffers: number;
    confirmedTransactions: number;
  };
  externalMeta?: PriceIntelligenceResult["external"];
  insufficientData: boolean;
};

export type ProfessionalDraftState = {
  text: string;
  applied: boolean;
  previewOpen: boolean;
};

export type RequestBrainState = {
  analysisStatus: RequestAnalysisStatus;
  requestDraft: RequestDraft;
  strategy: PriceStrategyResolution | null;
  completeness: CompletenessBreakdown | null;
  nextQuestions: QuestionCandidate[];
  marketIntelligence: MarketIntelligenceSnapshot | null;
  professionalDraft: ProfessionalDraftState;
  previewFingerprint: string | null;
  previewError: string | null;
  /** Fields auto-filled by Talepo parser (for subtle UI indicator) */
  aiFilledFields: Set<string>;
};

export type PricePreviewResponse = {
  ok: boolean;
  intelligence?: {
    strategy?: PriceStrategyResolution;
    completeness?: CompletenessBreakdown;
    marketRange?: MarketRange | null;
    weightedReference?: WeightedMarketReference | null;
    overallConfidence?: ConfidenceDetail;
    internalConfidence?: ConfidenceDetail;
    externalConfidence?: ConfidenceDetail;
    budgetEvaluation?: BudgetEvaluation;
    confidenceReasons?: string[];
    insufficientData?: boolean;
    external?: PriceIntelligenceResult["external"];
    sources?: PriceIntelligenceResult["sources"];
    offerPriceStats?: { rawSampleSize: number };
    acceptedOfferStats?: { rawSampleSize: number };
    confirmedTransactionStats?: { rawSampleSize: number };
    externalListingStats?: { rawSampleSize: number };
  };
  message?: string;
};
