"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
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
  MapPin,
  Send,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";

import { RealEstateLocationFields } from "@/components/request/RealEstateLocationFields";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { runTalepoAiCore, type Recommendation } from "@/lib/ai";
import {
  composeProfessionalDescription,
  composeRequestTitle,
} from "@/lib/ai/request-text-composer";
import {
  getExploreFilterDefs,
  getFilterSelectOptions,
} from "@/lib/explore/category-filters";
import {
  neighborhoodsDisplayValue,
  neighborhoodsFieldValue,
  realEstateLocationError,
  realEstateLocationToCity,
  resolveRealEstateLocationFromSources,
  type RealEstateLocation,
} from "@/lib/geo/real-estate-location";
import { TURKEY_IL_NAMES } from "@/lib/geo/turkey-districts";
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
  const [publishedVersion, setPublishedVersion] = useState<
    "manual" | "ai" | null
  >(null);
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
  const [realEstateDraft, setRealEstateDraft] = useState<RealEstateLocation>({
    il: "",
    ilce: "",
    mahalleler: [],
  });
  const [realEstateTouched, setRealEstateTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  const [aiCompanionOpen, setAiCompanionOpen] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  /** User-picked category; null means follow AI detection. */
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

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
      setCategoryOverride(null);
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
  const visibleCommonFields = selectedCategory.commonFields.map(resolveCommonField);
  const visibleCommonFieldKeys = new Set(
    visibleCommonFields.map((field) => field.key)
  );
  const isRealEstate = activeCategoryId === "real-estate";

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

  const mergedCommonDraft: CommonDraft = {
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
      ? commonDraft.budget ||
        aiResult.parsed.budgetDisplay ||
        (aiResult.parsed.budget
          ? formatCurrency(aiResult.parsed.budget)
          : "")
      : "",
  };

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

  const visibleDynamicFields = getVisibleCategoryFields(
    selectedCategory.fields,
    dynamicValues,
    activeCategoryId,
  );

  const missingFields = visibleDynamicFields.filter(
    (field) =>
      isFieldRequired(field, dynamicValues) &&
      !dynamicValues[field.key]?.trim(),
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
  const optionalDynamicFields = visibleDynamicFields.filter(
    (field) => !isFieldRequired(field, dynamicValues),
  );
  const hasOptionalFields =
    optionalCommonFields.length > 0 || optionalDynamicFields.length > 0;
  const filledOptionalCount =
    optionalCommonFields.filter((field) =>
      Boolean(mergedCommonDraft[field.key]?.trim()),
    ).length +
    optionalDynamicFields.filter((field) =>
      Boolean(dynamicValues[field.key]?.trim()),
    ).length;

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
    aiResult.score >= 85
      ? "Yayınlamaya uygun"
      : aiResult.score >= 60
        ? "Birkaç detay eklenebilir"
        : "Bilgiler tamamlanmalı";

  const hasText = requestText.trim().length > 0;

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
    setCityTouched(true);
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
          delete next[def.fieldKey];
        }
        return next;
      });
    }
    setPublishedVersion(null);
  }

  function applyRecommendation(recommendation: Recommendation) {
    const field = recommendation.field;
    if (!field) {
      setOptionalOpen(true);
      return;
    }

    if (field === "deliveryDays") {
      const days =
        recommendation.suggestedValue != null
          ? String(recommendation.suggestedValue)
          : "14";
      updateCommonField("delivery", `${days} gün`);
      setOptionalOpen(true);
      return;
    }

    if (field === "city") {
      const cityHint = aiResult.parsed.city?.trim();
      if (!isRealEstate && cityHint) {
        applyCityFilter(cityHint);
        return;
      }
      setFiltersOpen(true);
      return;
    }

    if (recommendation.suggestedValue != null) {
      updateDynamicField(field, String(recommendation.suggestedValue));
    }

    const isOptionalDynamic = optionalDynamicFields.some(
      (item) => item.key === field,
    );
    const isOptionalCommon =
      field === "quantity" || field === "delivery" || field === "budget";
    if (isOptionalDynamic || isOptionalCommon) {
      setOptionalOpen(true);
    }
  }

  const filterCityValue = isRealEstate
    ? realEstateLocation.il
    : mergedCommonDraft.city.trim();
  const filterBudgetValue = mergedCommonDraft.budget.trim();
  const activeCategoryFilterCount = categoryFilterDefs.filter((def) =>
    Boolean(dynamicValues[def.fieldKey]?.trim()),
  ).length;
  const activeFilterCount =
    (categoryOverride ? 1 : 0) +
    (filterCityValue ? 1 : 0) +
    (filterBudgetValue ? 1 : 0) +
    activeCategoryFilterCount;
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
          aiScore: aiResult.score,
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
        <RealEstateLocationFields
          key={`${activeCategoryId}-location`}
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
    <div className="relative z-[1] space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-white/[0.04] px-2.5 py-1">
            <span className="talepo-ai-status-dot" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/80">
              Talepo AI
            </span>
          </div>
          <p className="mt-3 text-base font-semibold tracking-tight text-white">
            Firmalara gidecek görünüm
          </p>
          <p className="mt-1 text-sm leading-6 text-teal-100/45">
            Metninizi netleştirir; siz onaylamadan yayınlanmaz.
          </p>
        </div>

        <div
          className="talepo-ai-score-ring shrink-0"
          style={
            {
              "--progress": aiResult.score,
            } as CSSProperties
          }
          aria-label={`Talep kalite puanı ${aiResult.score}`}
        >
          <div className="text-center">
            <p className="text-xl font-semibold tracking-[-0.05em] text-white">
              {aiResult.score}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-teal-100/40">
              /100
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-teal-300/25 bg-teal-400/10 px-2.5 py-1 text-xs font-medium text-teal-100">
          {readinessLabel}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-teal-100/55">
          {selectedCategory.label}
        </span>
        {categoryOverride ? (
          <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-100/80">
            Kategori seçildi
          </span>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-teal-100/45">
            AI tespit · %{aiResult.knowledge.confidence}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="talepo-ai-metric rounded-2xl px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal-100/40">
            Tahmini fiyat
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-snug tracking-tight text-white">
            {formatCurrency(aiResult.pricing.min)} –{" "}
            {formatCurrency(aiResult.pricing.max)}
          </p>
          <p className="mt-1 text-xs leading-5 text-teal-100/40">
            Güven %{aiResult.pricing.confidence}
          </p>
        </div>
        <div className="talepo-ai-metric rounded-2xl px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal-100/40">
            Uygun firma
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-snug tracking-tight text-white">
            {matchingDisplay.estimatedCompanyCount} firma
          </p>
          <p className="mt-1 text-xs leading-5 text-teal-100/40">
            {matchingDisplay.expectedOfferCount} teklif beklentisi
          </p>
        </div>
      </div>

      {visibleCommonFieldKeys.has("budget") &&
      (mergedCommonDraft.budget.trim() || aiResult.parsed.budget) ? (
        <div className="talepo-ai-metric rounded-2xl px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal-100/40">
            Algılanan bütçe
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-snug tracking-tight text-white">
            {mergedCommonDraft.budget.trim() ||
              aiResult.parsed.budgetDisplay ||
              (aiResult.parsed.budget
                ? formatCurrency(aiResult.parsed.budget)
                : "")}
          </p>
          <p className="mt-1 text-xs leading-5 text-teal-100/40">
            İhtiyaç metninden talebe eklendi
          </p>
        </div>
      ) : null}

      {(aiResult.recommendations.length > 0 ||
        missingFields.length > 0 ||
        realEstateLocationMissing) && (
        <div className="talepo-ai-metric rounded-2xl p-3.5">
          <div className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 text-teal-300/80" />
            <p className="text-sm font-semibold text-white">AI önerileri</p>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {aiResult.recommendations.slice(0, 3).map((recommendation) => (
              <div
                key={recommendation.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/90">
                    {recommendation.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-teal-100/40">
                    {recommendation.reason}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applyRecommendation(recommendation)}
                  className="shrink-0 rounded-lg border border-teal-300/30 bg-teal-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-teal-100 transition hover:bg-teal-400/20"
                >
                  Uygula
                </button>
              </div>
            ))}
            {realEstateLocationMissing && (
              <p className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-sm text-teal-100/70">
                {realEstateLocationError(realEstateLocation) ??
                  "İl / ilçe seçimi eksik (mahalle isteğe bağlı)."}
              </p>
            )}
            {missingFields.slice(0, 2).map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5"
              >
                <p className="text-sm text-teal-100/70">{field.label} eksik</p>
                <button
                  type="button"
                  onClick={() => {
                    const isOptional = optionalDynamicFields.some(
                      (item) => item.key === field.key,
                    );
                    if (isOptional) setOptionalOpen(true);
                  }}
                  className="shrink-0 rounded-lg border border-teal-300/30 bg-teal-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-teal-100 transition hover:bg-teal-400/20"
                >
                  Aç
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {aiResult.recommendations.length === 0 &&
        missingFields.length === 0 &&
        !realEstateLocationMissing &&
        hasText && (
          <div className="flex items-center gap-2 rounded-2xl border border-teal-300/25 bg-teal-400/10 px-3.5 py-3 text-sm font-medium text-teal-100">
            <Check className="h-4 w-4 shrink-0" />
            Temel bilgiler tamam
          </div>
        )}

      <div className="talepo-ai-version rounded-2xl p-4">
        <div className="flex items-start gap-3 pl-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0f766e]/12 text-[#0f766e]">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal-800/55">
              Profesyonel metin
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[#0f1f1d]">
              {mergedCommonDraft.title || "Talep özeti"}
            </p>
          </div>
          <WandSparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]/55" />
        </div>
        <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-line rounded-xl bg-[#f7faf9] px-3.5 py-3 text-sm leading-7 text-teal-950/65">
          {hasText
            ? professionalText
            : "İhtiyacınızı yazdıkça net sürüm burada oluşur."}
        </p>
      </div>

      <details className="group talepo-ai-metric rounded-2xl">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-teal-100/70 [&::-webkit-details-marker]:hidden">
          Öne çıkarma (isteğe bağlı)
          <ChevronDown className="h-4 w-4 text-teal-100/35 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-white/8 px-4 pb-4 pt-3">
          <p className="text-xs leading-5 text-teal-100/40">
            Talebinizi keşifte daha görünür yapmak isterseniz süre seçin.
            Ödeme yakında.
          </p>
          <label className="mt-3 block">
            <span className="text-xs text-teal-100/40">Süre</span>
            <select
              value={featureBoost}
              onChange={(event) =>
                setFeatureBoost(event.target.value as typeof featureBoost)
              }
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0a1518] px-3 text-sm text-white outline-none focus:border-teal-300/35"
            >
              <option value="">Öne çıkarma istemiyorum</option>
              <option value="FEATURE_24H">24 saat · ₺99</option>
              <option value="FEATURE_3D">3 gün · ₺199</option>
              <option value="FEATURE_7D">7 gün · ₺349</option>
            </select>
          </label>
        </div>
      </details>

      <p className="flex items-start gap-2 px-0.5 text-[11px] leading-5 text-teal-100/35">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Fiyat ve firma sayıları tahmindir; gerçek veri bağlandığında
        güncellenecektir. Acil tercih yayın sırasında sorulur.
      </p>

      {publishError && publishedVersion === "ai" && (
        <div className="rounded-2xl bg-[#ffe4df] p-3.5 text-sm font-medium text-[#8b352b]">
          {publishError}
        </div>
      )}

      <button
        type="button"
        disabled={isPublishing}
        onClick={() => requestPublish("ai")}
        className="flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-[#14b8a6] px-4 text-sm font-semibold text-[#071316] transition hover:bg-[#2dd4bf] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          {isPublishing && publishedVersion === "ai" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isPublishing && publishedVersion === "ai"
            ? "Yayınlanıyor..."
            : "AI sürümüyle yayınla"}
        </span>
        <ArrowRight className="h-4 w-4 opacity-80" />
      </button>
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
            <Link
              href="/panel"
              className="talepo-cloud-pill px-3 py-2 text-sm font-medium text-[#0f1f1d]/72 transition hover:border-teal-800/15 hover:text-[#0f1f1d] sm:px-3.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="hidden sm:inline">Panele dön</span>
            </Link>
          </div>

          <Link
            href="/"
            aria-label="Talepo ana sayfa"
            className="shrink-0"
          >
            <span className="text-[1.35rem] font-semibold tracking-[-0.05em] text-[#0f1f1d] sm:text-[1.45rem]">
              tale
              <span className="text-[#0f766e]">po</span>
            </span>
          </Link>

          <div className="justify-self-end">
            <span className="inline-flex items-center rounded-full border border-teal-900/[0.08] bg-teal-50/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-teal-900/45">
              Ücretsiz
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 py-4 sm:px-6 lg:px-8">
        <section className="talepo-rise mx-auto max-w-2xl py-7 text-center sm:py-9">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-teal-800/40">
            Yeni talep
          </p>
          <h1 className="mt-3 text-[1.85rem] font-semibold tracking-[-0.045em] text-[#0f1f1d] sm:text-[2.35rem]">
            İhtiyacınızı tanımlayın
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-teal-950/48 sm:text-[15px] sm:leading-7">
            Kısa ve net yazın; başlık ile alanlar otomatik hazırlanır. Firmalar
            buna göre teklif verir — iletişiminiz kabulden önce gizli kalır.
          </p>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] lg:gap-7">
          <section className="space-y-4 sm:space-y-5">
            {/* Primary: need composer */}
            <div
              className={`talepo-rise talepo-rise-delay-1 rounded-[1.75rem] border bg-white/90 p-4 shadow-[0_16px_48px_rgba(15,31,29,0.05)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300 sm:p-6 ${
                composerFocused
                  ? "border-[#0f766e]/28 shadow-[0_20px_56px_rgba(15,118,110,0.1)]"
                  : "border-teal-900/8"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3 px-1">
                <label
                  htmlFor="talep-composer"
                  className="text-[11px] font-medium uppercase tracking-[0.18em] text-teal-950/40"
                >
                  İhtiyaç metni
                </label>
                {hasText ? (
                  <span className="text-[11px] tracking-[0.02em] text-teal-800/45">
                    {selectedCategory.label}
                  </span>
                ) : null}
              </div>

              <textarea
                id="talep-composer"
                value={requestText}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                onChange={(event) => {
                  setRequestText(event.target.value);
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
                  setCategoryOverride(null);
                  setPublishedVersion(null);
                }}
                className="mt-3 min-h-[200px] w-full resize-y bg-transparent px-1 py-1 text-[17px] leading-8 text-[#0f1f1d] outline-none placeholder:text-[#0f1f1d]/25 sm:min-h-[240px] sm:text-[18px] sm:leading-9"
                placeholder="Örn. İstanbul’da 50 ofis sandalyesi; temiz ve uygun fiyatlı olsun."
              />

              <div className="mt-2 flex items-center justify-between border-t border-teal-900/6 px-1 pt-3">
                <p className="text-xs text-teal-950/35">
                  Ne kadar net yazarsanız alanlar o kadar doğru dolar.
                </p>
                <span className="shrink-0 text-xs tabular-nums text-teal-950/30">
                  {requestText.length}
                </span>
              </div>
            </div>

            {/* Quick filters — wire into form / category fields */}
            <div className="talepo-rise talepo-rise-delay-2 rounded-[1.75rem] border border-teal-900/10 bg-white/90 p-3 shadow-sm sm:p-4">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-1 py-1 text-left"
                aria-expanded={filtersOpen}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef6f4] text-[#0f766e]">
                    <SlidersHorizontal className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0f1f1d]">
                      Filtreler
                    </p>
                    <p className="mt-0.5 text-xs text-teal-950/45">
                      Kategori, şehir ve bütçe alanlarını hızlıca doldurun
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeFilterCount > 0 ? (
                    <span className="rounded-full bg-[#0f766e] px-2 py-0.5 text-[11px] font-semibold text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={`h-4 w-4 text-teal-950/35 transition ${
                      filtersOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {filtersOpen ? (
                <div className="mt-3 space-y-3 border-t border-teal-900/6 pt-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="min-w-[10rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[14rem]">
                      Kategori
                      <select
                        value={activeCategoryId}
                        onChange={(event) => {
                          const next = event.target.value;
                          setCategoryOverride(
                            next === detectedCategoryId ? null : next,
                          );
                          setManualValues({});
                          setPublishedVersion(null);
                        }}
                        className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
                      >
                        {REQUEST_CATEGORIES.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                            {category.id === detectedCategoryId
                              ? " · AI"
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="min-w-[9rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[12rem]">
                      {isRealEstate ? "İl" : "Şehir"}
                      <span className="relative mt-1 block">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-teal-800/40" />
                        <select
                          value={filterCityValue}
                          onChange={(event) =>
                            applyCityFilter(event.target.value)
                          }
                          className="h-10 w-full appearance-none rounded-xl border border-teal-900/10 bg-[#f7fbfa] py-2 pl-9 pr-8 text-sm outline-none focus:border-teal-600/50"
                        >
                          <option value="">Seçiniz</option>
                          {TURKEY_IL_NAMES.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-teal-800/35" />
                      </span>
                    </label>

                    {categoryFilterDefs.map((def) => {
                      if (def.input !== "select") {
                        return (
                          <label
                            key={def.param}
                            className="min-w-[8rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[11rem]"
                          >
                            {def.label}
                            <input
                              type={def.input === "number" ? "number" : "text"}
                              inputMode={
                                def.input === "number" ? "numeric" : undefined
                              }
                              value={dynamicValues[def.fieldKey] ?? ""}
                              placeholder={def.placeholder}
                              onChange={(event) =>
                                updateDynamicField(
                                  def.fieldKey,
                                  event.target.value,
                                )
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
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
                            value={dynamicValues[def.fieldKey] ?? ""}
                            onChange={(event) =>
                              updateDynamicField(
                                def.fieldKey,
                                event.target.value,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
                          >
                            <option value="">Seçiniz</option>
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>

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
                                : "border border-teal-900/10 bg-[#f7fbfa] text-teal-950/70 hover:border-teal-700/25"
                            }`}
                          >
                            {city}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {visibleCommonFieldKeys.has("budget") ? (
                    <div>
                      <p className="text-xs font-semibold text-teal-900/55">
                        Bütçe aralığı
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {BUDGET_PRESETS.map((preset) => {
                          const active = activeBudgetPresetId === preset.id;
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
                                  : "border border-teal-900/10 bg-[#f7fbfa] text-teal-950/70 hover:border-teal-700/25"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-900/8 bg-[#f7faf9] px-3 py-2.5">
                    <p className="text-xs leading-5 text-teal-950/50">
                      <span className="font-semibold text-teal-900/70">
                        Acil tercih:
                      </span>{" "}
                      yayınlarken sorulur — burada seçim yok.
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
                </div>
              ) : null}
            </div>

            {/* Secondary: essentials */}
            <div className="talepo-rise talepo-rise-delay-2 rounded-[1.75rem] border border-teal-900/8 bg-white p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-800/40">
                    Temel bilgiler
                  </p>
                  <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[#0f1f1d] sm:text-xl">
                    Kontrol edin ve tamamlayın
                  </h2>
                </div>

                <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#0f766e]/12 bg-[#f0fdfa] px-3.5">
                  <span className="text-sm font-medium text-[#115e59]">
                    {selectedCategory.label}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#0f766e]/55">
                    {categoryOverride ? "Seçildi" : "Otomatik"}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
                {essentialCommonFields.map(renderCommonField)}
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

              {hasOptionalFields ? (
                <div className="mt-4 border-t border-teal-900/6 pt-4">
                  <button
                    type="button"
                    onClick={() => setOptionalOpen((open) => !open)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                      optionalOpen
                        ? "border-[#0f766e]/30 bg-[#f0fdfa] shadow-[0_0_0_3px_rgba(15,118,110,0.06)]"
                        : "border-teal-900/12 bg-[#fafcfb] hover:border-[#0f766e]/28 hover:bg-[#f0fdfa] hover:shadow-[0_8px_24px_rgba(15,31,29,0.05)]"
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
                          Ek detaylar
                        </span>
                        <span className="mt-0.5 block text-xs text-teal-950/45">
                          {mergedCommonDraft.budget.trim()
                            ? `Bütçe: ${mergedCommonDraft.budget.trim()}${
                                filledOptionalCount > 1
                                  ? ` · ${filledOptionalCount} alan`
                                  : ""
                              }`
                            : filledOptionalCount > 0
                              ? `${filledOptionalCount} alan dolduruldu — düzenlemek için açın`
                              : "Miktar, teslimat, bütçe ve kategori alanları"}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {filledOptionalCount > 0 ? (
                        <span className="rounded-full bg-[#0f766e] px-2 py-0.5 text-[11px] font-semibold text-white">
                          {filledOptionalCount}
                        </span>
                      ) : (
                        <span className="rounded-full border border-teal-900/10 bg-white px-2 py-0.5 text-[11px] font-medium text-teal-800/60">
                          İsteğe bağlı
                        </span>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 text-teal-950/40 transition ${
                          optionalOpen ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>

                  {optionalOpen ? (
                    <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
                      {optionalCommonFields.map(renderCommonField)}
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
                  ) : null}
                </div>
              ) : null}

              {publishError && publishedVersion === "manual" && (
                <div className="mt-4 rounded-2xl bg-[#ffe4df] p-3.5 text-sm font-medium text-[#8b352b]">
                  {publishError}
                </div>
              )}

              <button
                type="button"
                disabled={isPublishing}
                onClick={() => requestPublish("manual")}
                className="mt-5 flex min-h-[50px] w-full items-center justify-between rounded-2xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white transition hover:bg-[#0a1614] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPublishing && publishedVersion === "manual"
                  ? "Yayınlanıyor..."
                  : "Talebimi yayınla"}
                {isPublishing && publishedVersion === "manual" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </section>

          {/* Companion: AI panel template */}
          <aside className="talepo-rise talepo-rise-delay-3 lg:sticky lg:top-4 lg:self-start">
            <div className="talepo-ai-panel rounded-[1.75rem]">
              <button
                type="button"
                className="relative z-[1] flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-4 text-left lg:hidden"
                onClick={() => setAiCompanionOpen((open) => !open)}
                aria-expanded={aiCompanionOpen}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f766e] text-white shadow-[0_0_24px_rgba(20,184,166,0.35)]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/75">
                      <span className="talepo-ai-status-dot" />
                      Talepo AI
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">
                      {hasText
                        ? readinessLabel
                        : "Metin yazıldıkça burada hazırlanır"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-teal-300/25 bg-teal-400/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-teal-100">
                    {aiResult.score}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-teal-100/45 transition ${
                      aiCompanionOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              <div
                className={`relative z-[1] px-4 pb-5 sm:px-5 sm:pb-6 lg:block lg:pt-5 ${
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
