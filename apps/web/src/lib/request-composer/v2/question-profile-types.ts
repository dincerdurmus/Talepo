/**
 * Question profile types for composer v2.
 * Profiles decorate existing REQUEST_CATEGORIES / hybrid candidates —
 * they are not a parallel form schema.
 */

import type { ProductQuestionContract } from "@/lib/request-category-engine";

export type QuestionImportance =
  | "publish_required"
  | "routing_critical"
  | "quote_critical"
  | "optional";

export type BudgetBasis =
  | "total"
  | "per_unit"
  | "monthly"
  | "daily"
  | "service"
  | "negotiable";

export type LocationMode =
  | "delivery"
  | "pickup"
  | "onsite"
  | "remote"
  | "real_estate"
  | "nationwide";

export type SoftAnswerStatus =
  | "specified"
  | "open_to_offers"
  | "unknown"
  | "no_preference"
  | "flexible"
  | "skipped_optional";

export type QuestionProfileDef = {
  fieldKey: string;
  /** User-facing Turkish prompt */
  prompt: string;
  summaryLabel: string;
  importance: QuestionImportance;
  /** Empty = all categories that surface this key via engine/common */
  categories?: string[];
  whenNeedTypes?: string[];
  /** Product contracts stay silent until their routing need type is known. */
  requiresNeedType?: boolean;
  /**
   * Product-scoped questions: only ask when the detected product/appliance
   * type (diacritic-folded, substring match) hits one of these. A TV gets
   * screen size; an air purifier gets room size — never the other way around.
   */
  whenProductTypes?: string[];
  /** One-tap options offered when the hybrid candidate has none. */
  quickChoices?: { label: string; value: string }[];
  allowUnknown?: boolean;
  allowDontCare?: boolean;
  inputHint?: "text" | "select" | "budget" | "location" | "number";
  budgetBasis?: BudgetBasis;
  /** Rank within same importance (higher first) */
  rank?: number;
  /**
   * Sözleşme profili yalnız çözülen tek ürün sözleşmesinde görünür. Bu,
   * üst aile eşleşmelerinin dar ürün sorularını sızdırmasını engeller.
   */
  contractScope?: ProductQuestionContract;
};

export type ScheduledQuestion = {
  fieldKey: string;
  prompt: string;
  summaryLabel: string;
  importance: QuestionImportance;
  allowUnknown: boolean;
  allowDontCare: boolean;
  inputHint: NonNullable<QuestionProfileDef["inputHint"]>;
  budgetBasis?: BudgetBasis;
  /** From hybrid candidate when present */
  priorityScore: number;
  quickChoices?: { label: string; value: string }[];
  escapeChoices: { label: string; value: string }[];
  placeholder?: string;
  categoryId?: string;
  /**
   * ÇIKARIMIN TEK MEŞRU ROLÜ (KB-17): önerilen / ön-seçili cevap.
   *
   * Alan yalnız Talepo'nun tahmininden dolduğunda soru kapanmaz; tahmin
   * buraya taşınır ve kullanıcıya ön-seçili olarak gösterilir. Onaylamak tek
   * dokunuş, değiştirmek de tek dokunuştur — ama karar kullanıcınındır.
   */
  suggestedValue?: string;
  suggestedValueAuthority?: "INFERENCE_ONLY";
};

/**
 * SORU AŞAMASI — KURUCU KARARI (2026-09-12).
 *
 * Her kategoride önce yalnız iki şey sorulur: bütçe ve il/ilçe. İkisi de
 * kapanmadan başka hiçbir soru görünmez. İkisi kapanınca kategori soruları
 * "Talebi detaylandır" başlığı altında gelir. Kullanıcı bütçeyi ya da
 * konumu metinde yazdıysa o soru zaten kapalıdır ve bu aşama atlanır.
 *
 *   essentials  bütçe / konum açık; görünen küme yalnız onlardır
 *   detail      bütçe / konum kapalı; kategoriye özel sorular görünür
 */
export type QuestionPhase = "essentials" | "detail";

export type ScheduleResult = {
  visible: ScheduledQuestion[];
  remainingCriticalCount: number;
  remainingOptionalCount: number;
  canEnterReview: boolean;
  blockingFieldKeys: string[];
  blockingLabels: string[];
  /** Görünen kümenin hangi aşamadan geldiği (bkz. `QuestionPhase`). */
  phase: QuestionPhase;
  /**
   * Aşamanın kullanıcıya gösterilen başlığı. Tek yerden gelir ki `/talep`
   * formu ile Maira aynı sözü söylesin; arayüz kendi metnini uydurmaz.
   */
  phaseHeading: string;
};
