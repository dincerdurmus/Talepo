/**
 * Question scheduler: show at most 1–3 highest-importance unanswered questions.
 * Total question count is NOT capped at 3 — groups advance as answers arrive.
 */

import type { QuestionCandidate } from "@/lib/request-brain/types";
import { getCategoryById } from "@/lib/request-category-engine";

import {
  importanceRank,
  isRemoteEligibleService,
  listProfilesForCategory,
  resolveProfileForField,
} from "./question-profiles";
import type {
  QuestionImportance,
  ScheduleResult,
  ScheduledQuestion,
  SoftAnswerStatus,
} from "./question-profile-types";
import {
  globalCoreQuestionProfiles,
  isBudgetSatisfiedForPublish,
  isLocationSatisfiedForPublish,
  parseLocationStatus,
} from "./global-core-profile";

const MAX_VISIBLE = 3;

export type FieldAnswerState = {
  kind?: "VALUE" | "ANY" | "NOT_APPLICABLE" | "UNKNOWN" | string;
  value?: string | null;
  softStatus?: SoftAnswerStatus | null;
};

function parseSoftStatus(raw: string | null | undefined): SoftAnswerStatus | null {
  if (!raw?.trim()) return null;
  const fold = raw.trim().toLocaleLowerCase("tr-TR");
  if (
    fold === "teklifleri görmek istiyorum" ||
    fold === "teklif bekliyorum" ||
    fold === "open_to_offers" ||
    fold === "teklif"
  ) {
    return "open_to_offers";
  }
  if (
    fold === "bilmiyorum" ||
    fold === "henüz bilmiyorum" ||
    fold === "unknown"
  ) {
    return "unknown";
  }
  if (
    fold === "fark etmez" ||
    fold === "farketmez" ||
    fold === "fark-etmez" ||
    fold === "no_preference" ||
    fold === "konum fark etmez"
  ) {
    return "no_preference";
  }
  if (fold === "esnek" || fold === "flexible") return "flexible";
  return null;
}

export function isFieldSatisfied(input: {
  fieldKey: string;
  state?: FieldAnswerState | null;
  importance: QuestionImportance;
  allowUnknown: boolean;
  allowDontCare: boolean;
  /** Explicit optional skip — does NOT satisfy publish_required */
  optionallySkipped?: boolean;
}): boolean {
  const soft = input.state?.softStatus ?? parseSoftStatus(input.state?.value);
  const kind = input.state?.kind;
  const value = input.state?.value?.trim() ?? "";

  if (input.fieldKey === "budget") {
    return isBudgetSatisfiedForPublish(value);
  }
  if (input.fieldKey === "city") {
    const loc = parseLocationStatus(value);
    if (
      loc === "nationwide" ||
      loc === "remote" ||
      loc === "no_location_preference"
    ) {
      return true;
    }
    if (value.includes("/")) {
      const [il, ilce] = value.split("/").map((p) => p.trim());
      return Boolean(il && ilce);
    }
    // Çoklu-il seçici yalın il ("Ankara") veya il listesi ("İstanbul, Ankara")
    // üretebilir — ilçe "Tümü" bilinçli bir cevaptır, tatmin sayılır.
    if (value.length > 0 && !soft) return true;
    if (soft === "unknown" && input.allowUnknown) return true;
    return false;
  }

  if (kind === "VALUE" && value.length > 0 && !soft) return true;
  if (kind === "ANY" || kind === "NOT_APPLICABLE") {
    return input.allowDontCare || input.importance === "optional";
  }
  if (soft === "open_to_offers" && input.fieldKey === "budget") return true;
  if (soft === "unknown" && input.allowUnknown) return true;
  if (soft === "no_preference" && input.allowDontCare) return true;
  if (soft === "flexible" && input.allowDontCare) return true;
  if (input.optionallySkipped && input.importance === "optional") return true;
  if (value.length > 0 && !soft) return true;
  return false;
}

