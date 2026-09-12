/**
 * Question scheduler: show at most 1–3 highest-importance unanswered questions.
 * Total question count is NOT capped at 3 — groups advance as answers arrive.
 */

import type { QuestionCandidate } from "@/lib/request-brain/types";
import { fieldDisplayLabel } from "@/lib/request-composer/ui-helpers";
import {
  getCategoryById,
  isGeneratedCommonField,
  resolveCategoryQuestionContract,
} from "@/lib/request-category-engine";

import {
  isDeliberateNonValueAnswer,
  isInferenceOnlyAnswer,
} from "../answer-authority";
import type { FieldProvenance } from "../types";

import {
  importanceRank,
  isRemoteEligibleService,
  listProfilesForCategory,
  resolveProfileForField,
} from "./question-profiles";
import type {
  QuestionImportance,
  QuestionPhase,
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

/**
 * AŞAMA BAŞLIKLARI — TEK YETKİLİ (kurucu, 2026-09-12).
 *
 * `/talep` formu ve Maira bu metni buradan okur; iki yüzey ayrı cümle
 * kurmaz. Başlık bir cevap alanı değildir, hiçbir yüzeye değer olarak
 * yazılmaz.
 */
export const PHASE_HEADINGS: Record<QuestionPhase, string> = {
  essentials: "Teklif için iki bilgi yeterli",
  detail: "Talebi detaylandır, daha gerçek teklif al",
};

/**
 * Görünen kümenin aşamasını seçer. Bütçe / konum (`publish_required`)
 * açıkken yalnız onlar görünür; kapanınca kalan sorular olduğu gibi gelir.
 * Sıralama değişmez, yalnız görünürlük kapısı eklenir.
 */
export function resolveQuestionPhase(
  pending: ReadonlyArray<Pick<ScheduledQuestion, "importance">>,
): QuestionPhase {
  return pending.some((q) => q.importance === "publish_required")
    ? "essentials"
    : "detail";
}

export type FieldAnswerState = {
  kind?: "VALUE" | "ANY" | "NOT_APPLICABLE" | "UNKNOWN" | string;
  value?: string | null;
  softStatus?: SoftAnswerStatus | null;
  /**
   * Değerin kaynağı (KB-17). Taşınmazsa eski davranış korunur; taşındığında
   * yalnız `INFERRED` olan değer soruyu kapatamaz.
   */
  provenance?: FieldProvenance | string | null;
};

/**
 * ARAYÜZ SEÇENEK DEĞERİNİ YAPISAL DURUMA ÇEVİRİR — KAPANIŞ KARARI DEĞİLDİR
 * (B2, 2026-08-27).
 *
 * Bu ayrıştırıcı `/talep` ekranında kullanıcının TIKLADIĞI kaçış seçeneğinin
 * değerini (`unknown`, `no_preference`, `open_to_offers`, `flexible`) ve o
 * seçeneğin görünen metnini yapısal bir duruma çevirir. Tek görevi, arayüz
 * sınırında hangi kanonik modun yazılacağını seçmektir.
 *
 * `isFieldSatisfied` bu fonksiyonu ARTIK ÇAĞIRMAZ. Kapanış kararını
 * yerelleştirilmiş metinden vermek, ekranda yazan sözcüğü bir sözleşme hâline
 * getiriyordu: ölçüldü, profil izin verdiğinde `"Henüz bilmiyorum"` /
 * `"Fark etmez"` / `"Esnek"` metinleri kanonik durum "bu bilinçli bir cevap
 * değil" derken bile soruyu kapatıyordu.
 */
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
    /* `/talep` "Bilmiyorum" eyleminin taslakta bıraktığı görünen metin. */
    fold === "belirtilmedi" ||
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
  /**
   * YAPISAL DURUM — ETİKETTEN TÜRETİLMEZ (B2).
   *
   * `softStatus` çağıranın taşıdığı YAPISAL alandır. Taslak dizesinden
   * ayrıştırma kaldırıldı: ekranda yazan metin bir cevap otoritesi değildir.
   */
  const soft = input.state?.softStatus ?? null;
  const kind = input.state?.kind;
  const value = input.state?.value?.trim() ?? "";
  /**
   * FAIL-CLOSED: KANONİK MODU OLMAYAN KAÇIŞ ETİKETİ CEVAP DEĞİLDİR.
   *
   * Eski bir taslak (ya da kanonik modu kaybolmuş bir yol) yalnız
   * `"Henüz bilmiyorum"` / `"Fark etmez"` / `"Esnek"` metnini taşıyabilir.
   * Bu metin ne soruyu kapatır ne de gerçek bir değer yerine geçer — soru
   * AÇIK kalır. Etiket burada yalnız REDDETMEK için tanınır; hiçbir koşulda
   * yetki üretmez. Yetki tek yerden gelir: `isDeliberateNonValueAnswer`.
   */
  const isEscapeLabelOnly =
    !isDeliberateNonValueAnswer(input.state) &&
    parseSoftStatus(input.state?.value) !== null;
  const hasRealValue = value.length > 0 && !isEscapeLabelOnly;

  /**
   * ÇIKARIM CEVAP DEĞİLDİR (KB-17).
   *
   * Kullanıcının yazmadığı ve doğrulanmış bir otoritenin kanıtlamadığı değer
   * soruyu tatmin edemez — bütçe ve konum dâhil. Değer kaybolmaz; soruda
   * ön-seçili öneri olarak kullanıcıya gösterilir ve kararı o verir.
   */
  if (isInferenceOnlyAnswer(input.state)) return false;

  /**
   * BİLİNÇLİ DEĞER TAŞIMAYAN CEVAP — TEK KANONİK ÖLÇÜT (D3f Dilim 1).
   *
   * Burada eskiden karar İKİ ayrı yerden veriliyordu: elle yazılmış bir
   * `kind` listesi (`ANY || NOT_APPLICABLE`) ve `parseSoftStatus` ile
   * YERELLEŞTİRİLMİŞ ETİKETİN ayrıştırılması ("bilmiyorum", "henüz
   * bilmiyorum"). Etiketten karar vermek, kullanıcının gördüğü metni bir
   * sözleşme hâline getiriyordu; metin değişince cevap sessizce kayboluyordu.
   *
   * Karar artık kanonik moddan ve açık kullanıcı kaynağından okunur. PROFİL
   * POLİTİKASI DEĞİŞMEZ: hangi sorunun "Bilmiyorum" ya da "Fark etmez" ile
   * geçilebileceğine profil karar vermeye devam eder.
   */
  if (isDeliberateNonValueAnswer(input.state)) {
    if (input.importance === "optional") return true;
    return kind === "UNKNOWN" ? input.allowUnknown : input.allowDontCare;
  }

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
    if (hasRealValue) return true;
    if (soft === "unknown" && input.allowUnknown) return true;
    return false;
  }

  if (kind === "VALUE" && hasRealValue) return true;
  if (soft === "open_to_offers" && input.fieldKey === "budget") return true;
  if (soft === "unknown" && input.allowUnknown) return true;
  if (soft === "no_preference" && input.allowDontCare) return true;
  if (soft === "flexible" && input.allowDontCare) return true;
  if (input.optionallySkipped && input.importance === "optional") return true;
  if (hasRealValue) return true;
  return false;
}

