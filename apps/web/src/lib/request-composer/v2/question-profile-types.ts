/**
 * Question profile types for composer v2.
 * Profiles decorate existing REQUEST_CATEGORIES / hybrid candidates —
 * they are not a parallel form schema.
 */

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

export type ScheduleResult = {
  visible: ScheduledQuestion[];
  remainingCriticalCount: number;
  remainingOptionalCount: number;
  canEnterReview: boolean;
  blockingFieldKeys: string[];
  blockingLabels: string[];
};
