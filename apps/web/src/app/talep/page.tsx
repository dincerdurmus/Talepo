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

import { CatalogIdentityPreview } from "@/components/request/CatalogIdentityPreview";
import {
  HybridBrowsePath,
  HybridCategoryBrowsePanel,
} from "@/components/request/HybridComposerPanels";
import { PublishSuccessMoment } from "@/components/request/PublishSuccessMoment";
import { subcategorySlug } from "@/lib/knowledge/slug";
import {
  TalepoAiPanel,
  type ClarificationOption,
} from "@/components/request/TalepoAiPanel";
import { CategoryGuidanceCard } from "@/components/request/v2/CategoryGuidanceCard";
import { CategoryGuidanceSummary } from "@/components/request/v2/CategoryGuidanceSummary";
import { FocusedQuestionsPanel } from "@/components/request/v2/FocusedQuestionsPanel";
import { PublishReviewSummary } from "@/components/request/v2/PublishReviewSummary";
import { UnderstoodFactsBoard } from "@/components/request/v2/UnderstoodFactsBoard";
import { shouldConfirmYearCondition } from "@/components/request/YearConditionConfirmation";
import { isImplausibleFutureModelYear } from "@/components/request/FutureModelYearConfirmation";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { MairaStage } from "@/components/request/maira/MairaStage";
import {
  formatBudgetDigits,
  planAnswerApplication,
  projectUserAnswers,
} from "@/lib/request-composer/v2/answer-apply-plan";
import { resolveQuestionControl } from "@/lib/request-composer/v2/question-control-registry";
import { mergeAnswersIntoUnderstoodFacts } from "./ui-helpers";
import { listAllProfiles } from "@/lib/request-composer/v2/question-profiles";
import { useHybridRequestComposer } from "@/hooks/useHybridRequestComposer";
import { useRequestBrain } from "@/hooks/useRequestBrain";
import {
  budgetPlaceholderForStrategy,
  formatBudgetFromMedian,
  isBudgetMeaningfulForStrategy,
  isMarketRangeReliable,
} from "@/lib/request-brain/budget-actions";
import {
  budgetPromptForStrategy,
  toHumanQuestions,
} from "@/lib/request-brain/human-question-layer";
import {
  buildCategoryGuidance,
  categoryGuidanceToUserChoice,
  type CategoryGuidanceSelection,
} from "@/lib/request-composer/v2/category-guidance";
import { enrichUnderstoodFacts } from "@/lib/request-composer/v2/understood-facts";
import { understandingMatchesComposerText } from "@/lib/request-composer/v2/text-match";
import {
  applyResumePublishAction,
  decideResumePublishAction,
} from "@/lib/request-composer/resume-publish";
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
  findProvinceAndDistrictInText,
  parseRealEstateCity,
  textMentionsPlace,
  TURKEY_IL_NAMES,
  TURKEY_PROVINCES,
} from "@/lib/geo/turkey-districts";
import {
  getVisibleCategoryFields,
  isFieldRequired,
  REQUEST_CATEGORIES,
  resolveCommonField,
  resolveRequestCategory,
  withCategoryFieldDefaults,
  type DynamicField,
} from "@/lib/request-category-engine";
import {
  CATALOG_PREVIEW_CHIP_KEYS,
  toCatalogPreviewModel,
} from "@/lib/catalog/consumer";
import { buildDiscoveryProjectionFromState } from "@/lib/discovery";
import {
  UNRESOLVED_CATEGORY_SLUG,
  sanitizeRawInput,
} from "@/lib/request/raw-input";
import type { CategoryUserChoice } from "@/lib/request/understanding-snapshot";
import {
  buildPublishUnderstandingSnapshot,
  withUnderstandingSnapshot,
} from "@/lib/request/publish-understanding";
import {
  composeNaturalRequestText,
  filterRenderableCandidates,
  resolveHybridQuestions,
  resolveQuestionDraftPresentation,
  buildPublishAnswerFields,
  buildPublishFieldValues,
  buildUnderstoodFacts,
  understoodFactsToSummaryChips,
} from "@/lib/request-composer";
import {
  isSoftEscapeValue,
  scheduleComposerQuestions,
  scheduledToFocusedQuestion,
} from "@/lib/request-composer/v2/focused-questions";
import { computeComposerPublishReadiness } from "@/lib/request-composer/v2/publish-readiness";
import { softStatusFromAnswerValue } from "@/lib/request-composer/v2/question-scheduler";
import {
  budgetDisplayLabel,
  filterReviewPreferences,
  filterReviewUncertainties,
  locationDisplayLabel,
} from "@/lib/request-composer/v2/review-display";
import { trackComposerEvent } from "@/lib/request-composer/v2/composer-analytics";
import {
  budgetDisplayFromUnderstanding,
  resolveSchemaCategory,
  safeDraftAttributes,
  seedFieldValuesFromUnderstanding,
} from "@/lib/request-understanding/activation-bridge";
import { emptyRequestUnderstanding } from "@/lib/request-understanding/understand-request";

type CommonDraft = {
  title: string;
  quantity: string;
  city: string;
  delivery: string;
  budget: string;
};

function formatBudgetNumbersInText(text: string): string {
  return text
    .replace(
      /(?:₺\s*)?(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:tl|₺)(?=$|\s|[.,;!?])/giu,
      (_match, amount: string) => `${formatBudgetDigits(amount)} TL`,
    )
    .replace(
      /\b(\d[\d.\s]*)\s*adet\b/giu,
      (_match, amount: string) => `${formatBudgetDigits(amount)} adet`,
    );
}

const TITLE_OVERLAP_STOP_WORDS = new Set([
  "arıyorum",
  "ariyorum",
  "istiyorum",
  "lazım",
  "lazim",
  "bir",
  "için",
  "icin",
  "ve",
  "ile",
  "adet",
  "tane",
  "m²",
  "metrekare",
  "urun",
  "ürün",
  "mobilya",
  "makine",
  "hizmet",
  "servis",
]);

function titlePreservesRequestSubject(candidate: string, rawText: string): boolean {
  const tokens = (value: string) =>
    value
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[a-z0-9çğıöşü²+.-]+/giu)
      ?.filter(
        (token) =>
          token.length >= 2 &&
          !/^\d[\d.,+²-]*$/u.test(token) &&
          !TITLE_OVERLAP_STOP_WORDS.has(token),
      ) ?? [];
  const rawTokens = new Set(tokens(rawText));
  const candidateTokens = tokens(candidate);
  if (rawTokens.size === 0 || candidateTokens.length === 0) return false;
  return candidateTokens.some((token) => rawTokens.has(token));
}

function titleRepeatsContent(candidate: string): boolean {
  const seen = new Set<string>();
  for (const token of candidate
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-zçğıöşü]{4,}/giu) ?? []) {
    if (TITLE_OVERLAP_STOP_WORDS.has(token)) continue;
    if (seen.has(token)) return true;
    seen.add(token);
  }
  return false;
}

function titleHasMeaningfulSubject(candidate: string): boolean {
  return (
    candidate
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[a-zçğıöşü]{3,}/giu)
      ?.some((token) => !TITLE_OVERLAP_STOP_WORDS.has(token)) ?? false
  );
}

function rawTitleFallback(rawText: string): string {
  return rawText
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/u, "")
    .trim()
    .slice(0, 110);
}

const ESSENTIAL_COMMON_KEYS = new Set(["title", "city"]);

const BUDGET_PRESETS = [
  { id: "under-10", label: "10 bin altı", value: "10.000 TL'ye kadar" },
  { id: "10-50", label: "10–50 bin", value: "10.000 – 50.000 TL" },
  { id: "50-200", label: "50–200 bin", value: "50.000 – 200.000 TL" },
  { id: "200-plus", label: "200 bin+", value: "200.000 TL üzeri" },
] as const;

const EXAMPLE_CHIPS = [
  "İstanbul’da 55 inç Arçelik televizyon arıyorum.",
  "Heidelberg SM 74 için nemlendirme pompası lazım.",
  "Ankara Çankaya’da kiralık 3+1 daire arıyorum.",
] as const;

/** Rollback switch: false restores the legacy left-side requirement fields. */
const ENABLE_AI_ONLY_PUBLISH_REQUIREMENTS = true;

/** Üye olmadan doldurulan talebin giriş/kayıt boyunca saklandığı anahtar. */
const PENDING_DRAFT_KEY = "talepo:pending-request-draft:v1";
const PENDING_DRAFT_TTL_MS = 30 * 60 * 1000;
/** Rollback switch for the fixed-height desktop workspace experiment. */
const ENABLE_FIXED_DESKTOP_WORKSPACE = false;

function comparableMoney(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+/, "");
}