function escapesFor(input: {
  fieldKey: string;
  allowUnknown: boolean;
  allowDontCare: boolean;
  importance: QuestionImportance;
  categoryId?: string;
  needType?: string | null;
  remoteEligible?: boolean;
}): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const isRealEstate = input.categoryId === "real-estate";
  /* Yazılım / web projesi her zaman uzaktan yapılabilir (kurucu,
     2026-09-12); ürün sözcüğü imzasına bağlı değildir. */
  const isSoftwareProject =
    input.categoryId === "technology" && input.needType === "software";
  const isServiceLike =
    isSoftwareProject ||
    ((input.categoryId === "services" || input.categoryId === "health") &&
      input.remoteEligible !== false);

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
  if (fallback) return fallback;
  /* Ortak alanın kendi cümlesi vardır; "Adet bilgisini ekleyelim." gibi
     yedek etiket kullanıcıya gösterilmez (kurucu, 2026-09-12). */
  if (fieldKey === "quantity") return "Kaç adet gerekli?";
  /* Ham İngilizce anahtar kullanıcıya ASLA gösterilmez; Türkçe etiket
     kanonik haritadan gelir, o da yoksa nötr bir cümleye düşülür. */
  const label = fieldDisplayLabel(fieldKey);
  return label ? `${label} bilgisini ekleyelim.` : "Bir detayı birlikte ekleyelim.";
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
    (input.categoryId === "automotive" &&
      ((input.needType ?? input.values.needType ?? input.fieldStates?.needType?.value) === "service" ||
      (input.needType ?? input.values.needType ?? input.fieldStates?.needType?.value) === "tire")
      ? input.values.serviceType ?? input.values.productType
      : input.values.productType) ??
    input.values.solutionType ??
    input.values.applianceType ??
    input.values.furnitureType ??
    input.values.babyProductType ??
    input.values.kitchenProductType ??
    input.values.machineType ??
    input.values.propertyType ??
    input.values.serviceType ??
    input.values.tireItemType ??
    input.fieldStates?.productType?.value ??
    input.fieldStates?.solutionType?.value ??
    input.fieldStates?.applianceType?.value ??
    input.fieldStates?.furnitureType?.value ??
    input.fieldStates?.babyProductType?.value ??
    input.fieldStates?.kitchenProductType?.value ??
    input.fieldStates?.machineType?.value ??
    input.fieldStates?.propertyType?.value ??
    input.fieldStates?.serviceType?.value ??
    input.fieldStates?.tireItemType?.value ??
    null;

  const needTypeContext =
    input.needType ??
    input.values.needType ??
    input.fieldStates?.needType?.value ??
    null;

  const categoryProfiles = listProfilesForCategory({
    categoryId: input.categoryId,
    needType: needTypeContext,
    productType: productTypeContext,
  });
  const productContract = resolveCategoryQuestionContract({
    categoryId: input.categoryId,
    productType: productTypeContext,
    needType: needTypeContext,
  });
  const hybridCandidates = productContract
    ? input.hybridCandidates.filter((candidate) =>
        productContract.allowedCandidateFieldKeys.includes(candidate.fieldKey),
      )
    : input.hybridCandidates;
  // Global core cannot be overwritten/suppressed by category profiles.
  const listingFromValues =
    input.values.listingType?.trim() ||
    input.fieldStates?.listingType?.value?.trim() ||
    null;
  const propertyTypeFromValues =
    input.values.propertyType?.trim() ||
    input.fieldStates?.propertyType?.value?.trim() ||
    (input.categoryId === "real-estate" ? (input.productType ?? "") : "") ||
    null;
  const globalCore = globalCoreQuestionProfiles(input.categoryId, {
    listingType: listingFromValues,
    needType: needTypeContext,
    propertyType: propertyTypeFromValues,
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
  for (const c of hybridCandidates) keySet.add(c.fieldKey);
  for (const k of commonKeys) {
    /* Üretilen etiket soru olarak zamanlanmaz (D3f 3g — kanonik yetenek). */
    if (isGeneratedCommonField(k)) continue;
    keySet.add(k);
  }
  // Explicit product decisions also apply to shared and inferred time questions.
  if (productContract?.omitDeliveryQuestion) keySet.delete("delivery");

  const hybridByKey = new Map(
    hybridCandidates.map((c) => [c.fieldKey, c]),
  );

  /**
   * SORU OLMAK İÇİN PROFİL GEREKİR (kurucu, 2026-09-12).
   *
   * Ölçüldü (156 senaryo): ürün sözleşmesi olmayan kategorilerde eski form
   * alanları ("Özellikler", "Teknik özellikler", "Kullanım alanı", "Ölçüler",
   * "Uyumlu ürün kimlikleri") aday soru olarak akışa doluyordu. Beyaz eşya,
   * mobilya, ev-mutfak ve sağlıkta senaryo başına 5-7 soru bu sınıftandı;
   * kahve makinesine kurulum, sunucuya ekran boyutu soruluyor, profil
   * sorusu ham alanla iki kez geliyordu (kaç kişilik + kapasite). Kurucu
   * kuralı: sürekli serbest metin yazdırma, her kategoride aynı soru setini
   * kullanma. Karar: yalnız aday listesinden gelen ve hiçbir profil
   * çözmeyen anahtar soru olarak zamanlanmaz; alan düzenleme ekranında
   * kalır. Küresel çekirdek, kategori profilleri ve kategorinin kendi ortak
   * alanları (ör. makinede adet) bu kapıdan etkilenmez. Kategori
   * çözülmemişken ("needDescription" kaçışı) eski davranış korunur.
   */
  const declaredKeys = new Set<string>([
    ...globalCore.map((p) => p.fieldKey),
    ...categoryProfiles.map((p) => p.fieldKey),
    ...commonKeys,
  ]);
  const legacyFieldGate = Boolean(category);

  // Location already answered via mode or soft status
  const currentValue = (key: string) => {
    const canonical = input.fieldStates?.[key];
    return canonical ? (canonical.kind === "VALUE" ? canonical.value : null) : input.values[key];
  };
  const locationSatisfiedEarly = isLocationSatisfiedForPublish({
    cityValue: currentValue("city"),
    locationMode: currentValue("locationMode"),
    realEstateComplete: input.realEstateLocationComplete,
    categoryId: input.categoryId,
  });

  type Pending = ScheduledQuestion & { sortScore: number };
  const pending: Pending[] = [];

  for (const fieldKey of keySet) {
    if (isGeneratedCommonField(fieldKey)) continue;
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

    const resolvedProfile =
      profileByKey.get(fieldKey) ??
      resolveProfileForField({
        fieldKey,
        categoryId: input.categoryId,
        needType: needTypeContext,
        productType: productTypeContext,
      });
    if (!resolvedProfile && legacyFieldGate && !declaredKeys.has(fieldKey)) {
      continue;
    }
    const profile =
      resolvedProfile ??
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
      value: input.fieldStates?.[fieldKey]
        ? input.fieldStates[fieldKey].value ?? null
        : input.values[fieldKey] ?? null,
    };

    const satisfied = isFieldSatisfied({
      fieldKey,
      state,
      importance: profile.importance,
      allowUnknown: Boolean(profile.allowUnknown),
      allowDontCare: Boolean(profile.allowDontCare),
      optionallySkipped: optionalSkipped.has(fieldKey),
    });
    // A session ledger is not an answer store. Cleared canonical answers must
    // reopen even when their old key is still in the UI's history.
    const draftAnswer = answered.has(fieldKey) &&
      (!input.fieldStates ||
        (!input.fieldStates[fieldKey] && Boolean(input.values[fieldKey]?.trim())));
    if (satisfied || draftAnswer) continue;

    if (fieldKey === "quantity" && !input.fieldStates?.quantity && (input.values.quantity ?? "").trim()) {
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

    // Tahmin cevabı kapatamaz ama boşa da gitmez: ön-seçili öneri olur.
    const inferenceSuggestion = isInferenceOnlyAnswer(state)
      ? (state.value ?? "").trim()
      : "";

    pending.push({
      fieldKey,
      suggestedValue: inferenceSuggestion || undefined,
      suggestedValueAuthority: inferenceSuggestion
        ? ("INFERENCE_ONLY" as const)
        : undefined,
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
        needType: needTypeContext,
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
  const publishRequired = pending.filter(
    (p) => p.importance === "publish_required",
  );

  /**
   * ÇIKARIM DOĞRULAMASI YAYINI KİLİTLER (kurucu eki, 2026-08-26).
   *
   * Kural DAR tutulur ve iki koşulun BİRLİKTE sağlanmasını ister:
   *   1. Alanın değeri YALNIZ Talepo'nun çıkarımından geliyor (öneri var), ve
   *   2. Alan yönlendirme açısından kritik (`routing_critical`).
   *
   * Gerekçe asimetriktir: boş bırakılmış bir routing sorusu talebi eksik
   * bırakır — kullanıcı ne olduğunu bilir. Doğrulanmamış bir çıkarım ise
   * talebi YANLIŞ havuza gönderir ve kullanıcı bunu hiç görmez. Bu yüzden
   * kural bütün routing alanlarına YAYILMAZ: önerisi olmayan routing sorusu
   * eskisi gibi atlanabilir kalır.
   */
  const unconfirmedInference = pending.filter(
    (p) =>
      p.suggestedValueAuthority === "INFERENCE_ONLY" &&
      p.importance === "routing_critical",
  );

  const blockingCritical = [
    ...publishRequired,
    ...unconfirmedInference.filter(
      (p) => !publishRequired.some((b) => b.fieldKey === p.fieldKey),
    ),
  ];

  /**
   * ÖNCE BÜTÇE VE KONUM, SONRA DETAY (kurucu, 2026-09-12).
   *
   * Bütçe ya da il/ilçe açıkken başka soru ekrana çıkmaz: kullanıcı önce
   * teklif için şart olan iki bilgiyi verir, sonra "Talebi detaylandır"
   * başlığı altında kategori soruları gelir. Metinde yazılmış bütçe/konum
   * zaten `isFieldSatisfied` ile kapalıdır; o durumda ilk aşama hiç
   * görünmez. Sıralama puanı değişmedi; yalnız görünürlük kapısı eklendi,
   * `pending`, `blocking` ve sayaçlar aynen hesaplanır.
   */
  const phase = resolveQuestionPhase(pending);
  const visibleSource = phase === "essentials" ? publishRequired : pending;
  const visible = visibleSource.slice(0, MAX_VISIBLE).map((item) => {
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
    phase,
    phaseHeading: PHASE_HEADINGS[phase],
  };
}

export function softStatusFromAnswerValue(
  value: string,
): SoftAnswerStatus | "skip_optional" | null {
  const fold = value.trim().toLocaleLowerCase("tr-TR");
  if (fold === "skip_optional" || fold === "skip") return "skip_optional";
  return parseSoftStatus(value);
}
