/**
 * Focused question bridge: scheduler (1–3 visible) over hybrid candidates + profiles.
 * Total questions are NOT capped at 3 — only the visible group is.
 */

import {
  toHumanQuestions,
  type HumanizedQuestion,
} from "@/lib/request-brain/human-question-layer";
import type { QuestionCandidate } from "@/lib/request-brain/types";
import type { DynamicField } from "@/lib/request-category-engine";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";

import { DONT_CARE_FIELD_KEYS } from "./display-format";
import type { ScheduleResult, ScheduledQuestion } from "./question-profile-types";
import {
  scheduleNextQuestions,
  type FieldAnswerState,
} from "./question-scheduler";
import { resolveQuestionControl } from "./question-control-registry";
import { resolveProfileForField } from "./question-profiles";
import type { QuestionControlDef } from "./question-control-types";

export type FocusedQuestion = HumanizedQuestion & {
  helper?: string;
  importance?: ScheduledQuestion["importance"];
  summaryLabel?: string;
  control?: QuestionControlDef;
  categoryId?: string;
  allowUnknown?: boolean;
  allowDontCare?: boolean;
  budgetBasis?: ScheduledQuestion["budgetBasis"];
  /** Çıkarımdan gelen öneri — cevap DEĞİL, öneri (KB-17). Ham kayıt değeri. */
  suggestedValue?: string;
  /**
   * Önerinin KULLANICIYA GÖSTERİLECEK kanonik Türkçe etiketi.
   *
   * Kayıt değeri ("vehicle") ile insan etiketi ("Araç") ayrı rollerdir;
   * kullanıcıya slug gösterilmez. Etiket burada, tek yerde çözülür — arayüz
   * kendi eşleştirmesini yapmaz.
   */
  suggestedLabel?: string;
  suggestedValueAuthority?: ScheduledQuestion["suggestedValueAuthority"];
};

/**
 * Bir cevap değerinin kullanıcıya gösterilecek kanonik etiketini çözer.
 *
 * NEDEN AYRI VE SAF. Kayıt değeri ("vehicle") ile insan etiketi ("Araç") ayrı
 * rollerdir ve kullanıcıya YALNIZ etiket gösterilir. Çözümleme tek yerde
 * durur; arayüz kendi eşleştirmesini kurmaz. Seçenek kaydında karşılık yoksa
 * değer AYNEN döner — serbest metin alanlarında uydurma etiket üretilmez.
 */
export function resolveChoiceLabel(
  question:
    | {
        quickChoices?: { label: string; value: string }[];
        options?: { label: string; value: string }[];
        escapeChoices?: { label: string; value: string }[];
      }
    | null
    | undefined,
  value: string,
): string {
  const raw = (value ?? "").trim();
  if (!raw || !question) return raw;
  const pools = [
    question.quickChoices ?? [],
    question.options ?? [],
    question.escapeChoices ?? [],
  ];
  for (const pool of pools) {
    const hit = pool.find((o) => o.value === raw);
    if (hit?.label) return hit.label;
  }
  return raw;
}

