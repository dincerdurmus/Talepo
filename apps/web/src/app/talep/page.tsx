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
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Send,
  TrendingUp,
  Zap,
} from "lucide-react";

import { describeContactInfo, stripContactInfo } from "@/lib/membership/contact-filter";
import {
  CONTACT_IN_REQUEST_NOTICE,
  CONTACT_KEEP_ACTION_LABEL,
  CONTACT_REMOVE_ACTION_LABEL,
  contactChoiceTelemetry,
  type ContactChoice,
} from "@/lib/request/contact-notice";
import { subcategorySlug } from "@/lib/knowledge/slug";
import {
  TalepoAiPanel,
  type ClarificationOption,
} from "@/components/request/TalepoAiPanel";
import { CategoryConfirmationCard } from "@/components/request/v2/CategoryConfirmationCard";
import { CategoryGuidanceCard } from "@/components/request/v2/CategoryGuidanceCard";
import { FocusedQuestionsPanel } from "@/components/request/v2/FocusedQuestionsPanel";
import { shouldConfirmYearCondition } from "@/components/request/YearConditionConfirmation";
import { isImplausibleFutureModelYear } from "@/components/request/FutureModelYearConfirmation";
import { CategorySheet } from "@/components/request/talep/CategorySheet";
import {
  MairaStatusLine,
  ReadingSentence,
  readingDurationMs,
  type MairaStatus,
} from "@/components/request/talep/MairaVoice";
import { RequestCardPanel } from "@/components/request/talep/RequestCardPanel";
import { TalepStartPanel } from "@/components/request/talep/TalepStartPanel";
import {
  buildReadingHighlights,
  toReadingSegments,
} from "@/lib/request-composer/v2/reading-highlights";
import { buildRequestCardModel } from "@/lib/request-composer/v2/request-card-model";
import { publishOutcomeFrom } from "@/lib/request/publish-result-status";
import {
  advanceBrowseWalk,
  createBrowseWalkState,
  listBrowseOptions,
} from "@/lib/request-composer/ui-helpers";
import type { BrowseNode } from "@/lib/knowledge/types";
import {
  formatBudgetDigits,
  planAnswerApplication,
  projectCanonicalCommonAnswers,
  projectUserAnswers,
} from "@/lib/request-composer/v2/answer-apply-plan";
import { mergeAnswersIntoUnderstoodFacts } from "./ui-helpers";
import { useHybridRequestComposer } from "@/hooks/useHybridRequestComposer";
import { usePublicCategories } from "@/hooks/usePublicCategories";
import { useRequestBrain } from "@/hooks/useRequestBrain";
import {
  formatBudgetFromMedian,
  isBudgetMeaningfulForStrategy,
  isMarketRangeReliable,
} from "@/lib/request-brain/budget-actions";
import {
  toHumanQuestions,
} from "@/lib/request-brain/human-question-layer";
import {
  buildCategoryChoice,
  buildCategoryConfirmation,
  categoryConfirmationToGuidanceSelection,
  type CategoryConfirmationAction,
} from "@/lib/request-composer/v2/category-confirmation";
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
} from "@/lib/geo/turkey-districts";
import {
  getVisibleCategoryFields,
  isFieldRequired,
  resolveCommonField,
  resolveRequestCategory,
  withCategoryFieldDefaults,
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
  resolveEditQuestion,
  scheduledToFocusedQuestion,
} from "@/lib/request-composer/v2/focused-questions";
import { computeComposerPublishReadiness } from "@/lib/request-composer/v2/publish-readiness";
import {
  PHASE_HEADINGS,
} from "@/lib/request-composer/v2/question-scheduler";
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
import { isUnsupportedRequestScope } from "@/lib/request-understanding/types";

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
  const categories = usePublicCategories();
  if (!categories) return <p className="p-8 text-center" role="status">Kategoriler yükleniyor. Bağlantı kurulunca devam edebilirsiniz.</p>;
  return <AvailableCategoryForm categories={categories} />;
}