function escapesFor(input: {
  fieldKey: string;
  allowUnknown: boolean;
  allowDontCare: boolean;
  importance: QuestionImportance;
  categoryId?: string;
  remoteEligible?: boolean;
}): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const isRealEstate = input.categoryId === "real-estate";
  const isServiceLike =
    (input.categoryId === "services" || input.categoryId === "health") &&
    input.remoteEligible !== false;

  if (input.fieldKey === "budget") {
    // Tek kaçış: teklifleri görmek — bilmiyorum/farketmez bütçede yok (kurucu).
    out.push({
      label: "Teklifleri görmek istiyorum",
      value: "open_to_offers",
    });
    return out;
  }
  if (input.fieldKey === "city") {
    if (isRealEstate) {
      // RE must collect verified il+ilçe — do not soft-bypass with nationwide/remote
      if (input.allowUnknown) {
        out.push({ label: "Henüz bilmiyorum", value: "unknown" });
      }
      return out;
    }
    // Kurucu kararı (2026-08-23): "Türkiye geneli" ve "Konum fark etmez"
    // çipleri kalktı — il listesindeki "Tümü" seçeneği aynı işi görür.
    if (isServiceLike) {
      out.push({ label: "Uzaktan", value: "remote" });
    }
    if (input.allowUnknown) {
      out.push({ label: "Henüz bilmiyorum", value: "unknown" });
    }
    return out;
  }
  if (input.fieldKey === "dimensions") {
    out.push(
      { label: "Ölçüyü bilmiyorum", value: "unknown" },
      { label: "Standart ölçü önerilsin", value: "unknown" },
    );
  }
  if (input.allowUnknown && input.fieldKey !== "dimensions") {
    out.push({ label: "Henüz bilmiyorum", value: "unknown" });
  }
  if (input.allowDontCare) {
    out.push({ label: "Fark etmez", value: "no_preference" });
  }
  if (input.importance === "optional") {
    out.push({ label: "Şimdilik geç", value: "skip_optional" });
  }
  return out;
}

function defaultPrompt(fieldKey: string, fallback?: string): string {
  return fallback ?? `${fieldKey} bilgisini ekleyelim.`;
}

/**
 * Build the next 1–3 questions from hybrid candidates + Talepo Standard profiles.
 */
