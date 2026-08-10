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
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ListPlus,
  LoaderCircle,
  Send,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";

import { ConversationalStartPanel } from "@/components/request/ConversationalStartPanel";
import { EnrichmentChips } from "@/components/request/EnrichmentChips";
import { PublishSuccessMoment } from "@/components/request/PublishSuccessMoment";
import { RealEstateLocationFields } from "@/components/request/RealEstateLocationFields";
import { RequestProcessStrip } from "@/components/request/RequestProcessStrip";
import { RequestSummaryCard } from "@/components/request/RequestSummaryCard";
import {
  TalepoAiPanel,
  type ClarificationOption,
} from "@/components/request/TalepoAiPanel";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { useRequestBrain } from "@/hooks/useRequestBrain";
import {
  budgetPlaceholderForStrategy,
  formatBudgetFromMedian,
  isBudgetMeaningfulForStrategy,
  isMarketRangeReliable,
} from "@/lib/request-brain/budget-actions";
import { buildCategoryClarification } from "@/lib/request-brain/category-clarification";
import {
  budgetPromptForStrategy,
  toHumanQuestions,
} from "@/lib/request-brain/human-question-layer";
import { computeRequestReadiness } from "@/lib/request-brain/request-readiness";
import type { QuestionCandidate } from "@/lib/request-brain/types";
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
import { understandRequest } from "@/lib/request-understanding/understand-request";
import {
  budgetDisplayFromUnderstanding,
  buildUnderstandingSummary,
  resolveSchemaCategory,
  safeDraftAttributes,
  seedFieldValuesFromUnderstanding,
} from "@/lib/request-understanding/activation-bridge";