function AvailableCategoryForm({ categories }: { categories: import("@/lib/request-category-engine").RequestCategory[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromHome = formatBudgetNumbersInText(
    searchParams.get("query")?.trim() ?? "",
  );
  const categoryFromHome = searchParams.get("category")?.trim() ?? "";
  const validCategoryFromHome = categories.some(
    (category) => category.id === categoryFromHome,
  )
    ? categoryFromHome
    : null;
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
  const [, setPublishButtonAttention] = useState(false);
  const [, setPublishReadyAnimation] = useState(false);
  /** Draft values typed in the AI companion suggestion rows (keyed by gap id). */
  const [, setOptionalOpen] = useState(false);
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
  const hybrid = useHybridRequestComposer({ initialText: queryFromHome, categories, selectedCategoryId: categoryOverride });
  const requestText = hybrid.text;
  const [categoryUserChoice, setCategoryUserChoice] =
    useState<CategoryUserChoice>(null);
  /**
   * KATEGORİ ONAY ADIMI — "Bu değil" görünümü (kurucu, 2026-09-12). Hangi
   * kategori tahmini için reddedildiği tutulur; tahmin değişince görünüm
   * kendiliğinden kapanır. Sayfa state'idir ki form ile Maira arasında
   * geçişte kaybolmasın. Kategoriye DOKUNMAZ; yalnız görünüm.
   */
  const [categoryRejectedFor, setCategoryRejectedFor] = useState<
    string | null
  >(null);
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
  const [, setFiltersOpen] = useState(false);
  const [, setAiPanelScrollOffset] = useState(0);
  const aiPanelFollowRef = useRef<HTMLDivElement>(null);
  const aiPanelNaturalTopRef = useRef<number | null>(null);
  const aiPanelOffsetRef = useRef(0);
  /** 1 = ihtiyaç metni, 2 = AI özeti onay / yayın */
  const [, setWizardStep] = useState<1 | 2>(1);
  /**
   * TEK AKIŞ, ANAHTAR YOK (kurucu, 2026-09-25). "Form" ile "Maira" ayrı
   * modlar değildir: talep kartı formun kendisi, Maira da sayfanın sesidir.
   * Tam ekran koyu sahne, giriş sahnesi ve "Maira seni bekliyor" bandı
   * kaldırıldı; bu yüzden görünüm anahtarı da kaldırıldı.
   *
   * `introDecided` KALDI ama artık tek bir şey söyler: kullanıcı cümlesini
   * gönderdi mi? Gönderene kadar başlangıç ekranı durur.
   */
  const [introDecided, setIntroDecided] = useState(false);
  /**
   * "MAIRA OKUYOR" ANI. Cümle gönderildiğinde büyük puntoyla durur ve
   * anlaşılan parçalar sırayla vurgulanır; süre dolunca alıntıya döner ve
   * kart belirir. Yalnız bir SUNUM aşamasıdır — hiçbir cevabı etkilemez.
   */
  const [readingPhase, setReadingPhase] = useState<"reading" | "quote">("quote");
  /**
   * Ekranda duran tek soru. Talep kartındaki satıra dokunmak da burayı
   * değiştirir; soru otoritesi değişmez, yalnız hangisinin görüneceği.
   */
  const [askingFieldKey, setAskingFieldKey] = useState<string | null>(null);
  /** Alttan açılan kategori paneli: akış ortasında `pick`, başta `browse`. */
  const [categorySheet, setCategorySheet] = useState<{
    mode: "pick" | "browse";
    root: BrowseNode | null;
  } | null>(null);
  /** Yayın sonucu: sunucunun döndürdüğü durum (D-0032) burada saklanır. */
  const [publishStatus, setPublishStatus] = useState<{
    status: string | null;
    publishedAt: string | null;
  } | null>(null);
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
  const proposedCategoryId = (() => {
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
  const activeCategoryId = categories.some((category) => category.id === proposedCategoryId) ? proposedCategoryId : "";
  const selectedCategory = resolveRequestCategory(activeCategoryId, categories);
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
    setCategoryRejectedFor(null);
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

  const canonicalCommon = useMemo(
    () => projectCanonicalCommonAnswers(hybrid.state?.fields ?? {}),
    [hybrid.state?.fields],
  );
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
        parsedCity: commonDraft.city || canonicalCommon.city || understandingCity,
        rawText: requestText,
        parsedNeighborhoods: manualValues.neighborhoods,
      }),
    [
      understandingCity,
      commonDraft.city,
      canonicalCommon.city,
      manualValues.neighborhoods,
      requestText,
    ],
  );

  // AI autofills until the user edits; after that their choice sticks.
  const realEstateLocation = realEstateTouched
    ? realEstateDraft
    : suggestedRealEstateLocation;

  const dynamicValues = useMemo(() => {
    const category = resolveRequestCategory(activeCategoryId, categories);
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
  }, [activeCategoryId, categories, hybrid.softFillFields, seededFields, manualValues]);

  /**
   * KALDI AMA ARTIK ÇİZİLMİYOR (2026-09-25). Eski "hızlı filtre çipleri"
   * yüzeyi yeni tasarımda yok; bu memo yalnız `verify-talep-companion-
   * contract-v1`in ölçtüğü `getExploreFilterDefs(activeCategoryId,
   * dynamicValues)` çağrı sözleşmesini ayakta tutuyor. Sözleşme yeniden
   * değerlendirilene kadar kullanılmayan bir değer olarak duruyor —
   * sessizce silinip kapının sahte yeşile düşmesi daha kötü olurdu.
   */
  const categoryFilterDefs = useMemo(
    () => getExploreFilterDefs(activeCategoryId, dynamicValues),
    [activeCategoryId, dynamicValues],
  );
  void categoryFilterDefs;

  const autoTitle = useMemo(() => {
    const category = resolveRequestCategory(activeCategoryId, categories);
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
    categories,
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
        ? commonDraft.quantity || canonicalCommon.quantity ||
          (understandingQuantity != null
            ? `${understandingQuantity} ${understandingUnit}`
            : "")
        : "",
      city: isRealEstate
        ? (cityTouched ? commonDraft.city : "") ||
          realEstateLocationToCity(realEstateLocation) ||
          commonDraft.city || canonicalCommon.city ||
          understandingCity ||
          ""
        : visibleCommonFieldKeys.has("city")
          ? cityTouched
            ? commonDraft.city
            : commonDraft.city || canonicalCommon.city || understandingCity || ""
          : "",
      delivery: visibleCommonFieldKeys.has("delivery")
        ? commonDraft.delivery || canonicalCommon.delivery || ""
        : "",
      budget: visibleCommonFieldKeys.has("budget")
        ? budgetTouched
          ? commonDraft.budget
          : commonDraft.budget || canonicalCommon.budget || understandingBudgetDisplay
        : "",
    }),
    [
      understandingBudgetDisplay,
      canonicalCommon,
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
  /**
   * TALEPTE İLETİŞİM BİLGİSİ (D-0031, 2026-09-23).
   *
   * Engel YOK: kullanıcı uyarılır ve seçer. Seçim yapılana kadar `null`
   * kalır; yayın yolunda gönderilmeyen seçim sunucuda "kaldır"a düşer.
   * Algılayıcı `contact-filter`ın kendisidir — ikinci bir algılayıcı yok.
   */
  const contactKinds = useMemo(
    () => describeContactInfo(hybrid.text ?? ""),
    [hybrid.text],
  );
  const [contactChoice, setContactChoice] = useState<ContactChoice | null>(null);
  // Reset this component's derived selection before committing a render of
  // contact-free text. The guard settles after one render; no effect cascade.
  if (contactKinds.length === 0 && contactChoice !== null) {
    setContactChoice(null);
  }
  const showContactNotice = contactKinds.length > 0 && contactChoice === null;

  const composerOutOfScope =
    isUnsupportedRequestScope(hybrid.state?.understanding?.requestScope?.value);

  const focusedQuestionSchedule = useMemo(() => {
    if (composerOutOfScope) {
      return {
        visible: [],
        remainingCriticalCount: 0,
        remainingOptionalCount: 0,
        canEnterReview: false,
        blockingFieldKeys: [],
        blockingLabels: [],
        phase: "detail" as const,
        phaseHeading: PHASE_HEADINGS.detail,
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

  /**
   * SORU BAĞLAMI — NORMAL SORU İLE DÜZELTME SORUSU İÇİN TEK OKUMA.
   *
   * Bu dört değer daha önce yalnız `focusedQuestions` içinde okunuyordu;
   * düzeltme yüzeyi kendi (eksik) bağlamını kuruyordu ve iki yüzey
   * ayrışabiliyordu. Tek memo, ayrışmayı yapısal olarak imkânsız kılar.
   */
  const questionContext = useMemo(() => {
    const valueOf = (key: string) => {
      const f = hybrid.state?.fields[key];
      return f?.kind === "VALUE" ? String(f.value ?? "") : null;
    };
    return {
      productType:
        valueOf("productType") ??
        valueOf("solutionType") ??
        valueOf("applianceType") ??
        valueOf("furnitureType") ??
        valueOf("babyProductType") ??
        valueOf("kitchenProductType") ??
        valueOf("machineType"),
      brand: valueOf("brand"),
      needType: valueOf("needType"),
      listingType: valueOf("listingType"),
      isRemoteService:
        /\buzaktan\b/i.test(requestText) ||
        (manualValues.locationMode ?? "").toLocaleLowerCase("tr-TR") ===
          "remote",
    };
  }, [hybrid.state?.fields, manualValues.locationMode, requestText]);

  const focusedQuestions = useMemo(() => {
    const hybridByKey = new Map(
      enrichmentCandidates.map((c) => [c.fieldKey, c]),
    );
    return focusedQuestionSchedule.visible.map((q) =>
      scheduledToFocusedQuestion(q, hybridByKey.get(q.fieldKey), {
        productType: questionContext.productType,
        needType: questionContext.needType,
        brand: questionContext.brand,
        isRemoteService: questionContext.isRemoteService,
        listingType: questionContext.listingType,
      }),
    );
  }, [
    enrichmentCandidates,
    focusedQuestionSchedule.visible,
    questionContext,
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
    const guidance = buildCategoryGuidance({
      understanding,
      rawText: requestText,
      categoryConfident,
      userLocked: categoryLockedByUser,
    });
    if (!guidance) return null;
    const candidates = guidance.candidates.filter((candidate) => categories.some((category) => category.id === candidate.slug));
    return { ...guidance, candidates, allowMultiSelect: guidance.allowMultiSelect && candidates.length > 1 };
  }, [
    categories,
    categoryConfident,
    categoryLockedByUser,
    hybrid.isSyncing,
    requestText,
    understanding,
  ]);

  /**
   * KATEGORİ ONAY ADIMI (kurucu, 2026-09-12). Motor güvenle karar verdiğinde
   * bile önce sorulur: "Bunu X olarak değerlendiriyorum, doğru mu?" Model tek
   * yerden kurulur; standart kart da Maira da AYNI nesneyi çizer. Belirsiz
   * durumda bu adım yoktur, rehberlik kartı (`categoryGuidance`) sürer.
   */
  const categoryConfirmation = useMemo(() => {
    const live = understandingMatchesComposerText({
      composerText: requestText,
      understandingRawInput: understanding.rawInput,
      isSyncing: hybrid.isSyncing,
    });
    if (!live) return null;
    const slug = hybrid.state?.subcategorySlug ?? null;
    const subLabel = slug
      ? selectedCategory.subcategories.find(
          (label) => subcategorySlug(label) === slug,
        ) ?? null
      : null;
    return buildCategoryConfirmation({
      rawText: requestText,
      isSyncing: hybrid.isSyncing,
      categoryConfident: schemaCategory.confident,
      categoryLockedByUser,
      categoryUserChoice,
      categoryId: activeCategoryId,
      displayLabelSafe: schemaCategory.displayLabelSafe,
      subcategoryLabel: subLabel,
    });
  }, [
    activeCategoryId,
    categoryLockedByUser,
    categoryUserChoice,
    hybrid.isSyncing,
    hybrid.state?.subcategorySlug,
    requestText,
    schemaCategory.confident,
    schemaCategory.displayLabelSafe,
    selectedCategory.subcategories,
    understanding.rawInput,
  ]);
  /**
   * MAIRA'DA BELİRSİZ DURUM (kurucu, 2026-09-12). Standart form kanonik
   * rehberlik kartını çizer; Maira aynı kararı kendi sahnesinde gösterir —
   * "Maira başka bir şey değil". Adaylar `categoryGuidance`'tan taşınır,
   * ikinci bir aday üretimi yoktur.
   */
  const categoryChoice = useMemo(() => {
    if (categoryConfirmation) return null;
    if (categoryUserChoice) return null;
    if (!categoryGuidance) return null;
    return buildCategoryChoice({
      guidance: categoryGuidance,
      categoryId: activeCategoryId,
    });
  }, [
    activeCategoryId,
    categoryConfirmation,
    categoryGuidance,
    categoryUserChoice,
  ]);
  /** Maira'nın gördüğü TEK adım: onay ya da seçim. */
  const categoryStepForMaira = categoryConfirmation ?? categoryChoice;
  const categoryRejected =
    categoryStepForMaira !== null &&
    categoryRejectedFor === (categoryStepForMaira.categoryId || "__choose__");

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
    if (!categoryConfirmation) return;
    trackComposerEvent("category_confirmation_shown", {
      categoryId: categoryConfirmation.categoryId,
      hasSubcategory: categoryConfirmation.subcategoryLabel !== null,
    });
  }, [categoryConfirmation]);

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
        categoryConfirmation ||
        focusedQuestions.length > 0)
    ) {
      setUxStage("clarify");
    }
  }, [
    categoryConfirmation,
    categoryGuidance,
    editableUnderstoodFacts.length,
    focusedQuestions.length,
    hybrid.isSyncing,
    requestText,
    uxStage,
  ]);

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
      /**
       * "BUNLARDAN HİÇBİRİ" KÖKLERİ AÇAR (2026-09-15). Maira'da "Bu değil"
       * 11 kök kategoriyi açıyordu; formda aynı dokunuş kartı kapatıp
       * kullanıcıyı kategorisiz bırakıyordu (ölçüldü). İki yüzey aynı
       * adımı yaşar: seçim kaydedilmez, kart kök ızgarasına döner;
       * "Vazgeç" adayları geri getirir.
       */
      setCategoryUserChoice(null);
      setCategoryOverride(null);
      setCategoryLockedByUser(false);
      setShowOtherDomainInput(false);
      setCategoryRejectedFor(categoryChoice?.categoryId || "__choose__");
      return;
    }
    if (selection.action === "other_domain") {
      setCategoryOverride(null);
      setCategoryLockedByUser(false);
      setShowOtherDomainInput(true);
    }
  }

  /**
   * Kategori onay dokunuşu — TEK işleyici, iki yüzey. "Evet" ve kök seçimi
   * mevcut `applyCategoryGuidance` yolundan geçer (picked_candidate + kilit);
   * "Bu değil" / "Vazgeç" yalnız görünümü değiştirir.
   */
  function applyCategoryConfirmation(action: CategoryConfirmationAction) {
    const step = categoryStepForMaira;
    if (!step) return;
    if (action.kind === "reject") {
      setCategoryRejectedFor(step.categoryId || "__choose__");
      trackComposerEvent("category_confirmation_rejected", {
        categoryId: step.categoryId,
        mode: step.mode,
      });
      return;
    }
    if (action.kind === "back") {
      setCategoryRejectedFor(null);
      return;
    }
    const selection = categoryConfirmationToGuidanceSelection(step, action);
    if (!selection) return;
    trackComposerEvent(
      action.kind === "confirm"
        ? "category_confirmation_confirmed"
        : "category_root_picked",
      {
        categoryId: step.categoryId,
        mode: step.mode,
        pickedCategoryId:
          selection.kind === "candidate" ? selection.slug : undefined,
      },
    );
    setCategoryRejectedFor(null);
    applyCategoryGuidance(selection);
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

  const showBudgetActions =
    visibleCommonFieldKeys.has("budget") &&
    isBudgetMeaningfulForStrategy(brain.strategy?.strategy) &&
    isMarketRangeReliable({
      marketMedian: brain.marketIntelligence?.marketRange?.median,
      overallConfidenceLevel: brain.marketIntelligence?.overallConfidence?.level,
    });

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

  /**
   * DÜZELTME KONTROLÜ — İKİ YÜZEY İÇİN TEK KÖPRÜ (2026-08-30).
   *
   * Maira "Yanıtlarım" ve standart "Talepo'nun anladıkları" panosu AYNI
   * çözücüyü çağırır. Çözücü, normal soru üretiminin kendi zincirini
   * kullanır (`resolveEditQuestion` → profil → `scheduledToFocusedQuestion`)
   * ve bağlamı normal soruyla aynı `questionContext` memosundan okur; bu
   * yüzden iki yüzeyin seçenek listesi ayrışamaz. Kayıt bir kontrol
   * veremiyorsa satır düzenlenemez — uydurma metin kutusu açılmaz.
   */
  function resolveAnswerEditQuestion(fieldKey: string) {
    if (!activeCategoryId) return null;
    const resolved = resolveEditQuestion({
      state: hybrid.state ?? null,
      fieldKey,
      categoryId: activeCategoryId,
      needType: questionContext.needType,
      productType: questionContext.productType,
      isRemoteService: questionContext.isRemoteService,
      listingType: questionContext.listingType,
    });
    return resolved.status === "ready" ? resolved.question : null;
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

    if (!categories.length || (proposedCategoryId && !activeCategoryId)) {
      surfacePublishFailure("Seçilen kategori şu anda kullanılamıyor. Lütfen aktif bir kategori seçin.");
      return;
    }

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

    if (!categories.length || (proposedCategoryId && !activeCategoryId)) {
      surfacePublishFailure("Seçilen kategori şu anda kullanılamıyor. Lütfen aktif bir kategori seçin.");
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
          /* D-0031: seçim sunucuya gider; sunucu metni ona göre uygular ve
             seçim gönderilmediyse GÜVENLİ tarafa (kaldır) düşer. */
          contactChoice: contactChoice ?? "REMOVED",
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
        /**
         * D-0032: sunucu talebin GERÇEK durumunu döndürür. Şüpheli talep
         * `PENDING_REVIEW` ile kaydedilir ve `publishedAt` boş kalır; arayüz
         * bu iki alanı okumadan "yayında" diyemez.
         */
        request?: { id?: string; status?: string; publishedAt?: string | null };
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
      setPublishStatus({
        status: result.request?.status ?? null,
        publishedAt: result.request?.publishedAt ?? null,
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


  const aiPanelContent = (
    <TalepoAiPanel
      insightMode
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
            <TrendingUp className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/75">
              Talep Analizi
            </p>
            <p className="talepo-ai-title mt-1 truncate text-sm font-semibold">
              {composerOutOfScope
                ? "Talepo kapsamı dışında"
                : "Piyasa & profesyonel görünüm"}
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
          <TrendingUp className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/75">
            Talep Analizi
          </p>
          <p className="talepo-ai-title mt-1 text-base font-semibold">
            Piyasa & profesyonel görünüm
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

  /**
   * TALEP KARTININ SATIRLARI. Anlaşılan olgular ile kullanıcının verdiği
   * cevaplar AYNI birleştirmeden geçer (kör birleştirme yok), eksik satırlar
   * da zamanlayıcının görünür sorularından gelir. Kart ikinci bir liste
   * tutmaz; doluluk çubuğu tam olarak bu satırları sayar.
   */
  const cardFacts = mergeAnswersIntoUnderstoodFacts({
    facts: editableUnderstoodFacts,
    answers: userAnswerRows,
  });

  /**
   * Okuma anının vurguları: kullanıcının cümlesinde YERİ BULUNAN olgular.
   * Senkron sürerken bayat olgu gösterilmez.
   */
  const readingSegments = toReadingSegments(
    requestText,
    buildReadingHighlights({
      text: requestText,
      facts: hybrid.isSyncing ? [] : cardFacts,
    }),
  );

  /**
   * Kart satırına dokunulan alan görünür sorular arasında değilse, kanonik
   * düzeltme köprüsü o alanın sorusunu üretir. İkinci bir soru yolu yoktur.
   */
  const editQuestion =
    askingFieldKey &&
    !focusedQuestions.some((q) => q.fieldKey === askingFieldKey)
      ? resolveAnswerEditQuestion(askingFieldKey)
      : null;
  const questionsForPanel = editQuestion ? [editQuestion] : focusedQuestions;
  const activeQuestion =
    questionsForPanel.find((q) => q.fieldKey === askingFieldKey) ??
    (askingFieldKey ? null : questionsForPanel[0] ?? null);

  /**
   * KARTTAKİ EKSİK SATIR = ZORUNLU SORU (kurucu, 2026-09-25).
   *
   * Opsiyonel sorular "sorulacak" satırı olarak yazılsaydı doluluk çubuğunun
   * paydası şişer ve kullanıcı yayınlayabildiği hâlde eksik görünürdü.
   * Opsiyoneller kartın altındaki "İstersen ekle" chip'lerine düşer; ikisi
   * de AYNI kanonik soru listesinden türer, ikinci bir liste yoktur.
   */
  const criticalQuestions = focusedQuestions.filter(
    (question) => question.importance !== "optional",
  );
  const optionalQuestions = focusedQuestions.filter(
    (question) => question.importance === "optional",
  );
  const requestCard = buildRequestCardModel({
    facts: cardFacts,
    questions: criticalQuestions,
    askingFieldKey: activeQuestion?.fieldKey ?? null,
    optionalFields: [
      ...optionalQuestions.map((question) => ({
        key: question.fieldKey,
        label: question.summaryLabel ?? question.label ?? question.fieldKey,
      })),
      ...optionalDynamicFields.map((field) => ({
        key: field.key,
        label: field.label,
      })),
    ],
    answeredFieldKeys: [...answeredQuestionKeys, ...skippedQuestionKeys],
  });

  /**
   * OKUMA ANI KENDİ KENDİNE KAPANIR. Süre tek yerden (`readingDurationMs`)
   * gelir; vurgu sayısı değiştikçe yeniden kurulur. Senkron sürerken sayaç
   * başlamaz — henüz vurgulanacak olgu yoktur.
   */
  const readingEntityCount = readingSegments.filter(
    (segment) => segment.kind === "entity",
  ).length;
  useEffect(() => {
    if (readingPhase !== "reading") return;
    if (hybrid.isSyncing) return;
    const timer = window.setTimeout(
      () => setReadingPhase("quote"),
      readingDurationMs(readingEntityCount),
    );
    return () => window.clearTimeout(timer);
  }, [hybrid.isSyncing, readingEntityCount, readingPhase]);

  const publishOutcome = publishSuccess
    ? publishOutcomeFrom({
        status: publishStatus?.status ?? null,
        publishedAt: publishStatus?.publishedAt ?? null,
      })
    : null;

  const mairaStatus: MairaStatus = publishOutcome
    ? publishOutcome.kind === "published"
      ? "YAYINDA"
      : "İNCELEMEDE"
    : hybrid.isSyncing || isPublishing
      ? "DÜŞÜNÜYOR"
      : readingPhase === "reading"
        ? "OKUYOR"
        : activeQuestion
          ? "SORUYOR"
          : composerReadiness.canReview
            ? "HAZIR"
            : "DÜŞÜNÜYOR";
  const mairaThinking = hybrid.isSyncing || isPublishing;

  /**
   * Kartın alt kategori satırı. Etiket kanonik kategori kaydından çözülür;
   * "Beyaz Eşya › Beyaz Eşya" tekrarını kartın kendisi eler.
   */
  const activeSubcategoryLabel = (() => {
    const slug = hybrid.state?.subcategorySlug ?? null;
    if (!slug) return null;
    return (
      selectedCategory.subcategories.find(
        (label) => subcategorySlug(label) === slug,
      ) ?? null
    );
  })();

  /** Kategori panelinin kökleri ve çocukları kanonik gezinmeden gelir. */
  const browseRoots = hybrid.browseColumns[0] ?? [];
  const browseChildrenOf = (root: BrowseNode) =>
    listBrowseOptions(advanceBrowseWalk(createBrowseWalkState(), root));

  function startReading() {
    setIntroDecided(true);
    setWizardStep(2);
    setAskingFieldKey(null);
    setReadingPhase("reading");
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-white text-[#0f1f1d]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-[60px] max-w-[1080px] items-center justify-between px-5">
          <Link href="/" aria-label="Talepo ana sayfa" className="shrink-0">
            <span className="text-[21px] font-bold tracking-[-0.04em] text-[#0f1f1d]">
              tale<span className="text-[#0f766e]">po</span>
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[#3a4c49]">
            <Link href="/panel" className="hidden sm:inline">
              Panele dön
            </Link>
            <Link href="/panel/taleplerim">Taleplerim</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1080px] px-5 pb-[72px] pt-5 lg:pb-20 lg:pt-9">
        {publishSuccess && publishOutcome ? (
          /*
            YAYIN SONU — DURUM SUNUCUDAN GELİR (D-0032). İncelemeye düşen
            talep "yayında" DEMEZ; metin `publishOutcomeFrom` ile tek yerden
            çözülür ve burada yeniden yazılmaz.
          */
          <section
            data-testid="talep-published"
            data-publish-outcome={publishOutcome.kind}
            className="grid justify-items-start gap-2.5 py-10"
          >
            <span
              aria-hidden
              className={`grid h-[54px] w-[54px] place-items-center rounded-full text-white shadow-[0_0_0_8px_#e4f1ee] ${
                publishOutcome.kind === "published"
                  ? "bg-[#0f766e]"
                  : "bg-[#a15c07]"
              }`}
            >
              {publishOutcome.kind === "published" ? (
                <Check className="h-[26px] w-[26px] stroke-[2.4]" />
              ) : (
                <Clock3 className="h-[26px] w-[26px] stroke-[2.2]" />
              )}
            </span>
            <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f766e]">
              {publishOutcome.badge}
            </p>
            <h1 className="m-0 mt-1 text-[28px] font-semibold tracking-[-0.035em] text-[#0f1f1d]">
              {publishOutcome.headline}
            </h1>
            <p className="m-0 max-w-[46ch] text-[15px] leading-6 text-[#0f1f1d]/55">
              {publishOutcome.detail}
            </p>
            {publishSuccess.title ? (
              <p className="m-0 mt-2 rounded-2xl bg-[#f5f8f7] px-4 py-3 text-sm font-medium text-[#0f1f1d]">
                {publishSuccess.title}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={publishSuccess.viewHref}
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-5 text-sm font-semibold text-white"
              >
                Talebimi görüntüle
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <button
                type="button"
                className="inline-flex h-[52px] items-center justify-center rounded-2xl px-4 text-sm font-medium text-[#0f766e]"
                onClick={() => {
                  setPublishSuccess(null);
                  setPublishStatus(null);
                  setPublishedVersion(null);
                  setPublishError(null);
                  hybrid.resetWithText("");
                  hybrid.setOpenBrowsePanel(false);
                  setWizardStep(1);
                  setIntroDecided(false);
                  setReadingPhase("quote");
                  setAskingFieldKey(null);
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
                  setAnsweredQuestionKeys([]);
                  setSkippedQuestionKeys([]);
                  setOtherDomainNote("");
                  setShowOtherDomainInput(false);
                  setUnresolvedExpressions([]);
                  setGuidanceSelectedSlugs([]);
                }}
              >
                Yeni talep oluştur
              </button>
            </div>
          </section>
        ) : !introDecided ? (
          <TalepStartPanel
            text={requestText}
            onTextChange={(value) => {
              const nextText = formatBudgetNumbersInText(value);
              // The composer is authoritative. Any field removed from
              // the text must not survive as a stale manual answer.
              setManualValues({});
              setAnsweredQuestionKeys([]);
              setSkippedQuestionKeys([]);
              setConfirmedFactKeys([]);
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
              setAppliedProfessionalDescription(false);
              brain.setProfessionalDraftApplied(false);
              hybrid.setText(nextText);
              clearCategoryOverridesOnTextEdit();
              setPublishedVersion(null);
              setPublishError(null);
            }}
            onSubmit={startReading}
            /*
              Kutunun altındaki etiketler YALNIZ mevcut anlama sonucundan
              gelir; senkron sürerken bayat olgu gösterilmez.
            */
            detected={(hybrid.isSyncing ? [] : cardFacts)
              .slice(0, 3)
              .map((fact) => ({
                key: fact.key,
                label: fact.label,
                value: fact.displayValue,
              }))}
            examples={EXAMPLE_CHIPS}
            onPickExample={(example) => {
              applyExampleChip(example);
              startReading();
            }}
            roots={browseRoots}
            onOpenCategories={() =>
              setCategorySheet({ mode: "browse", root: null })
            }
            onOpenCategory={(root) =>
              setCategorySheet({ mode: "browse", root })
            }
          />
        ) : (
          /*
            `lg:grid-rows-[auto_1fr]`: kart iki satırı kapsadığı için artan
            yükseklik ikisi arasında bölünüyor ve alıntı ile soru arasında
            boş bir koridor açılıyordu (tarayıcıda ölçüldü). Artan yükseklik
            tek satıra (soru satırına) verilir; `items-start` de içeriği
            satırın başında tutar.
          */
          <div className="grid items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-[26px]">
            <div className="grid min-w-0 gap-[22px] lg:col-start-1 lg:row-start-1">
              <MairaStatusLine status={mairaStatus} thinking={mairaThinking} />
              <ReadingSentence
                segments={readingSegments}
                phase={readingPhase}
              />
            </div>

            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-[84px] lg:self-start">
              {readingPhase === "quote" ? (
                <RequestCardPanel
                  model={requestCard}
                  title={
                    mergedCommonDraft.title.trim() ||
                    requestText.trim().slice(0, 60) ||
                    "Yeni talep"
                  }
                  categoryId={
                    categoryConfident && schemaCategory.displayLabelSafe
                      ? activeCategoryId
                      : null
                  }
                  categoryLabel={
                    categoryConfident && schemaCategory.displayLabelSafe
                      ? selectedCategory.label
                      : null
                  }
                  subcategoryLabel={activeSubcategoryLabel}
                  updating={hybrid.isSyncing}
                  locked={Boolean(publishOutcome)}
                  categoryStep={categoryStepForMaira}
                  categoryRejected={categoryRejected}
                  onCategoryAction={applyCategoryConfirmation}
                  onChangeCategory={() =>
                    setCategorySheet({ mode: "pick", root: null })
                  }
                  onAskField={(fieldKey) => {
                    setAskingFieldKey(fieldKey);
                    if (typeof window !== "undefined" && window.innerWidth < 920) {
                      window.setTimeout(() => {
                        document
                          .querySelector('[data-testid="composer-questions"]')
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                      }, 60);
                    }
                  }}
                  onAddOptional={(fieldKey) => setAskingFieldKey(fieldKey)}
                />
              ) : null}
            </div>

            <div className="grid min-w-0 gap-4 lg:col-start-1 lg:row-start-2">
              {readingPhase !== "quote" ? null : (
                <>
                  {/*
                    TALEPTE İLETİŞİM BİLGİSİ — UYARI, ENGEL DEĞİL (D-0031).
                    Kart yayın yolunu KAPATMAZ; kullanıcı seçene kadar görünür
                    durur ve seçim yapılınca kapanır.
                  */}
                  {showContactNotice ? (
                    <div
                      data-testid="composer-contact-notice"
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950"
                    >
                      <p>{CONTACT_IN_REQUEST_NOTICE}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          data-testid="composer-contact-remove"
                          className="min-h-10 rounded-lg bg-[#0f766e] px-3 text-sm font-medium text-white"
                          onClick={() => {
                            const cleaned = stripContactInfo(hybrid.text ?? "");
                            hybrid.setText(cleaned);
                            setContactChoice("REMOVED");
                            trackComposerEvent(
                              "contact_notice_choice",
                              contactChoiceTelemetry({
                                choice: "REMOVED",
                                kinds: contactKinds,
                              }),
                            );
                          }}
                        >
                          {CONTACT_REMOVE_ACTION_LABEL}
                        </button>
                        <button
                          type="button"
                          data-testid="composer-contact-keep"
                          className="min-h-10 rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950"
                          onClick={() => {
                            setContactChoice("KEPT");
                            trackComposerEvent(
                              "contact_notice_choice",
                              contactChoiceTelemetry({
                                choice: "KEPT",
                                kinds: contactKinds,
                              }),
                            );
                          }}
                        >
                          {CONTACT_KEEP_ACTION_LABEL}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/*
                    KAPSAM DIŞI (arz ilanı / ilaç) — kurucu kararı. Bu dal
                    soru ve yayın dallarının ÖNÜNDEDİR; kapsam dışında hiçbir
                    yayın yolu render edilmez.
                  */}
                  {!hybrid.isSyncing && composerReadiness.outOfScopeNotice ? (
                    <div
                      data-testid="composer-out-of-scope"
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950"
                    >
                      <p>{composerReadiness.outOfScopeNotice}</p>
                      <button
                        type="button"
                        data-testid="composer-out-of-scope-edit"
                        className="mt-2 min-h-10 rounded-lg bg-[#0f766e] px-3 text-sm font-medium text-white"
                        onClick={() => {
                          setIntroDecided(false);
                          setReadingPhase("quote");
                          window.setTimeout(() => {
                            const el =
                              document.getElementById("talep-composer");
                            el?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                            (el as HTMLTextAreaElement | null)?.focus();
                          }, 60);
                        }}
                      >
                        {composerReadiness.editActionLabel}
                      </button>
                    </div>
                  ) : (
                    <>
                      {activeQuestion ? (
                        <FocusedQuestionsPanel
                          questions={questionsForPanel}
                          draftByKey={focusedDraftByKey}
                          healthNotice={isHealthCategory}
                          remainingCriticalCount={
                            composerReadiness.remainingCriticalCount
                          }
                          phase={focusedQuestionSchedule.phase}
                          phaseHeading={focusedQuestionSchedule.phaseHeading}
                          activeFieldKey={activeQuestion.fieldKey}
                          onActiveFieldChange={setAskingFieldKey}
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
                        ANA EYLEM HEP GÖRÜNÜR (kurucu, 2026-08-23): eksik alan
                        varsa ne kaldığını söyler ve soruya götürür; yoksa
                        doğrudan yayınlar. Soru açıkken de kaybolmaz.
                      */}
                      {hybrid.isSyncing ? null : composerReadiness.canReview ? (
                        <div className="grid gap-3.5">
                          <p className="m-0 max-w-[36ch] text-[15px] leading-6 text-[#0f1f1d]/50">
                            Satırlara dokunup değiştirebilirsin. Hazırsan
                            yayınla, teklifler gelmeye başlasın.
                          </p>
                          {publishError ? (
                            <p
                              role="alert"
                              data-testid="composer-publish-error"
                              className="m-0 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-3 text-sm text-orange-950"
                            >
                              {publishError}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            data-testid="composer-review-cta"
                            disabled={isPublishing}
                            className="flex h-[58px] w-full items-center justify-center rounded-[18px] bg-[#0f766e] text-[16.5px] font-semibold text-white shadow-[0_16px_32px_-16px_rgba(15,118,110,0.8)] transition active:scale-[0.985] disabled:opacity-60"
                            onClick={() => {
                              trackComposerEvent("publish_summary_opened");
                              handlePublishAttempt();
                            }}
                          >
                            {isPublishing ? "Yayınlanıyor…" : "Talebi yayınla"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-testid="composer-continue-hint"
                          className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-[18px] border border-[#0f766e]/25 bg-[#f0fdfa] px-4 text-sm font-semibold text-[#0f5f59] transition hover:border-[#0f766e]/45"
                          onClick={() => {
                            document
                              .querySelector('[data-testid="composer-questions"]')
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                          }}
                        >
                          Yayın için son adım:{" "}
                          {composerReadiness.blockingLabels?.length
                            ? composerReadiness.blockingLabels.join(" + ")
                            : "kalan soruları yanıtlayın"}
                        </button>
                      )}
                    </>
                  )}

                  {/*
                    KAPSAM DIŞINDA KATEGORİ SORULMAZ (tarayıcıda ölçüldü,
                    2026-09-25). "Bu talep yayınlanamaz" diyen metnin hemen
                    altında "Hangi alanda arıyorsun?" sormak kendi kendini
                    çürütüyordu: kullanıcı yayınlanamayacak bir talebi
                    sınıflandırmaya davet ediliyordu. Kapsam kapısı açıkken
                    kategori yüzeylerinin ikisi de susar; tek eylem metne
                    dönmektir.

                    "Bu değil" denince kök seçimi buradan açılır — aynı model,
                    aynı işleyici; kartla ikinci bir kategori mantığı yoktur.
                  */}
                  {!composerReadiness.outOfScopeNotice &&
                  categoryConfirmation &&
                  categoryRejected ? (
                    <CategoryConfirmationCard
                      model={categoryConfirmation}
                      rejected={categoryRejected}
                      onAction={applyCategoryConfirmation}
                    />
                  ) : null}

                  {composerReadiness.outOfScopeNotice ? null : categoryGuidance &&
                  !categoryUserChoice &&
                  categoryChoice &&
                  categoryRejected ? (
                    <CategoryConfirmationCard
                      model={categoryChoice}
                      rejected
                      onAction={applyCategoryConfirmation}
                    />
                  ) : categoryGuidance && !categoryUserChoice ? (
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

                  {hybrid.composerError ? (
                    <div className="rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-3 text-sm text-orange-950">
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

                  <button
                    type="button"
                    className="min-h-10 text-left text-[13px] font-medium text-[#0f766e]"
                    onClick={() => {
                      setIntroDecided(false);
                      setReadingPhase("quote");
                    }}
                  >
                    Cümlemi düzenle
                  </button>

                  {/*
                    TALEP ANALİZİ — İKİNCİL, VARSAYILAN KAPALI (2026-09-25).
                    Yeni akışta ekranda aynı anda tek şey durur; piyasa /
                    profesyonel görünüm isteyen kullanıcı için panel burada
                    açılır ve kanonik companion sözleşmesi korunur.
                  */}
                  {/*
                    AKORDEON ZORUNLU SİNYALDE AÇILIR. `open` ifadesi türetilmiş
                    kararı ADIYLA taşır: yayın hatası, rehberlik ya da kapsam
                    sinyali varsa panel kullanıcının tercihini geçici olarak
                    ezer ve mesaj kapalı bir akordeonun ardında kalmaz.
                  */}
                  <details
                    className="group rounded-[1.35rem] border border-[#0b1917]/8 bg-white"
                    open={aiCompanionOpen || publishSignalDemandsAttention}
                    onToggle={(event) =>
                      setAiCompanionOpen(event.currentTarget.open)
                    }
                  >
                    <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-medium text-[#0f1f1d] marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-2">
                        <span>Talep analizi</span>
                        <span className="text-xs font-normal text-[#0f1f1d]/45">
                          Piyasa & profesyonel görünüm
                        </span>
                      </span>
                    </summary>
                    <div className="border-t border-[#0b1917]/6 p-3">
                      {aiCompanionShell}
                    </div>
                  </details>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {categorySheet ? (
      <CategorySheet
        mode={categorySheet.mode}
        initialRoot={categorySheet.root}
        roots={browseRoots}
        childrenOf={browseChildrenOf}
        currentCategoryId={activeCategoryId || null}
        currentSubLabel={activeSubcategoryLabel}
        onClose={() => setCategorySheet(null)}
        onEnterRoot={(root) => hybrid.selectBrowseNodeAtColumn(0, root)}
        onPickRoot={(root) => {
          hybrid.selectBrowseNodeAtColumn(0, root);
          setDismissedFactKeys([]);
          setCategorySheet(null);
          setAskingFieldKey(null);
          if (!introDecided) startReading();
        }}
        onPickChild={(_root, child) => {
          hybrid.selectBrowseNodeAtColumn(1, child);
          setDismissedFactKeys([]);
          setCategorySheet(null);
          setAskingFieldKey(null);
          if (!introDecided) startReading();
        }}
      />
      ) : null}

      {urgencyPromptVersion ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0f1f1d]/45 px-4 py-6 sm:items-center"
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
