import type { CompletenessBreakdown } from "@/lib/price-intelligence/strategy-completeness";
import type { Authority } from "@/lib/request-understanding/provenance";
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

/**
 * TALEPO'NUN TAHMİNİ — CEVAP DEĞİL (D3b, 2026-08-26).
 *
 * Sorunun yanında gösterilecek öneri, sorunun CEVABINDAN ayrı bir alandır ve
 * kendi otoritesini taşır. Cevap alanına yazılan bir tahmin, arayüzde seçili
 * bir kullanıcı cevabı gibi görünür (`aria-checked="true"`) ve kullanıcı
 * hiçbir şeye dokunmadan onaylamış sayılır — tarayıcıda ölçülen hata buydu.
 *
 * Öneri adayın KENDİ sözleşmesinde durur, arayüz kabuğunun prop zincirinde
 * değil: bugünkü panel ile onun yerini alacak arayüz aynı adayı tüketir ve
 * kabuk değişince bu bilgi sessizce düşmez.
 *
 * `authority` her zaman kanonik merdivenin `INFERRED` basamağıdır; öneri
 * onaylanana kadar `confirmed` false kalır. Kullanıcı açıkça seçip
 * onayladığında sonuç bir öneri olmaktan çıkar ve normal cevap zincirinden
 * `USER_EXPLICIT` olarak yazılır — bu alan güncellenmez, ilgisiz hâle gelir.
 */
export type InferredQuestionSuggestion = {
  /** Gösterilecek tahmin metni. */
  value: string;
  /**
   * Kanonik merdivenin `INFERRED` basamağı — daraltılmış literal. Tip
   * düzeyinde başka bir basamak yazılamaz: bir öneri, tanımı gereği soruyu
   * kapatmaya yetkili bir cevap olamaz.
   */
  authority: Extract<Authority, "INFERRED">;
  /**
   * Daraltılmış literal: bu alan bir ÖNERİdir, kalıcı bir kullanıcı seçimi
   * değildir. Onay geldiğinde sonuç normal cevap zincirinden yazılır; burada
   * `true` yazılabilecek bir yol tip düzeyinde bırakılmaz.
   */
  confirmed: false;
};

export type QuestionCandidate = {
  fieldKey: string;
  label: string;
  reason: string;
  /**
   * Talepo'nun bu alan için tahmini. Varsa arayüz onu ÖNERİ olarak gösterir;
   * seçim durumu üretmez, soruyu kapatmaz.
   */
  inferredSuggestion?: InferredQuestionSuggestion;
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
  multiSelect?: boolean;
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