export function scheduledToFocusedQuestion(
  q: ScheduledQuestion,
  hybrid?: QuestionCandidate,
  extras?: {
    productType?: string | null;
    needType?: string | null;
    brand?: string | null;
    isRemoteService?: boolean;
    listingType?: string | null;
  },
): FocusedQuestion {
  const categoryId = q.categoryId ?? "technology";
  const control = resolveQuestionControl({
    categoryId,
    fieldKey: q.fieldKey,
    needType: extras?.needType,
    productType: extras?.productType,
    brand: extras?.brand,
    importance: q.importance,
    allowUnknown: q.allowUnknown,
    allowDontCare: q.allowDontCare,
    isRemoteService: extras?.isRemoteService,
    isRealEstate: categoryId === "real-estate",
    listingType: extras?.listingType,
    /**
     * KAYIP NOKTASI BURASIYDI (ölçüldü 2026-08-29): profilin kanonik hızlı
     * seçenekleri zamanlanmış soruda duruyor ama kontrol çözücüye hiç
     * verilmiyordu; panel `control.options` okuduğu için 34 soru seçeneksiz
     * çiziliyordu. Tek kanal: seçenekler profilden gelir, kontrol tipini
     * kayıt seçer.
     */
    profileChoices: q.quickChoices,
  });

  const escapeChoices = q.escapeChoices.map((e) =>
    e.value === "skip_optional" ? { ...e, value: "skip" } : e,
  );

  // Prefer registry options as quickChoices for option-first UI
  const registryChoices = [
    ...control.options,
    ...control.softOptions,
  ].map((o) => ({ label: o.label, value: o.value }));

  return {
    fieldKey: q.fieldKey,
    label: q.summaryLabel,
    reason: q.importance,
    publishImpact: q.importance === "publish_required" ? 1 : 0.5,
    matchingImpact: q.importance === "routing_critical" ? 1 : 0.4,
    priceImpact: q.importance === "quote_critical" ? 1 : 0.3,
    confidenceImpact: 0.3,
    priorityScore: q.priorityScore,
    inputType:
      control.controlType === "text_fallback"
        ? "text"
        : control.controlType === "number_presets" ||
            control.controlType === "number_with_unit"
          ? "number"
          : "select",
    placeholder: control.placeholder ?? q.placeholder ?? hybrid?.placeholder,
    quickChoices:
      registryChoices.length > 0
        ? registryChoices
        : q.quickChoices && q.quickChoices.length > 0
          ? q.quickChoices
          : hybrid?.quickChoices,
    options: hybrid?.options,
    humanPrompt: q.prompt,
    fieldClass:
      q.importance === "publish_required"
        ? "REQUIRED_TO_PUBLISH"
        : q.importance === "optional"
          ? "OPTIONAL"
          : "HIGH_VALUE",
    escapeChoices,
    importance: q.importance,
    summaryLabel: q.summaryLabel,
    control,
    categoryId,
    allowUnknown: q.allowUnknown,
    allowDontCare: q.allowDontCare,
    budgetBasis: q.budgetBasis ?? control.budgetBasis,
    suggestedValue: q.suggestedValue,
    suggestedLabel: q.suggestedValue
      ? resolveChoiceLabel(
          { quickChoices: registryChoices, options: hybrid?.options },
          q.suggestedValue,
        )
      : undefined,
    suggestedValueAuthority: q.suggestedValueAuthority,
  };
}

export function selectFocusedQuestions(input: {
  candidates: QuestionCandidate[];
  strategy: PriceStrategyKey | null | undefined;
  requiredDynamicKeys: string[];
  dynamicFields: DynamicField[];
  answeredKeys?: Set<string> | string[];
  skippedKeys?: Set<string> | string[];
  maxVisible?: number;
  /** Preferred: full scheduler with Talepo Standard profiles */
  categoryId?: string;
  needType?: string | null;
  values?: Record<string, string | undefined>;
  fieldStates?: Record<string, FieldAnswerState | undefined>;
  realEstateLocationComplete?: boolean;
  isRemoteService?: boolean;
}): FocusedQuestion[] {
  if (input.categoryId) {
    const schedule = scheduleNextQuestions({
      categoryId: input.categoryId,
      needType: input.needType,
      hybridCandidates: input.candidates,
      values: input.values ?? {},
      fieldStates: input.fieldStates,
      optionalSkippedKeys: input.skippedKeys,
      answeredKeys: input.answeredKeys,
      realEstateLocationComplete: input.realEstateLocationComplete,
      isRemoteService: input.isRemoteService,
    });
    const hybridByKey = new Map(
      input.candidates.map((c) => [c.fieldKey, c]),
    );
    const maxVisible = Math.min(3, Math.max(1, input.maxVisible ?? 3));
    return schedule.visible
      .slice(0, maxVisible)
      .map((q) => scheduledToFocusedQuestion(q, hybridByKey.get(q.fieldKey)));
  }

  const answered = new Set(
    Array.isArray(input.answeredKeys)
      ? input.answeredKeys
      : [...(input.answeredKeys ?? [])],
  );
  const skipped = new Set(
    Array.isArray(input.skippedKeys)
      ? input.skippedKeys
      : [...(input.skippedKeys ?? [])],
  );
  const maxVisible = Math.min(3, Math.max(1, input.maxVisible ?? 3));

  const FIELD_PRIORITY: Record<string, number> = {
    needType: 100,
    listingType: 98,
    propertyType: 96,
    city: 84,
    quantity: 76,
    budget: 64,
    delivery: 60,
    condition: 66,
  };

  const filtered = input.candidates
    .filter((q) => !answered.has(q.fieldKey) && !skipped.has(q.fieldKey))
    .slice()
    .sort((a, b) => {
      const pa = FIELD_PRIORITY[a.fieldKey] ?? a.priorityScore * 40;
      const pb = FIELD_PRIORITY[b.fieldKey] ?? b.priorityScore * 40;
      return pb - pa;
    });

  const humanized = toHumanQuestions(filtered, {
    strategy: input.strategy,
    requiredDynamicKeys: input.requiredDynamicKeys,
    dynamicFields: input.dynamicFields,
    maxVisible,
  });

  return humanized.map((q) => {
    const escapeChoices = escapesForField(q.fieldKey);
    const quickChoices = (q.quickChoices ?? []).filter(
      (c) => !/^fark\s*etmez$/i.test(c.label) && c.value !== "fark-etmez",
    );
    return {
      ...q,
      humanPrompt: q.humanPrompt,
      quickChoices,
      escapeChoices,
      helper: undefined,
    };
  });
}