export function scheduleNextQuestions(input: {
  categoryId: string;
  needType?: string | null;
  /**
   * Detected product/appliance type — activates product-scoped questions
   * (TV → screen size, klima → BTU) and keeps them silent otherwise.
   */
  productType?: string | null;
  hybridCandidates: QuestionCandidate[];
  /** Common + dynamic draft values */
  values: Record<string, string | undefined>;
  /** Hybrid field kinds when available */
  fieldStates?: Record<string, FieldAnswerState | undefined>;
  /** Keys the user optionally skipped (optional only) */
  optionalSkippedKeys?: Set<string> | string[];
  /** Keys already answered this session */
  answeredKeys?: Set<string> | string[];
  /** Real-estate: treat city as unsatisfied unless il+ilçe present */
  realEstateLocationComplete?: boolean;
  isRemoteService?: boolean;
}): ScheduleResult {
  const answered = new Set(
    Array.isArray(input.answeredKeys)
      ? input.answeredKeys
      : [...(input.answeredKeys ?? [])],
  );
  const optionalSkipped = new Set(
    Array.isArray(input.optionalSkippedKeys)
      ? input.optionalSkippedKeys
      : [...(input.optionalSkippedKeys ?? [])],
  );

  const category = getCategoryById(input.categoryId);
  const commonKeys = new Set(
    (category?.commonFields ?? []).map((f) => f.key),
  );

  // Product context: explicit input wins; otherwise derive from the values /
  // field states every caller already passes — so TV gets its screen-size
  // question no matter which wrapper invoked the scheduler.
  const productTypeContext =
    input.productType ??
    input.values.productType ??
    input.values.applianceType ??
    input.values.kitchenProductType ??
    input.values.propertyType ??
    input.values.serviceType ??
    input.fieldStates?.productType?.value ??
    input.fieldStates?.applianceType?.value ??
    input.fieldStates?.kitchenProductType?.value ??
    input.fieldStates?.propertyType?.value ??
    input.fieldStates?.serviceType?.value ??
    null;

  const categoryProfiles = listProfilesForCategory({
    categoryId: input.categoryId,
    needType: input.needType,
    productType: productTypeContext,
  });
  // Global core cannot be overwritten/suppressed by category profiles.
  const listingFromValues =
    input.values.listingType?.trim() ||
    input.fieldStates?.listingType?.value?.trim() ||
    null;
  const globalCore = globalCoreQuestionProfiles(input.categoryId, {
    listingType: listingFromValues,
  });
  const profileByKey = new Map<string, (typeof globalCore)[number]>();
  for (const p of categoryProfiles) profileByKey.set(p.fieldKey, p);
  for (const p of globalCore) {
    // Core wins on budget/city/delivery — category may only refine prompt via globalCore itself
    profileByKey.set(p.fieldKey, p);
  }

  const keySet = new Set<string>();
  // Always seed global core first
  for (const p of globalCore) {
    if (p.fieldKey === "city" && input.isRemoteService) {
      // Remote already chosen via locationMode — city still satisfied separately
      continue;
    }
    keySet.add(p.fieldKey);
  }
  for (const p of categoryProfiles) {
    if (p.fieldKey === "city" && input.isRemoteService) continue;
    keySet.add(p.fieldKey);
  }
  for (const c of input.hybridCandidates) keySet.add(c.fieldKey);
  for (const k of commonKeys) {
    if (k === "title") continue;
    keySet.add(k);
  }

  const hybridByKey = new Map(
    input.hybridCandidates.map((c) => [c.fieldKey, c]),
  );

  // Location already answered via mode or soft status
  const locationSatisfiedEarly = isLocationSatisfiedForPublish({
    cityValue: input.values.city,
    locationMode: input.values.locationMode,
    realEstateComplete: input.realEstateLocationComplete,
    categoryId: input.categoryId,
  });

  type Pending = ScheduledQuestion & { sortScore: number };
  const pending: Pending[] = [];

  for (const fieldKey of keySet) {
    if (fieldKey === "title") continue;
    if (
      fieldKey === "city" &&
      input.categoryId === "real-estate" &&
      input.realEstateLocationComplete
    ) {
      continue;
    }
    if (fieldKey === "city" && (input.isRemoteService || locationSatisfiedEarly)) {
      continue;
    }
    if (
      fieldKey === "locationMode" &&
      (input.isRemoteService ||
        parseLocationStatus(input.values.locationMode) === "remote")
    ) {
      continue;
    }

    const profile =
      profileByKey.get(fieldKey) ??
      resolveProfileForField({
        fieldKey,
        categoryId: input.categoryId,
        needType: input.needType,
        productType: productTypeContext,
      }) ??
      ({
        fieldKey,
        prompt: hybridByKey.get(fieldKey)?.label ?? defaultPrompt(fieldKey),
        summaryLabel: hybridByKey.get(fieldKey)?.label ?? fieldKey,
        importance: "optional" as const,
        rank: 10,
        allowUnknown: true,
        allowDontCare: true,
      });

    const state: FieldAnswerState = {
      ...(input.fieldStates?.[fieldKey] ?? {}),
      value:
        input.fieldStates?.[fieldKey]?.value ??
        input.values[fieldKey] ??
        null,
    };

    const satisfied = isFieldSatisfied({
      fieldKey,
      state,
      importance: profile.importance,
      allowUnknown: Boolean(profile.allowUnknown),
      allowDontCare: Boolean(profile.allowDontCare),
      optionallySkipped: optionalSkipped.has(fieldKey),
    });
    if (satisfied || answered.has(fieldKey)) continue;

    if (fieldKey === "quantity" && (input.values.quantity ?? "").trim()) {
      continue;
    }

    const hybrid = hybridByKey.get(fieldKey);
    const importance = profile.importance;
    const sortScore =
      importanceRank(importance) +
      (profile.rank ?? 0) +
      (hybrid?.priorityScore ?? 0) * 10;

    let quickChoices = (hybrid?.quickChoices ?? []).filter(
      (c) =>
        !/^fark\s*etmez$/i.test(c.label) &&
        c.value !== "fark-etmez" &&
        c.value !== "no_preference",
    );
    // Product-scoped profiles ship their own one-tap options.
    if (quickChoices.length === 0 && profile.quickChoices?.length) {
      quickChoices = profile.quickChoices;
    }
    if (fieldKey === "locationMode" && quickChoices.length === 0) {
      quickChoices = [
        { label: "Uzaktan uygun", value: "remote" },
        { label: "Yerinde olsun", value: "onsite" },
      ];
    }
    if (fieldKey === "city" && quickChoices.length === 0) {
      quickChoices = [
        { label: "İl ve ilçe belirt", value: "__location_city__" },
      ];
    }
    if (fieldKey === "budget") {
      quickChoices = [
        { label: "Bütçe aralığı belirt", value: "__budget_range__" },
      ];
    }

    pending.push({
      fieldKey,
      prompt: profile.prompt,
      summaryLabel: profile.summaryLabel,
      importance,
      allowUnknown: Boolean(profile.allowUnknown),
      allowDontCare: Boolean(profile.allowDontCare),
      inputHint: profile.inputHint ?? "text",
      budgetBasis: profile.budgetBasis,
      priorityScore: hybrid?.priorityScore ?? 0.5,
      quickChoices:
        fieldKey === "budget" || fieldKey === "city"
          ? undefined
          : quickChoices,
      escapeChoices: escapesFor({
        fieldKey,
        allowUnknown: Boolean(profile.allowUnknown),
        allowDontCare: Boolean(profile.allowDontCare),
        importance,
        categoryId: input.categoryId,
        remoteEligible: isRemoteEligibleService(productTypeContext),
      }),
      placeholder:
        fieldKey === "budget"
          ? profile.budgetBasis === "monthly"
            ? "Örn. 25.000 TL / ay"
            : "Örn. 50.000 TL veya 40–60 bin"
          : fieldKey === "city"
            ? "Örn. İstanbul / Kadıköy"
            : hybrid?.placeholder,
      categoryId: input.categoryId,
      sortScore,
    });
  }

  pending.sort((a, b) => b.sortScore - a.sortScore);

  // Kuzey yıldızı (kurucu): yalnız bütçe + il/ilçe zorunludur — başka hiçbir
  // soru yayını kilitleyemez. quote/routing sorular öne çıkar ama atlanabilir.
  const blockingCritical = pending.filter(
    (p) => p.importance === "publish_required",
  );

  const visible = pending.slice(0, MAX_VISIBLE).map((item) => {
    const { sortScore: _score, ...q } = item;
    void _score;
    return q;
  });

  const blocking = blockingCritical.map((c) => c.fieldKey);
  const canEnterReview = blockingCritical.length === 0;

  return {
    visible,
    remainingCriticalCount: blockingCritical.length,
    remainingOptionalCount: pending.length - blockingCritical.length,
    canEnterReview,
    blockingFieldKeys: blocking,
    blockingLabels: blockingCritical.map((c) => c.summaryLabel),
  };
}

export function softStatusFromAnswerValue(
  value: string,
): SoftAnswerStatus | "skip_optional" | null {
  const fold = value.trim().toLocaleLowerCase("tr-TR");
  if (fold === "skip_optional" || fold === "skip") return "skip_optional";
  return parseSoftStatus(value);
}