export default function TalepOlusturPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f4f7f6] px-5 py-16 text-[#0f1f1d]">
          <div className="mx-auto max-w-3xl animate-pulse rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white p-8">
            <div className="h-8 w-48 rounded bg-[#0f1f1d]/8" />
            <div className="mt-6 h-40 rounded-2xl bg-[#0f1f1d]/5" />
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
  const queryFromHome = formatBudgetNumbersInText(
    searchParams.get("query")?.trim() ?? "",
  );
  const categoryFromHome = searchParams.get("category")?.trim() ?? "";
  const validCategoryFromHome = REQUEST_CATEGORIES.some(
    (category) => category.id === categoryFromHome,
  )
    ? categoryFromHome
    : null;
  const hybrid = useHybridRequestComposer({ initialText: queryFromHome });
  const requestText = hybrid.text;
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
  /**
   * "Bilgileri düzenle" akordeonunun kullanıcı tarafındaki durumu. Yayın
   * hatası akordeonu zorla açar; hata temizlendiğinde panel bu değere geri
   * döner, böylece kullanıcının açtığı düzenleme alanları kendiliğinden
   * kapanmaz (2026-08-26).
   */
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
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
  const [publishGuidanceAttempted, setPublishGuidanceAttempted] = useState(false);
  const [publishButtonAttention, setPublishButtonAttention] = useState(false);
  const [publishReadyAnimation, setPublishReadyAnimation] = useState(false);
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
  const [categoryUserChoice, setCategoryUserChoice] =
    useState<CategoryUserChoice>(null);
  const [confirmedFactKeys, setConfirmedFactKeys] = useState<string[]>([]);
  const [dismissedFactKeys, setDismissedFactKeys] = useState<string[]>([]);
  const [skippedQuestionKeys, setSkippedQuestionKeys] = useState<string[]>([]);
  const [answeredQuestionKeys, setAnsweredQuestionKeys] = useState<string[]>(
    [],
  );
  const [focusedDraftByKey, setFocusedDraftByKey] = useState<
    Record<string, string>
  >({});
  /** Progressive UX: compose → clarify → review */
  const [uxStage, setUxStage] = useState<"compose" | "clarify" | "review">(
    "compose",
  );
  const composerStartedRef = useRef(false);
  /** Soru cevaplarının serbest metne yazılan parçaları (kurucu, 2026-08-23). */
  /** Üyelik akışında saklanan taslağın anahtarı ve dönüş durumu. */
  const resumeAttemptedRef = useRef(false);
  const [resumePublishPending, setResumePublishPending] = useState(false);
  const [otherDomainNote, setOtherDomainNote] = useState("");
  const [showOtherDomainInput, setShowOtherDomainInput] = useState(false);
  const [unresolvedExpressions, setUnresolvedExpressions] = useState<
    string[]
  >([]);
  const [guidanceSelectedSlugs, setGuidanceSelectedSlugs] = useState<string[]>(
    [],
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [aiPanelScrollOffset, setAiPanelScrollOffset] = useState(0);
  const aiPanelFollowRef = useRef<HTMLDivElement>(null);
  const aiPanelNaturalTopRef = useRef<number | null>(null);
  const aiPanelOffsetRef = useRef(0);
  /** 1 = ihtiyaç metni, 2 = AI özeti onay / yayın */
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  /**
   * GÖRÜNÜM YALNIZ BİR SUNUM SEÇİMİDİR (2026-08-29).
   *
   * Maira ve standart görünüm AYNI bileşen örneğinde yaşar: geçiş yalnız bu
   * değeri değiştirir, bileşen unmount olmaz ve hiçbir cevap yeniden
   * kurulmaz. İkinci bir state ağacı ya da serileştirme yoktur.
   */
  const [viewMode, setViewMode] = useState<"standard" | "maira">("standard");
  const [confirmedYearConditionKey, setConfirmedYearConditionKey] =
    useState<string | null>(null);
  const [confirmedFutureModelYearKey, setConfirmedFutureModelYearKey] =
    useState<string | null>(null);
  const [confirmedBudgetConflictKey, setConfirmedBudgetConflictKey] =
    useState<string | null>(null);
  const [appliedProfessionalDescription, setAppliedProfessionalDescription] =
    useState(false);
  const previousActiveCategoryIdRef = useRef<string | null>(null);

  if (queryFromHome !== syncedQueryFromHome) {
    setSyncedQueryFromHome(queryFromHome);
    if (queryFromHome) {
      hybrid.resetWithText(queryFromHome);
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

  /**
   * Phase 1 Single Brain closure:
   * Hybrid composer owns the sole understandRequest() call for user text.
   * /talep never re-runs Single Brain — city/budget/lock are draft overlays.
   * emptyRequestUnderstanding() is a cached shell only when hybrid has no state.
   */
  const understanding =
    hybrid.state?.understanding ?? emptyRequestUnderstanding();

  const [liveMatching, setLiveMatching] = useState<{
    estimatedCompanyCount: number;
    expectedOfferCount: number;
  } | null>(null);

  const schemaCategory = resolveSchemaCategory(understanding);
  const detectedCategoryId = schemaCategory.categoryId;
  const categoryConfident =
    !hybrid.isSyncing && (categoryLockedByUser || schemaCategory.confident);

  /**
   * CATEGORY_HINT (URL soft) ≠ USER_CATEGORY_OVERRIDE ≠ CANONICAL_CATEGORY
   * Priority: locked Step-2 select > detector CONFIDENT > hybrid canonical >
   * detector TENTATIVE > soft URL hint > provisional schema.
   * TENTATIVE must not override a resolved canonical categoryId (e.g. web
   * service leaf vs a weak real-estate "site" substring).
   */
  const activeCategoryId = (() => {
    if (categoryLockedByUser && categoryOverride) return categoryOverride;
    if (
      understanding.category.status === "CONFIDENT" &&
      understanding.category.value
    ) {
      return understanding.category.value;
    }
    if (hybrid.state?.categoryId) return hybrid.state.categoryId;
    if (
      understanding.category.status === "TENTATIVE" &&
      understanding.category.value
    ) {
      return understanding.category.value;
    }
    if (categoryOverride && !understanding.category.value) {
      return categoryOverride;
    }
    return detectedCategoryId;
  })();
  const selectedCategory = resolveRequestCategory(activeCategoryId);
  const visibleCommonFields = useMemo(
    () => selectedCategory.commonFields.map(resolveCommonField),
    [selectedCategory],
  );
  const visibleCommonFieldKeys = useMemo(
    () => new Set(visibleCommonFields.map((field) => field.key)),
    [visibleCommonFields],
  );
  const isRealEstate = activeCategoryId === "real-estate";

  /** Text edits release soft hint and Step-2 lock so detector drives filters. */
  function clearCategoryOverridesOnTextEdit() {
    setCategoryLockedByUser(false);
    setCategoryOverride(null);
    setCategoryUserChoice(null);
    setConfirmedFactKeys([]);
    setDismissedFactKeys([]);
    setOtherDomainNote("");
    setShowOtherDomainInput(false);
    setUnresolvedExpressions([]);
    setGuidanceSelectedSlugs([]);
  }

  // Category change: drop stale category-specific answers; keep city/budget comfort.
  useEffect(() => {
    const previous = previousActiveCategoryIdRef.current;
    previousActiveCategoryIdRef.current = activeCategoryId;
    if (!previous || previous === activeCategoryId) return;

    if (previous === "real-estate" && activeCategoryId !== "real-estate") {
      setRealEstateDraft({ il: "", ilce: "", mahalleler: [] });
      setRealEstateTouched(false);
    }

    setManualValues((current) => {
      const rest = { ...current };
      delete rest.neighborhoods;
      delete rest.needType;
      delete rest.solutionType;
      delete rest.platform;
      delete rest.users;
      delete rest.integration;
      delete rest.quantityDetail;
      delete rest.specs;
      delete rest.furnitureType;
      delete rest.usageArea;
      delete rest.applianceType;
      delete rest.propertyType;
      delete rest.listingType;
      delete rest.roomCount;
      delete rest.floor;
      delete rest.buildingAge;
      delete rest.part;
      delete rest.partPreference;
      delete rest.vin;
      return rest;
    });
    setEnrichmentFieldKey(null);
    setEnrichmentDraft("");
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
    const category = resolveRequestCategory(activeCategoryId);
    const values: Record<string, string> = {};
    const composerFill = hybrid.softFillFields;

    for (const field of category.fields) {
      const seeded = seededFields[field.key];
      const fromComposer = composerFill[field.key];

      values[field.key] =
        manualValues[field.key] ??
        fromComposer ??
        (seeded === undefined || seeded === null ? "" : String(seeded));
    }

    // Also surface needType/model/brand seeds even if not in field list yet
    for (const [key, value] of Object.entries(seededFields)) {
      if (values[key] === undefined || values[key] === "") {
        if (!manualValues[key] && value) values[key] = value;
      }
    }
    for (const [key, value] of Object.entries(composerFill)) {
      if (values[key] === undefined || values[key] === "") {
        if (!manualValues[key] && value) values[key] = value;
      }
    }

    return withCategoryFieldDefaults(activeCategoryId, values);
  }, [activeCategoryId, hybrid.softFillFields, seededFields, manualValues]);

  const categoryFilterDefs = useMemo(
    () => getExploreFilterDefs(activeCategoryId, dynamicValues),
    [activeCategoryId, dynamicValues],
  );

  const autoTitle = useMemo(() => {
    const category = resolveRequestCategory(activeCategoryId);
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

  const aiSuggestedTitle = useMemo(() => {
    const composed = (
      hybrid.state?.lastComposedText?.trim() ||
      (hybrid.state ? composeNaturalRequestText(hybrid.state) : "")
    ).replace(/[.!\s]+$/u, "");
    // A generated sentence may only replace the title when it still contains
    // the subject the user actually wrote. This blocks stale/cross-category
    // titles such as "konut arıyorum" for an office painting request.
    let base =
      activeCategoryId !== "services" &&
      composed &&
      titlePreservesRequestSubject(composed, requestText) &&
      !titleRepeatsContent(composed)
        ? composed
        : autoTitle;
    if (!titleHasMeaningfulSubject(base)) {
      base = rawTitleFallback(requestText) || base;
    }

    if (activeCategoryId === "automotive") {
      const yearMin =
        dynamicValues.yearMin || String(understanding.attributes.yearMin?.value ?? "");
      const yearMax =
        dynamicValues.yearMax || String(understanding.attributes.yearMax?.value ?? "");
      const modelYear =
        dynamicValues.modelYear ||
        String(understanding.attributes.modelYear?.value ?? "");
      const yearLabel = yearMin
        ? `${yearMin} ve üzeri`
        : yearMax
          ? `${yearMax} ve altı`
          : modelYear
            ? `${modelYear} model`
            : "";
      const numericYear = (yearMin || yearMax || modelYear).trim();
      if (yearLabel && numericYear && !base.includes(numericYear)) {
        base = `${yearLabel} ${base}`.trim();
      }
    }

    base = base
      .replace(/\b(?:sıfır|ikinci\s+el|2\.\s*el)\b/giu, " ")
      .replace(/\s+/g, " ")
      .trim();

    const location =
      findProvinceAndDistrictInText(requestText) ??
      (/\bist\b/iu.test(requestText) ? { il: "İstanbul", ilce: "" } : null);
    if (!location || !base) return base;

    const alreadyMentionsLocation =
      textMentionsPlace(base, location.il) ||
      (location.ilce ? textMentionsPlace(base, location.ilce) : false);
    if (location.il === "İstanbul") {
      base = base
        .replace(/(?:\s*[-,]?\s*)\bist\b/giu, " ")
        .replace(/\s+/g, " ")
        .replace(/\s*[-,]\s*$/u, "")
        .trim();
    }
    if (alreadyMentionsLocation && !/\bist\b/iu.test(base)) return base;

    const locationLabel = location.ilce
      ? `${location.ilce}, ${location.il}`
      : location.il;
    return `${base} - ${locationLabel}`;
  }, [
    activeCategoryId,
    autoTitle,
    dynamicValues.modelYear,
    dynamicValues.yearMax,
    dynamicValues.yearMin,
    hybrid.state,
    requestText,
    understanding.attributes.modelYear?.value,
    understanding.attributes.yearMax?.value,
    understanding.attributes.yearMin?.value,
  ]);

  const mergedCommonDraft = useMemo<CommonDraft>(
    () => ({
      title: titleManuallyEdited ? commonDraft.title : aiSuggestedTitle,
      quantity: visibleCommonFieldKeys.has("quantity")
        ? commonDraft.quantity ||
          (understandingQuantity != null
            ? `${understandingQuantity} ${understandingUnit}`
            : "")
        : "",
      city: isRealEstate
        ? (cityTouched ? commonDraft.city : "") ||
          realEstateLocationToCity(realEstateLocation) ||
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
      aiSuggestedTitle,
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
      hybrid.isSyncing
        ? []
        : getVisibleCategoryFields(
        selectedCategory.fields,
        dynamicValues,
        activeCategoryId,
        {
          subcategorySlug: hybrid.state?.subcategorySlug ?? null,
          taxonomyNodeId: hybrid.state?.taxonomyNodeId ?? null,
        },
      ),
    [
      activeCategoryId,
      dynamicValues,
      hybrid.isSyncing,
      selectedCategory.fields,
      hybrid.state?.subcategorySlug,
      hybrid.state?.taxonomyNodeId,
    ],
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
    ? cityTouched && commonDraft.city.trim()
      ? commonDraft.city
          .split(",")
          .map((value) => parseRealEstateCity(value.trim()))
          .some((location) => !location?.il || !location.ilce)
      : Boolean(realEstateLocationError(realEstateLocation))
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
    quantity: visibleCommonFieldKeys.has("quantity")
      ? understandingQuantity
      : undefined,
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
    enabled: requestText.trim().length > 0,
    // Single-page: always treat as "active" once there is text
    wizardStep: requestText.trim().length > 0 ? 2 : 1,
    understanding,
    categoryLockedByUser,
  });

  const completenessPct = brain.completeness
    ? Math.round(brain.completeness.score * 100)
    : liveScore;

  const budgetRequired = visibleCommonFieldKeys.has("budget");
  const hasBudget = Boolean(mergedCommonDraft.budget.trim());

  const budgetConflict = useMemo(() => {
    const textBudget = understandingBudgetDisplay.trim();
    const enteredBudget = commonDraft.budget.trim();
    if (!budgetTouched || !textBudget || !enteredBudget) return null;
    const textComparable = comparableMoney(textBudget);
    const enteredComparable = comparableMoney(enteredBudget);
    if (!textComparable || !enteredComparable || textComparable === enteredComparable) {
      return null;
    }
    const key = `${textComparable}:${enteredComparable}`;
    if (confirmedBudgetConflictKey === key) return null;
    return { textBudget, enteredBudget, key };
  }, [budgetTouched, commonDraft.budget, confirmedBudgetConflictKey, understandingBudgetDisplay]);

  const publishable =
    Boolean(mergedCommonDraft.title.trim()) &&
    (!budgetRequired || hasBudget) &&
    (!visibleCommonFieldKeys.has("city") ||
      Boolean(mergedCommonDraft.city.trim()) ||
      !realEstateLocationMissing) &&
    missingFields.length === 0 &&
    !realEstateLocationMissing;

  const missingPublishLabels = useMemo(() => {
    const labels: string[] = [];
    if (!mergedCommonDraft.title.trim()) labels.push("Talep başlığı");
    if (budgetRequired && !hasBudget) labels.push("Bütçe");
    if (
      visibleCommonFieldKeys.has("city") &&
      !mergedCommonDraft.city.trim() &&
      !understandingCity.trim()
    ) {
      labels.push(isRealEstate ? "İl ve ilçe" : "Şehir / bölge");
    }
    if (isRealEstate && realEstateLocationMissing) {
      if (!labels.includes("İl ve ilçe")) labels.push("İl ve ilçe");
    }
    labels.push(...missingFields.map((field) => field.label));
    return [...new Set(labels)];
  }, [
    budgetRequired,
    hasBudget,
    isRealEstate,
    mergedCommonDraft.city,
    mergedCommonDraft.title,
    missingFields,
    realEstateLocationMissing,
    understandingCity,
    visibleCommonFieldKeys,
  ]);

  const missingPublishFieldKeys = useMemo(() => {
    const keys: string[] = [];
    if (!mergedCommonDraft.title.trim()) keys.push("title");
    if (budgetRequired && !hasBudget) keys.push("budget");
    if (
      visibleCommonFieldKeys.has("city") &&
      !mergedCommonDraft.city.trim() &&
      !understandingCity.trim()
    ) {
      keys.push("city");
    }
    if (isRealEstate && realEstateLocationMissing && !keys.includes("city")) {
      keys.push("city");
    }
    keys.push(...missingFields.map((field) => field.key));
    return [...new Set(keys)];
  }, [
    budgetRequired,
    hasBudget,
    mergedCommonDraft.city,
    mergedCommonDraft.title,
    missingFields,
    isRealEstate,
    realEstateLocationMissing,
    understandingCity,
    visibleCommonFieldKeys,
  ]);

  const catalogPreview = useMemo(
    () => toCatalogPreviewModel(understanding),
    [understanding],
  );

  const requestSummary = useMemo(() => {
    const facts = buildUnderstoodFacts(hybrid.state);
    const chips = understoodFactsToSummaryChips(facts).filter((chip) =>
      catalogPreview ? !CATALOG_PREVIEW_CHIP_KEYS.has(chip.fieldKey) : true,
    );
    const kind = understanding.requestSubject.kind.value;
    const subtypeLabel =
      kind === "PART"
        ? "Yedek parça"
        : kind === "ACCESSORY"
          ? "Aksesuar"
          : null;
    return {
      headline: aiSuggestedTitle || "Talebiniz",
      chips,
      subtypeLabel,
    };
  }, [
    aiSuggestedTitle,
    catalogPreview,
    hybrid.state,
    understanding.requestSubject.kind.value,
  ]);

  const yearConditionConfirmation = useMemo(() => {
    const year =
      dynamicValues.modelYear ||
      (typeof understanding.attributes.modelYear?.value === "number"
        ? String(understanding.attributes.modelYear.value)
        : "");
    const rawCondition =
      dynamicValues.condition ||
      (understanding.condition?.value === "NEW"
        ? "Sıfır"
        : understanding.condition?.value === "USED"
          ? "İkinci el"
          : "");
    if (!year || (rawCondition !== "Sıfır" && rawCondition !== "İkinci el")) {
      return null;
    }
    const condition: "Sıfır" | "İkinci el" = rawCondition;
    const key = `${year}:${condition}`;
    if (!shouldConfirmYearCondition(year, condition)) return null;
    return { year, condition, key };
  }, [dynamicValues.condition, dynamicValues.modelYear, understanding.attributes.modelYear?.value, understanding.condition?.value]);

  const yearConditionConfirmationPending =
    yearConditionConfirmation != null &&
    confirmedYearConditionKey !== yearConditionConfirmation.key;

  const futureModelYearConfirmation = useMemo(() => {
    const candidates = [
      dynamicValues.modelYear,
      dynamicValues.yearMin,
      dynamicValues.yearMax,
      understanding.attributes.modelYear?.value,
      understanding.attributes.yearMin?.value,
      understanding.attributes.yearMax?.value,
    ];
    const raw = candidates.find((value) => value != null && String(value).trim());
    const year = Number(raw);
    if (!Number.isInteger(year) || !isImplausibleFutureModelYear(year)) return null;
    return { year, key: String(year) };
  }, [
    dynamicValues.modelYear,
    dynamicValues.yearMax,
    dynamicValues.yearMin,
    understanding.attributes.modelYear?.value,
    understanding.attributes.yearMax?.value,
    understanding.attributes.yearMin?.value,
  ]);

  const futureModelYearConfirmationPending =
    futureModelYearConfirmation != null &&
    confirmedFutureModelYearKey !== futureModelYearConfirmation.key;

  /**
   * Sole question authority: resolveHybridQuestions (canonical-hybrid).
   * rankNextBestQuestions may rank inside that allowlist; brain.nextQuestions is unused.
   */
  const hybridQuestionResult = useMemo(() => {
    if (hybrid.isSyncing || !hybrid.state) return null;
    try {
      return resolveHybridQuestions(hybrid.state, {
        strategy: brain.strategy?.strategy ?? null,
        completeness: brain.completeness,
        dynamicFields: visibleDynamicFields,
        requiredDynamicKeys,
      });
    } catch {
      return null;
    }
  }, [
    brain.completeness,
    brain.strategy?.strategy,
    hybrid.isSyncing,
    hybrid.state,
    requiredDynamicKeys,
    visibleDynamicFields,
  ]);

  /**
   * NİHAİ RENDER YÜZEYİ tek otoritede: `filterRenderableCandidates`.
   * Süzgeç mantığı burada YENİDEN yazılmaz; doğrulayıcı da aynı
   * fonksiyonu çağırarak kullanıcının gördüğü listeyi ölçer.
   */
  const enrichmentCandidates = useMemo(
    () =>
      filterRenderableCandidates({
        hybridQuestionResult,
        visibleDynamicFields,
        missingFields,
        dynamicValues,
        requestText,
        activeCategoryId,
        isRealEstate,
        realEstateLocationMissing,
        visibleCommonFieldKeys,
        mergedCommonDraft,
        understandingCity,
        budgetRequired,
        hasBudget,
        strategy: brain.strategy?.strategy,
        canonicalFields: hybrid.state?.fields ?? null,
      }),
    [
      activeCategoryId,
      brain.strategy?.strategy,
      budgetRequired,
      hybrid.state?.fields,
      dynamicValues,
      hasBudget,
      hybridQuestionResult,
      isRealEstate,
      mergedCommonDraft,
      missingFields,
      realEstateLocationMissing,
      requestText,
      understandingCity,
      visibleCommonFieldKeys,
      visibleDynamicFields,
    ],
  );

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

  const humanQuestions = useMemo(
    () =>
      toHumanQuestions(enrichmentCandidates, {
        strategy: brain.strategy?.strategy,
        requiredDynamicKeys,
        dynamicFields: visibleDynamicFields,
        maxVisible: enrichmentCandidates.length,
      }),
    [
      brain.strategy?.strategy,
      enrichmentCandidates,
      requiredDynamicKeys,
      visibleDynamicFields,
    ],
  );

  const humanPrompts = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of humanQuestions) {
      map[q.fieldKey] = q.humanPrompt;
    }
    return map;
  }, [humanQuestions]);

  /**
   * Kapsam dışı (arz ilanı) talepte hiçbir soru zamanlanmaz — kurucu kararı,
   * 2026-08-25. `resolveHybridQuestions` zaten susuyor; buradaki KÜRESEL
   * ÇEKİRDEK zamanlayıcısı (bütçe/konum/zaman) ayrı bir yoldan geldiği için
   * ölçümde hâlâ soru üretiyor ve panel "Yayına hazır" diyordu. İki otorite
   * de aynı kapsam kararını okur.
   */
  const composerOutOfScope =
    hybrid.state?.understanding?.requestScope?.value === "UNSUPPORTED_SUPPLY";

  const focusedQuestionSchedule = useMemo(() => {
    if (composerOutOfScope) {
      return {
        visible: [],
        remainingCriticalCount: 0,
        remainingOptionalCount: 0,
        canEnterReview: false,
        blockingFieldKeys: [],
        blockingLabels: [],
      };
    }
    const live = understandingMatchesComposerText({
      composerText: requestText,
      understandingRawInput: understanding.rawInput,
      isSyncing: hybrid.isSyncing,
    });
    if (!live || !requestText.trim()) {
      return scheduleComposerQuestions({
        categoryId: activeCategoryId,
        candidates: [],
        values: {},
      });
    }
    const needTypeField = hybrid.state?.fields.needType;
    const needType =
      needTypeField?.kind === "VALUE"
        ? String(needTypeField.value ?? "")
        : null;
    const locationMode =
      (manualValues.locationMode ?? "").trim().toLocaleLowerCase("tr-TR") ||
      (dynamicValues.locationMode ?? "").trim().toLocaleLowerCase("tr-TR") ||
      (/\buzaktan\b/i.test(requestText) ? "remote" : "");
    const isRemoteService =
      locationMode === "remote" ||
      locationMode === "uzaktan" ||
      locationMode === "uzaktan uygun";

    return scheduleComposerQuestions({
      categoryId: activeCategoryId,
      needType,
      candidates: enrichmentCandidates,
      values: {
        title: mergedCommonDraft.title,
        quantity: mergedCommonDraft.quantity,
        city: isRealEstate
          ? realEstateLocation.il || understandingCity
          : mergedCommonDraft.city || understandingCity,
        delivery: mergedCommonDraft.delivery,
        budget: mergedCommonDraft.budget,
        ...Object.fromEntries(
          Object.entries(dynamicValues).map(([k, v]) => [k, String(v ?? "")]),
        ),
        // Canonical RE listing must win over empty dynamic bags
        listingType:
          (hybrid.state?.fields.listingType?.kind === "VALUE"
            ? String(hybrid.state.fields.listingType.value ?? "")
            : "") ||
          (understanding.attributes?.listingType?.value != null
            ? String(understanding.attributes.listingType.value)
            : "") ||
          (dynamicValues.listingType
            ? String(dynamicValues.listingType)
            : ""),
        roomCount:
          (hybrid.state?.fields.roomCount?.kind === "VALUE"
            ? String(hybrid.state.fields.roomCount.value ?? "")
            : "") ||
          (understanding.attributes?.roomCount?.value != null
            ? String(understanding.attributes.roomCount.value)
            : "") ||
          (dynamicValues.roomCount ? String(dynamicValues.roomCount) : ""),
        locationMode:
          manualValues.locationMode ??
          dynamicValues.locationMode ??
          (isRemoteService ? "remote" : undefined),
      },
      fieldStates: Object.fromEntries(
        Object.entries(hybrid.state?.fields ?? {}).map(([key, field]) => [
          key,
          {
            kind: field?.kind,
            value:
              field?.kind === "VALUE"
                ? String(field.value ?? "")
                : field?.kind === "ANY"
                  ? "no_preference"
                  : null,
            // KB-17: kaynak taşınmazsa scheduler çıkarımı cevap sanar.
            provenance: field?.provenance ?? null,
          },
        ]),
      ),
      answeredKeys: answeredQuestionKeys,
      optionalSkippedKeys: skippedQuestionKeys,
      realEstateLocationComplete: isRealEstate
        ? !realEstateLocationMissing
        : undefined,
      isRemoteService,
    });
  }, [
    activeCategoryId,
    answeredQuestionKeys,
    composerOutOfScope,
    dynamicValues,
    enrichmentCandidates,
    hybrid.isSyncing,
    hybrid.state?.fields,
    isRealEstate,
    manualValues.locationMode,
    mergedCommonDraft.budget,
    mergedCommonDraft.city,
    mergedCommonDraft.delivery,
    mergedCommonDraft.quantity,
    mergedCommonDraft.title,
    realEstateLocation.il,
    realEstateLocationMissing,
    requestText,
    skippedQuestionKeys,
    understanding.rawInput,
    understandingCity,
  ]);

  const focusedQuestions = useMemo(() => {
    const hybridByKey = new Map(
      enrichmentCandidates.map((c) => [c.fieldKey, c]),
    );
    const productType =
      hybrid.state?.fields.productType?.kind === "VALUE"
        ? String(hybrid.state.fields.productType.value ?? "")
        : hybrid.state?.fields.applianceType?.kind === "VALUE"
          ? String(hybrid.state.fields.applianceType.value ?? "")
          : null;
    const needTypeField = hybrid.state?.fields.needType;
    const needType =
      needTypeField?.kind === "VALUE"
        ? String(needTypeField.value ?? "")
        : null;
    const listingType =
      hybrid.state?.fields.listingType?.kind === "VALUE"
        ? String(hybrid.state.fields.listingType.value ?? "")
        : null;
    const isRemote =
      /\buzaktan\b/i.test(requestText) ||
      (manualValues.locationMode ?? "").toLocaleLowerCase("tr-TR") ===
        "remote";
    return focusedQuestionSchedule.visible.map((q) =>
      scheduledToFocusedQuestion(q, hybridByKey.get(q.fieldKey), {
        productType,
        needType,
        isRemoteService: isRemote,
        listingType,
      }),
    );
  }, [
    enrichmentCandidates,
    focusedQuestionSchedule.visible,
    hybrid.state?.fields,
    manualValues.locationMode,
    requestText,
  ]);

  const composerReadiness = useMemo(
    () =>
      computeComposerPublishReadiness({
        hasUsableText: Boolean(requestText.trim()),
        schedule: focusedQuestionSchedule,
        realEstateLocationComplete: isRealEstate
          ? !realEstateLocationMissing
          : undefined,
        categoryId: activeCategoryId,
        budgetValue: mergedCommonDraft.budget,
        cityValue: isRealEstate
          ? realEstateLocation.il
            ? `${realEstateLocation.il}${realEstateLocation.ilce ? ` / ${realEstateLocation.ilce}` : ""}`
            : understandingCity
          : mergedCommonDraft.city || understandingCity,
        locationMode:
          manualValues.locationMode ??
          dynamicValues.locationMode ??
          (/\buzaktan\b/i.test(requestText) ? "remote" : null),
        // Kapsam kararı anlama katmanından gelir (kurucu kararı, 2026-08-25):
        // arz ilanında review/publish açılmaz.
        requestScope:
          hybrid.state?.understanding?.requestScope?.value ?? null,
      }),
    [
      activeCategoryId,
      dynamicValues.locationMode,
      focusedQuestionSchedule,
      isRealEstate,
      manualValues.locationMode,
      mergedCommonDraft.budget,
      mergedCommonDraft.city,
      realEstateLocation.il,
      realEstateLocation.ilce,
      realEstateLocationMissing,
      requestText,
      understandingCity,
      hybrid.state?.understanding?.requestScope?.value,
    ],
  );

  /**
   * MOBİL GÖRÜNÜRLÜK — İKİ KAPI, TEK KARAR (2026-08-26).
   *
   * Mobilde AI companion iki kapının arkasındadır: onu taşıyan dış
   * `<details>` ("Bilgileri düzenle") ve `aiCompanionOpen` ile yönetilen iç
   * panel. Tarayıcı ölçümü ikisinin ayrı ayrı kapalı kalabildiğini gösterdi:
   * eksik alan rehberliği ve kapsam dışı açıklaması DOM'da üretiliyor ama
   * kullanıcıya hiç görünmüyordu, çünkü bu iki sinyal `publishError`
   * üretmez ve akordeon yalnız ona bakıyordu.
   *
   * Karar TEK yerde verilir ve her iki kapı da aynı değeri kullanır. İki
   * kapı ayrı ifadeler taşırsa biri açılıp diğeri kapalı kalabilir —
   * ölçülen kusur tam olarak buydu.
   *
   * Görünürlük TÜRETİLİR, effect ile senkronize edilmez: kullanıcının kendi
   * açma/kapama tercihi (`aiCompanionOpen`) korunur, zorunlu sinyaller ise
   * onu GEÇİCİ olarak geçersiz kılar. İkisi birbirini state üzerinden
   * sessizce ezmez.
   *
   * ZORLA AÇMA GEÇİCİDİR. Her sinyal, panelin o sinyali gerçekten çizdiği
   * koşulun aynısına bağlanır; aksi hâlde panel kapanamaz hâle gelir.
   * `publishGuidanceAttempted` hiçbir yerde `false`'a dönmez — çıplak
   * kullanılsaydı kullanıcının ilk yayın denemesinden sonra akordeon ve
   * companion kalıcı olarak açık kalır, kapatma düğmesi sessizce
   * etkisizleşirdi. Bu yüzden rehberlik sinyali rehberliğin kendi render
   * koşuluyla (`attempted && missingLabels.length > 0`) eşleşir ve eksik
   * alan doldurulunca zorlama kendiliğinden kalkar.
   *
   * KAPSAM DIŞI BİLDİRİMİ BU KARARA GİRMEZ. "Kapsam dışı açıklaması mobilde
   * görünmüyor" ölçümü bir YANLIŞ POZİTİFTİ (`checkVisibility()` bu sayfada
   * güvenilmez sonuç veriyor). Bildirim `<details>` ağacının dışında, ana
   * composer kartında çizilir ve her iki kapıdan bağımsız olarak zaten
   * görünürdür; doğrulayıcı bunu yapısal olarak sabitler. Kapsam güvenliği
   * ayrı eksende durur: `UNSUPPORTED_SUPPLY` talep publish/create yoluna hiç
   * girmez. Companion'ı bunun için zorla açmak, yanlış bir ölçümden doğan
   * gereksiz bir davranışı kalıcılaştırmak olurdu.
   */
  const publishSignalDemandsAttention =
    Boolean(publishError) ||
    (publishGuidanceAttempted && missingPublishLabels.length > 0);
  const effectiveAiCompanionOpen =
    aiCompanionOpen || publishSignalDemandsAttention;

  // Üyelik dönüşü: saklanan taslağı geri yükle (kurucu, 2026-08-23).
  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;
    try {
      const raw = window.localStorage.getItem(PENDING_DRAFT_KEY);
      if (!raw) return;
      window.localStorage.removeItem(PENDING_DRAFT_KEY);
      const draft = JSON.parse(raw) as {
        v?: number;
        savedAt?: number;
        pendingPublish?: boolean;
        text?: string;
        manualValues?: Record<string, string>;
        commonDraft?: Partial<typeof commonDraft>;
        realEstateDraft?: typeof realEstateDraft;
        categoryOverride?: string | null;
        categoryLockedByUser?: boolean;
        categoryUserChoice?: typeof categoryUserChoice;
        cityTouched?: boolean;
        budgetTouched?: boolean;
      };
      if (
        !draft?.text?.trim() ||
        Date.now() - (draft.savedAt ?? 0) > PENDING_DRAFT_TTL_MS
      ) {
        return;
      }
      // DIS SISTEM SENKRONIZASYONU. Kaynak React degil, tarayicinin
      // localStorage'idir: kullanici uye olmak icin sayfadan ayrildiginda
      // yazdigi metin ve verdigi cevaplar oraya birakilir. Bu effect onlari
      // React state'ine geri tasir. Deps [] ve resumeAttemptedRef ciftli
      // kilit oldugu icin tek turda bir kez calisir; anahtar okunur okunmaz
      // silindiginden tekrar veya yaris uretemez. Kaldirilirsa uyelikten
      // donen kullanicinin butun cevaplari sessizce kaybolur.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setManualValues(draft.manualValues ?? {});
      setCommonDraft({
        title: "",
        quantity: "",
        city: "",
        delivery: "",
        budget: "",
        ...(draft.commonDraft ?? {}),
      });
      setRealEstateDraft(
        draft.realEstateDraft ?? { il: "", ilce: "", mahalleler: [] },
      );
      if (draft.categoryOverride) setCategoryOverride(draft.categoryOverride);
      setCategoryLockedByUser(Boolean(draft.categoryLockedByUser));
      if (draft.categoryUserChoice) {
        setCategoryUserChoice(draft.categoryUserChoice);
      }
      setCityTouched(Boolean(draft.cityTouched));
      setBudgetTouched(Boolean(draft.budgetTouched));
      hybrid.setText(draft.text);
      setWizardStep(2);
      setAiCompanionOpen(true);
      if (draft.pendingPublish) setResumePublishPending(true);
    } catch {
      /* bozuk taslak sessizce yok sayılır */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Taslak hazır olunca kaldığı yerden otomatik yayınla (tek deneme).
  useEffect(() => {
    // DIS SISTEM SENKRONIZASYONU + TEK-ATIS LATCH. Beklenen olay React
    // icinden gelmiyor: anlama motorunun asenkron sindirimi bitip rawInput
    // metinle esitlendiginde tetikleniyor. Karar decideResumePublishAction
    // icinde saf olarak verilir; burasi yalnizca uygulayicidir.
    applyResumePublishAction(
      decideResumePublishAction({
        pending: resumePublishPending,
        isSyncing: hybrid.isSyncing,
        understandingRawInput: understanding.rawInput,
        composerText: requestText,
        // KAPSAM KAPISI, kanonik otoriteden okunur. Arz ilani yayin yoluna
        // HIC girmez: karar `blocked` doner, latch soner ama publish
        // denenmez. Bestecinin kapsam disi rehberligi zaten kosulsuz
        // gorunur oldugu icin kullanici cikmaza sokulmaz.
        requestScope: understanding.requestScope?.value ?? null,
      }),
      {
        // Latch YALNIZ karar bunu istediginde kapanir; beklerken acik
        // kalir, boylece niyet kaybolmaz ve denemeden sonra tekrarlanmaz.
        closeLatch: () => setResumePublishPending(false),
        // Yayina uygunluk denemeyi IPTAL ETMEZ: butce ya da konum eksikse
        // handlePublishAttempt bunu eksik alan rehberligine cevirir. Eski
        // davranista latch sonuyor ama hicbir sey yapilmiyordu; kullanici
        // yayinlama niyetiyle uye olup donuyor ve hicbir sey gormuyordu.
        attemptPublish: handlePublishAttempt,
        // Basarisiz deneme SESSIZCE YUTULMAZ. Latch bilerek geri acilmaz
        // (otomatik tekrar sonsuz donguye doner); bunun yerine kullaniciya
        // gorunur bir hata gosterilir ve companion acilir, boylece kendi
        // yeniden deneme yolu acik kalir.
        onAttemptFailed: (error) => {
          console.error("[resume-publish] yayin denemesi basarisiz", error);
          surfacePublishFailure(
            error instanceof Error && error.message
              ? error.message
              : "Talebiniz yayınlanamadı. Lütfen tekrar deneyin.",
          );
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resumePublishPending,
    hybrid.isSyncing,
    requestText,
    understanding.rawInput,
    understanding.requestScope?.value,
  ]);

  const categoryGuidance = useMemo(() => {
    const live = understandingMatchesComposerText({
      composerText: requestText,
      understandingRawInput: understanding.rawInput,
      isSyncing: hybrid.isSyncing,
    });
    if (!live) return null;
    return buildCategoryGuidance({
      understanding,
      rawText: requestText,
      categoryConfident,
      userLocked: categoryLockedByUser,
    });
  }, [
    categoryConfident,
    categoryLockedByUser,
    hybrid.isSyncing,
    requestText,
    understanding,
  ]);

  const editableUnderstoodFacts = useMemo(() => {
    const live = understandingMatchesComposerText({
      composerText: requestText,
      understandingRawInput: understanding.rawInput,
      isSyncing: hybrid.isSyncing,
    });
    return enrichUnderstoodFacts({
      facts: live ? hybrid.understoodFacts : [],
      understanding,
      confirmedKeys: confirmedFactKeys,
      dismissedKeys: dismissedFactKeys,
      categoryId: activeCategoryId,
    });
  }, [
    activeCategoryId,
    confirmedFactKeys,
    dismissedFactKeys,
    hybrid.isSyncing,
    hybrid.understoodFacts,
    requestText,
    understanding,
  ]);

  const publishReviewModel = useMemo(() => {
    const reviewLocation = locationDisplayLabel(
      mergedCommonDraft.city.trim() || null,
    );
    const reviewBudget = budgetDisplayLabel(
      mergedCommonDraft.budget.trim() || null,
    );
    const prefs = filterReviewPreferences({
      preferences: editableUnderstoodFacts
        .filter((f) => f.key !== "needType")
        .slice(0, 8)
        .map((f) => ({
          key: f.key,
          label: f.label,
          value: f.displayValue,
        })),
      location: reviewLocation,
      budget: reviewBudget,
    });
    const uncertainItems = filterReviewUncertainties({
      items: editableUnderstoodFacts
        .filter((f) => f.tone === "check" || f.tone === "unsure")
        .map((f) => ({
          key: f.key,
          label: f.label,
          tone: f.tone as "check" | "unsure",
        })),
      cityValue: mergedCommonDraft.city,
      budgetValue: mergedCommonDraft.budget,
    });
    const summarySource =
      appliedProfessionalDescription && professionalText.trim()
        ? professionalText
        : requestText;
    return {
      summaryText: summarySource,
      rawInput: requestText,
      // Pro filtreleme kategori+alt kategori üzerinden satılır — özet de
      // "Otomotiv › Yedek Parça" gibi tam yolu göstermeli (kurucu, 2026-08-23).
      categoryLabel: schemaCategory.displayLabelSafe
        ? (() => {
            const slug = hybrid.state?.subcategorySlug ?? null;
            const subLabel = slug
              ? selectedCategory.subcategories.find(
                  (label) => subcategorySlug(label) === slug,
                ) ?? null
              : null;
            return subLabel
              ? `${selectedCategory.label} › ${subLabel}`
              : selectedCategory.label;
          })()
        : null,
      categoryUnresolved:
        !categoryConfident ||
        categoryUserChoice === "defer_to_talepo" ||
        categoryUserChoice === "none_of_these" ||
        categoryUserChoice === "other_domain",
      preferences: prefs,
      location: reviewLocation,
      timing: mergedCommonDraft.delivery.trim() || null,
      budget: reviewBudget,
      uncertainItems,
    };
  }, [
    appliedProfessionalDescription,
    categoryConfident,
    categoryUserChoice,
    editableUnderstoodFacts,
    mergedCommonDraft.budget,
    mergedCommonDraft.city,
    mergedCommonDraft.delivery,
    professionalText,
    requestText,
    schemaCategory.displayLabelSafe,
    selectedCategory.label,
    selectedCategory.subcategories,
    hybrid.state?.subcategorySlug,
  ]);

  const isHealthCategory =
    activeCategoryId === "health" ||
    activeCategoryId === "healthcare" ||
    /sağlık|saglik/i.test(selectedCategory.label);

  useEffect(() => {
    if (composerStartedRef.current) return;
    if (requestText.trim().length < 3) return;
    composerStartedRef.current = true;
    trackComposerEvent("composer_started", {
      hasQueryParam: Boolean(queryFromHome),
    });
  }, [queryFromHome, requestText]);

  useEffect(() => {
    if (focusedQuestions.length === 0) return;
    trackComposerEvent("focused_question_shown", {
      count: focusedQuestions.length,
      keys: focusedQuestions.map((q) => q.fieldKey).join(","),
    });
  }, [focusedQuestions]);

  useEffect(() => {
    if (!categoryGuidance) return;
    trackComposerEvent("category_clarification_shown", {
      candidateCount: categoryGuidance.candidates.length,
    });
  }, [categoryGuidance]);

  useEffect(() => {
    if (!requestText.trim()) {
      // GEREKLI ASAMA SIFIRLAMASI. Kullanici metni tamamen sildiginde asama
      // compose'a donmek ZORUNDA: aksi halde bos bir talep uzerinde review
      // ya da clarify ekraninda sikisir ve cikis yolu kalmaz. Bu bir
      // turetilmis deger degil, kullanici eylemine karsilik gelen tek yonlu
      // sifirlamadir; React ayni degerde bail-out yaptigi icin kaskad tek
      // render turuyla sinirlidir.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUxStage("compose");
      return;
    }
    if (uxStage === "review") return;
    if (
      !hybrid.isSyncing &&
      (editableUnderstoodFacts.length > 0 ||
        categoryGuidance ||
        focusedQuestions.length > 0)
    ) {
      setUxStage("clarify");
    }
  }, [
    categoryGuidance,
    editableUnderstoodFacts.length,
    focusedQuestions.length,
    hybrid.isSyncing,
    requestText,
    uxStage,
  ]);

  const budgetCopy = budgetPromptForStrategy(brain.strategy?.strategy);

  function applyCategoryGuidance(selection: CategoryGuidanceSelection) {
    const choice = categoryGuidanceToUserChoice(selection);
    setCategoryUserChoice(choice);

    if (selection.kind === "candidate") {
      setCategoryOverride(selection.slug);
      setCategoryLockedByUser(true);
      setGuidanceSelectedSlugs([selection.slug]);
      setShowOtherDomainInput(false);
      return;
    }

    if (selection.kind === "multi") {
      const primary = selection.slugs[0];
      if (primary) {
        setCategoryOverride(primary);
        setCategoryLockedByUser(true);
      }
      setGuidanceSelectedSlugs(selection.slugs);
      setShowOtherDomainInput(false);
      return;
    }

    // Actions
    setGuidanceSelectedSlugs([]);
    if (selection.action === "defer_to_talepo") {
      setCategoryOverride(null);
      setCategoryLockedByUser(false);
      setShowOtherDomainInput(false);
      return;
    }
    if (selection.action === "none_of_these") {
      setCategoryOverride(null);
      setCategoryLockedByUser(false);
      setShowOtherDomainInput(false);
      return;
    }
    if (selection.action === "other_domain") {
      setCategoryOverride(null);
      setCategoryLockedByUser(false);
      setShowOtherDomainInput(true);
    }
  }

  function applyClarification(option: ClarificationOption) {
    // Legacy companion path — keep for field-level clarification only.
    if (option.categoryId) {
      setCategoryOverride(option.categoryId);
      setCategoryLockedByUser(true);
      setCategoryUserChoice("picked_candidate");
      setGuidanceSelectedSlugs([option.categoryId]);
    }
    if (option.fieldKey && option.value != null) {
      setManualValues((current) => ({
        ...current,
        [option.fieldKey!]: option.value!,
      }));
      setConfirmedFactKeys((keys) =>
        keys.includes(option.fieldKey!) ? keys : [...keys, option.fieldKey!],
      );
    }
  }

  function applyHumanQuestionValue(
    question: QuestionCandidate,
    value?: string,
  ) {
    if (value === "bilmiyorum" || value === "fark-etmez") {
      const isAny = value === "fark-etmez";
      /**
       * "BİLMİYORUM" BİR DEĞER DEĞİLDİR (D3f Dilim 1, 2026-08-27).
       *
       * Buradan eskiden yerelleştirilmiş etiket (`"Belirtilmedi"`) kanonik
       * kayda DEĞER olarak yazılıyordu: alan `kind: "VALUE"` oluyor,
       * projection'ın `attributes` torbasına giriyor ve matching onu bir ürün
       * özelliği / marka sanıyordu. Kanonik mod taşınır; etiket yalnız
       * kullanıcının ekranda gördüğü metindir.
       */
      hybrid.applyQuickOption(
        question.fieldKey,
        isAny ? "Farketmez" : "Belirtilmedi",
        isAny,
        isAny ? "ANY" : "UNKNOWN",
      );
      setManualValues((current) => ({
        ...current,
        [question.fieldKey]:
          value === "fark-etmez" ? "Fark etmez" : "Belirtilmedi",
      }));
      return;
    }
    if (value != null && value !== "") {
      applyBrainQuestion(question, value);
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

  const showBudgetActions =
    visibleCommonFieldKeys.has("budget") &&
    isBudgetMeaningfulForStrategy(brain.strategy?.strategy) &&
    isMarketRangeReliable({
      marketMedian: brain.marketIntelligence?.marketRange?.median,
      overallConfidenceLevel: brain.marketIntelligence?.overallConfidence?.level,
    });

  const readinessLabel = readiness.message;

  const hasText = requestText.trim().length > 0;

  useEffect(() => {
    let frame: number | null = null;
    const syncAiPanelWithPage = () => {
      frame = null;
      if (window.innerWidth < 1024) {
        aiPanelNaturalTopRef.current = null;
        aiPanelOffsetRef.current = 0;
        setAiPanelScrollOffset(0);
        return;
      }

      const panel = aiPanelFollowRef.current;
      if (!panel) return;

      if (aiPanelNaturalTopRef.current == null) {
        aiPanelNaturalTopRef.current =
          panel.getBoundingClientRect().top +
          window.scrollY -
          aiPanelOffsetRef.current;
      }

      const nextOffset = Math.max(
        0,
        window.scrollY - aiPanelNaturalTopRef.current,
      );
      aiPanelOffsetRef.current = nextOffset;
      setAiPanelScrollOffset(Math.round(nextOffset));
    };
    const onScroll = () => {
      if (frame == null) frame = window.requestAnimationFrame(syncAiPanelWithPage);
    };

    syncAiPanelWithPage();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => {
      aiPanelNaturalTopRef.current = null;
      syncAiPanelWithPage();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame != null) window.cancelAnimationFrame(frame);
    };
  }, []);

  function applyExampleChip(example: string) {
    hybrid.resetWithText(example);
    clearCategoryOverridesOnTextEdit();
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
    setWizardStep(2);
    setAiCompanionOpen(true);
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
      const locations = city
        .split(",")
        .map((value) => parseRealEstateCity(value.trim()))
        .filter((value): value is { il: string; ilce: string } => Boolean(value));
      if (locations.length === 0) return;
      setCityTouched(true);
      setCommonDraft((current) => ({ ...current, city }));
      setRealEstateTouched(true);
      setRealEstateDraft({
        il: locations[0]!.il,
        ilce: locations[0]!.ilce,
        mahalleler: [],
      });
      setPublishedVersion(null);
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


  /**
   * ODAKLI SORU İŞLEYİCİLERİ — İKİ GÖRÜNÜM İÇİN TEK YOL (2026-08-29).
   *
   * Bu iki işleyici JSX içinde satır içi tanımlıydı; o hâlde yalnız standart
   * görünüm onlara ulaşabiliyordu. Adlandırılınca Maira sahnesi de AYNI
   * fonksiyonu çağırır: cevap uygulaması, answered/confirmed defterleri ve
   * telemetri tek yerde kalır, ikinci bir cevap yolu doğmaz.
   */
  function handleFocusedAnswer(fieldKey: string, value: string) {
                            if (
                              value === "skip" ||
                              value === "skip_optional"
                            ) {
                              setSkippedQuestionKeys((keys) =>
                                keys.includes(fieldKey)
                                  ? keys
                                  : [...keys, fieldKey],
                              );
                              trackComposerEvent("focused_question_skipped", {
                                fieldKey,
                              });
                              return;
                            }
                            /**
                             * CEVAP, SORU GÖRÜNÜR DEĞİLKEN DE UYGULANIR.
                             *
                             * Zaten cevaplanmış bir alan zamanlayıcıdan
                             * yayınlanmaz; "Yanıtlarım" üzerinden düzeltilen
                             * cevap bu yüzden sessizce düşüyordu (tarayıcıda
                             * ölçüldü, 2026-08-30). Uygulayıcının ihtiyacı olan
                             * tek şey alan anahtarıdır; görünür soru bulunamazsa
                             * anahtarla devam edilir. İkinci bir cevap yolu
                             * açılmaz — aynı işleyici, aynı apply-plan.
                             */
                            const question =
                              enrichmentCandidates.find(
                                (q) => q.fieldKey === fieldKey,
                              ) ??
                              focusedQuestions.find(
                                (q) => q.fieldKey === fieldKey,
                              ) ?? ({ fieldKey } as QuestionCandidate);
                            applyBrainQuestion(question, value);
                            /**
                             * KULLANICI METNİ OTORİTESİ (kurucu, 2026-08-26).
                             *
                             * Verilen cevap ARTIK serbest metne yazılmaz. Bu,
                             * 2026-08-23 tarihli "cevap metne de işlenir"
                             * kararının YERİNE GEÇER. Gerekçe ölçülmüş bir
                             * zarardır: bestecinin metne yazdığı sözcük bir
                             * sonraki okumada BAŞKA bir alanın kullanıcı kanıtı
                             * sayılabiliyordu ve kullanıcı kendi cümlesinde
                             * makine slug'ı ("Talep türü: vehicle.") görüyordu.
                             *
                             * Cevap kaybolmaz: `applyBrainQuestion` zaten her
                             * cevabı `hybrid.applyQuickOption` üzerinden
                             * kanonik duruma EXPLICIT_BROWSE kaynağıyla yazar
                             * ve o yol rawInput'u bilerek korur. `rawInput`
                             * kullanıcının yazdığı metin olarak değişmeden
                             * kalır.
                             */
                            setAnsweredQuestionKeys((keys) =>
                              keys.includes(fieldKey)
                                ? keys
                                : [...keys, fieldKey],
                            );
                            setConfirmedFactKeys((keys) =>
                              keys.includes(fieldKey)
                                ? keys
                                : [...keys, fieldKey],
                            );
                            trackComposerEvent(
                              isSoftEscapeValue(value)
                                ? "focused_question_skipped"
                                : "focused_question_answered",
                              { fieldKey },
                            );
                          }

  function handleFocusedSkip(fieldKey: string) {
                            const importance = focusedQuestions.find(
                              (q) => q.fieldKey === fieldKey,
                            )?.importance;
                            if (importance && importance !== "optional") {
                              return;
                            }
                            setSkippedQuestionKeys((keys) =>
                              keys.includes(fieldKey)
                                ? keys
                                : [...keys, fieldKey],
                            );
                            trackComposerEvent("focused_question_skipped", {
                              fieldKey,
                            });
                          }
  /**
   * CEVAP UYGULAMA — KARAR SAF MODÜLDE, ETKİ BURADA.
   *
   * Kararın kendisi `planAnswerApplication` içindedir ve React bilmez;
   * burada yalnız planın etkileri bugünkü kanonik yollara uygulanır.
   * Maira görünümü de aynı fonksiyonu çağırır — iki yüzey için ikinci bir
   * cevap yolu yoktur.
   */
  function applyBrainQuestion(question: QuestionCandidate, rawValue: string) {
    const plan = planAnswerApplication({
      fieldKey: question.fieldKey,
      rawValue,
      currentText: hybrid.text,
    });
    if (plan.noop) return;
    for (const effect of plan.effects) {
      if (effect.kind === "canonical") {
        hybrid.applyQuickOption(
          effect.fieldKey,
          effect.value,
          effect.isAny,
          effect.valueKind,
        );
      } else if (effect.kind === "common") {
        updateCommonField(effect.fieldKey, effect.value);
      } else if (effect.kind === "dynamic") {
        updateDynamicField(effect.fieldKey, effect.value);
      } else if (effect.kind === "appendText") {
        hybrid.setText(effect.value);
      } else if (effect.kind === "cityFilter") {
        if (effect.value) applyCityFilter(effect.value);
      }
    }
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

  /**
   * YAYIN HATASI İÇİN TEK YÜZEY OTORİTESİ (2026-08-26).
   *
   * Bir yayın önkoşulu hatası iki şeyi BİRLİKTE yapmak zorundadır: mesajı
   * kaydetmek ve mesajı taşıyan yüzeyi açmak. Bunlar dallarda ayrı ayrı elle
   * yazıldığında ayrıştılar: `requestPublish` içindeki dört erken dönüş ile
   * `publishRequest`'in emlak dalı mesajı yazıyor ama companion'ı açmıyordu.
   * Mobilde iç panel `aiCompanionOpen=false` ile gizli kaldığı için kullanıcı
   * hatayı hiç görmüyordu. Tek giriş noktası bu ikilinin gelecekte yeniden
   * ayrışmasını engeller; hata temizligi (`setPublishError(null)`) bu
   * otoritenin kapsamı dışındadır çünkü bir yüzey açmaz.
   */
  function surfacePublishFailure(message: string) {
    setPublishError(message);
    setAiCompanionOpen(true);
  }

  function requestPublish(version: "manual" | "ai") {
    if (isPublishing) return;

    if (!mergedCommonDraft.title.trim()) {
      surfacePublishFailure("Talebinizi yayınlamak için bir başlık gerekli.");
      return;
    }

    if (budgetRequired && !hasBudget) {
      surfacePublishFailure(
        "Bütçenizi belirtmeniz yeterli, ardından yayınlayabilirsiniz.",
      );
      return;
    }

    if (isRealEstate) {
      const locationError = realEstateLocationError(realEstateLocation);
      if (locationError) {
        setPublishedVersion(version);
        surfacePublishFailure(locationError);
        return;
      }
    }

    if (missingFields.length > 0) {
      surfacePublishFailure(
        `Yayın için şu bilgiye ihtiyacımız var: ${missingFields[0]!.label}`,
      );
      setOptionalOpen(true);
      return;
    }

    setPublishError(null);
    setPublishAsUrgent(false);
    setUrgencyPromptVersion(version);
  }

  function handlePublishAttempt() {
    // Never publish against the previous analysis after the user edits or
    // deletes text. The composer is the authority for every category.
    if (hybrid.isSyncing) {
      setPublishGuidanceAttempted(true);
      surfacePublishFailure("Talebinizdeki son değişiklikler kontrol ediliyor.");
      return;
    }
    if (
      ENABLE_AI_ONLY_PUBLISH_REQUIREMENTS &&
      missingPublishLabels.length > 0
    ) {
      setPublishGuidanceAttempted(true);
      setPublishButtonAttention(true);
      window.setTimeout(() => setPublishButtonAttention(false), 650);
      setAiCompanionOpen(true);
      setEnrichmentFieldKey(null);
      setEnrichmentDraft("");
      window.setTimeout(() => {
        document.getElementById("talepo-ai-companion")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
      return;
    }
    setPublishGuidanceAttempted(true);
    const locationError = isRealEstate
      ? realEstateLocationError(realEstateLocation)
      : null;
    if (locationError) {
      requestPublish("ai");
      return;
    }
    setPublishReadyAnimation(true);
    window.setTimeout(() => {
      setPublishReadyAnimation(false);
      requestPublish("ai");
    }, 900);
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
        surfacePublishFailure(locationError);
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

    const rawInputForPublish = sanitizeRawInput(requestText);
    const persistCategorySlug =
      categoryUserChoice === "defer_to_talepo" ||
      categoryUserChoice === "none_of_these" ||
      (categoryUserChoice === "other_domain" && !categoryLockedByUser) ||
      !selectedCategory.id?.trim()
        ? UNRESOLVED_CATEGORY_SLUG
        : selectedCategory.id;
    const persistCategoryName =
      persistCategorySlug === UNRESOLVED_CATEGORY_SLUG
        ? "Belirsiz kategori (sistem)"
        : selectedCategory.label;

    const baseProjection = hybrid.state
      ? buildDiscoveryProjectionFromState(hybrid.state)
      : null;
    const noteExpressions = [
      ...unresolvedExpressions,
      ...(otherDomainNote.trim() ? [otherDomainNote.trim()] : []),
    ];
    /**
     * KULLANICI DOKUNUŞUNUN TEK LİSTESİ. Understanding snapshot'ının
     * `confirmedFieldKeys` girdisi ile yayın torbasının `userTouchedKeys`
     * girdisi AYNI diziden okunur — iki ayrı dokunuş kaydı tutulursa
     * "onaylandı" ile "yayınlanabilir" sessizce ayrışır.
     */
    const userConfirmedFieldKeys = [
      ...confirmedFactKeys,
      ...Object.keys(manualValues).filter(
        (key) => (manualValues[key] ?? "").trim().length > 0,
      ),
    ];
    const understandingSnapshot = buildPublishUnderstandingSnapshot({
      understanding,
      userSelected: categoryLockedByUser,
      userChoice: categoryUserChoice,
      confirmedFieldKeys: userConfirmedFieldKeys,
      primarySlug:
        persistCategorySlug === UNRESOLVED_CATEGORY_SLUG
          ? null
          : persistCategorySlug,
    });
    // Attach other-domain / free-text context into unresolvedExpressions.
    if (noteExpressions.length > 0) {
      understandingSnapshot.unresolvedExpressions = [
        ...new Set([
          ...understandingSnapshot.unresolvedExpressions,
          ...noteExpressions.map((s) => s.slice(0, 240)),
        ]),
      ].slice(0, 40);
    }
    const discoveryProjection = withUnderstandingSnapshot(
      baseProjection,
      understandingSnapshot,
    );

    /**
     * Yayın payload'ının `fields[]` değerleri ham `dynamicValues`tan değil
     * kanonik yayın torbasından okunur (D3c-a): onaysız çıkarım kullanıcı
     * cevabı kanalına yazılamaz, kullanıcının dokunduğu her değer aynen gider.
     */
    const publishFieldValues = buildPublishFieldValues({
      canonicalFields: hybrid.state?.fields ?? null,
      values: dynamicValues,
      userTouchedKeys: userConfirmedFieldKeys,
    });
    /**
     * ORTAK ALAN CEVAPLARI DA AYNI KANALDAN GİDER (D3f Dilim 2b).
     *
     * `fields[]` yalnız görünür dinamik alanlardan kuruluyordu; ortak alanlar
     * (`budget` / `city` / `delivery` / `quantity` / `title`) hiçbir
     * kategoride bu listede olmadığı için kullanıcının bilinçli
     * "Bilmiyorum" / "Fark etmez" cevabı sunucuya HİÇ ulaşmıyordu. Liste tek
     * kurucudan çıkar; alan adına özel dal yoktur ve anahtarlar tekildir.
     */
    const publishAnswerFields = buildPublishAnswerFields({
      canonicalFields: hybrid.state?.fields ?? null,
      /* Kamuya açık soru evreni talebin O ANKİ kategorisinden türer (3h). */
      categoryId: hybrid.state?.categoryId ?? activeCategoryId,
      values: dynamicValues,
      userTouchedKeys: userConfirmedFieldKeys,
      dynamicFieldKeys: visibleDynamicFields.map((field) => field.key),
    });
    const commonAnswerFields = publishAnswerFields.filter(
      (row) => !visibleDynamicFields.some((field) => field.key === row.key),
    );

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: mergedCommonDraft.title,
          description: descriptionForPublish,
          rawInput: rawInputForPublish,
          professionalDescription: professionalText,
          category: {
            slug: persistCategorySlug,
            name: persistCategoryName,
            description: selectedCategory.description,
          },
          city: mergedCommonDraft.city,
          district: isRealEstate ? realEstateLocation.ilce : undefined,
          quantity: mergedCommonDraft.quantity,
          delivery: mergedCommonDraft.delivery,
          budget: mergedCommonDraft.budget,
          aiScore: completenessPct,
          aiSummary: [
            `Kategori: ${persistCategoryName}`,
            `AI güveni: %${Math.round(understanding.understandingConfidence * 100)}`,
            `Tahmini firma: ${matchingDisplay.estimatedCompanyCount}`,
            `Beklenen teklif: ${matchingDisplay.expectedOfferCount}`,
          ].join("\n"),
          isUrgent,
          featureBoost: featureBoost || null,
          publishVersion: version,
          // Phase 3A + Phase 1 understanding snapshot
          discoveryProjection: discoveryProjection ?? undefined,
          fields: [
            ...visibleDynamicFields.map((field) => ({
              ...field,
              required: isFieldRequired(field, dynamicValues),
              /* Değer VE mod birlikte gider (D3e): değer taşımayan bir
               * "Fark etmez" cevabı yalnız etiketle ifade edilemez. */
              value: publishFieldValues[field.key]?.value ?? "",
              mode: publishFieldValues[field.key]?.mode,
            })),
            /* Ortak alanların bilinçli değer taşımayan cevapları (D3f 2b). */
            ...commonAnswerFields.map((row) => ({
              key: row.key,
              label: row.label ?? row.key,
              type: "text" as const,
              required: false,
              value: row.value,
              mode: row.mode,
            })),
            // Legacy dual-write: older alerts/explore rows used brandPreference
            ...(activeCategoryId === "appliances" &&
            publishFieldValues.brand?.mode === "VALUE" &&
            publishFieldValues.brand.value.trim()
              ? [
                  {
                    key: "brandPreference",
                    label: "Marka tercihi",
                    type: "text" as const,
                    required: false,
                    value: publishFieldValues.brand.value.trim(),
                  },
                ]
              : []),
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
          // Kurucu (2026-08-23): üye olmadan doldurulan talep KAYBOLMAZ —
          // taslağı sakla; giriş/kayıt sonrası geri yüklenip otomatik yayınlanır.
          try {
            window.localStorage.setItem(
              PENDING_DRAFT_KEY,
              JSON.stringify({
                v: 1,
                savedAt: Date.now(),
                pendingPublish: true,
                text: requestText,
                manualValues,
                commonDraft,
                realEstateDraft,
                categoryOverride,
                categoryLockedByUser,
                categoryUserChoice,
                cityTouched,
                budgetTouched,
              }),
            );
          } catch {
            /* depolama kapalıysa akış eskisi gibi devam eder */
          }
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
      trackComposerEvent("request_published", {
        version,
        categoryUnresolved: publishReviewModel.categoryUnresolved,
      });
      setPublishSuccess({
        title: mergedCommonDraft.title,
        requestId,
        viewHref,
      });
      router.refresh();
    } catch (error) {
      surfacePublishFailure(
        error instanceof Error
          ? error.message
          : "Talep yayınlanırken bir hata oluştu.",
      );
      setIsPublishing(false);
      brain.setAnalysisStatus("READY_FOR_REVIEW");
    }
  }

  function renderCommonField(field: (typeof visibleCommonFields)[number]) {
    if (field.key === "city") return null;

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
            ? "Başlık metninize göre hazırlandı, düzenleyebilirsiniz"
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
      yearConditionConfirmation={
        yearConditionConfirmationPending ? yearConditionConfirmation : null
      }
      onChangeConfirmedCondition={(value) => {
        hybrid.applyQuickOption("condition", value, false);
        updateDynamicField("condition", value);
      }}
      onConfirmYearCondition={() =>
        setConfirmedYearConditionKey(yearConditionConfirmation?.key ?? null)
      }
      futureModelYearConfirmation={
        futureModelYearConfirmationPending ? futureModelYearConfirmation : null
      }
      onUseCurrentModelYear={() => {
        const year = futureModelYearConfirmation?.year;
        if (!year) return;
        const currentYear = new Date().getFullYear();
        hybrid.setText(requestText.replace(String(year), String(currentYear)));
        setConfirmedFutureModelYearKey(null);
      }}
      onConfirmFutureModelYear={() =>
        setConfirmedFutureModelYearKey(futureModelYearConfirmation?.key ?? null)
      }
      budgetConflict={budgetConflict}
      onChooseBudget={(value) => {
        if (!budgetConflict) return;
        if (value === budgetConflict.enteredBudget) {
          setConfirmedBudgetConflictKey(budgetConflict.key);
          return;
        }
        updateCommonField("budget", value);
        setConfirmedBudgetConflictKey(null);
      }}
      publishGuidance={{
        attempted: publishGuidanceAttempted,
        missingLabels: missingPublishLabels,
        missingFieldKeys: missingPublishFieldKeys,
      }}
      /*
       * HATA GORUNURLUGU. Review asamasinda ozet kendi hatasini gosterir;
       * onun disinda (ozellikle uyelik donusu sonrasi clarify asamasinda)
       * hata BURADA gorunur. Ikisi ayni anda cizilmez, boylece ayni hata
       * ayni ekranda iki kez gosterilmez. Tekrar denemesi kanonik
       * handlePublishAttempt kapisindan gecer: kapsam ve eksik alan
       * kontrolleri atlanmaz.
       */
      publishFailure={
        publishError && uxStage !== "review"
          ? { message: publishError, onRetry: handlePublishAttempt }
          : null
      }
      enrichmentCandidates={enrichmentCandidates}
      enrichmentFieldKey={enrichmentFieldKey}
      enrichmentDraft={enrichmentDraft}
      humanPrompts={humanPrompts}
      onEnrichmentSelect={(q) => {
        if (enrichmentFieldKey === q.fieldKey) {
          setEnrichmentFieldKey(null);
          setEnrichmentDraft("");
          return;
        }
        setEnrichmentFieldKey(q.fieldKey);
        /**
         * TASLAK ÇIKARIMLA DOLDURULMAZ (D3b, 2026-08-26).
         *
         * Buraya doğrudan mevcut değer yazıldığında Talepo'nun tahmini
         * seçili bir kullanıcı cevabı gibi görünüyordu. Hangi değerin
         * taslağa gideceğine bu dosya karar VERMEZ; kanonik cevap
         * otoritesini okuyan ortak yardımcı karar verir. Tahmin ise
         * sorunun kendi sözleşmesinde ÖNERİ olarak taşınır.
         */
        setEnrichmentDraft(
          resolveQuestionDraftPresentation(
            hybrid.state?.fields?.[q.fieldKey] ?? null,
            dynamicValues[q.fieldKey] ?? "",
          ).draftValue,
        );
        setAiCompanionOpen(true);
      }}
      onEnrichmentDraftChange={setEnrichmentDraft}
      onEnrichmentApply={(q, value) => {
        applyBrainQuestion(q, value);
        setEnrichmentFieldKey(null);
        setEnrichmentDraft("");
      }}
      onEnrichmentCancel={() => {
        setEnrichmentFieldKey(null);
        setEnrichmentDraft("");
      }}
      clarification={null}
      onClarificationSelect={applyClarification}
      showBudgetActions={showBudgetActions}
      onKeepBudget={() => setBudgetTouched(true)}
      onUseMarketMedian={() => {
        const median = brain.marketIntelligence?.marketRange?.median;
        if (median == null) return;
        setBudgetTouched(true);
        updateCommonField("budget", formatBudgetFromMedian(median));
      }}
      professionalText={professionalText}
      nextStepLabel={
        !composerReadiness.canReview && composerReadiness.blockingLabels.length
          ? composerReadiness.blockingLabels[0]
          : null
      }
      onNextStep={() => {
        setAiCompanionOpen(false);
        document
          .querySelector('[data-testid="composer-questions"]')
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      professionalDraftApplied={brain.professionalDraftApplied}
      professionalPreviewOpen={brain.professionalPreviewOpen}
      onToggleProfessionalPreview={() =>
        brain.setProfessionalPreviewOpen(!brain.professionalPreviewOpen)
      }
      onApplyProfessionalDraft={() => {
        const next = professionalText.trim();
        if (!next || next === requestText.trim()) {
          setAppliedProfessionalDescription(true);
          brain.setProfessionalDraftApplied(true);
          return;
        }
        // Kurucu kararı (2026-08-23): buton kompozer metnini de profesyonel
        // hâle çevirir; metin otoritedir — alt cevaplar yeniden türetilir,
        // karşılığı olmayanlar boş kalır (manuel yazımla aynı yol).
        setAppliedProfessionalDescription(true);
        brain.setProfessionalDraftApplied(true);
        setManualValues({});
        setCommonDraft({
          title: "",
          quantity: "",
          city: "",
          delivery: "",
          budget: "",
        });
        setTitleManuallyEdited(false);
        setCityTouched(false);
        setBudgetTouched(false);
        setRealEstateTouched(false);
        setRealEstateDraft({ il: "", ilce: "", mahalleler: [] });
        setConfirmedYearConditionKey(null);
        setConfirmedFutureModelYearKey(null);
        setConfirmedBudgetConflictKey(null);
        hybrid.setText(next);
        setPublishedVersion(null);
        setPublishError(null);
        setWizardStep(2);
        // Basıldığı belli olsun: metnin değiştiği yere götür (kurucu, 2026-08-23)
        document
          .getElementById("talep-composer")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      matchingFirmCount={matchingDisplay.estimatedCompanyCount}
    />
  );

  const aiCompanionShell = (
    <div id="talepo-ai-companion" className={`talepo-ai-panel min-h-0 scroll-mt-20 rounded-[2rem] ${ENABLE_FIXED_DESKTOP_WORKSPACE ? "lg:flex lg:h-full lg:min-h-0 lg:flex-col" : "lg:min-h-[32rem]"}`}>
      <span className="talepo-ai-topline" aria-hidden />
      <button
        type="button"
        className="relative z-[1] flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left lg:hidden"
        onClick={() => setAiCompanionOpen((open) => !open)}
        aria-expanded={effectiveAiCompanionOpen}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="talepo-ai-emblem shrink-0">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/75">
              <span className="talepo-ai-status-dot" />
              Talepo AI
            </p>
            <p className="talepo-ai-title mt-1 truncate text-sm font-semibold">
              {/* Kapsam dışı talep "yayına hazır" diyemez — uyarıyla çelişir. */}
              {composerOutOfScope
                ? "Talepo kapsamı dışında"
                : readiness.state === "READY"
                ? "Yayına hazır"
                : enrichmentCandidates.length > 0
                  ? `${enrichmentCandidates.length} öneri · netleştir`
                  : "Analiz asistanı"}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-teal-100/45 transition ${
            effectiveAiCompanionOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div className="relative z-[1] hidden items-center gap-3 px-5 pt-6 lg:flex">
        <span className="talepo-ai-emblem shrink-0">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/75">
            <span className="talepo-ai-status-dot" />
            Talepo AI
          </p>
          <p className="talepo-ai-title mt-1 text-base font-semibold">
            Analiz asistanı
          </p>
        </div>
      </div>

      <div
        className={`relative z-[1] min-w-0 px-4 pb-5 sm:px-6 sm:pb-7 lg:block lg:pt-4 ${ENABLE_FIXED_DESKTOP_WORKSPACE ? "lg:min-h-0 lg:flex-1 lg:overflow-y-auto" : ""} ${
          effectiveAiCompanionOpen
            ? "block border-t border-white/10 pt-4 lg:border-t-0"
            : "hidden lg:block"
        }`}
      >
        {aiPanelContent}
      </div>
    </div>
  );

  /**
   * Kanonik cevaplardan türetilmiş "Yanıtlarım" satırları. İkinci depo
   * değildir; her render'da aynı kaynaktan yeniden türer.
   */
  const userAnswerRows = projectUserAnswers({
    fields: hybrid.state?.fields ?? {},
    commonDraft: {
      city: mergedCommonDraft.city,
      budget: mergedCommonDraft.budget,
      delivery: mergedCommonDraft.delivery,
      quantity: mergedCommonDraft.quantity,
    },
    touchedCommonKeys: [
      ...(cityTouched ? ["city"] : []),
      ...(budgetTouched ? ["budget"] : []),
    ],
    categoryId: activeCategoryId,
    rawInput: understanding.rawInput,
    /**
     * Konum kanonik alan üretmez (dokunulmamış ortak alan sunucuya sızmamalı
     * kuralı), ama kullanıcı metinde açıkça yazdıysa bu bir CEVAPTIR ve
     * listeden düşmemelidir. Yalnız USER_EXPLICIT olan taşınır; çıkarım hayır.
     */
    explicitCommon: {
      ...(understanding.location?.city?.value &&
      (understanding.location.city.source === "USER_EXPLICIT" ||
        understanding.location.city.provenance === "EXPLICIT")
        ? { city: String(understanding.location.city.value) }
        : {}),
    },
  });

  if (viewMode === "maira") {
    return (
      <div className="min-h-screen bg-[#07040f] p-3 sm:p-5">
        <MairaStage
          questions={focusedQuestions}
          draftByKey={focusedDraftByKey}
          onDraftChange={(fieldKey, value) =>
            setFocusedDraftByKey((current) => ({ ...current, [fieldKey]: value }))
          }
          onAnswer={handleFocusedAnswer}
          onSkip={handleFocusedSkip}
          remainingCriticalCount={composerReadiness.remainingCriticalCount}
          answers={userAnswerRows}
          subtitle={readinessLabel}
          onExitToStandard={() => setViewMode("standard")}
          editControl={(fieldKey) => {
            /**
             * Cevaplanmış bir alan zamanlayıcıdan yeniden yayınlanmaz (kanonik
             * değer soruyu kapatır). Düzenleme yüzeyi bu yüzden doğrudan
             * KONTROL KAYDINDAN çözülür — seçenekler ve serbest cevap izni
             * aynı otoriteden gelir, Maira hiçbir şey üretmez.
             */
            if (!activeCategoryId) return null;
            const profile = listAllProfiles().find(
              (def) => def.fieldKey === fieldKey,
            );
            const control = resolveQuestionControl({
              categoryId: activeCategoryId,
              fieldKey,
              importance: profile?.importance ?? "optional",
              allowUnknown: Boolean(profile?.allowUnknown),
              allowDontCare: Boolean(profile?.allowDontCare),
              isRealEstate: activeCategoryId === "real-estate",
              profileChoices: profile?.quickChoices,
            });
            return control.options.length > 0 || control.allowCustom
              ? control
              : null;
          }}
          onEditAnswer={(fieldKey, value) => {
            /* Mevcut kanonik cevap işleyicisi — ikinci güncelleme yolu yok. */
            handleFocusedAnswer(fieldKey, value);
          }}
        />
      </div>
    );
  }

  return (
    <main className={`relative min-h-screen overflow-x-hidden bg-[#f4f7f6] text-[#0f1f1d] ${ENABLE_FIXED_DESKTOP_WORKSPACE ? "lg:h-screen lg:overflow-hidden" : ""}`}>
      <header className="sticky top-0 z-40 border-b border-[#0f1f1d]/8 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto grid h-14 max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="justify-self-start">
            <Link
              href="/panel"
              className="talepo-cloud-pill px-3 py-2 text-sm font-medium text-[#0f1f1d]/72 transition hover:border-teal-800/15 hover:text-[#0f1f1d] sm:px-3.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="hidden sm:inline">Panele dön</span>
            </Link>
          </div>

          <Link href="/" aria-label="Talepo ana sayfa" className="shrink-0">
            <span className="text-[1.35rem] font-semibold tracking-[-0.05em] text-[#0f1f1d] sm:text-[1.45rem]">
              tale
              <span className="text-[#0f766e]">po</span>
            </span>
          </Link>

          <div className="justify-self-end">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${
                hasText
                  ? "border-[#0f766e]/12 bg-[#f0fdfa] text-[#115e59]"
                  : "border-[#0f1f1d]/8 bg-white text-[#0f1f1d]/45"
              }`}
            >
              {hasText ? "Hazırlanıyor" : "Yeni talep"}
            </span>
          </div>
        </div>
      </header>

      <div className={`relative z-10 mx-auto max-w-[1280px] px-4 py-4 sm:px-6 lg:px-8 ${ENABLE_FIXED_DESKTOP_WORKSPACE ? "lg:h-[calc(100vh-4rem)] lg:overflow-hidden" : ""}`}>
        {publishSuccess ? (
          <PublishSuccessMoment
            title={publishSuccess.title}
            requestId={publishSuccess.requestId}
            viewHref={publishSuccess.viewHref}
            onNewRequest={() => {
              setPublishSuccess(null);
              setPublishedVersion(null);
              setPublishError(null);
              hybrid.resetWithText("");
              hybrid.setOpenBrowsePanel(true);
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
              setTitleManuallyEdited(false);
              setRealEstateDraft({ il: "", ilce: "", mahalleler: [] });
              setRealEstateTouched(false);
              setCityTouched(false);
              setBudgetTouched(false);
              setOptionalOpen(false);
              setAiCompanionOpen(false);
              setEnrichmentFieldKey(null);
              setEnrichmentDraft("");
              setFeatureBoost("");
              setCategoryOverride(null);
              setCategoryLockedByUser(false);
              setCategoryUserChoice(null);
              setConfirmedFactKeys([]);
              setDismissedFactKeys([]);
              setOtherDomainNote("");
              setShowOtherDomainInput(false);
              setUnresolvedExpressions([]);
              setGuidanceSelectedSlugs([]);
            }}
          />
        ) : (
          <>
            <section className={`talepo-rise talepo-hero-aurora relative mx-auto mb-5 max-w-3xl overflow-hidden rounded-[1.75rem] px-6 py-8 text-center sm:rounded-[2rem] sm:px-10 sm:py-10 ${ENABLE_FIXED_DESKTOP_WORKSPACE && hasText ? "lg:hidden" : ""}`}>
              <div className="talepo-hero-aurora-glow" aria-hidden />
              <div className="relative">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  <Sparkles className="h-3.5 w-3.5 text-[#7cc4ff]" />
                  Anlat · Netleştir · Yayınla
                </p>
                <h1 className="mt-4 text-[2rem] font-semibold tracking-[-0.05em] text-white sm:text-[2.6rem]">
                  Ne aradığını{" "}
                  <span className="bg-gradient-to-r from-[#8fd0ff] via-[#c4b5fd] to-[#ffb280] bg-clip-text text-transparent">
                    anlat.
                  </span>
                </h1>
                <p className="mx-auto mt-2.5 max-w-xl text-sm font-medium leading-6 text-white/55 sm:text-base">
                  Talepo doğru firmalara ulaşması için gerisini seninle birlikte
                  tamamlasın. İstersen kategoriden de başlayabilirsin.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[#221a3f]">
                    1 · Anlat
                  </span>
                  <span className="text-white/30">→</span>
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      hasText
                        ? "bg-white text-[#221a3f]"
                        : "bg-white/10 text-white/55"
                    }`}
                  >
                    2 · Kontrol et & tamamla
                  </span>
                </div>
              </div>
            </section>

            <div
              className={`mx-auto grid items-start gap-5 ${
                hasText
                  ? `max-w-[1180px] lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)] lg:gap-7 ${ENABLE_FIXED_DESKTOP_WORKSPACE ? "lg:h-full lg:min-h-0" : ""}`
                  : "max-w-[920px]"
              }`}
            >
              <div className={`flex min-w-0 flex-col gap-4 ${ENABLE_FIXED_DESKTOP_WORKSPACE && hasText ? "lg:h-full lg:overflow-y-auto lg:pr-2" : ""}`}>
                <div
                  className={`talepo-rise talepo-rise-delay-1 rounded-[1.35rem] border bg-white p-4 shadow-[0_28px_80px_rgba(11,37,34,0.08)] transition-[border-color,box-shadow] duration-300 sm:p-5 ${
                    composerFocused
                      ? "border-[#0f766e]/35 shadow-[0_28px_80px_rgba(11,37,34,0.12)]"
                      : "border-[#0f1f1d]/8"
                  }`}
                >
                  <label
                    htmlFor="talep-composer"
                    className="block text-sm font-semibold text-[#0f1f1d]"
                  >
                    İhtiyacını anlat
                  </label>
                  <p className="mt-1 text-xs text-[#0f1f1d]/45">
                    Doğal cümlelerle yaz. Kategori ağacı seni sınırlamaz.
                  </p>

                  <textarea
                    id="talep-composer"
                    value={requestText}
                    onFocus={() => setComposerFocused(true)}
                    onBlur={() => setComposerFocused(false)}
                    onChange={(event) => {
                      const nextText = formatBudgetNumbersInText(event.target.value);
                      // The composer is authoritative. Any field removed from
                      // the text must not survive as a stale manual answer.
                      setManualValues({});
                      setCommonDraft({
                        title: "",
                        quantity: "",
                        city: "",
                        delivery: "",
                        budget: "",
                      });
                      setTitleManuallyEdited(false);
                      setCityTouched(false);
                      setBudgetTouched(false);
                      setRealEstateTouched(false);
                      setRealEstateDraft({ il: "", ilce: "", mahalleler: [] });
                      setConfirmedYearConditionKey(null);
                      setConfirmedFutureModelYearKey(null);
                      setConfirmedBudgetConflictKey(null);
                      // Elle düzenleme profesyonel-uygulandı durumunu düşürür
                      setAppliedProfessionalDescription(false);
                      brain.setProfessionalDraftApplied(false);
                      hybrid.setText(nextText);
                      clearCategoryOverridesOnTextEdit();
                      setPublishedVersion(null);
                      setPublishError(null);
                      if (nextText.trim().length > 0) {
                        setWizardStep(2);
                        setAiCompanionOpen(true);
                      }
                    }}
                    className="mt-3 min-h-[120px] w-full resize-y bg-transparent text-[16px] leading-7 text-[#0f1f1d] outline-none placeholder:text-[#0f1f1d]/28 sm:min-h-[140px] sm:text-[17px] sm:leading-8"
                    placeholder="Örn. İstanbul’da 55 inç Arçelik televizyon arıyorum."
                  />

                  <HybridCategoryBrowsePanel
                    open={hybrid.openBrowsePanel}
                    onToggle={() =>
                      hybrid.setOpenBrowsePanel(!hybrid.openBrowsePanel)
                    }
                    walk={hybrid.browseWalk}
                    columns={hybrid.browseColumns}
                    degraded={hybrid.browseDegraded}
                    onSelectAtColumn={(columnIndex, node) => {
                      hybrid.selectBrowseNodeAtColumn(columnIndex, node);
                      // Yeni bir seçim, önceki "Kaldır" kararlarını geçersiz
                      // kılar — satır tekrar görünür (kurucu, 2026-08-23).
                      setDismissedFactKeys([]);
                      setWizardStep(2);
                      setAiCompanionOpen(true);
                    }}
                    onReset={hybrid.resetBrowseWalk}
                  />

                  {requestText.trim().length > 0 ? (
                    <>
                      <UnderstoodFactsBoard
                        hasText
                        updating={hybrid.isSyncing}
                        degraded={hybrid.browseDegraded}
                        /*
                          Kullanıcının VERDİĞİ cevaplar da bu panoda görünür:
                          birleştirme kör değildir, kanonik cevap aynı alandaki
                          eski olguyu yener ve yinelenen satır üretmez.
                        */
                        facts={mergeAnswersIntoUnderstoodFacts({
                          facts: editableUnderstoodFacts,
                          answers: userAnswerRows,
                        })}
                        collapsed={uxStage === "review"}
                        onExpand={() => setUxStage("clarify")}
                        categoryLabel={
                          hybrid.isSyncing
                            ? null
                            : categoryConfident &&
                                schemaCategory.displayLabelSafe
                              ? selectedCategory.label
                              : null
                        }
                        onConfirmFact={(key) => {
                          setConfirmedFactKeys((keys) =>
                            keys.includes(key) ? keys : [...keys, key],
                          );
                        }}
                        onDismissFact={(key) => {
                          setDismissedFactKeys((keys) =>
                            keys.includes(key) ? keys : [...keys, key],
                          );
                          setManualValues((current) => {
                            const next = { ...current };
                            delete next[key];
                            return next;
                          });
                        }}
                        onEditFact={(key, value) => {
                          setManualValues((current) => ({
                            ...current,
                            [key]: value,
                          }));
                          setConfirmedFactKeys((keys) =>
                            keys.includes(key) ? keys : [...keys, key],
                          );
                          hybrid.applyQuickOption(key, value, false);
                        }}
                        onDontCareFact={(key) => {
                          hybrid.applyQuickOption(key, "Farketmez", true);
                          setManualValues((current) => ({
                            ...current,
                            [key]: "Fark etmez",
                          }));
                          setConfirmedFactKeys((keys) =>
                            keys.includes(key) ? keys : [...keys, key],
                          );
                        }}
                      />

                      {categoryGuidance && !categoryUserChoice ? (
                        <CategoryGuidanceCard
                          model={categoryGuidance}
                          selectedSlugs={guidanceSelectedSlugs}
                          selectedAction={null}
                          showOtherDomainInput={showOtherDomainInput}
                          otherDomainNote={otherDomainNote}
                          onOtherDomainNoteChange={(value) => {
                            setOtherDomainNote(value);
                            setUnresolvedExpressions((prev) => {
                              const cleaned = prev.filter(
                                (item) => !item.startsWith("other_domain:"),
                              );
                              const trimmed = value.trim();
                              return trimmed
                                ? [
                                    ...cleaned,
                                    `other_domain:${trimmed.slice(0, 200)}`,
                                  ]
                                : cleaned;
                            });
                          }}
                          onSelect={applyCategoryGuidance}
                        />
                      ) : null}

                      <CategoryGuidanceSummary
                        userChoice={categoryUserChoice}
                        selectedSlugs={guidanceSelectedSlugs}
                        otherDomainNote={otherDomainNote}
                        onChange={() => {
                          setCategoryUserChoice(null);
                          setGuidanceSelectedSlugs([]);
                          setCategoryLockedByUser(false);
                        }}
                      />

                      {/*
                        MAIRA GİRİŞİ — AYNI STATE, FARKLI YÜZEY.
                        Görünüm değişimi cevapları yeniden kurmaz; yalnız
                        `viewMode` değişir ve bileşen unmount olmaz.
                      */}
                      {focusedQuestions.length > 0 && uxStage !== "compose" ? (
                        <button
                          type="button"
                          data-testid="composer-enter-maira"
                          onClick={() => setViewMode("maira")}
                          className="mb-3 min-h-11 w-full rounded-xl border border-[#0f766e]/25 bg-[#f0fdfa] px-4 text-sm font-medium text-[#0f5f59] transition hover:border-[#0f766e]/45"
                        >
                          Maira ile devam et
                        </button>
                      ) : null}

                      {focusedQuestions.length > 0 && uxStage !== "compose" ? (
                        <FocusedQuestionsPanel
                          questions={focusedQuestions}
                          draftByKey={focusedDraftByKey}
                          healthNotice={isHealthCategory}
                          collapsed={uxStage === "review"}
                          remainingCriticalCount={
                            composerReadiness.remainingCriticalCount
                          }
                          onExpand={() => setUxStage("clarify")}
                          onDraftChange={(fieldKey, value) =>
                            setFocusedDraftByKey((current) => ({
                              ...current,
                              [fieldKey]: value,
                            }))
                          }
                          onAnswer={handleFocusedAnswer}
                          onSkip={handleFocusedSkip}
                        />
                      ) : null}

                      {/*
                        KAPSAM DIŞI (arz ilanı) — kurucu kararı, 2026-08-25.
                        Kullanıcı boş ekranda bırakılmaz: ne olduğunu söyleyen
                        kısa bir açıklama ve metnine dönmesi için tek bir eylem
                        gösterilir. Bu dal review/publish dallarının ÖNÜNDEDİR;
                        kapsam dışında hiçbir yayın yolu render edilmez.
                      */}
                      {!hybrid.isSyncing && composerReadiness.outOfScopeNotice ? (
                        <div
                          data-testid="composer-out-of-scope"
                          className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950"
                        >
                          <p>{composerReadiness.outOfScopeNotice}</p>
                          <button
                            type="button"
                            data-testid="composer-out-of-scope-edit"
                            className="mt-2 min-h-10 rounded-lg bg-[#0f766e] px-3 text-sm font-medium text-white"
                            onClick={() => {
                              const el =
                                document.getElementById("talep-composer");
                              el?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                              (el as HTMLTextAreaElement | null)?.focus();
                            }}
                          >
                            {composerReadiness.editActionLabel}
                          </button>
                        </div>
                      ) : !hybrid.isSyncing && uxStage === "review" ? (
                        <PublishReviewSummary
                          model={publishReviewModel}
                          publishing={isPublishing}
                          publishError={publishError}
                          onEdit={() => {
                            setUxStage("clarify");
                          }}
                          onPublish={() => {
                            handlePublishAttempt();
                          }}
                        />
                      ) : !hybrid.isSyncing && composerReadiness.canReview ? (
                        <button
                          type="button"
                          data-testid="composer-review-cta"
                          className="mt-3 min-h-12 w-full rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,118,110,0.25)] transition hover:bg-[#115e59]"
                          onClick={() => {
                            setUxStage("review");
                            setWizardStep(2);
                            trackComposerEvent("publish_summary_opened");
                          }}
                        >
                          Önizle ve yayınla
                        </button>
                      ) : !hybrid.isSyncing && !composerReadiness.canReview ? (
                        /* Ana eylem hep görünür — eksik alanı söyler, tıklayınca
                           soruya götürür (kurucu, 2026-08-23). */
                        <button
                          type="button"
                          data-testid="composer-continue-hint"
                          className="mt-3 min-h-12 w-full cursor-pointer rounded-xl border border-[#0f766e]/25 bg-[#f0fdfa] px-4 text-sm font-semibold text-[#0f5f59] transition hover:border-[#0f766e]/45"
                          onClick={() => {
                            document
                              .querySelector('[data-testid="composer-questions"]')
                              ?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                        >
                          Yayın için son adım:{" "}
                          {composerReadiness.blockingLabels?.length
                            ? composerReadiness.blockingLabels.join(" + ")
                            : "kalan soruları yanıtlayın"}
                        </button>
                      ) : null}
                    </>
                  ) : null}

                  {hybrid.composerError ? (
                    <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-3 text-sm text-orange-950">
                      <p>
                        Talebinizi okurken bir sorun oluştu. Yazınız korunuyor —
                        kategoriden de devam edebilirsiniz.
                      </p>
                      <button
                        type="button"
                        className="mt-2 min-h-10 rounded-lg bg-[#0f766e] px-3 text-sm font-medium text-white"
                        onClick={() => hybrid.retrySync()}
                      >
                        Tekrar dene
                      </button>
                    </div>
                  ) : null}

                  <HybridBrowsePath
                    path={hybrid.isSyncing ? [] : hybrid.browsePath}
                    degraded={hybrid.browseDegraded}
                    allowBrandEdit
                    onEditBrandAny={() => {
                      hybrid.setOpenBrowsePanel(true);
                    }}
                  />

                  <ul className="mt-3 flex flex-col gap-1.5 border-t border-[#0f1f1d]/6 pt-3 text-xs text-[#0f1f1d]/50 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                    <li className="inline-flex items-center gap-1.5">
                      <span className="text-[#0f766e]">✓</span> Önce yaz, gerekirse
                      düzelt
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span className="text-[#0f766e]">✓</span> Kategori seni
                      kilitlemez
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span className="text-[#0f766e]">✓</span> Liste dışı ürün de
                      kabul
                    </li>
                  </ul>
                </div>

                <div className={`talepo-rise talepo-rise-delay-2 px-0.5 ${hasText ? "hidden" : ""}`}>
                  <p className="text-xs font-medium text-[#0f1f1d]/40">
                    Hızlı örnek
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {EXAMPLE_CHIPS.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => applyExampleChip(example)}
                        className="rounded-full border border-[#0f1f1d]/10 bg-white/80 px-3.5 py-2 text-left text-xs font-medium text-[#0f1f1d]/70 shadow-sm backdrop-blur-sm transition hover:border-[#0f766e]/30 hover:bg-[#ecfdf5] hover:text-[#0f1f1d]"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>

                {hasText ? (
              <section
                id="talep-finish"
                className="talepo-rise space-y-4 scroll-mt-20 sm:space-y-5"
              >
                {/*
                  YAYIN HATASI BU AKORDEONU ACAR (2026-08-26). Mobilde AI
                  companion bu <details> icinde ciziliyor (asagida,
                  `lg:hidden` sarmalayici). Akordeon varsayilan kapali
                  oldugu icin, hata kutusu companion'a tasindiginda mobil
                  kullanici onu yine goremiyordu: setAiCompanionOpen yalniz
                  ic sarmalayicinin hidden/block sinifini degistiriyor,
                  kapali bir <details>'i acmiyor. Masaustunde companion bu
                  agacin disindaki <aside> icinde oldugu icin etkilenmez.

                  ACILMA TEK YONLUDUR. Hata varken akordeon zorla acilir,
                  ama hata TEMIZLENDIGINDE zorla KAPANMAZ: kullanicinin o an
                  duzenledigi butce/konum alanlari, "Tekrar dene" basar
                  basmaz (requestPublish ilk isi olarak publishError'i
                  sifirlar) gozunun onunde kaybolmamalidir. Native toggle
                  `editDetailsOpen`'a yazildigi icin, hata gectikten sonra
                  panel kullanicinin biraktigi durumda kalir.
                */}
                <details
                  open={editDetailsOpen || publishSignalDemandsAttention}
                  onToggle={(event) =>
                    setEditDetailsOpen(event.currentTarget.open)
                  }
                  className="group rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white open:shadow-[0_10px_30px_rgba(11,37,34,0.06)]"
                >
                  <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-medium text-[#0f1f1d] marker:content-none [&::-webkit-details-marker]:hidden sm:px-5">
                    <span className="flex items-center justify-between gap-2">
                      <span>Bilgileri düzenle</span>
                      <span className="text-xs font-normal text-[#0f1f1d]/45 group-open:hidden">
                        Başlık, kategori ve ek alanlar
                      </span>
                    </span>
                  </summary>
                <div className="space-y-4 border-t border-[#0f1f1d]/6 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                  <div className="rounded-[1.25rem] border border-[#0f766e]/10 bg-[#f7fcfa]/80 p-4 sm:p-5">
                    <label className="block">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#0f1f1d]">
                          Talep başlığın
                        </span>
                        {!titleManuallyEdited ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#dff6ef] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0f766e]">
                            <Sparkles className="h-3 w-3" aria-hidden />
                            Talepo AI önerisi
                          </span>
                        ) : (
                          <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">
                            Sen düzenledin
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#0f1f1d]/45">
                        Önerimizi kullanabilir veya kutuya tıklayıp değiştirebilirsin.
                      </span>
                      <span className="relative mt-3 block">
                        <input
                          value={mergedCommonDraft.title}
                          onChange={(e) => updateCommonField("title", e.target.value)}
                          className="h-12 w-full rounded-xl border border-[#0f766e]/20 bg-[#f7fcfa] px-4 pr-24 text-sm font-semibold text-[#0f1f1d] outline-none transition focus:border-[#0f766e]/55 focus:bg-white focus:ring-4 focus:ring-[#0f766e]/8"
                          placeholder="Talep başlığını yaz"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[11px] font-medium text-[#0f766e]/60">
                          Düzenle
                        </span>
                      </span>
                    </label>
                    <label className="mt-4 block border-t border-[#0f1f1d]/6 pt-4">
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#0f1f1d]/35">
                        Kategori
                      </span>
                      <span className="relative mt-1.5 flex h-11 items-center rounded-lg border border-[#0f1f1d]/8 bg-[#fafcfb] px-3 focus-within:border-[#0f766e]/35">
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
                          aria-label="Kategori"
                          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                        >
                          {REQUEST_CATEGORIES.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm font-medium text-[#0f1f1d]">
                          {selectedCategory.label}
                        </span>
                        {activeCategoryId === detectedCategoryId ? (
                          <span className="ml-1.5 shrink-0 text-xs font-semibold">
                            <span className="text-[#0f1f1d]/45">- </span>
                            <span className="text-[#0f766e]">
                              Talepo AI Tarafından Seçildi!
                            </span>
                          </span>
                        ) : null}
                        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#0f1f1d]" aria-hidden />
                      </span>
                    </label>
                  </div>

                  {/* Budget — required, natural prompt */}
                  {!ENABLE_AI_ONLY_PUBLISH_REQUIREMENTS && budgetRequired ? (
                    <div className="rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white p-5 sm:p-6">
                      <h3 className="text-base font-semibold tracking-tight text-[#0f1f1d]">
                        {budgetCopy.title}
                      </h3>
                      {marketHint ? (
                        <p className="mt-1.5 text-sm text-[#0f1f1d]/50">
                          Piyasa referansı: {marketHint}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-sm text-[#0f1f1d]/50">
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
                          className="h-12 w-full rounded-xl border border-[#0f1f1d]/10 bg-[#fafcfb] px-3.5 text-sm outline-none focus:border-[#0f766e]/35 focus:bg-white"
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

                  {/* Required dynamic fields still missing — soft blocked prompts */}
                  {!ENABLE_AI_ONLY_PUBLISH_REQUIREMENTS && missingFields.length > 0 ? (
                    <div className="rounded-[1.35rem] border border-amber-900/10 bg-[#fffbf5] p-5">
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

                  {/* Advanced: all details */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setOptionalOpen((open) => !open)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                        optionalOpen
                          ? "border-[#0f766e]/30 bg-[#f0fdfa]"
                          : "border-[#0f1f1d]/10 bg-white/80 hover:border-[#0f766e]/20"
                      }`}
                      aria-expanded={optionalOpen}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <ListPlus className="h-4 w-4 shrink-0 text-[#0f766e]" />
                        <span>
                          <span className="block text-sm font-semibold text-[#0f1f1d]">
                            Verdiğim bilgileri düzenle
                          </span>
                          <span className="mt-0.5 block text-xs text-[#0f1f1d]/45">
                            Bütçe, konum ve diğer cevaplarını kontrol et
                          </span>
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-[#0f1f1d]/40 transition ${
                          optionalOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {optionalOpen ? (
                      <div className="mt-3 space-y-4 rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white p-4 sm:p-5">
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
                          {(ENABLE_AI_ONLY_PUBLISH_REQUIREMENTS
                            ? visibleCommonFields.filter(
                                (field) => field.key !== "title",
                              )
                            : optionalCommonFields.filter(
                                (field) => field.key !== "budget",
                              ))
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
                        <label className="block rounded-2xl border border-[#0f1f1d]/8 bg-[#f7faf9] px-4 py-3">
                          <span className="text-xs font-semibold text-[#0f1f1d]/55">
                            Öne çıkarma (isteğe bağlı)
                          </span>
                          <select
                            value={featureBoost}
                            onChange={(event) =>
                              setFeatureBoost(
                                event.target.value as typeof featureBoost,
                              )
                            }
                            className="mt-2 h-11 w-full rounded-xl border border-[#0f1f1d]/10 bg-white px-3 text-sm outline-none"
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

                  {/*
                    Yayin hatasi KUTUSU BURADAN KALDIRILDI (2026-08-26).
                    Bu blok varsayilan kapali bir <details> icindeydi:
                    kullanici akordeonu kendisi acmadan hatayi goremiyordu ve
                    "Tekrar dene" requestPublish'i dogrudan cagirarak kapsam
                    kapisini ve eksik alan rehberligini atliyordu. Hata artik
                    review asamasinda ozette, diger asamalarda AI companion
                    icinde role="alert" ile gosteriliyor ve tekrar denemesi
                    kanonik handlePublishAttempt kapisindan geciyor.
                  */}

                  {!ENABLE_AI_ONLY_PUBLISH_REQUIREMENTS ? <div
                    className={`rounded-[1.25rem] border px-4 py-3 ${
                      missingPublishLabels.length > 0
                        ? "border-orange-200 bg-orange-50/80"
                        : "border-[#0f766e]/15 bg-[#ecfdf5]"
                    }`}
                  >
                    {missingPublishLabels.length > 0 ? (
                      <>
                        <p className="text-sm font-semibold text-orange-900">
                          Talebi yayınlamak için şu bilgileri tamamlayın:
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {missingPublishLabels.map((label) => (
                            <li
                              key={label}
                              className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-xs font-medium text-orange-800"
                            >
                              {label}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-[#0f766e]">
                        Gerekli bilgiler tamamlandı. Talebinizi yayınlayabilirsiniz.
                      </p>
                    )}
                  </div> : null}

                  {/* Mobile: AI sits above optional edit */}
                  <div className="lg:hidden">{aiCompanionShell}</div>

                  <p className="text-center text-xs text-[#0f1f1d]/45">
                    Yayınlama, yukarıdaki talep özetinden yapılır.
                  </p>
                </div>
                </details>
              </section>
                ) : null}
              </div>

              {hasText ? (
        <aside className={`talepo-rise talepo-rise-delay-2 hidden min-w-0 lg:block ${ENABLE_FIXED_DESKTOP_WORKSPACE ? "lg:h-full lg:min-h-0" : "lg:self-start"}`}>
                <div
                  ref={aiPanelFollowRef}
                  className="lg:will-change-transform"
                  style={{ transform: `translateY(${aiPanelScrollOffset}px)` }}
                >
                  {aiCompanionShell}
                </div>
              </aside>
              ) : null}
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
            className="w-full max-w-md rounded-[28px] border border-[#0f1f1d]/10 bg-white p-6 shadow-[0_24px_64px_rgba(15,31,29,0.18)] sm:p-7"
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
            <p className="mt-2 text-sm leading-6 text-[#0f1f1d]/50">
              Yayınlamadan önce acil olup olmadığını belirtebilirsiniz.
            </p>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#0f1f1d]/10 bg-[#f7faf9] px-4 py-3.5 transition hover:border-[#0f1f1d]/15 hover:bg-[#eef6f4]">
              <input
                type="checkbox"
                checked={publishAsUrgent}
                onChange={(event) => setPublishAsUrgent(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#0f1f1d]/20 text-[#0f766e] focus:ring-[#0f766e]/25"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[#0f1f1d]">
                  Bu talep acil
                  <Zap className="h-3.5 w-3.5 text-[#0f766e]" />
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-[#0f1f1d]/45">
                  İşaretlerseniz tedarikçilere acil alıcı olarak iletilir.
                </span>
              </span>
            </label>

            <p className="mt-3 text-xs leading-5 text-[#0f1f1d]/40">
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
                className="flex min-h-[44px] w-full items-center justify-center rounded-2xl px-4 text-sm font-medium text-[#0f1f1d]/45 transition hover:text-[#0f1f1d]"
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
    "h-11 w-full rounded-xl border border-[#0f1f1d]/10 bg-[#fafcfb] px-3.5 text-sm outline-none transition focus:border-[#0f766e]/35 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.08)]";

  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-xs font-medium text-[#0f1f1d]/45">
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
        <span className="text-xs font-medium text-[#0f1f1d]/45">
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
              className="h-11 w-full appearance-none rounded-xl border border-[#0f1f1d]/10 bg-[#fafcfb] px-3.5 pr-10 text-sm outline-none transition focus:border-[#0f766e]/35 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.08)]"
            >
              <option value="">Seçiniz</option>

              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f1f1d]/30" />
          </>
        ) : (
          <input
            type={field.type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            className="h-11 w-full rounded-xl border border-[#0f1f1d]/10 bg-[#fafcfb] px-3.5 pr-12 text-sm outline-none transition focus:border-[#0f766e]/35 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.08)]"
          />
        )}

        {field.unit && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#0f1f1d]/30">
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