function escapesForField(
  fieldKey: string,
): Array<{ label: string; value: string }> {
  if (fieldKey === "dimensions") {
    return [
      { label: "Ölçüyü bilmiyorum", value: "bilmiyorum" },
      { label: "Standart ölçü önerilsin", value: "standart-olcu" },
      { label: "Numuneye göre çalışılsın", value: "numune" },
    ];
  }
  if (fieldKey === "quantity") {
    return [
      { label: "Bilmiyorum", value: "bilmiyorum" },
      { label: "Şimdilik geç", value: "skip" },
    ];
  }
  if (fieldKey === "delivery" || fieldKey === "deliveryDays") {
    return [
      { label: "Esnek", value: "fark-etmez" },
      { label: "Şimdilik geç", value: "skip" },
    ];
  }
  if (DONT_CARE_FIELD_KEYS.has(fieldKey)) {
    return [
      { label: "Fark etmez", value: "fark-etmez" },
      { label: "Öneriye açığım", value: "öneriye-açığım" },
      { label: "Şimdilik geç", value: "skip" },
    ];
  }
  return [
    { label: "Bilmiyorum", value: "bilmiyorum" },
    { label: "Şimdilik geç", value: "skip" },
  ];
}

export function isSoftEscapeValue(value: string): boolean {
  const fold = value.trim().toLocaleLowerCase("tr-TR");
  return (
    fold === "bilmiyorum" ||
    fold === "henüz bilmiyorum" ||
    fold === "unknown" ||
    fold === "fark etmez" ||
    fold === "fark-etmez" ||
    fold === "farketmez" ||
    fold === "no_preference" ||
    fold === "open_to_offers" ||
    fold === "teklifleri görmek istiyorum" ||
    fold === "teklif bekliyorum" ||
    fold === "öneriye açığım" ||
    fold === "öneriye-açığım" ||
    fold === "standart-olcu" ||
    fold === "standart ölçü önerilsin" ||
    fold === "numune" ||
    fold === "numuneye göre çalışılsın" ||
    fold === "skip" ||
    fold === "skip_optional" ||
    fold === "esnek" ||
    fold === "flexible" ||
    fold === "nationwide" ||
    fold === "türkiye geneli" ||
    fold === "turkiye geneli" ||
    fold === "remote" ||
    fold === "uzaktan" ||
    fold === "no_location_preference" ||
    fold === "konum fark etmez"
  );
}

export function scheduleComposerQuestions(input: {
  categoryId: string;
  needType?: string | null;
  candidates: QuestionCandidate[];
  values: Record<string, string | undefined>;
  fieldStates?: Record<string, FieldAnswerState | undefined>;
  answeredKeys?: Set<string> | string[];
  optionalSkippedKeys?: Set<string> | string[];
  realEstateLocationComplete?: boolean;
  isRemoteService?: boolean;
}): ScheduleResult {
  return scheduleNextQuestions({
    categoryId: input.categoryId,
    needType: input.needType,
    hybridCandidates: input.candidates,
    values: input.values,
    fieldStates: input.fieldStates,
    answeredKeys: input.answeredKeys,
    optionalSkippedKeys: input.optionalSkippedKeys,
    realEstateLocationComplete: input.realEstateLocationComplete,
    isRemoteService: input.isRemoteService,
  });
}

export type { ScheduleResult };

