"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  FileText,
  Info,
  LoaderCircle,
  ListPlus,
  Send,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";

import { RealEstateLocationFields } from "@/components/request/RealEstateLocationFields";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { runTalepoAiCore } from "@/lib/ai";
import {
  composeProfessionalDescription,
  composeRequestTitle,
} from "@/lib/ai/request-text-composer";
import {
  getExploreFilterDefs,
  getFilterSelectOptions,
} from "@/lib/explore/category-filters";
import {
  neighborhoodsFieldValue,
  realEstateLocationError,
  realEstateLocationToCity,
  resolveRealEstateLocationFromSources,
  type RealEstateLocation,
} from "@/lib/geo/real-estate-location";
import {
  getCategoryById,
  getVisibleCategoryFields,
  isFieldRequired,
  REQUEST_CATEGORIES,
  resolveCommonField,
  withCategoryFieldDefaults,
  type DynamicField,
} from "@/lib/request-category-engine";

type CommonDraft = {
  title: string;
  quantity: string;
  city: string;
  delivery: string;
  budget: string;
};

type CompanionGap = {
  id: string;
  title: string;
  description?: string;
  field: string;
  placeholder?: string;
  suggestedValue?: string;
  inputType: "text" | "number" | "select";
  options?: { label: string; value: string }[];
  /** Real-estate location needs structured picker, not free text. */
  pickerOnly?: boolean;
};

const ESSENTIAL_COMMON_KEYS = new Set(["title", "city"]);

const QUICK_CITIES = [
  "İstanbul",
  "Ankara",
  "İzmir",
  "Bursa",
  "Antalya",
  "Kocaeli",
] as const;

const BUDGET_PRESETS = [
  { id: "under-10", label: "10 bin altı", value: "10.000 TL'ye kadar" },
  { id: "10-50", label: "10–50 bin", value: "10.000 – 50.000 TL" },
  { id: "50-200", label: "50–200 bin", value: "50.000 – 200.000 TL" },
  { id: "200-plus", label: "200 bin+", value: "200.000 TL üzeri" },
] as const;

const EXAMPLE_CHIPS = [
  "İstanbul’da 50 ofis sandalyesi lazım",
  "Bağcılar’da 2+1 kiralık daire arıyorum",
  "5.000 adet baskılı karton kutu",
  "Ankara’ya 10 laptop teklifi",
] as const;

export default function TalepOlusturPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#eef3f2] px-5 py-16 text-[#0f1f1d]">
          <div className="mx-auto max-w-3xl animate-pulse rounded-2xl bg-white/80 p-8">
            <div className="h-8 w-48 rounded bg-teal-900/10" />
            <div className="mt-6 h-40 rounded-2xl bg-teal-900/5" />
          </div>
        </main>
      }
    >
      <TalepOlusturForm />
    </Suspense>
  );
}

function TalepOlusturForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromHome = searchParams.get("query")?.trim() ?? "";
  const categoryFromHome = searchParams.get("category")?.trim() ?? "";
  const validCategoryFromHome = REQUEST_CATEGORIES.some(
    (category) => category.id === categoryFromHome,
  )
    ? categoryFromHome
    : null;
  const [requestText, setRequestText] = useState(queryFromHome);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [commonDraft, setCommonDraft] = useState<CommonDraft>({
    title: "",
    quantity: "",
    city: "",
    delivery: "",
    budget: "",
  });
  /** When true, user edited the title — stop overwriting from AI. */
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [, setPublishedVersion] = useState<"manual" | "ai" | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [featureBoost, setFeatureBoost] = useState<
    "" | "FEATURE_24H" | "FEATURE_3D" | "FEATURE_7D"
  >("");
  const [urgencyPromptVersion, setUrgencyPromptVersion] = useState<
    "manual" | "ai" | null
  >(null);
  const [publishAsUrgent, setPublishAsUrgent] = useState(false);
  const [syncedQueryFromHome, setSyncedQueryFromHome] = useState(queryFromHome);
  const [syncedCategoryFromHome, setSyncedCategoryFromHome] =
    useState(categoryFromHome);
  const [realEstateDraft, setRealEstateDraft] = useState<RealEstateLocation>({
    il: "",
    ilce: "",
    mahalleler: [],
  });
  const [realEstateTouched, setRealEstateTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  /** When true, user edited/cleared budget — stop falling back to AI extraction. */
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [aiCompanionOpen, setAiCompanionOpen] = useState(false);
  const [aiMetricsOpen, setAiMetricsOpen] = useState(false);
  /** Draft values typed in the AI companion suggestion rows (keyed by gap id). */
  const [suggestionInputs, setSuggestionInputs] = useState<
    Record<string, string>
  >({});
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  /**
   * Category resolution:
   * - URL `?category=` is an initial soft hint only (seeds override, not locked).
   * - After need text changes meaningfully, or on Step 1 → Step 2 continue,
   *   soft hints clear so AI/detection wins from the current text.
   * - Manual pick in the Step 2 category select locks until the user picks the
   *   AI option again or clears filters (`categoryLockedByUser`).
   * - activeCategoryId = categoryOverride ?? detectedCategoryId
   */
  const [categoryOverride, setCategoryOverride] = useState<string | null>(
    validCategoryFromHome,
  );
  const [categoryLockedByUser, setCategoryLockedByUser] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** 1 = ihtiyaç metni, 2 = AI özeti onay / yayın */
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const previousActiveCategoryIdRef = useRef<string | null>(null);

  if (queryFromHome !== syncedQueryFromHome) {
    setSyncedQueryFromHome(queryFromHome);
    if (queryFromHome) {
      setRequestText(queryFromHome);
      setManualValues({});
      setCommonDraft({
        title: "",
        quantity: "",
        city: "",
        delivery: "",
        budget: "",
      });
      setTitleManuallyEdited(false);
      setPublishedVersion(null);
      setUrgencyPromptVersion(null);
      setPublishAsUrgent(false);
      setRealEstateDraft({ il: "", ilce: "", mahalleler: [] });
      setRealEstateTouched(false);
      setCityTouched(false);
      setBudgetTouched(false);
      setCategoryOverride(validCategoryFromHome);
      setCategoryLockedByUser(false);
      setWizardStep(1);
      setOptionalOpen(false);
      setFiltersOpen(false);
      setAiCompanionOpen(false);
      setAiMetricsOpen(false);
    }
  }

  if (categoryFromHome !== syncedCategoryFromHome) {
    setSyncedCategoryFromHome(categoryFromHome);
    if (validCategoryFromHome) {
      setCategoryOverride(validCategoryFromHome);
      setCategoryLockedByUser(false);
    }
  }

  const aiResult = useMemo(() => {
    try {
      return runTalepoAiCore(requestText);
    } catch (error) {
      console.error("[talep] AI core failed", error);
      return runTalepoAiCore("");
    }
  }, [requestText]);

  const [liveMatching, setLiveMatching] = useState<{
    estimatedCompanyCount: number;
    expectedOfferCount: number;
  } | null>(null);

  const detectedCategoryId = aiResult.parsed.categoryId;
  const activeCategoryId = categoryOverride ?? detectedCategoryId;
  const selectedCategory = getCategoryById(activeCategoryId);
  const categoryFilterDefs = getExploreFilterDefs(activeCategoryId);
  const visibleCommonFields = useMemo(
    () => selectedCategory.commonFields.map(resolveCommonField),
    [selectedCategory],
  );
  const visibleCommonFieldKeys = useMemo(
    () => new Set(visibleCommonFields.map((field) => field.key)),
    [visibleCommonFields],
  );
  const isRealEstate = activeCategoryId === "real-estate";

  /** Soft URL/home hint — not a user lock; AI may replace it after text changes. */
  function releaseSoftCategoryHint() {
    if (!categoryLockedByUser) {
      setCategoryOverride(null);
    }
  }

  // Drop il/ilçe/mahalle when category leaves real-estate (override clear or AI switch).
  useEffect(() => {
    const previous = previousActiveCategoryIdRef.current;
    previousActiveCategoryIdRef.current = activeCategoryId;
    if (previous !== "real-estate" || activeCategoryId === "real-estate") {
      return;
    }
    setRealEstateDraft({ il: "", ilce: "", mahalleler: [] });
    setRealEstateTouched(false);
    setManualValues((current) => {
      if (!current.neighborhoods) return current;
      const rest = { ...current };
      delete rest.neighborhoods;
      return rest;
    });
  }, [activeCategoryId]);

  const suggestedRealEstateLocation = useMemo(
    () =>
      resolveRealEstateLocationFromSources({
        parsedCity: commonDraft.city || aiResult.parsed.city,
        rawText: requestText,
        parsedNeighborhoods: manualValues.neighborhoods,
      }),
    [
      aiResult.parsed.city,
      commonDraft.city,
      manualValues.neighborhoods,
      requestText,
    ],
  );

  // AI autofills until the user edits; after that their choice sticks.
  const realEstateLocation = realEstateTouched
    ? realEstateDraft
    : suggestedRealEstateLocation;

  const dynamicValues = useMemo(() => {
    const category = getCategoryById(activeCategoryId);
    const values: Record<string, string> = {};

    for (const field of category.fields) {
      const aiValue = aiResult.parsed.attributes[field.key];

      values[field.key] =
        manualValues[field.key] ??
        (aiValue === undefined || aiValue === null ? "" : String(aiValue));
    }

    return withCategoryFieldDefaults(activeCategoryId, values);
  }, [activeCategoryId, aiResult.parsed.attributes, manualValues]);

  const autoTitle = useMemo(() => {
    const category = getCategoryById(activeCategoryId);
    return composeRequestTitle({
      categoryId: activeCategoryId,
      rawText: requestText,
      attributes: {
        ...aiResult.parsed.attributes,
        ...dynamicValues,
      },
      city: commonDraft.city || aiResult.parsed.city || "",
      quantity: aiResult.parsed.quantity,
      unit: aiResult.parsed.unit,
      fields: category.fields,
      fieldValues: dynamicValues,
      commonDraft,
    });
  }, [
    activeCategoryId,
    requestText,
    aiResult.parsed.attributes,
    aiResult.parsed.city,
    aiResult.parsed.quantity,
    aiResult.parsed.unit,
    dynamicValues,
    commonDraft,
  ]);

  const mergedCommonDraft = useMemo<CommonDraft>(
    () => ({
      title: titleManuallyEdited ? commonDraft.title : autoTitle,
      quantity: visibleCommonFieldKeys.has("quantity")
        ? commonDraft.quantity ||
          (aiResult.parsed.quantity
            ? `${aiResult.parsed.quantity} ${aiResult.parsed.unit ?? "adet"}`
            : "")
        : "",
      city: isRealEstate
        ? realEstateLocationToCity(realEstateLocation) ||
          commonDraft.city ||
          aiResult.parsed.city ||
          ""
        : visibleCommonFieldKeys.has("city")
          ? cityTouched
            ? commonDraft.city
            : commonDraft.city || aiResult.parsed.city || ""
          : "",
      delivery: visibleCommonFieldKeys.has("delivery")
        ? commonDraft.delivery ||
          (aiResult.parsed.deliveryDays
            ? `${aiResult.parsed.deliveryDays} gün`
            : "")
        : "",
      budget: visibleCommonFieldKeys.has("budget")
        ? budgetTouched
          ? commonDraft.budget
          : commonDraft.budget ||
            aiResult.parsed.budgetDisplay ||
            (aiResult.parsed.budget
              ? formatCurrency(aiResult.parsed.budget)
              : "")
        : "",
    }),
    [
      aiResult.parsed.budget,
      aiResult.parsed.budgetDisplay,
      aiResult.parsed.city,
      aiResult.parsed.deliveryDays,
      aiResult.parsed.quantity,
      aiResult.parsed.unit,
      autoTitle,
      budgetTouched,
      cityTouched,
      commonDraft.budget,
      commonDraft.city,
      commonDraft.delivery,
      commonDraft.quantity,
      commonDraft.title,
      isRealEstate,
      realEstateLocation,
      titleManuallyEdited,
      visibleCommonFieldKeys,
    ],
  );

  const canFetchLiveMatching = requestText.trim().length >= 8;

  if (!canFetchLiveMatching && liveMatching !== null) {
    setLiveMatching(null);
  }

  useEffect(() => {
    if (!canFetchLiveMatching) return;

    const city =
      commonDraft.city || aiResult.parsed.city || "";
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          category: activeCategoryId,
        });
        if (city) params.set("city", city);
        const response = await fetch(`/api/matching/estimate?${params}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          ok?: boolean;
          estimatedCompanyCount?: number;
          expectedOfferCount?: number;
        };
        if (!response.ok || !data.ok) return;
        setLiveMatching({
          estimatedCompanyCount: data.estimatedCompanyCount ?? 0,
          expectedOfferCount: data.expectedOfferCount ?? 0,
        });
      } catch {
        // keep client heuristic
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    activeCategoryId,
    aiResult.parsed.city,
    canFetchLiveMatching,
    commonDraft.city,
    requestText,
  ]);

  const matchingDisplay = liveMatching ?? aiResult.matching;

  const visibleDynamicFields = useMemo(
    () =>
      getVisibleCategoryFields(
        selectedCategory.fields,
        dynamicValues,
        activeCategoryId,
      ),
    [activeCategoryId, dynamicValues, selectedCategory.fields],
  );

  const missingFields = useMemo(
    () =>
      visibleDynamicFields.filter(
        (field) =>
          isFieldRequired(field, dynamicValues) &&
          !dynamicValues[field.key]?.trim(),
      ),
    [dynamicValues, visibleDynamicFields],
  );

  const realEstateLocationMissing = isRealEstate
    ? Boolean(realEstateLocationError(realEstateLocation))
    : false;

  const essentialCommonFields = visibleCommonFields.filter((field) =>
    ESSENTIAL_COMMON_KEYS.has(field.key),
  );
  const optionalCommonFields = visibleCommonFields.filter(
    (field) => !ESSENTIAL_COMMON_KEYS.has(field.key),
  );
  const requiredDynamicFields = visibleDynamicFields.filter((field) =>
    isFieldRequired(field, dynamicValues),
  );
  const optionalDynamicFields = useMemo(
    () =>
      visibleDynamicFields.filter(
        (field) => !isFieldRequired(field, dynamicValues),
      ),
    [dynamicValues, visibleDynamicFields],
  );
  const hasOptionalFields =
    optionalCommonFields.length > 0 || optionalDynamicFields.length > 0;

  const isCommonFieldFilled = useCallback(
    (key: keyof CommonDraft) => {
      if (key === "city") {
        return (
          Boolean(mergedCommonDraft.city.trim()) && !realEstateLocationMissing
        );
      }
      return Boolean(mergedCommonDraft[key]?.trim());
    },
    [mergedCommonDraft, realEstateLocationMissing],
  );

  const filledOptionalCount =
    optionalCommonFields.filter((field) =>
      isCommonFieldFilled(field.key),
    ).length +
    optionalDynamicFields.filter((field) =>
      Boolean(dynamicValues[field.key]?.trim()),
    ).length;

  /**
   * Transparent score: only fields the Step 2 UI exposes.
   * Required/essential → up to 85 (or 100 if no optionals).
   * Optional common + category fields → remaining points to 100.
   * When everything fillable is filled → exactly 100 (no hidden caps).
   */
  const liveScore = useMemo(() => {
    type ScoreItem = { filled: boolean };

    const requiredItems: ScoreItem[] = [];
    const optionalItems: ScoreItem[] = [];

    for (const field of visibleCommonFields) {
      const filled = isCommonFieldFilled(field.key);
      if (ESSENTIAL_COMMON_KEYS.has(field.key)) {
        requiredItems.push({ filled });
      } else {
        optionalItems.push({ filled });
      }
    }

    for (const field of visibleDynamicFields) {
      const filled = Boolean(dynamicValues[field.key]?.trim());
      if (isFieldRequired(field, dynamicValues)) {
        requiredItems.push({ filled });
      } else {
        optionalItems.push({ filled });
      }
    }

    const ratio = (items: ScoreItem[]) => {
      if (items.length === 0) return 1;
      return items.filter((item) => item.filled).length / items.length;
    };

    const requiredMax = optionalItems.length === 0 ? 100 : 85;
    const optionalMax = 100 - requiredMax;
    const score = Math.round(
      ratio(requiredItems) * requiredMax + ratio(optionalItems) * optionalMax,
    );

    if (requiredItems.length === 0 && optionalItems.length === 0) {
      return requestText.trim().length >= 8 ? 70 : 20;
    }

    return Math.min(100, Math.max(0, score));
  }, [
    dynamicValues,
    isCommonFieldFilled,
    requestText,
    visibleCommonFields,
    visibleDynamicFields,
  ]);

  const companionGaps = useMemo(() => {
    const gaps: CompanionGap[] = [];
    const seenFields = new Set<string>();

    const fieldFilled = (field: string) => {
      if (field === "deliveryDays" || field === "delivery") {
        return Boolean(mergedCommonDraft.delivery.trim());
      }
      if (field === "city") {
        return (
          Boolean(mergedCommonDraft.city.trim()) && !realEstateLocationMissing
        );
      }
      if (field === "quantity") {
        return Boolean(mergedCommonDraft.quantity.trim());
      }
      if (field === "budget") {
        return Boolean(mergedCommonDraft.budget.trim());
      }
      if (field === "title") {
        return Boolean(mergedCommonDraft.title.trim());
      }
      return Boolean(dynamicValues[field]?.trim());
    };

    const pushGap = (gap: CompanionGap) => {
      if (!gap.field || seenFields.has(gap.field)) return;
      if (fieldFilled(gap.field)) return;
      seenFields.add(gap.field);
      gaps.push(gap);
    };

    for (const recommendation of aiResult.recommendations) {
      if (!recommendation.field) continue;
      const dynamicField = visibleDynamicFields.find(
        (field) => field.key === recommendation.field,
      );
      pushGap({
        id: recommendation.id,
        title: recommendation.title,
        description: recommendation.description,
        field: recommendation.field,
        placeholder: recommendation.description,
        suggestedValue:
          recommendation.suggestedValue != null
            ? String(recommendation.suggestedValue)
            : undefined,
        inputType: dynamicField?.type ?? "text",
        options: dynamicField?.options,
        pickerOnly: recommendation.field === "city" && isRealEstate,
      });
    }

    for (const field of missingFields) {
      pushGap({
        id: `missing-${field.key}`,
        title: `${field.label} ekleyin`,
        description: field.placeholder,
        field: field.key,
        placeholder: field.placeholder,
        inputType: field.type,
        options: field.options,
      });
    }

    for (const key of ["quantity", "delivery", "budget", "city"] as const) {
      if (!visibleCommonFieldKeys.has(key)) continue;
      if (key === "city" && isRealEstate) continue;
      const defaults = visibleCommonFields.find((field) => field.key === key);
      pushGap({
        id: `common-${key}`,
        title:
          key === "delivery"
            ? activeCategoryId === "technology"
              ? "Proje süresini belirtin"
              : "Teslim süresini belirtin"
            : key === "quantity"
              ? "Miktarı belirtin"
              : key === "budget"
                ? "Bütçe aralığı ekleyin"
                : "Teslimat şehrini ekleyin",
        description: defaults?.placeholder,
        field: key === "delivery" ? "deliveryDays" : key,
        placeholder: defaults?.placeholder,
        suggestedValue: key === "delivery" ? "14" : undefined,
        inputType: "text",
      });
    }

    // Remaining optional category fields → keep öneriler in sync with score < 100
    for (const field of optionalDynamicFields) {
      pushGap({
        id: `optional-${field.key}`,
        title: `${field.label} ekleyin`,
        description: field.placeholder,
        field: field.key,
        placeholder: field.placeholder,
        inputType: field.type,
        options: field.options,
      });
    }

    return gaps.slice(0, 6);
  }, [
    activeCategoryId,
    aiResult.recommendations,
    dynamicValues,
    isRealEstate,
    mergedCommonDraft,
    missingFields,
    optionalDynamicFields,
    realEstateLocationMissing,
    visibleCommonFieldKeys,
    visibleCommonFields,
    visibleDynamicFields,
  ]);

  const professionalText = composeProfessionalDescription({
    categoryId: activeCategoryId,
    rawText: requestText,
    attributes: {
      ...aiResult.parsed.attributes,
      ...dynamicValues,
    },
    city: mergedCommonDraft.city || aiResult.parsed.city,
    budget: aiResult.parsed.budget,
    deliveryDays: aiResult.parsed.deliveryDays,
    quantity: aiResult.parsed.quantity,
    unit: aiResult.parsed.unit,
    fields: visibleDynamicFields,
    fieldValues: dynamicValues,
    commonDraft: mergedCommonDraft,
    commonFields: visibleCommonFields,
  });

  const readinessLabel =
    liveScore >= 85
      ? "Yayınlamaya uygun"
      : liveScore >= 60
        ? "Birkaç detay eklenebilir"
        : "Bilgiler tamamlanmalı";

  const hasText = requestText.trim().length > 0;
  const canContinue = requestText.trim().length >= 8;

  function goToStep2() {
    if (!canContinue || isPublishing) return;
    // Fresh detection from current text unless the user locked a category in UI.
    releaseSoftCategoryHint();
    setPublishError(null);
    setPublishedVersion(null);
    setOptionalOpen(false);
    // Open missing-only filters so step 2 immediately shows what is still empty.
    setFiltersOpen(true);
    // Mobile companion starts open so inline gap inputs are discoverable.
    setAiCompanionOpen(true);
    setAiMetricsOpen(false);
    setWizardStep(2);
  }

  function goToStep1() {
    if (isPublishing) return;
    setPublishError(null);
    setUrgencyPromptVersion(null);
    setPublishAsUrgent(false);
    setWizardStep(1);
  }

  function applyExampleChip(example: string) {
    setRequestText(example);
    releaseSoftCategoryHint();
    setManualValues({});
    setCommonDraft({
      title: "",
      quantity: "",
      city: "",
      delivery: "",
      budget: "",
    });
    setTitleManuallyEdited(false);
    setRealEstateDraft({ il: "", ilce: "", mahalleler: [] });
    setRealEstateTouched(false);
    setCityTouched(false);
    setBudgetTouched(false);
    setPublishedVersion(null);
    setPublishError(null);
  }

  function updateDynamicField(key: string, value: string) {
    setManualValues((current) => ({
      ...current,
      [key]: value,
    }));
    setPublishedVersion(null);
  }

  function updateCommonField(
    field: keyof CommonDraft,
    value: string
  ) {
    if (field === "title") {
      if (!value.trim()) {
        // Clearing title resumes autofill.
        setTitleManuallyEdited(false);
        setCommonDraft((current) => ({ ...current, title: "" }));
      } else {
        setTitleManuallyEdited(true);
        setCommonDraft((current) => ({ ...current, title: value }));
      }
      setPublishedVersion(null);
      return;
    }

    if (field === "city") {
      setCityTouched(true);
    }
    if (field === "budget") {
      setBudgetTouched(true);
    }

    setCommonDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setPublishedVersion(null);
  }

  function updateRealEstateLocation(next: RealEstateLocation) {
    setRealEstateTouched(true);
    setRealEstateDraft(next);
    setManualValues((current) => ({
      ...current,
      neighborhoods: neighborhoodsFieldValue(next),
    }));
    setPublishedVersion(null);
  }

  function applyCityFilter(city: string) {
    if (isRealEstate) {
      const sameIl = city === realEstateLocation.il;
      updateRealEstateLocation({
        il: city,
        ilce: sameIl ? realEstateLocation.ilce : "",
        mahalleler: sameIl ? realEstateLocation.mahalleler : [],
      });
      return;
    }
    setCityTouched(true);
    updateCommonField("city", city);
  }

  function applyBudgetPreset(value: string) {
    updateCommonField("budget", value);
    if (value) setOptionalOpen(true);
  }

  function clearCreateFilters() {
    setCategoryOverride(null);
    setCategoryLockedByUser(false);
    setCityTouched(true);
    setBudgetTouched(true);
    setCommonDraft((current) => ({
      ...current,
      city: "",
      budget: "",
    }));
    setRealEstateTouched(true);
    setRealEstateDraft({ il: "", ilce: "", mahalleler: [] });
    if (categoryFilterDefs.length > 0) {
      setManualValues((current) => {
        const next = { ...current };
        for (const def of categoryFilterDefs) {
          // Empty string keeps AI from re-filling so cleared filter chips reappear.
          next[def.fieldKey] = "";
        }
        return next;
      });
    }
    setPublishedVersion(null);
  }

  function applyCompanionGap(gap: CompanionGap, rawValue?: string) {
    const field = gap.field;
    const typed =
      rawValue?.trim() ||
      suggestionInputs[gap.id]?.trim() ||
      gap.suggestedValue?.trim() ||
      "";

    if (gap.pickerOnly || (field === "city" && isRealEstate && !typed)) {
      setOptionalOpen(true);
      setFiltersOpen(true);
      setAiCompanionOpen(true);
      return;
    }

    if (!typed && field !== "city") {
      return;
    }

    if (field === "deliveryDays" || field === "delivery") {
      const deliveryValue = /^\d+$/.test(typed) ? `${typed} gün` : typed;
      updateCommonField("delivery", deliveryValue);
      setOptionalOpen(true);
      setSuggestionInputs((current) => {
        const next = { ...current };
        delete next[gap.id];
        return next;
      });
      return;
    }

    if (field === "city") {
      if (typed) {
        applyCityFilter(typed);
        setSuggestionInputs((current) => {
          const next = { ...current };
          delete next[gap.id];
          return next;
        });
        return;
      }
      const cityHint = aiResult.parsed.city?.trim();
      if (!isRealEstate && cityHint) {
        applyCityFilter(cityHint);
        return;
      }
      setOptionalOpen(true);
      setFiltersOpen(true);
      return;
    }

    if (field === "quantity" || field === "budget") {
      updateCommonField(field, typed);
      setOptionalOpen(true);
      setSuggestionInputs((current) => {
        const next = { ...current };
        delete next[gap.id];
        return next;
      });
      return;
    }

    updateDynamicField(field, typed);
    setSuggestionInputs((current) => {
      const next = { ...current };
      delete next[gap.id];
      return next;
    });

    const isOptionalDynamic = optionalDynamicFields.some(
      (item) => item.key === field,
    );
    if (isOptionalDynamic) {
      setOptionalOpen(true);
    }
  }

  const filterCityValue = isRealEstate
    ? realEstateLocation.il
    : mergedCommonDraft.city.trim();
  const filterBudgetValue = mergedCommonDraft.budget.trim();
  /** AI/need-text already provided city — hide city chips even if form looks empty briefly. */
  const cityFilledFromAi =
    !cityTouched && Boolean(aiResult.parsed.city?.trim());
  const budgetFilledFromAi =
    !budgetTouched &&
    (Boolean(aiResult.parsed.budgetDisplay?.trim()) ||
      aiResult.parsed.budget != null);
  const isCityFilled = Boolean(filterCityValue) || cityFilledFromAi;
  const isBudgetFilled = Boolean(filterBudgetValue) || budgetFilledFromAi;
  const missingCategoryFilterDefs = categoryFilterDefs.filter(
    (def) => !dynamicValues[def.fieldKey]?.trim(),
  );
  const activeCategoryFilterCount = categoryFilterDefs.filter((def) =>
    Boolean(dynamicValues[def.fieldKey]?.trim()),
  ).length;
  const activeFilterCount =
    (categoryLockedByUser && categoryOverride ? 1 : 0) +
    (filterCityValue ? 1 : 0) +
    (filterBudgetValue ? 1 : 0) +
    activeCategoryFilterCount;
  /** Step-2 quick filters: only fields still empty after need text / AI. */
  const showCityQuickFilter = !isRealEstate && !isCityFilled;
  const showBudgetQuickFilter =
    visibleCommonFieldKeys.has("budget") && !isBudgetFilled;
  const hasMissingQuickFilters =
    showCityQuickFilter ||
    showBudgetQuickFilter ||
    missingCategoryFilterDefs.length > 0;
  const activeBudgetPresetId =
    BUDGET_PRESETS.find((preset) => preset.value === filterBudgetValue)?.id ??
    null;

  function requestPublish(version: "manual" | "ai") {
    if (isPublishing) return;

    if (isRealEstate) {
      const locationError = realEstateLocationError(realEstateLocation);
      if (locationError) {
        setPublishedVersion(version);
        setPublishError(locationError);
        return;
      }
    }

    setPublishError(null);
    setPublishAsUrgent(false);
    setUrgencyPromptVersion(version);
  }

  function closeUrgencyPrompt() {
    if (isPublishing) return;
    setUrgencyPromptVersion(null);
    setPublishAsUrgent(false);
  }

  function confirmPublish() {
    const version = urgencyPromptVersion;
    if (!version || isPublishing) return;
    const isUrgent = publishAsUrgent;
    setUrgencyPromptVersion(null);
    setPublishAsUrgent(false);
    void publishRequest(version, isUrgent);
  }

  async function publishRequest(
    version: "manual" | "ai",
    isUrgent: boolean,
  ) {
    if (isPublishing) return;

    if (isRealEstate) {
      const locationError = realEstateLocationError(realEstateLocation);
      if (locationError) {
        setPublishedVersion(version);
        setPublishError(locationError);
        return;
      }
    }

    setPublishedVersion(version);
    setPublishError(null);
    setIsPublishing(true);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: mergedCommonDraft.title,
          description:
            version === "ai" ? professionalText : requestText.trim(),
          professionalDescription: professionalText,
          category: {
            slug: selectedCategory.id,
            name: selectedCategory.label,
            description: selectedCategory.description,
          },
          city: mergedCommonDraft.city,
          district: isRealEstate ? realEstateLocation.ilce : undefined,
          quantity: mergedCommonDraft.quantity,
          delivery: mergedCommonDraft.delivery,
          budget: mergedCommonDraft.budget,
          aiScore: liveScore,
          aiSummary: [
            `Kategori: ${selectedCategory.label}`,
            `AI güveni: %${aiResult.knowledge.confidence}`,
            `Tahmini firma: ${matchingDisplay.estimatedCompanyCount}`,
            `Beklenen teklif: ${matchingDisplay.expectedOfferCount}`,
          ].join("\n"),
          isUrgent,
          featureBoost: featureBoost || null,
          publishVersion: version,
          fields: [
            ...visibleDynamicFields.map((field) => ({
              ...field,
              required: isFieldRequired(field, dynamicValues),
              value: dynamicValues[field.key] ?? "",
            })),
            ...(isRealEstate
              ? [
                  {
                    key: "neighborhoods",
                    label: "Mahalle",
                    type: "text" as const,
                    required: false,
                    value: neighborhoodsFieldValue(realEstateLocation),
                  },
                ]
              : []),
          ],
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/giris?callbackUrl=${encodeURIComponent("/talep")}`);
          return;
        }

        throw new Error(result.message || "Talep yayınlanamadı.");
      }

      router.push(result.redirectTo || "/panel/taleplerim");
      router.refresh();
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "Talep yayınlanırken bir hata oluştu.",
      );
      setIsPublishing(false);
    }
  }

  function renderCommonField(field: (typeof visibleCommonFields)[number]) {
    if (isRealEstate && field.key === "city") {
      return (
        <div
          key={`${activeCategoryId}-location`}
          className="sm:col-span-2"
        >
          <RealEstateLocationFields
            il={realEstateLocation.il}
            ilce={realEstateLocation.ilce}
            mahalleler={realEstateLocation.mahalleler}
            aiSuggested={!realEstateTouched}
            onIlChange={(il) =>
              updateRealEstateLocation({
                il,
                ilce: "",
                mahalleler: [],
              })
            }
            onIlceChange={(ilce) =>
              updateRealEstateLocation({
                il: realEstateLocation.il,
                ilce,
                mahalleler: [],
              })
            }
            onMahallelerChange={(mahalleler) =>
              updateRealEstateLocation({
                il: realEstateLocation.il,
                ilce: realEstateLocation.ilce,
                mahalleler,
              })
            }
          />
        </div>
      );
    }

    return (
      <CommonField
        key={`${activeCategoryId}-${field.key}`}
        label={field.label}
        value={mergedCommonDraft[field.key]}
        onChange={(value) => updateCommonField(field.key, value)}
        placeholder={field.placeholder}
        wide={field.key === "title"}
        money={field.key === "budget"}
        hint={
          field.key === "title" &&
          !titleManuallyEdited &&
          Boolean(autoTitle.trim()) &&
          autoTitle !== "Yeni talep"
            ? "Başlık metninize göre hazırlandı — düzenleyebilirsiniz"
            : undefined
        }
      />
    );
  }

  const companionBody = (
    <div className="talepo-ai-panel-body relative z-[1] space-y-3.5">
      <div className="flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-white/[0.04] px-2.5 py-1">
            <span className="talepo-ai-status-dot" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/80">
              Talepo AI
            </span>
          </div>
          <p className="mt-2.5 text-sm font-semibold tracking-tight text-white">
            {readinessLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-teal-100/45">
            Eksik alanları burada doldurarak skoru yükseltebilirsiniz.
          </p>
        </div>
        <div
          className="talepo-ai-score-ring mx-auto shrink-0 scale-90 min-[380px]:mx-0"
          style={
            {
              "--progress": liveScore,
            } as CSSProperties
          }
          aria-label={`Talep kalite puanı ${liveScore}`}
        >
          <div className="text-center">
            <p className="text-lg font-semibold tracking-[-0.05em] text-white">
              {liveScore}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-teal-100/40">
              /100
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-teal-100/55">
          {selectedCategory.label}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-teal-100/45">
          {categoryLockedByUser
            ? "Kategori seçildi"
            : `AI · %${aiResult.knowledge.confidence}`}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setAiMetricsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left"
        aria-expanded={aiMetricsOpen}
      >
        <span className="min-w-0 text-xs font-medium leading-5 text-teal-100/65">
          Tahminler · {matchingDisplay.estimatedCompanyCount} firma ·{" "}
          {formatCurrency(aiResult.pricing.min)}–
          {formatCurrency(aiResult.pricing.max)}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-teal-100/40 transition ${
            aiMetricsOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {aiMetricsOpen ? (
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          <div className="talepo-ai-metric rounded-2xl px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-teal-100/40">
              Tahmini fiyat
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-white">
              {formatCurrency(aiResult.pricing.min)} –{" "}
              {formatCurrency(aiResult.pricing.max)}
            </p>
          </div>
          <div className="talepo-ai-metric rounded-2xl px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-teal-100/40">
              Uygun firma
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-white">
              {matchingDisplay.estimatedCompanyCount} firma
            </p>
            <p className="mt-0.5 text-[11px] text-teal-100/40">
              {matchingDisplay.expectedOfferCount} teklif
            </p>
          </div>
        </div>
      ) : null}

      {(companionGaps.length > 0 || realEstateLocationMissing) && (
        <div className="talepo-ai-metric rounded-2xl p-3 sm:p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CircleAlert className="h-3.5 w-3.5 shrink-0 text-teal-300/80" />
              <p className="text-xs font-semibold text-white">
                ~100% için öneriler
              </p>
            </div>
            <p className="text-[10px] tabular-nums text-teal-100/40">
              {liveScore}/100
            </p>
          </div>
          <div className="mt-2.5 space-y-2">
            {realEstateLocationMissing && (
              <div className="talepo-ai-suggestion rounded-xl border border-white/8 bg-white/[0.04] p-2.5">
                <p className="text-xs leading-5 text-teal-100/75">
                  {realEstateLocationError(realEstateLocation) ??
                    "İl / ilçe seçimi eksik."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFiltersOpen(true);
                    setAiCompanionOpen(true);
                  }}
                  className="talepo-ai-suggestion-apply mt-2"
                >
                  Seç
                </button>
              </div>
            )}

            {companionGaps.map((gap) => {
              const inputValue =
                suggestionInputs[gap.id] ?? gap.suggestedValue ?? "";
              const canApply =
                gap.pickerOnly ||
                Boolean(inputValue.trim()) ||
                gap.field === "city";

              return (
                <div
                  key={gap.id}
                  className="talepo-ai-suggestion rounded-xl border border-white/8 bg-white/[0.04] p-2.5"
                >
                  <p className="text-xs font-medium leading-5 text-teal-50/90">
                    {gap.title}
                  </p>
                  {gap.description ? (
                    <p className="mt-0.5 text-[11px] leading-4 text-teal-100/40">
                      {gap.description}
                    </p>
                  ) : null}

                  {gap.pickerOnly ? (
                    <button
                      type="button"
                      onClick={() => applyCompanionGap(gap)}
                      className="talepo-ai-suggestion-apply mt-2"
                    >
                      Seç
                    </button>
                  ) : (
                    <div className="mt-2 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
                      {gap.inputType === "select" ? (
                        <select
                          value={inputValue}
                          onChange={(event) =>
                            setSuggestionInputs((current) => ({
                              ...current,
                              [gap.id]: event.target.value,
                            }))
                          }
                          className="talepo-ai-suggestion-input"
                        >
                          <option value="">Seçiniz</option>
                          {gap.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={gap.inputType === "number" ? "number" : "text"}
                          value={inputValue}
                          onChange={(event) =>
                            setSuggestionInputs((current) => ({
                              ...current,
                              [gap.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              applyCompanionGap(gap, inputValue);
                            }
                          }}
                          placeholder={gap.placeholder ?? "Değer girin"}
                          className="talepo-ai-suggestion-input"
                        />
                      )}
                      <button
                        type="button"
                        disabled={!canApply}
                        onClick={() => applyCompanionGap(gap, inputValue)}
                        className="talepo-ai-suggestion-apply disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Uygula
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {companionGaps.length === 0 &&
        missingFields.length === 0 &&
        !realEstateLocationMissing &&
        hasText && (
          <div className="flex items-center gap-2 rounded-xl border border-teal-300/25 bg-teal-400/10 px-3 py-2.5 text-xs font-medium text-teal-100">
            <Check className="h-3.5 w-3.5 shrink-0" />
            {liveScore >= 100
              ? "Tüm alanlar tamam · skor 100/100"
              : `Bilgiler tamam · skor ${liveScore}/100`}
          </div>
        )}

      <div className="talepo-ai-version rounded-2xl p-3.5">
        <div className="flex items-center gap-2 pl-1">
          <FileText className="h-3.5 w-3.5 shrink-0 text-[#0f766e]/70" />
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal-800/55">
            Firmalara gidecek metin
          </p>
          <WandSparkles className="ml-auto h-3.5 w-3.5 shrink-0 text-[#0f766e]/45" />
        </div>
        <p className="talepo-ai-firm-text mt-2 max-h-28 overflow-y-auto overflow-x-hidden whitespace-pre-line break-words rounded-xl bg-[#f7faf9] px-3 py-2.5 text-xs leading-6 text-teal-950/65">
          {professionalText}
        </p>
      </div>

      <p className="flex items-start gap-2 px-0.5 text-[10px] leading-4 text-teal-100/35">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Tahminler bilgilendirme amaçlıdır. Acil tercih yayın sırasında sorulur.
      </p>
    </div>
  );

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#eef3f2] text-[#0f1f1d]">
      {/* Atmospheric marketplace backdrop — soft, corporate, non-competing */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(165deg,#e8f1ef_0%,#f4f7f6_42%,#eef2f6_100%)]" />
        <div className="absolute -left-[18%] top-[-8%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.14)_0%,transparent_68%)] blur-2xl" />
        <div className="absolute -right-[12%] top-[12%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle_at_center,rgba(13,148,136,0.1)_0%,transparent_70%)] blur-2xl" />
        <div className="absolute bottom-[-10%] left-[30%] h-[420px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(15,31,29,0.05)_0%,transparent_72%)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(15,118,110,0.09) 0.8px, transparent 0.8px)",
            backgroundSize: "22px 22px",
            maskImage:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 45%, transparent 78%)",
            WebkitMaskImage:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 45%, transparent 78%)",
          }}
        />
        {/* Soft abstract listing shapes — decorative only */}
        <svg
          className="absolute right-[-4%] top-[140px] hidden h-[340px] w-[340px] text-[#0f766e] opacity-[0.07] lg:block"
          viewBox="0 0 320 320"
          fill="none"
        >
          <rect x="48" y="40" width="180" height="220" rx="28" stroke="currentColor" strokeWidth="2" />
          <rect x="88" y="72" width="160" height="200" rx="24" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
          <path d="M112 118h112M112 148h88M112 178h96" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.45" />
          <circle cx="248" cy="248" r="42" stroke="currentColor" strokeWidth="2" />
          <path d="M232 248h32M248 232v32" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
        </svg>
        <svg
          className="absolute left-[-6%] top-[220px] hidden h-[280px] w-[280px] text-[#0f1f1d] opacity-[0.045] lg:block"
          viewBox="0 0 280 280"
          fill="none"
        >
          <circle cx="140" cy="140" r="110" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="140" cy="140" r="72" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
          <path d="M140 54v172M54 140h172" stroke="currentColor" strokeWidth="1" opacity="0.35" />
        </svg>
      </div>

      <header className="sticky top-0 z-40 border-b border-teal-900/[0.07] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto grid h-14 max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="justify-self-start">
            {wizardStep === 2 ? (
              <button
                type="button"
                onClick={goToStep1}
                className="talepo-cloud-pill px-3 py-2 text-sm font-medium text-[#0f1f1d]/72 transition hover:border-teal-800/15 hover:text-[#0f1f1d] sm:px-3.5"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="hidden sm:inline">Geri</span>
              </button>
            ) : (
              <Link
                href="/panel"
                className="talepo-cloud-pill px-3 py-2 text-sm font-medium text-[#0f1f1d]/72 transition hover:border-teal-800/15 hover:text-[#0f1f1d] sm:px-3.5"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="hidden sm:inline">Panele dön</span>
              </Link>
            )}
          </div>

          <Link href="/" aria-label="Talepo ana sayfa" className="shrink-0">
            <span className="text-[1.35rem] font-semibold tracking-[-0.05em] text-[#0f1f1d] sm:text-[1.45rem]">
              tale
              <span className="text-[#0f766e]">po</span>
            </span>
          </Link>

          <div className="justify-self-end">
            <span className="inline-flex items-center rounded-full border border-teal-900/[0.08] bg-teal-50/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-teal-900/45">
              Adım {wizardStep}/2
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 py-4 sm:px-6 lg:px-8">
        {wizardStep === 1 ? (
          <>
            <section className="talepo-rise mx-auto max-w-2xl py-7 text-center sm:py-9">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-teal-800/40">
                Yeni talep · Adım 1
              </p>
              <h1 className="mt-3 text-[1.85rem] font-semibold tracking-[-0.045em] text-[#0f1f1d] sm:text-[2.35rem]">
                İhtiyacınızı yazın
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-teal-950/48 sm:text-[15px] sm:leading-7">
                Kısa ve net anlatın. AI başlık, kategori ve alanları önerir —
                siz onaylamadan yayınlanmaz.
              </p>
            </section>

            <div className="mx-auto max-w-2xl space-y-4">
              <div
                className={`talepo-rise talepo-rise-delay-1 rounded-[1.75rem] border bg-white/80 p-4 shadow-[0_16px_48px_rgba(15,31,29,0.05)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300 sm:p-6 ${
                  composerFocused
                    ? "border-[#0f766e]/28 shadow-[0_20px_56px_rgba(15,118,110,0.1)]"
                    : "border-teal-900/8"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3 px-1">
                  <label
                    htmlFor="talep-composer"
                    className="text-[11px] font-medium uppercase tracking-[0.18em] text-teal-950/40"
                  >
                    İhtiyaç
                  </label>
                  {categoryLockedByUser ? (
                    <span className="rounded-full border border-[#0f766e]/15 bg-[#f0fdfa] px-2.5 py-1 text-[11px] font-medium text-[#115e59]">
                      {getCategoryById(activeCategoryId).label}
                    </span>
                  ) : hasText || categoryOverride ? (
                    <span className="text-[11px] tracking-[0.02em] text-teal-800/45">
                      {selectedCategory.label}
                      {categoryOverride && !hasText ? " · ipucu" : ""}
                    </span>
                  ) : null}
                </div>

                <textarea
                  id="talep-composer"
                  value={requestText}
                  onFocus={() => setComposerFocused(true)}
                  onBlur={() => setComposerFocused(false)}
                  onChange={(event) => {
                    const nextText = event.target.value;
                    setRequestText(nextText);
                    // Soft URL hint yields to AI once the user edits the need text.
                    releaseSoftCategoryHint();
                    setManualValues({});
                    setCommonDraft((current) => ({
                      title: titleManuallyEdited ? current.title : "",
                      quantity: "",
                      city: "",
                      delivery: "",
                      budget: "",
                    }));
                    setRealEstateDraft({ il: "", ilce: "", mahalleler: [] });
                    setRealEstateTouched(false);
                    setCityTouched(false);
                    setBudgetTouched(false);
                    setPublishedVersion(null);
                    setPublishError(null);
                  }}
                  className="mt-3 min-h-[220px] w-full resize-y bg-transparent px-1 py-1 text-[17px] leading-8 text-[#0f1f1d] outline-none placeholder:text-[#0f1f1d]/25 sm:min-h-[260px] sm:text-[18px] sm:leading-9"
                  placeholder="Örn. İstanbul’da 50 ofis sandalyesi; temiz ve uygun fiyatlı olsun."
                />

                <div className="mt-2 flex items-center justify-between border-t border-teal-900/6 px-1 pt-3">
                  <p className="text-xs text-teal-950/35">
                    Ne kadar net yazarsanız öneriler o kadar isabetli olur.
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-teal-950/30">
                    {requestText.length}
                  </span>
                </div>
              </div>

              {categoryLockedByUser ? (
                <div className="talepo-rise talepo-rise-delay-2 flex flex-wrap items-center gap-2 px-1">
                  <p className="text-xs text-teal-950/40">
                    Kategori seçili — isterseniz örnek metin ekleyin:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_CHIPS.slice(0, 2).map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => applyExampleChip(example)}
                        className="rounded-full border border-teal-900/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-teal-950/70 transition hover:border-[#0f766e]/25 hover:bg-[#f0fdfa]"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="talepo-rise talepo-rise-delay-2 px-1">
                  <p className="text-xs font-medium text-teal-950/40">
                    Örneklerle başlayın
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {EXAMPLE_CHIPS.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => applyExampleChip(example)}
                        className="rounded-full border border-teal-900/10 bg-white/70 px-3.5 py-2 text-left text-xs font-medium text-teal-950/70 backdrop-blur-sm transition hover:border-[#0f766e]/25 hover:bg-[#f0fdfa] hover:text-[#0f1f1d]"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!canContinue}
                onClick={goToStep2}
                className="talepo-rise talepo-rise-delay-3 flex min-h-[52px] w-full items-center justify-between rounded-2xl bg-[#0f766e] px-5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(15,118,110,0.22)] transition hover:bg-[#0d6a63] disabled:cursor-not-allowed disabled:bg-teal-900/20 disabled:shadow-none"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 opacity-90" />
                  {canContinue ? "Önerileri göster" : "Devam etmek için yazın"}
                </span>
                <ArrowRight className="h-4 w-4 opacity-80" />
              </button>
              {!canContinue && hasText ? (
                <p className="text-center text-xs text-teal-950/40">
                  Biraz daha detay ekleyin (en az birkaç kelime).
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <section className="talepo-rise mx-auto max-w-3xl py-5 text-center sm:py-7">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-teal-800/40">
                Onay · Adım 2
              </p>
              <h1 className="mt-2.5 text-[1.65rem] font-semibold tracking-[-0.045em] text-[#0f1f1d] sm:text-[2rem]">
                Özeti kontrol edin
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-teal-950/48">
                AI alanları doldurdu. Kritik bilgileri düzenleyip tek tıkla
                yayınlayın.
              </p>
            </section>

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:gap-7">
              <section className="space-y-4 sm:space-y-5">
                <div className="talepo-rise talepo-rise-delay-1 rounded-[1.75rem] border border-teal-900/8 bg-white/95 p-4 shadow-[0_16px_48px_rgba(15,31,29,0.05)] sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-800/40">
                        AI özeti
                      </p>
                      <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[#0f1f1d]">
                        Yayınlanacak talep
                      </h2>
                    </div>
                    <div className="inline-flex h-9 items-center gap-2 rounded-full border border-[#0f766e]/12 bg-[#f0fdfa] px-3">
                      <span className="text-sm font-medium text-[#115e59]">
                        {selectedCategory.label}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#0f766e]/55">
                        {categoryLockedByUser ? "Seçildi" : "AI"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
                    {essentialCommonFields.map(renderCommonField)}

                    <label className="sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-medium text-teal-950/45">
                        Kategori
                      </span>
                      <select
                        value={activeCategoryId}
                        onChange={(event) => {
                          const next = event.target.value;
                          if (next === detectedCategoryId) {
                            setCategoryOverride(null);
                            setCategoryLockedByUser(false);
                          } else {
                            setCategoryOverride(next);
                            setCategoryLockedByUser(true);
                          }
                          setManualValues({});
                          setPublishedVersion(null);
                        }}
                        className="h-11 w-full rounded-xl border border-teal-900/10 bg-[#fafcfb] px-3.5 text-sm outline-none transition focus:border-[#0f766e]/35 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.08)]"
                      >
                        {REQUEST_CATEGORIES.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                            {category.id === detectedCategoryId ? " · AI" : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    {(() => {
                      const budgetField = visibleCommonFields.find(
                        (field) => field.key === "budget",
                      );
                      return budgetField ? renderCommonField(budgetField) : null;
                    })()}

                    {requiredDynamicFields.map((field) => (
                      <DynamicFieldInput
                        key={`${activeCategoryId}-${field.key}`}
                        field={{
                          ...field,
                          required: true,
                        }}
                        value={dynamicValues[field.key] ?? ""}
                        onChange={(value) => updateDynamicField(field.key, value)}
                      />
                    ))}
                  </div>

                  {/* Missing-only quick filters — filled AI/need-text fields stay hidden */}
                  <div className="mt-4 border-t border-teal-900/6 pt-4">
                    {hasMissingQuickFilters ? (
                      <div className="rounded-2xl border border-teal-900/8 bg-[#f7faf9] p-3 sm:p-4">
                        <button
                          type="button"
                          onClick={() => setFiltersOpen((open) => !open)}
                          className="flex w-full items-center justify-between gap-3 text-left"
                          aria-expanded={filtersOpen}
                        >
                          <span className="flex items-center gap-2.5">
                            <SlidersHorizontal className="h-4 w-4 text-[#0f766e]" />
                            <span className="text-sm font-semibold text-[#0f1f1d]">
                              Hızlı filtreler
                            </span>
                            <span className="text-xs text-teal-950/45">
                              Yalnızca eksik alanlar
                            </span>
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 text-teal-950/35 transition ${
                              filtersOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {filtersOpen ? (
                          <div className="mt-3 space-y-3 border-t border-teal-900/6 pt-3">
                            {showCityQuickFilter ? (
                              <div>
                                <p className="text-xs font-semibold text-teal-900/55">
                                  Hızlı şehir
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {QUICK_CITIES.map((city) => {
                                    const active = filterCityValue === city;
                                    return (
                                      <button
                                        key={city}
                                        type="button"
                                        onClick={() =>
                                          applyCityFilter(active ? "" : city)
                                        }
                                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                          active
                                            ? "bg-[#0f766e] text-white"
                                            : "border border-teal-900/10 bg-white text-teal-950/70 hover:border-teal-700/25"
                                        }`}
                                      >
                                        {city}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}

                            {showBudgetQuickFilter ? (
                              <div>
                                <p className="text-xs font-semibold text-teal-900/55">
                                  Bütçe aralığı
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {BUDGET_PRESETS.map((preset) => {
                                    const active =
                                      activeBudgetPresetId === preset.id;
                                    return (
                                      <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() =>
                                          applyBudgetPreset(
                                            active ? "" : preset.value,
                                          )
                                        }
                                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                          active
                                            ? "bg-[#0f766e] text-white"
                                            : "border border-teal-900/10 bg-white text-teal-950/70 hover:border-teal-700/25"
                                        }`}
                                      >
                                        {preset.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}

                            {missingCategoryFilterDefs.length > 0 ? (
                              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                                {missingCategoryFilterDefs.map((def) => {
                                  if (def.input !== "select") {
                                    return (
                                      <label
                                        key={def.param}
                                        className="min-w-[8rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[11rem]"
                                      >
                                        {def.label}
                                        <input
                                          type={
                                            def.input === "number"
                                              ? "number"
                                              : "text"
                                          }
                                          inputMode={
                                            def.input === "number"
                                              ? "numeric"
                                              : undefined
                                          }
                                          value={
                                            dynamicValues[def.fieldKey] ?? ""
                                          }
                                          placeholder={def.placeholder}
                                          onChange={(event) =>
                                            updateDynamicField(
                                              def.fieldKey,
                                              event.target.value,
                                            )
                                          }
                                          className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-white px-3 text-sm outline-none focus:border-teal-600/50"
                                        />
                                      </label>
                                    );
                                  }

                                  const options = getFilterSelectOptions(
                                    activeCategoryId,
                                    def.fieldKey,
                                  );
                                  return (
                                    <label
                                      key={def.param}
                                      className="min-w-[8rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[11rem]"
                                    >
                                      {def.label}
                                      <select
                                        value={
                                          dynamicValues[def.fieldKey] ?? ""
                                        }
                                        onChange={(event) =>
                                          updateDynamicField(
                                            def.fieldKey,
                                            event.target.value,
                                          )
                                        }
                                        className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-white px-3 text-sm outline-none focus:border-teal-600/50"
                                      >
                                        <option value="">Seçiniz</option>
                                        {options.map((option) => (
                                          <option
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-teal-900/6 bg-[#f7faf9] px-4 py-3">
                        <p className="text-sm text-teal-950/55">
                          Temel bilgiler dolu
                        </p>
                        {activeFilterCount > 0 ? (
                          <button
                            type="button"
                            onClick={clearCreateFilters}
                            className="text-xs font-semibold text-teal-800 underline-offset-2 hover:underline"
                          >
                            Filtreleri temizle
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-teal-900/6 pt-4">
                    <button
                      type="button"
                      onClick={() => setOptionalOpen((open) => !open)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                        optionalOpen
                          ? "border-[#0f766e]/30 bg-[#f0fdfa] shadow-[0_0_0_3px_rgba(15,118,110,0.06)]"
                          : "border-teal-900/12 bg-[#fafcfb] hover:border-[#0f766e]/28 hover:bg-[#f0fdfa]"
                      }`}
                      aria-expanded={optionalOpen}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            optionalOpen
                              ? "bg-[#0f766e] text-white"
                              : "bg-white text-[#0f766e] shadow-sm"
                          }`}
                        >
                          <ListPlus className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[#0f1f1d]">
                            Daha fazla ekle
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-teal-950/45">
                            {filledOptionalCount > 0
                              ? `${filledOptionalCount} ek alan · Daha fazla detay, daha hızlı ve doğru teklif`
                              : "İsteğe bağlı · Daha fazla detay, daha hızlı ve doğru teklif"}
                          </span>
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-teal-950/40 transition ${
                          optionalOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {optionalOpen ? (
                      <div className="mt-3 space-y-4">
                        {(hasOptionalFields ||
                          optionalCommonFields.filter((f) => f.key !== "budget")
                            .length > 0) && (
                          <div className="grid gap-3.5 sm:grid-cols-2">
                            {optionalCommonFields
                              .filter((field) => field.key !== "budget")
                              .map(renderCommonField)}
                            {optionalDynamicFields.map((field) => (
                              <DynamicFieldInput
                                key={`${activeCategoryId}-${field.key}`}
                                field={{
                                  ...field,
                                  required: false,
                                }}
                                value={dynamicValues[field.key] ?? ""}
                                onChange={(value) =>
                                  updateDynamicField(field.key, value)
                                }
                              />
                            ))}
                          </div>
                        )}

                        <label className="block rounded-2xl border border-teal-900/8 bg-[#f7faf9] px-4 py-3">
                          <span className="text-xs font-semibold text-teal-900/55">
                            Öne çıkarma (isteğe bağlı)
                          </span>
                          <select
                            value={featureBoost}
                            onChange={(event) =>
                              setFeatureBoost(
                                event.target.value as typeof featureBoost,
                              )
                            }
                            className="mt-2 h-11 w-full rounded-xl border border-teal-900/10 bg-white px-3 text-sm outline-none focus:border-teal-600/50"
                          >
                            <option value="">Öne çıkarma istemiyorum</option>
                            <option value="FEATURE_24H">24 saat · ₺99</option>
                            <option value="FEATURE_3D">3 gün · ₺199</option>
                            <option value="FEATURE_7D">7 gün · ₺349</option>
                          </select>
                          <span className="mt-1.5 block text-[11px] text-teal-950/40">
                            Ödeme yakında. Acil tercih yayınlarken sorulur.
                          </span>
                        </label>
                      </div>
                    ) : null}
                  </div>

                  {publishError ? (
                    <div className="mt-4 rounded-2xl bg-[#ffe4df] p-3.5 text-sm font-medium text-[#8b352b]">
                      {publishError}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={isPublishing}
                    onClick={() => requestPublish("ai")}
                    className="mt-5 flex min-h-[52px] w-full items-center justify-between rounded-2xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white transition hover:bg-[#0a1614] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      {isPublishing ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {isPublishing ? "Yayınlanıyor..." : "Talebimi yayınla"}
                    </span>
                    {!isPublishing ? (
                      <ArrowRight className="h-4 w-4 opacity-80" />
                    ) : null}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={goToStep1}
                  className="text-sm font-medium text-teal-800/55 transition hover:text-[#0f1f1d]"
                >
                  ← İhtiyaç metnini düzenle
                </button>
              </section>

              <aside className="talepo-rise talepo-rise-delay-2 min-w-0 lg:sticky lg:top-4 lg:self-start">
                <div className="talepo-ai-panel rounded-[1.75rem]">
                  <button
                    type="button"
                    className="relative z-[1] flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-4 text-left lg:hidden"
                    onClick={() => setAiCompanionOpen((open) => !open)}
                    aria-expanded={aiCompanionOpen}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f766e] text-white shadow-[0_0_24px_rgba(20,184,166,0.35)]">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/75">
                          <span className="talepo-ai-status-dot" />
                          Talepo AI
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-white">
                          {readinessLabel}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full border border-teal-300/25 bg-teal-400/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-teal-100">
                        {liveScore}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-teal-100/45 transition ${
                          aiCompanionOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  <div
                    className={`relative z-[1] min-w-0 px-3.5 pb-5 sm:px-5 sm:pb-6 lg:block lg:pt-5 ${
                      aiCompanionOpen
                        ? "block border-t border-white/10 pt-4"
                        : "hidden"
                    }`}
                  >
                    {companionBody}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      {urgencyPromptVersion ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f1f1d]/45 px-4 py-6 sm:items-center"
          role="presentation"
          onClick={closeUrgencyPrompt}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="urgency-prompt-title"
            className="w-full max-w-md rounded-[28px] border border-teal-900/10 bg-white p-6 shadow-[0_24px_64px_rgba(15,31,29,0.18)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0fdfa] text-[#0f766e]">
              <Send className="h-6 w-6" />
            </div>
            <h2
              id="urgency-prompt-title"
              className="mt-4 text-xl font-semibold tracking-tight text-[#0f1f1d]"
            >
              Talebinizi yayınlayın
            </h2>
            <p className="mt-2 text-sm leading-6 text-teal-950/50">
              Yayınlamadan önce acil olup olmadığını belirtebilirsiniz.
            </p>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-teal-900/10 bg-[#f7faf9] px-4 py-3.5 transition hover:border-teal-900/16 hover:bg-[#eef6f4]">
              <input
                type="checkbox"
                checked={publishAsUrgent}
                onChange={(event) => setPublishAsUrgent(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-teal-900/20 text-[#0f766e] focus:ring-[#0f766e]/25"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[#0f1f1d]">
                  Bu talep acil
                  <Zap className="h-3.5 w-3.5 text-[#0f766e]" />
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-teal-950/45">
                  İşaretlerseniz tedarikçilere acil alıcı olarak iletilir.
                </span>
              </span>
            </label>

            <p className="mt-3 text-xs leading-5 text-teal-950/40">
              * Acil işaretlemek ücretsizdir. Talebiniz keşif listesinde öne
              çıkar; uygun üyeliklere sahip tedarikçiler acil talepleri öncelikli
              görür.
            </p>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={confirmPublish}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#0f766e] px-4 text-sm font-semibold text-white transition hover:bg-[#0d6a63]"
              >
                Yayınla
              </button>
              <button
                type="button"
                onClick={closeUrgencyPrompt}
                className="flex min-h-[44px] w-full items-center justify-center rounded-2xl px-4 text-sm font-medium text-teal-950/45 transition hover:text-[#0f1f1d]"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function CommonField({
  label,
  value,
  onChange,
  placeholder,
  wide = false,
  money = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
  money?: boolean;
  hint?: string;
}) {
  const fieldClassName =
    "h-11 w-full rounded-xl border border-teal-900/10 bg-[#fafcfb] px-3.5 text-sm outline-none transition focus:border-[#0f766e]/35 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.08)]";

  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-xs font-medium text-teal-950/45">
        {label}
      </span>

      {money ? (
        <TrMoneyInput
          value={value}
          onValueChange={onChange}
          placeholder={placeholder}
          allowFreeText
          className={fieldClassName}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={fieldClassName}
        />
      )}

      {hint ? (
        <span className="mt-1.5 block text-[11px] leading-4 text-[#0f766e]/75">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: DynamicField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-medium text-teal-950/45">
          {field.label}
        </span>

        {field.required && (
          <span className="rounded-full bg-[#fff1ee] px-2 py-0.5 text-[10px] font-semibold text-[#a44b3d]">
            Zorunlu
          </span>
        )}
      </div>

      <div className="relative">
        {field.type === "select" ? (
          <>
            <select
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-teal-900/10 bg-[#fafcfb] px-3.5 pr-10 text-sm outline-none transition focus:border-[#0f766e]/35 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.08)]"
            >
              <option value="">Seçiniz</option>

              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-950/30" />
          </>
        ) : (
          <input
            type={field.type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            className="h-11 w-full rounded-xl border border-teal-900/10 bg-[#fafcfb] px-3.5 pr-12 text-sm outline-none transition focus:border-[#0f766e]/35 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.08)]"
          />
        )}

        {field.unit && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-teal-950/30">
            {field.unit}
          </span>
        )}
      </div>
    </label>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}