type CommonDraft = {
  title: string;
  quantity: string;
  city: string;
  delivery: string;
  budget: string;
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
  "2022 üstü C200 AMG arıyorum, 50 bin km altında olsun",
  "Başakşehir'de 2+1 kiralık ev arıyorum",
  "Dyson V15 sıfır arıyorum",
  "5.000 adet baskılı kutu yaptıracağım",
  "200 m² ofis boya badana yaptıracağım",
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
  const [publishSuccess, setPublishSuccess] = useState<{
    title: string;
    requestId: string | null;
    viewHref: string;
  } | null>(null);
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
  /** Draft values typed in the AI companion suggestion rows (keyed by gap id). */
  const [suggestionInputs, setSuggestionInputs] = useState<
    Record<string, string>
  >({});
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [enrichmentFieldKey, setEnrichmentFieldKey] = useState<string | null>(
    null,
  );
  const [enrichmentDraft, setEnrichmentDraft] = useState("");
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
  const [isAnalyzingStep, setIsAnalyzingStep] = useState(false);
  const [appliedProfessionalDescription, setAppliedProfessionalDescription] =
    useState(false);
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
    }
  }

  if (categoryFromHome !== syncedCategoryFromHome) {
    setSyncedCategoryFromHome(categoryFromHome);
    if (validCategoryFromHome) {
      setCategoryOverride(validCategoryFromHome);
      setCategoryLockedByUser(false);
    }
  }

  const understanding = useMemo(() => {
    try {
      const structuredFields: Record<string, string | null | undefined> = {
        ...manualValues,
      };
      if (cityTouched && commonDraft.city.trim()) {
        structuredFields.city = commonDraft.city.trim();
      }
      if (budgetTouched && commonDraft.budget.trim()) {
        structuredFields.budget = commonDraft.budget.trim();
      }
      if (commonDraft.quantity.trim()) {
        structuredFields.quantity = commonDraft.quantity.trim();
      }

      return understandRequest({
        rawInput: requestText,
        structured: {
          categoryId: categoryLockedByUser ? categoryOverride : null,
          city: cityTouched ? commonDraft.city : null,
          district: realEstateTouched ? realEstateDraft.ilce : null,
          fieldValues: structuredFields,
        },
      });
    } catch (error) {
      console.error("[talep] understandRequest failed", error);
      return understandRequest("");
    }
  }, [
    budgetTouched,
    categoryLockedByUser,
    categoryOverride,
    cityTouched,
    commonDraft.budget,
    commonDraft.city,
    commonDraft.quantity,
    manualValues,
    realEstateDraft.ilce,
    realEstateTouched,
    requestText,
  ]);

  const [liveMatching, setLiveMatching] = useState<{
    estimatedCompanyCount: number;
    expectedOfferCount: number;
  } | null>(null);

  const schemaCategory = resolveSchemaCategory(understanding);
  const detectedCategoryId = schemaCategory.categoryId;
  const categoryConfident =
    categoryLockedByUser || schemaCategory.confident;

  /**
   * CATEGORY_HINT (URL soft) ≠ USER_CATEGORY_OVERRIDE ≠ CANONICAL_CATEGORY
   * Priority: locked override > canonical CONFIDENT/TENTATIVE > soft hint > provisional schema
   */
  const activeCategoryId =
    categoryLockedByUser && categoryOverride
      ? categoryOverride
      : understanding.category.status === "CONFIDENT" &&
          understanding.category.value
        ? understanding.category.value
        : understanding.category.status === "TENTATIVE" &&
            understanding.category.value
          ? understanding.category.value
          : categoryOverride ?? detectedCategoryId;
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

  const understandingCity = understanding.location?.city?.value ?? "";
  const understandingBudgetDisplay = budgetDisplayFromUnderstanding(understanding);
  const understandingQuantity = understanding.quantity?.value?.value;
  const understandingUnit = understanding.quantity?.value?.unit ?? "adet";
  const seededFields = useMemo(
    () => seedFieldValuesFromUnderstanding(understanding),
    [understanding],
  );

  const suggestedRealEstateLocation = useMemo(
    () =>
      resolveRealEstateLocationFromSources({
        parsedCity: commonDraft.city || understandingCity,
        rawText: requestText,
        parsedNeighborhoods: manualValues.neighborhoods,
      }),
    [
      understandingCity,
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
      const seeded = seededFields[field.key];

      values[field.key] =
        manualValues[field.key] ??
        (seeded === undefined || seeded === null ? "" : String(seeded));
    }

    // Also surface needType/model/brand seeds even if not in field list yet
    for (const [key, value] of Object.entries(seededFields)) {
      if (values[key] === undefined || values[key] === "") {
        if (!manualValues[key] && value) values[key] = value;
      }
    }

    return withCategoryFieldDefaults(activeCategoryId, values);
  }, [activeCategoryId, seededFields, manualValues]);

  const autoTitle = useMemo(() => {
    const category = getCategoryById(activeCategoryId);
    return composeRequestTitle({
      categoryId: activeCategoryId,
      rawText: requestText,
      attributes: {
        ...seededFields,
        ...dynamicValues,
      },
      city: commonDraft.city || understandingCity || "",
      quantity: understandingQuantity,
      unit: understandingUnit,
      fields: category.fields,
      fieldValues: dynamicValues,
      commonDraft,
    });
  }, [
    activeCategoryId,
    requestText,
    seededFields,
    understandingCity,
    understandingQuantity,
    understandingUnit,
    dynamicValues,
    commonDraft,
  ]);

  const mergedCommonDraft = useMemo<CommonDraft>(
    () => ({
      title: titleManuallyEdited ? commonDraft.title : autoTitle,
      quantity: visibleCommonFieldKeys.has("quantity")
        ? commonDraft.quantity ||
          (understandingQuantity != null
            ? `${understandingQuantity} ${understandingUnit}`
            : "")
        : "",
      city: isRealEstate
        ? realEstateLocationToCity(realEstateLocation) ||
          commonDraft.city ||
          understandingCity ||
          ""
        : visibleCommonFieldKeys.has("city")
          ? cityTouched
            ? commonDraft.city
            : commonDraft.city || understandingCity || ""
          : "",
      delivery: visibleCommonFieldKeys.has("delivery")
        ? commonDraft.delivery
        : "",
      budget: visibleCommonFieldKeys.has("budget")
        ? budgetTouched
          ? commonDraft.budget
          : commonDraft.budget || understandingBudgetDisplay
        : "",
    }),
    [
      understandingBudgetDisplay,
      understandingCity,
      understandingQuantity,
      understandingUnit,
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
      commonDraft.city || understandingCity || "";
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          rawInput: requestText,
        });
        if (city) params.set("city", city);
        if (categoryLockedByUser && categoryOverride) {
          params.set("category", categoryOverride);
          params.set("categoryLocked", "1");
        }
        const response = await fetch(`/api/matching/estimate?${params}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          ok?: boolean;
          estimatedCompanyCount?: number;
          expectedOfferCount?: number;
          status?: string;
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
    categoryLockedByUser,
    categoryOverride,
    understandingCity,
    canFetchLiveMatching,
    commonDraft.city,
    requestText,
  ]);

  const matchingDisplay = liveMatching ?? {
    estimatedCompanyCount: 0,
    expectedOfferCount: 0,
  };

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

  const draftSafeAttributes = useMemo(
    () => safeDraftAttributes(understanding, { ...seededFields, ...dynamicValues }),
    [understanding, seededFields, dynamicValues],
  );

  const professionalText = composeProfessionalDescription({
    categoryId: activeCategoryId,
    rawText: requestText,
    attributes: draftSafeAttributes,
    city: mergedCommonDraft.city || understandingCity,
    budget: understanding.budget?.value?.max ?? understanding.budget?.value?.min,
    deliveryDays: undefined,
    quantity: understandingQuantity,
    unit: understandingUnit,
    fields: visibleDynamicFields,
    fieldValues: dynamicValues,
    commonDraft: mergedCommonDraft,
    commonFields: visibleCommonFields,
  });

  const requestDraft = useMemo(
    () => ({
      title: mergedCommonDraft.title,
      rawText: requestText,
      categorySlug: activeCategoryId,
      city: mergedCommonDraft.city,
      district: isRealEstate ? realEstateLocation.ilce : null,
      budget: mergedCommonDraft.budget,
      fieldValues: {
        ...dynamicValues,
        ...(mergedCommonDraft.quantity ? { quantity: mergedCommonDraft.quantity } : {}),
        ...(mergedCommonDraft.delivery ? { delivery: mergedCommonDraft.delivery } : {}),
      },
    }),
    [
      activeCategoryId,
      dynamicValues,
      isRealEstate,
      mergedCommonDraft.budget,
      mergedCommonDraft.city,
      mergedCommonDraft.delivery,
      mergedCommonDraft.quantity,
      mergedCommonDraft.title,
      realEstateLocation.ilce,
      requestText,
    ],
  );

  const requiredDynamicKeys = useMemo(
    () =>
      requiredDynamicFields
        .filter((field) => isFieldRequired(field, dynamicValues))
        .map((field) => field.key),
    [dynamicValues, requiredDynamicFields],
  );

  const brain = useRequestBrain({
    draft: requestDraft,
    dynamicFields: visibleDynamicFields,
    requiredDynamicKeys,
    professionalText,
    enabled: wizardStep === 2,
    wizardStep,
    understanding,
    categoryLockedByUser,
  });

  const completenessPct = brain.completeness
    ? Math.round(brain.completeness.score * 100)
    : liveScore;

  const budgetRequired = visibleCommonFieldKeys.has("budget");
  const hasBudget = Boolean(mergedCommonDraft.budget.trim());

  const publishable =
    Boolean(mergedCommonDraft.title.trim()) &&
    (!budgetRequired || hasBudget) &&
    (!visibleCommonFieldKeys.has("city") ||
      Boolean(mergedCommonDraft.city.trim()) ||
      !realEstateLocationMissing) &&
    missingFields.length === 0 &&
    !realEstateLocationMissing;

  const requestSummary = useMemo(() => {
    const fromBrain = buildUnderstandingSummary(understanding);
    // Prefer canonical semantic headline over mechanical title concat
    const semanticHeadline =
      fromBrain.headline && fromBrain.headline !== "Talebiniz"
        ? fromBrain.headline
        : null;
    return {
      headline:
        semanticHeadline ||
        mergedCommonDraft.title.trim() ||
        "Talebiniz",
      chips: fromBrain.chips,
      subtypeLabel: fromBrain.subtypeLabel ?? null,
    };
  }, [understanding, mergedCommonDraft.title]);

  const enrichmentCandidates = useMemo(() => {
    // Optional enrichment only — exclude budget/city and expert-only technical dumps
    return brain.nextQuestions.filter(
      (q) =>
        q.fieldKey !== "budget" &&
        q.fieldKey !== "city" &&
        q.fieldKey !== "specs" &&
        q.fieldKey !== "technicalSpecs",
    );
  }, [brain.nextQuestions]);

  const readiness = useMemo(
    () =>
      computeRequestReadiness({
        hasTitle: Boolean(mergedCommonDraft.title.trim()),
        budgetRequired,
        hasBudget,
        locationBlocked: realEstateLocationMissing,
        locationBlockedReason: isRealEstate
          ? realEstateLocationError(realEstateLocation) ?? undefined
          : undefined,
        missingRequiredPublishFields: missingFields.map((f) => f.label),
        enrichableCount: enrichmentCandidates.length,
        completeness: brain.completeness,
      }),
    [
      brain.completeness,
      budgetRequired,
      enrichmentCandidates.length,
      hasBudget,
      isRealEstate,
      mergedCommonDraft.title,
      missingFields,
      realEstateLocation,
      realEstateLocationMissing,
    ],
  );

  const topEnrichment = enrichmentCandidates[0] ?? null;

  const humanQuestions = useMemo(
    () =>
      toHumanQuestions(enrichmentCandidates, {
        strategy: brain.strategy?.strategy,
        requiredDynamicKeys,
        dynamicFields: visibleDynamicFields,
        maxVisible: 3,
      }),
    [
      brain.strategy?.strategy,
      enrichmentCandidates,
      requiredDynamicKeys,
      visibleDynamicFields,
    ],
  );

  const categoryClarification = useMemo(
    () =>
      buildCategoryClarification({
        rawText: requestText,
        categoryId: understanding.category.value ?? detectedCategoryId,
        categoryConfident,
      }),
    [categoryConfident, detectedCategoryId, requestText, understanding.category.value],
  );

  const budgetCopy = budgetPromptForStrategy(brain.strategy?.strategy);

  function applyClarification(option: ClarificationOption) {
    if (option.categoryId) {
      setCategoryOverride(option.categoryId);
      setCategoryLockedByUser(true);
    }
    if (option.fieldKey && option.value != null) {
      setManualValues((current) => ({
        ...current,
        [option.fieldKey!]: option.value!,
      }));
    }
  }

  function applyHumanQuestionValue(
    question: QuestionCandidate,
    value?: string,
  ) {
    if (value === "bilmiyorum" || value === "fark-etmez") {
      setManualValues((current) => ({
        ...current,
        [question.fieldKey]:
          value === "fark-etmez" ? "Fark etmez" : "Belirtilmedi",
      }));
      return;
    }
    if (value != null && value !== "") {
      if (question.fieldKey === "budget") {
        updateCommonField("budget", value);
        return;
      }
      if (question.fieldKey === "city") {
        updateCommonField("city", value);
        return;
      }
      setManualValues((current) => ({
        ...current,
        [question.fieldKey]: value,
      }));
      return;
    }
    setEnrichmentFieldKey(question.fieldKey);
    setEnrichmentDraft("");
  }

  const marketHint =
    brain.marketIntelligence?.marketRange &&
    isMarketRangeReliable({
      marketMedian: brain.marketIntelligence.marketRange.median,
      overallConfidenceLevel:
        brain.marketIntelligence.overallConfidence?.level,
    })
      ? `${formatBudgetFromMedian(brain.marketIntelligence.marketRange.low)} – ${formatBudgetFromMedian(brain.marketIntelligence.marketRange.high)}`
      : null;

  const showLocationPrompt =
    !isRealEstate &&
    visibleCommonFieldKeys.has("city") &&
    !mergedCommonDraft.city.trim();

  const showBudgetActions =
    visibleCommonFieldKeys.has("budget") &&
    isBudgetMeaningfulForStrategy(brain.strategy?.strategy) &&
    isMarketRangeReliable({
      marketMedian: brain.marketIntelligence?.marketRange?.median,
      overallConfidenceLevel: brain.marketIntelligence?.overallConfidence?.level,
    });

  const readinessLabel = readiness.message;

  const hasText = requestText.trim().length > 0;
  const canContinue = requestText.trim().length >= 8;

  function goToStep2() {
    if (!canContinue || isPublishing || isAnalyzingStep) return;
    releaseSoftCategoryHint();
    setPublishError(null);
    setPublishedVersion(null);
    setOptionalOpen(false);
    setFiltersOpen(false);
    setEnrichmentFieldKey(null);
    setEnrichmentDraft("");
    setAiCompanionOpen(true);
    setIsAnalyzingStep(true);
    brain.setAnalysisStatus("PARSING");
    window.setTimeout(() => {
      setWizardStep(2);
      setIsAnalyzingStep(false);
      brain.setAnalysisStatus("READY_FOR_REVIEW");
    }, 450);
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

  function applyBrainQuestion(question: QuestionCandidate, rawValue: string) {
    const field = question.fieldKey;
    const typed = rawValue.trim();

    if (field === "deliveryDays" || field === "delivery") {
      updateCommonField("delivery", /^\d+$/.test(typed) ? `${typed} gün` : typed);
      return;
    }
    if (field === "city") {
      if (typed) applyCityFilter(typed);
      return;
    }
    if (field === "quantity" || field === "budget" || field === "title") {
      updateCommonField(field, typed);
      return;
    }
    updateDynamicField(field, typed);
  }

  const filterCityValue = isRealEstate
    ? realEstateLocation.il
    : mergedCommonDraft.city.trim();
  const filterBudgetValue = mergedCommonDraft.budget.trim();
  /** AI/need-text already provided city — hide city chips even if form looks empty briefly. */
  const cityFilledFromAi =
    !cityTouched && Boolean(understandingCity.trim());
  const budgetFilledFromAi =
    !budgetTouched && Boolean(understandingBudgetDisplay.trim());
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

    if (!mergedCommonDraft.title.trim()) {
      setPublishError("Talebinizi yayınlamak için bir başlık gerekli.");
      return;
    }

    if (budgetRequired && !hasBudget) {
      setPublishError("Bütçenizi belirtmeniz yeterli — ardından yayınlayabilirsiniz.");
      return;
    }

    if (isRealEstate) {
      const locationError = realEstateLocationError(realEstateLocation);
      if (locationError) {
        setPublishedVersion(version);
        setPublishError(locationError);
        return;
      }
    }

    if (missingFields.length > 0) {
      setPublishError(
        `Yayın için şu bilgiye ihtiyacımız var: ${missingFields[0]!.label}`,
      );
      setOptionalOpen(true);
      return;
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
    brain.setAnalysisStatus("PUBLISHING");

    const descriptionForPublish =
      appliedProfessionalDescription || version === "ai"
        ? professionalText
        : requestText.trim();

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: mergedCommonDraft.title,
          description: descriptionForPublish,
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
          aiScore: completenessPct,
          aiSummary: [
            `Kategori: ${selectedCategory.label}`,
            `AI güveni: %${Math.round(understanding.understandingConfidence * 100)}`,
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
        id?: string;
        request?: { id?: string };
      };

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/giris?callbackUrl=${encodeURIComponent("/talep")}`);
          return;
        }

        throw new Error(result.message || "Talep yayınlanamadı.");
      }

      const requestId =
        result.id ?? result.request?.id ?? null;
      const viewHref =
        result.redirectTo ||
        (requestId ? `/panel/taleplerim/${requestId}` : "/panel/taleplerim");

      setIsPublishing(false);
      brain.setAnalysisStatus("PUBLISHED");
      setPublishSuccess({
        title: mergedCommonDraft.title,
        requestId,
        viewHref,
      });
      router.refresh();
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "Talep yayınlanırken bir hata oluştu.",
      );
      setIsPublishing(false);
      brain.setAnalysisStatus("READY_FOR_REVIEW");
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

  const aiPanelContent = (
    <TalepoAiPanel
      analysisStatus={brain.analysisStatus}
      categoryLabel={
        requestSummary.subtypeLabel
          ? `${selectedCategory.label} · ${requestSummary.subtypeLabel}`
          : selectedCategory.label
      }
      categoryConfident={categoryConfident}
      readiness={readiness}
      marketIntelligence={brain.marketIntelligence}
      previewError={brain.previewError}
      understoodHeadline={
        requestSummary.headline !== "Talebiniz"
          ? requestSummary.headline
          : mergedCommonDraft.title || selectedCategory.label
      }
      understoodChips={requestSummary.chips}
      humanQuestions={humanQuestions}
      clarification={
        wizardStep === 2 || hasText ? categoryClarification : null
      }
      onClarificationSelect={applyClarification}
      onApplyHumanQuestion={applyHumanQuestionValue}
      showBudgetActions={showBudgetActions}
      onKeepBudget={() => setBudgetTouched(true)}
      onUseMarketMedian={() => {
        const median = brain.marketIntelligence?.marketRange?.median;
        if (median == null) return;
        setBudgetTouched(true);
        updateCommonField("budget", formatBudgetFromMedian(median));
      }}
      professionalText={professionalText}
      professionalPreviewOpen={brain.professionalPreviewOpen}
      onToggleProfessionalPreview={() =>
        brain.setProfessionalPreviewOpen(!brain.professionalPreviewOpen)
      }
      onApplyProfessionalDraft={() => {
        setAppliedProfessionalDescription(true);
        brain.setProfessionalDraftApplied(true);
      }}
      matchingFirmCount={matchingDisplay.estimatedCompanyCount}
    />
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
            {wizardStep === 2 ? (
              <span className="inline-flex items-center rounded-full border border-[#0f766e]/12 bg-[#f0fdfa] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#115e59]">
                Hazırlanıyor
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-teal-900/[0.08] bg-teal-50/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-teal-900/45">
                Yeni talep
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 py-4 sm:px-6 lg:px-8">
        {publishSuccess ? (
          <PublishSuccessMoment
            title={publishSuccess.title}
            requestId={publishSuccess.requestId}
            viewHref={publishSuccess.viewHref}
            onNewRequest={() => {
              setPublishSuccess(null);
              setPublishedVersion(null);
              setPublishError(null);
              setRequestText("");
              setWizardStep(1);
              brain.setAnalysisStatus("IDLE");
              setManualValues({});
              setCommonDraft({
                title: "",
                quantity: "",
                city: "",
                delivery: "",
                budget: "",
              });
              setCategoryOverride(null);
              setCategoryLockedByUser(false);
            }}
          />
        ) : wizardStep === 1 ? (
          <>
            <section className="talepo-rise mx-auto max-w-3xl py-5 text-center sm:py-7">
              <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-[#0f1f1d] sm:text-[2.55rem]">
                Ne arıyorsanız{" "}
                <span className="text-[#0f766e]">anlatın.</span>
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-base font-medium leading-7 text-[#0f766e] sm:text-lg">
                Talepo talebinizi sizinle birlikte hazırlasın.
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-teal-950/48">
                Nasıl yazdığınız önemli değil. Bildiğiniz kadarıyla anlatın;
                Talepo ihtiyacınızı anlasın, önemli detaylarda size yardımcı
                olsun.
              </p>
            </section>

            <div className="talepo-rise talepo-rise-delay-1 mx-auto mb-5 hidden max-w-3xl lg:block">
              <RequestProcessStrip />
            </div>

            <div className="mx-auto grid max-w-[1180px] items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] lg:gap-7">
              <div className="flex flex-col gap-4">
                <div
                  className={`talepo-rise talepo-rise-delay-1 order-1 rounded-[1.75rem] border bg-white/90 p-4 shadow-[0_16px_48px_rgba(15,31,29,0.05)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300 sm:p-5 ${
                    composerFocused
                      ? "border-[#0f766e]/28 shadow-[0_20px_56px_rgba(15,118,110,0.1)]"
                      : "border-teal-900/8"
                  }`}
                >
                  <label
                    htmlFor="talep-composer"
                    className="block text-sm font-semibold text-[#0f1f1d]"
                  >
                    Ne arıyorsunuz?
                  </label>

                  <textarea
                    id="talep-composer"
                    value={requestText}
                    onFocus={() => setComposerFocused(true)}
                    onBlur={() => setComposerFocused(false)}
                    onChange={(event) => {
                      const nextText = event.target.value;
                      setRequestText(nextText);
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
                    className="mt-3 min-h-[140px] w-full resize-y bg-transparent text-[16px] leading-7 text-[#0f1f1d] outline-none placeholder:text-[#0f1f1d]/28 sm:min-h-[160px] sm:text-[17px] sm:leading-8"
                    placeholder="Örn. 2022 üzeri Mercedes C200 AMG arıyorum, 50 bin km altında olsun..."
                  />

                  <ul className="mt-3 flex flex-col gap-1.5 border-t border-teal-900/6 pt-3 text-xs text-teal-950/50 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                    <li className="inline-flex items-center gap-1.5">
                      <span className="text-[#0f766e]">✓</span> Yazım hatası sorun
                      değil
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span className="text-[#0f766e]">✓</span> Kendi
                      cümlelerinizle yazın
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span className="text-[#0f766e]">✓</span> Bilmediğiniz
                      detayları bilmek zorunda değilsiniz
                    </li>
                  </ul>
                </div>

                {/* Live understood preview — mobile / below input */}
                {canContinue && requestSummary.chips.length > 0 ? (
                  <div className="talepo-rise order-2 rounded-[1.25rem] border border-[#0f766e]/15 bg-[#f0fdfa]/70 px-4 py-3 lg:hidden">
                    <p className="text-xs font-medium text-[#0f766e]">Anladım ✓</p>
                    <p className="mt-1 text-sm font-semibold text-[#0f1f1d]">
                      {requestSummary.headline}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {requestSummary.chips.slice(0, 5).map((chip) => (
                        <span
                          key={chip.fieldKey}
                          className="rounded-full border border-teal-900/10 bg-white px-2.5 py-1 text-[11px] text-teal-950/75"
                        >
                          {chip.displayValue}
                        </span>
                      ))}
                      <span className="rounded-full border border-teal-900/10 bg-white px-2.5 py-1 text-[11px] text-teal-950/55">
                        {categoryConfident
                          ? selectedCategory.label
                          : "Birlikte netleştirelim"}
                      </span>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={!canContinue || isAnalyzingStep}
                  onClick={goToStep2}
                  className="talepo-rise talepo-rise-delay-3 order-3 flex min-h-[52px] w-full items-center justify-between rounded-2xl bg-[#0f766e] px-5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(15,118,110,0.22)] transition hover:bg-[#0d6a63] disabled:cursor-not-allowed disabled:bg-teal-900/20 disabled:shadow-none lg:order-4"
                >
                  <span className="flex items-center gap-2">
                    {isAnalyzingStep ? (
                      <LoaderCircle className="h-4 w-4 animate-spin opacity-90" />
                    ) : (
                      <Sparkles className="h-4 w-4 opacity-90" />
                    )}
                    {isAnalyzingStep
                      ? "Talebinizi hazırlıyorum..."
                      : canContinue
                        ? "Talebimi hazırla"
                        : "Yazmaya başlayın"}
                  </span>
                  <ArrowRight className="h-4 w-4 opacity-80" />
                </button>

                <div className="talepo-rise talepo-rise-delay-2 order-4 px-0.5 lg:order-3">
                  <p className="text-xs font-medium text-teal-950/40">
                    Nasıl yazabilirsiniz?
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

                <div className="talepo-rise order-5 lg:hidden">
                  <RequestProcessStrip />
                </div>

                {!hasText ? (
                  <details className="talepo-rise order-6 group rounded-[1.25rem] border border-teal-900/8 bg-white/80 lg:hidden">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-teal-950/55 marker:content-none [&::-webkit-details-marker]:hidden">
                      Nasıl çalışıyor?
                      <span className="float-right text-teal-800/35 group-open:hidden">
                        +
                      </span>
                      <span className="float-right hidden text-teal-800/35 group-open:inline">
                        −
                      </span>
                    </summary>
                    <div className="border-t border-teal-900/6 px-1 pb-2">
                      <ConversationalStartPanel
                        hasInput={false}
                        understood={false}
                        headline=""
                        chips={[]}
                        categoryLabel=""
                        enrichmentHints={[]}
                        embedded
                      />
                    </div>
                  </details>
                ) : null}
              </div>

              <aside className="talepo-rise talepo-rise-delay-2 hidden lg:block lg:sticky lg:top-20">
                <ConversationalStartPanel
                  hasInput={hasText}
                  understood={
                    canContinue &&
                    (requestSummary.chips.length > 0 ||
                      Boolean(mergedCommonDraft.title.trim()) ||
                      understanding.understandingConfidence >= 0.35)
                  }
                  headline={
                    requestSummary.headline !== "Talebiniz"
                      ? requestSummary.headline
                      : mergedCommonDraft.title ||
                        (categoryConfident
                          ? selectedCategory.label
                          : "Talebinizi netleştirelim")
                  }
                  chips={requestSummary.chips}
                  categoryLabel={
                    categoryConfident && schemaCategory.displayLabelSafe
                      ? selectedCategory.label
                      : "Birlikte netleştirelim"
                  }
                  enrichmentHints={enrichmentCandidates
                    .slice(0, 2)
                    .map((q) => q.label)}
                />
              </aside>
            </div>
          </>
        ) : (
          <>
            <section className="talepo-rise mx-auto max-w-3xl py-5 text-center sm:py-7">
              <h1 className="mt-0.5 text-[1.65rem] font-semibold tracking-[-0.045em] text-[#0f1f1d] sm:text-[2rem]">
                Talebinizi böyle anladım ✓
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-teal-950/48">
                Verdiğiniz bilgilerle talebinizi hazırladık. İsterseniz önerilen
                birkaç detayı daha ekleyebilirsiniz.
              </p>
            </section>

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] lg:gap-7">
              <section className="space-y-4 sm:space-y-5">
                <div className="talepo-rise talepo-rise-delay-1 space-y-4">
                  <RequestSummaryCard
                    headline={requestSummary.headline}
                    chips={requestSummary.chips}
                    categoryLabel={selectedCategory.label}
                    onEditChip={(fieldKey) => {
                      if (fieldKey === "city") {
                        setFiltersOpen(true);
                        return;
                      }
                      const q =
                        enrichmentCandidates.find((c) => c.fieldKey === fieldKey) ??
                        ({
                          fieldKey,
                          label: fieldKey,
                          reason: "",
                          publishImpact: 0,
                          matchingImpact: 0,
                          priceImpact: 0,
                          confidenceImpact: 0,
                          priorityScore: 0,
                          inputType: "text" as const,
                        } satisfies QuestionCandidate);
                      setEnrichmentFieldKey(fieldKey);
                      setEnrichmentDraft(dynamicValues[fieldKey] ?? "");
                      if (!enrichmentCandidates.some((c) => c.fieldKey === fieldKey)) {
                        // open advanced if editing a filled field not in enrichment list
                        setOptionalOpen(true);
                      }
                      void q;
                    }}
                    onRemoveChip={(fieldKey) => {
                      if (fieldKey === "city") {
                        applyCityFilter("");
                        return;
                      }
                      if (fieldKey === "quantity") {
                        updateCommonField("quantity", "");
                        return;
                      }
                      updateDynamicField(fieldKey, "");
                    }}
                  />

                  {/* Title edit (subtle) */}
                  <div className="rounded-[1.25rem] border border-teal-900/6 bg-white/70 px-4 py-3">
                    <label className="block">
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-950/35">
                        Başlık
                      </span>
                      <input
                        value={mergedCommonDraft.title}
                        onChange={(e) => updateCommonField("title", e.target.value)}
                        className="mt-1.5 h-10 w-full bg-transparent text-sm font-medium text-[#0f1f1d] outline-none"
                        placeholder="Talep başlığı"
                      />
                    </label>
                    <label className="mt-3 block border-t border-teal-900/6 pt-3">
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-950/35">
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
                        className="mt-1.5 h-10 w-full rounded-lg border border-teal-900/8 bg-[#fafcfb] px-2.5 text-sm outline-none"
                      >
                        {REQUEST_CATEGORIES.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                            {category.id === detectedCategoryId ? " · AI" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Budget — required, natural prompt */}
                  {budgetRequired ? (
                    <div className="rounded-[1.5rem] border border-teal-900/8 bg-white/95 p-5 sm:p-6">
                      <h3 className="text-base font-semibold tracking-tight text-[#0f1f1d]">
                        {budgetCopy.title}
                      </h3>
                      {marketHint ? (
                        <p className="mt-1.5 text-sm text-teal-950/48">
                          Piyasa referansı: {marketHint}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-sm text-teal-950/48">
                          {budgetCopy.helper}
                        </p>
                      )}
                      <div className="mt-4">
                        <TrMoneyInput
                          value={mergedCommonDraft.budget}
                          onValueChange={(value) =>
                            updateCommonField("budget", value)
                          }
                          allowFreeText
                          placeholder={budgetPlaceholderForStrategy(
                            brain.strategy?.strategy,
                          )}
                          className="h-12 w-full rounded-xl border border-teal-900/10 bg-[#fafcfb] px-3.5 text-sm outline-none focus:border-[#0f766e]/35 focus:bg-white"
                        />
                      </div>
                      {showBudgetActions ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const median =
                                brain.marketIntelligence?.marketRange?.median;
                              if (median == null) return;
                              setBudgetTouched(true);
                              updateCommonField(
                                "budget",
                                formatBudgetFromMedian(median),
                              );
                            }}
                            className="rounded-full border border-[#0f766e]/20 bg-[#f0fdfa] px-3 py-1.5 text-xs font-medium text-[#115e59]"
                          >
                            Piyasa medyanını kullan
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Location prompt */}
                  {isRealEstate ? (
                    <div className="rounded-[1.5rem] border border-teal-900/8 bg-white/95 p-5 sm:p-6">
                      <h3 className="text-base font-semibold tracking-tight text-[#0f1f1d]">
                        Teklifleri hangi bölgeden almak istersiniz?
                      </h3>
                      <div className="mt-4">
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
                    </div>
                  ) : showLocationPrompt ? (
                    <div className="rounded-[1.5rem] border border-teal-900/8 bg-white/95 p-5 sm:p-6">
                      <h3 className="text-base font-semibold tracking-tight text-[#0f1f1d]">
                        Teklifleri hangi bölgeden almak istersiniz?
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {QUICK_CITIES.map((city) => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => applyCityFilter(city)}
                            className="rounded-full border border-teal-900/10 bg-[#fafcfb] px-3 py-1.5 text-xs font-medium text-teal-950/70 hover:border-[#0f766e]/25 hover:bg-[#f0fdfa]"
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                      <input
                        value={mergedCommonDraft.city}
                        onChange={(e) => updateCommonField("city", e.target.value)}
                        placeholder="veya şehir yazın"
                        className="mt-3 h-11 w-full rounded-xl border border-teal-900/10 bg-[#fafcfb] px-3.5 text-sm outline-none focus:border-[#0f766e]/35"
                      />
                    </div>
                  ) : null}

                  {/* Required dynamic fields still missing — soft blocked prompts */}
                  {missingFields.length > 0 ? (
                    <div className="rounded-[1.5rem] border border-amber-900/10 bg-[#fffbf5] p-5">
                      <h3 className="text-sm font-semibold text-[#0f1f1d]">
                        Yayınlamak için bir bilgi daha
                      </h3>
                      <div className="mt-3 grid gap-3">
                        {missingFields.slice(0, 2).map((field) => (
                          <DynamicFieldInput
                            key={`${activeCategoryId}-${field.key}`}
                            field={{ ...field, required: true }}
                            value={dynamicValues[field.key] ?? ""}
                            onChange={(value) =>
                              updateDynamicField(field.key, value)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <EnrichmentChips
                    candidates={enrichmentCandidates}
                    activeFieldKey={enrichmentFieldKey}
                    draftValue={enrichmentDraft}
                    onSelect={(q) => {
                      setEnrichmentFieldKey(q.fieldKey);
                      setEnrichmentDraft(dynamicValues[q.fieldKey] ?? "");
                    }}
                    onDraftChange={setEnrichmentDraft}
                    onApply={(q, value) => {
                      applyBrainQuestion(q, value);
                      setEnrichmentFieldKey(null);
                      setEnrichmentDraft("");
                    }}
                    onCancel={() => {
                      setEnrichmentFieldKey(null);
                      setEnrichmentDraft("");
                    }}
                  />

                  {/* Advanced: all details */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setOptionalOpen((open) => !open)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                        optionalOpen
                          ? "border-[#0f766e]/30 bg-[#f0fdfa]"
                          : "border-teal-900/10 bg-white/80 hover:border-[#0f766e]/20"
                      }`}
                      aria-expanded={optionalOpen}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <ListPlus className="h-4 w-4 shrink-0 text-[#0f766e]" />
                        <span>
                          <span className="block text-sm font-semibold text-[#0f1f1d]">
                            Tüm detayları düzenle
                          </span>
                          <span className="mt-0.5 block text-xs text-teal-950/45">
                            İsteğe bağlı · mevcut tüm alanlar
                          </span>
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-teal-950/40 transition ${
                          optionalOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {optionalOpen ? (
                      <div className="mt-3 space-y-4 rounded-[1.5rem] border border-teal-900/8 bg-white/95 p-4 sm:p-5">
                        <div className="grid gap-3.5 sm:grid-cols-2">
                          {requiredDynamicFields.map((field) => (
                            <DynamicFieldInput
                              key={`${activeCategoryId}-req-${field.key}`}
                              field={{ ...field, required: true }}
                              value={dynamicValues[field.key] ?? ""}
                              onChange={(value) =>
                                updateDynamicField(field.key, value)
                              }
                            />
                          ))}
                          {optionalCommonFields
                            .filter((field) => field.key !== "budget")
                            .map(renderCommonField)}
                          {optionalDynamicFields.map((field) => (
                            <DynamicFieldInput
                              key={`${activeCategoryId}-opt-${field.key}`}
                              field={{ ...field, required: false }}
                              value={dynamicValues[field.key] ?? ""}
                              onChange={(value) =>
                                updateDynamicField(field.key, value)
                              }
                            />
                          ))}
                        </div>
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
                            className="mt-2 h-11 w-full rounded-xl border border-teal-900/10 bg-white px-3 text-sm outline-none"
                          >
                            <option value="">Öne çıkarma istemiyorum</option>
                            <option value="FEATURE_24H">24 saat · ₺99</option>
                            <option value="FEATURE_3D">3 gün · ₺199</option>
                            <option value="FEATURE_7D">7 gün · ₺349</option>
                          </select>
                        </label>
                      </div>
                    ) : null}
                  </div>

                  {publishError ? (
                    <div className="rounded-2xl border border-[#f0c7c0] bg-[#fff5f3] p-4 text-left">
                      <p className="text-sm font-semibold text-[#8b352b]">
                        Talebiniz henüz yayınlanamadı.
                      </p>
                      <p className="mt-1 text-sm text-[#8b352b]/80">
                        Bilgileriniz korunuyor. Tekrar deneyebilirsiniz.
                      </p>
                      <p className="mt-2 text-xs text-[#8b352b]/65">
                        {publishError}
                      </p>
                      <button
                        type="button"
                        onClick={() => requestPublish("ai")}
                        className="mt-3 rounded-xl bg-[#8b352b] px-3.5 py-2 text-xs font-semibold text-white"
                      >
                        Tekrar dene
                      </button>
                    </div>
                  ) : null}

                  <div className="rounded-[1.25rem] border border-teal-900/6 bg-[#f7faf9] px-4 py-3">
                    <p className="text-sm text-teal-950/60">{readiness.message}</p>
                  </div>

                  <button
                    type="button"
                    disabled={isPublishing || readiness.state === "BLOCKED"}
                    onClick={() => requestPublish("ai")}
                    aria-busy={isPublishing}
                    className="sticky bottom-3 z-20 flex min-h-[54px] w-full items-center justify-between rounded-2xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(15,118,110,0.28)] transition hover:bg-[#0d6a63] disabled:cursor-not-allowed disabled:bg-teal-900/25 disabled:shadow-none sm:static"
                  >
                    <span className="flex items-center gap-2">
                      {isPublishing ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {isPublishing
                        ? "Talebiniz yayınlanıyor..."
                        : "Talebimi yayınla"}
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
                          {readiness.state === "READY"
                            ? "Yayına hazır"
                            : readiness.state === "ENRICHABLE"
                              ? "Güçlendirilebilir"
                              : "Bir bilgi daha"}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-teal-100/45 transition ${
                        aiCompanionOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <div
                    className={`relative z-[1] min-w-0 px-3.5 pb-5 sm:px-5 sm:pb-6 lg:block lg:pt-5 ${
                      aiCompanionOpen
                        ? "block border-t border-white/10 pt-4"
                        : "hidden"
                    }`}
                  >
                    {aiPanelContent}
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