/* ═══════════════════════════════════════════════════════════════════════
   CEVAP DÜZELTME KAPISI — TEK SAF KÖPRÜ (2026-08-30)

   NEDEN VAR. Cevaplanmış bir alan zamanlayıcıdan yeniden yayınlanmaz:
   kanonik değer soruyu kapatır ve bu bastırma DOĞRUDUR, gevşetilmez.
   Ama "bir daha sorma" ile "düzeltemezsin" aynı şey değildir. Kullanıcı
   verdiği cevabı değiştirmek istediğinde o alanın kanonik sorusu yeniden
   çözülmek zorundadır.

   NEDEN AYNI ÜRETİM YOLU. Düzeltme yüzeyi daha önce `page.tsx` içinde
   satır içi çözülüyordu ve profili `listAllProfiles().find(...)` ile,
   yani kategori/ürün özgüllüğünü YOK SAYARAK buluyordu. Ölçüldü
   (2026-08-30): `printing/quantity` alanında bu kopya normal sorudan
   farklı bir kaçış seçeneği ("Henüz bilmiyorum") üretiyordu — iki yüzey
   sessizce farklı bir cevap evreni gösteriyordu. Bu köprü artık normal
   soru üretiminin KENDİ zincirini kullanır: `resolveProfileForField` →
   `ScheduledQuestion` → `scheduledToFocusedQuestion`. Seçenekler profilden
   gelir, kontrol tipini kayıt seçer; burada ikinci bir eşleme tablosu
   ya da ikinci bir seçenek aktarımı YOKTUR.

   NEDEN FAIL-CLOSED. Kanonik kontrol çözülemiyorsa uydurma bir metin
   kutusu açmak, kullanıcının serbestçe yazdığı metni kanonik cevap gibi
   kaydeder ve eşleşmeyi bozar. Kapı o durumda KAPALI döner.
   ═══════════════════════════════════════════════════════════════════════ */

export type EditQuestionResolution =
  | {
      status: "ready";
      /** Normal akıştakiyle aynı sözleşme: `FocusedQuestion`. */
      question: FocusedQuestion;
      /** Kanonik durumdaki mevcut değer — yalnız gösterim içindir. */
      currentValue: string | null;
      /** Kanonik merdivendeki mevcut mod (VALUE / ANY / UNKNOWN / …). */
      currentKind: string | null;
    }
  | { status: "unavailable"; fieldKey: string; reason: "no_profile" };

type CanonicalFieldLike = { kind?: string; value?: string | null };

export function resolveEditQuestion(input: {
  /** Besteci kanonik durumu — yalnız mevcut değeri OKUMAK için. */
  state: { fields?: Record<string, CanonicalFieldLike | undefined> } | null;
  fieldKey: string;
  categoryId: string;
  needType?: string | null;
  productType?: string | null;
  isRemoteService?: boolean;
  listingType?: string | null;
}): EditQuestionResolution {
  const { fieldKey, categoryId } = input;

  const profile = resolveProfileForField({
    fieldKey,
    categoryId,
    needType: input.needType ?? null,
    productType: input.productType ?? null,
  });
  if (!profile) return { status: "unavailable", fieldKey, reason: "no_profile" };

  /**
   * Zamanlayıcının ürettiğiyle AYNI ara sözleşme. `escapeChoices` boş
   * bırakılır: ANY / UNKNOWN kaçışlarını kontrol kaydı zaten
   * `softOptions` içinde taşır ve ikinci bir kaçış listesi aynı bilginin
   * ikinci kopyası olurdu.
   */
  const scheduled: ScheduledQuestion = {
    fieldKey,
    prompt: profile.prompt,
    summaryLabel: profile.summaryLabel,
    importance: profile.importance,
    allowUnknown: Boolean(profile.allowUnknown),
    allowDontCare: Boolean(profile.allowDontCare),
    inputHint: profile.inputHint ?? "text",
    budgetBasis: profile.budgetBasis,
    priorityScore: 0.5,
    quickChoices: profile.quickChoices,
    escapeChoices: [],
    categoryId,
  };

  const brandField = input.state?.fields?.brand;
  const question = scheduledToFocusedQuestion(scheduled, undefined, {
    productType: input.productType ?? null,
    needType: input.needType ?? null,
    brand:
      brandField?.kind === "VALUE" && typeof brandField.value === "string"
        ? brandField.value
        : null,
    isRemoteService: input.isRemoteService,
    listingType: input.listingType ?? null,
  });

  const field = input.state?.fields?.[fieldKey] ?? null;
  return {
    status: "ready",
    question,
    currentValue:
      field && field.kind === "VALUE" && typeof field.value === "string"
        ? field.value
        : null,
    currentKind: field ? (field.kind ?? null) : null,
  };
}
