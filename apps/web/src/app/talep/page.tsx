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
  Paperclip,
  Send,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";

import { runTalepoAiCore } from "@/lib/ai";
import {
  composeProfessionalDescription,
  composeRequestTitle,
} from "@/lib/ai/request-text-composer";
import {
  getCategoryById,
  getVisibleCategoryFields,
  isFieldRequired,
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

export default function TalepOlusturPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f4f3ef] px-5 py-16 text-[#171717]">
          <div className="mx-auto max-w-3xl animate-pulse rounded-[28px] bg-white/80 p-8">
            <div className="h-8 w-48 rounded bg-black/10" />
            <div className="mt-6 h-40 rounded-2xl bg-black/5" />
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
  const [isUrgent, setIsUrgent] = useState(false);
  const [featureBoost, setFeatureBoost] = useState<
    "" | "FEATURE_24H" | "FEATURE_3D" | "FEATURE_7D"
  >("");

  const aiResult = useMemo(() => {
    try {
      return runTalepoAiCore(requestText);
    } catch (error) {
      console.error("[talep] AI core failed", error);
      return runTalepoAiCore("");
    }
  }, [requestText]);

  // Keep homepage ?query= in sync on client navigations (component may not remount).
  useEffect(() => {
    if (!queryFromHome) return;
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
  }, [queryFromHome]);

  const [liveMatching, setLiveMatching] = useState<{
    estimatedCompanyCount: number;
    expectedOfferCount: number;
  } | null>(null);

  // Kategori yalnızca AI tarafından belirlenir; kullanıcı değiştiremez.
  const activeCategoryId = aiResult.parsed.categoryId;
  const selectedCategory = getCategoryById(activeCategoryId);
  const visibleCommonFields = selectedCategory.commonFields.map(resolveCommonField);
  const visibleCommonFieldKeys = new Set(
    visibleCommonFields.map((field) => field.key)
  );

  const dynamicValues = useMemo(() => {
    const values: Record<string, string> = {};

    for (const field of selectedCategory.fields) {
      const aiValue = aiResult.parsed.attributes[field.key];

      values[field.key] =
        manualValues[field.key] ??
        (aiValue === undefined || aiValue === null ? "" : String(aiValue));
    }

    return withCategoryFieldDefaults(activeCategoryId, values);
  }, [
    activeCategoryId,
    selectedCategory.fields,
    aiResult.parsed.attributes,
    manualValues,
  ]);

  const autoTitle = useMemo(
    () =>
      composeRequestTitle({
        categoryId: activeCategoryId,
        rawText: requestText,
        attributes: {
          ...aiResult.parsed.attributes,
          ...dynamicValues,
        },
        city: commonDraft.city || aiResult.parsed.city || "",
        quantity: aiResult.parsed.quantity,
        unit: aiResult.parsed.unit,
        fields: selectedCategory.fields,
        fieldValues: dynamicValues,
        commonDraft,
      }),
    [
      activeCategoryId,
      requestText,
      aiResult.parsed.attributes,
      aiResult.parsed.city,
      aiResult.parsed.quantity,
      aiResult.parsed.unit,
      dynamicValues,
      selectedCategory.fields,
      commonDraft,
    ],
  );

  const mergedCommonDraft: CommonDraft = {
    title: titleManuallyEdited ? commonDraft.title : autoTitle,
    quantity: visibleCommonFieldKeys.has("quantity")
      ? commonDraft.quantity ||
        (aiResult.parsed.quantity
          ? `${aiResult.parsed.quantity} ${aiResult.parsed.unit ?? "adet"}`
          : "")
      : "",
    city: visibleCommonFieldKeys.has("city")
      ? commonDraft.city || aiResult.parsed.city || ""
      : "",
    delivery: visibleCommonFieldKeys.has("delivery")
      ? commonDraft.delivery ||
        (aiResult.parsed.deliveryDays
          ? `${aiResult.parsed.deliveryDays} gün`
          : "")
      : "",
    budget: visibleCommonFieldKeys.has("budget")
      ? commonDraft.budget ||
        (aiResult.parsed.budget
          ? formatCurrency(aiResult.parsed.budget)
          : "")
      : "",
  };

  useEffect(() => {
    if (!requestText.trim() || requestText.trim().length < 8) {
      setLiveMatching(null);
      return;
    }

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

    setCommonDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setPublishedVersion(null);
  }

  async function publishRequest(version: "manual" | "ai") {
    if (isPublishing) return;

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
          fields: visibleDynamicFields.map((field) => ({
            ...field,
            required: isFieldRequired(field, dynamicValues),
            value: dynamicValues[field.key] ?? "",
          })),
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

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#171717]">
      <div className="mx-auto max-w-[1540px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white px-4 py-3 sm:px-5">
          <Link
            href="/panel"
            className="flex items-center gap-2 text-sm font-medium text-black/45 transition hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Panele dön
          </Link>

          <div className="text-2xl font-semibold tracking-[-0.06em]">
            tale<span className="text-[#0f766e]">po</span>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-[#ecfdf5] px-3 py-2 text-xs font-semibold text-[#0f766e]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#0f766e]" />
            AI Core bağlı
          </div>
        </header>

        <section className="py-8 sm:py-10">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#0f766e]/15 bg-white px-3.5 py-1.5 text-sm font-medium text-[#0f766e]">
              <WandSparkles className="h-3.5 w-3.5" />
              Yeni talep · ~20 saniye
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Ne lazımsa yazın.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/50">
              Bir paragraf yazın — başlık, kategori ve alanlar otomatik dolsun.
              Kontrol edip yayınlayın. İletişiminiz teklif kabulüne kadar gizli.
            </p>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-5">
            <div className="rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.04)] sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex w-fit items-center gap-2 rounded-full bg-[#f0fdfa] px-3 py-1.5 text-xs font-semibold text-[#0f766e]">
                    <WandSparkles className="h-3.5 w-3.5" />
                    Akıllı giriş
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                    İhtiyacınızı normal konuşur gibi yazın
                  </h2>
                  <p className="mt-2 text-sm text-black/45">
                    Ne kadar net yazarsanız AI alanları o kadar doğru doldurur.
                  </p>
                </div>
                <div className="rounded-full border border-black/[0.06] bg-[#f8f7f4] px-3 py-1.5 text-xs font-medium text-black/45">
                  Talep metni
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-black/[0.08] bg-[#fafaf8] p-4 transition focus-within:border-[#0f766e]/45 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(15,118,110,0.1)] sm:p-5">
                <textarea
                  value={requestText}
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
                    setPublishedVersion(null);
                  }}
                  className="min-h-[360px] w-full resize-y bg-transparent px-2 py-2 text-xl leading-9 outline-none placeholder:text-black/25 sm:min-h-[420px] sm:text-2xl sm:leading-10"
                  placeholder="Örn. 2013 model Mercedes C kasa arıyorum, hatasız olsun. İstanbul civarı..."
                />

                <div className="mt-2 flex items-center justify-between border-t border-black/[0.06] px-1 pt-4">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-black/45 transition hover:bg-black/[0.04] hover:text-black"
                  >
                    <Paperclip className="h-4 w-4" />
                    Dosya ekle
                  </button>

                  <span className="text-xs text-black/35">
                    {requestText.length} karakter
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.04)] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0f766e]">
                    AI Core sonucu
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    Talep alanları
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-black/45">
                    AI tarafından doldurulan alanları düzenleyebilirsiniz.
                    Kategori metninize göre otomatik seçilir.
                  </p>
                </div>

                <div className="min-w-[220px]">
                  <span className="mb-2 block text-xs font-medium text-black/40">
                    Kategori
                  </span>
                  <div
                    className="flex h-12 items-center justify-between rounded-2xl border border-[#0f766e]/15 bg-[#f0fdfa] px-4"
                    title="Kategori AI tarafından belirlenir ve değiştirilemez"
                  >
                    <span className="text-sm font-semibold text-[#115e59]">
                      {selectedCategory.label}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0f766e]/70">
                      AI
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-black/[0.05] bg-[#f8f7f4] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0f766e] text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      AI bunu “{selectedCategory.label}” olarak algıladı
                    </p>
                    <p className="mt-1 text-xs leading-5 text-black/45">
                      Güven seviyesi: %{aiResult.knowledge.confidence} · Kategori
                      kilitli; metni değiştirerek güncellenir
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {visibleCommonFields.map((field) => (
                  <CommonField
                    key={`${activeCategoryId}-${field.key}`}
                    label={field.label}
                    value={mergedCommonDraft[field.key]}
                    onChange={(value) => updateCommonField(field.key, value)}
                    placeholder={field.placeholder}
                    wide={field.key === "title"}
                    hint={
                      field.key === "title" &&
                      !titleManuallyEdited &&
                      Boolean(autoTitle.trim()) &&
                      autoTitle !== "Yeni talep"
                        ? "Başlık otomatik dolduruldu — düzenleyebilirsiniz"
                        : undefined
                    }
                  />
                ))}

                {visibleDynamicFields.map((field) => (
                  <DynamicFieldInput
                    key={`${activeCategoryId}-${field.key}`}
                    field={{
                      ...field,
                      required: isFieldRequired(field, dynamicValues),
                    }}
                    value={dynamicValues[field.key] ?? ""}
                    onChange={(value) =>
                      updateDynamicField(field.key, value)
                    }
                  />
                ))}
              </div>

              {publishError && publishedVersion === "manual" && (
                <div className="mt-4 rounded-2xl bg-[#ffe4df] p-4 text-sm font-semibold text-[#8b352b]">
                  {publishError}
                </div>
              )}

              <button
                type="button"
                disabled={isPublishing}
                onClick={() => publishRequest("manual")}
                className="mt-5 flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-black/[0.12] bg-[#171717] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
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

          <aside className="xl:sticky xl:top-4 xl:self-start">
            <div className="talepo-ai-panel rounded-[28px] p-5 text-white sm:p-7">
              <div className="relative z-[1]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/15 bg-white/[0.04] px-3 py-1.5">
                      <span className="talepo-ai-status-dot" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100/70">
                        Talepo AI Core
                      </span>
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
                      Canlı analiz
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-white/45">
                      Metniniz parse ediliyor · kurumsal sürüm hazırlanıyor
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
                      <p className="text-2xl font-semibold tracking-[-0.05em]">
                        {aiResult.score}
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
                        /100
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-teal-300/25 bg-[#0f766e]/35 px-3 py-1.5 text-xs font-semibold text-teal-50">
                    {aiResult.score >= 85
                      ? "Yayınlamaya hazır"
                      : aiResult.score >= 60
                        ? "Geliştirilebilir"
                        : "Eksik bilgi var"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50">
                    {selectedCategory.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50">
                    Güven %{aiResult.knowledge.confidence}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <MetricCard
                    label="Tahmini fiyat"
                    value={`${formatCurrency(aiResult.pricing.min)} – ${formatCurrency(aiResult.pricing.max)}`}
                    description={`Güven %${aiResult.pricing.confidence}`}
                  />
                  <MetricCard
                    label="Uygun firma"
                    value={`${matchingDisplay.estimatedCompanyCount} firma`}
                    description={`${matchingDisplay.expectedOfferCount} teklif`}
                  />
                </div>

                {(aiResult.recommendations.length > 0 ||
                  missingFields.length > 0) && (
                  <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                    <div className="flex items-center gap-2">
                      <CircleAlert className="h-4 w-4 text-teal-200/80" />
                      <p className="text-sm font-semibold">Eksikler / öneriler</p>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {aiResult.recommendations.slice(0, 2).map((recommendation) => (
                        <div
                          key={recommendation.id}
                          className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
                        >
                          <p className="text-sm font-medium text-white/85">
                            {recommendation.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-white/40">
                            {recommendation.reason}
                          </p>
                        </div>
                      ))}
                      {missingFields.slice(0, 3).map((field) => (
                        <div
                          key={field.key}
                          className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-white/65"
                        >
                          {field.label} eksik
                          <ArrowRight className="h-3.5 w-3.5 text-white/30" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiResult.recommendations.length === 0 &&
                  missingFields.length === 0 &&
                  requestText.trim() && (
                    <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-teal-300/20 bg-[#0f766e]/20 px-4 py-3 text-sm font-medium text-teal-50">
                      <Check className="h-4 w-4 shrink-0" />
                      Temel bilgiler tamam · kurumsal metin hazır
                    </div>
                  )}

                <div className="talepo-ai-version mt-5 rounded-[22px] p-5 pl-6 text-[#171717]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f766e] text-white shadow-[0_8px_20px_rgba(15,118,110,0.35)]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]/80">
                          AI tarafından hazırlanan sürüm
                        </p>
                        <p className="mt-1 text-base font-semibold tracking-tight">
                          {mergedCommonDraft.title || "Kurumsal talep metni"}
                        </p>
                      </div>
                    </div>
                    <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#0f766e]/55" />
                  </div>
                  <p className="mt-4 whitespace-pre-line rounded-2xl border border-black/[0.05] bg-[#f7f8f6] p-4 text-sm leading-7 text-black/70">
                    {requestText.trim()
                      ? professionalText
                      : "Sol tarafa talebinizi yazın; kurumsal sürüm burada oluşur."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsUrgent((current) => !current)}
                  aria-pressed={isUrgent}
                  className={`mt-4 flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                    isUrgent
                      ? "border-amber-300/50 bg-gradient-to-r from-amber-400/20 to-orange-500/15 shadow-[0_10px_28px_rgba(245,158,11,0.18)]"
                      : "border-amber-300/25 bg-amber-400/[0.08] hover:border-amber-300/40 hover:bg-amber-400/[0.12]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isUrgent
                        ? "bg-amber-400 text-[#1a1200] shadow-[0_8px_18px_rgba(245,158,11,0.45)]"
                        : "bg-amber-400/20 text-amber-200"
                    }`}
                  >
                    <Zap className="h-5 w-5" fill={isUrgent ? "currentColor" : "none"} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        Acil alıcıyım
                      </span>
                      <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-100">
                        Ücretsiz
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/55">
                      Firmalar talebinizi öncelikli görür; daha hızlı teklif
                      alırsınız.
                    </span>
                  </span>
                  <span
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      isUrgent
                        ? "border-amber-300 bg-amber-400 text-[#1a1200]"
                        : "border-white/25 bg-black/20"
                    }`}
                    aria-hidden
                  >
                    {isUrgent ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                  </span>
                </button>

                <details className="mt-3 group rounded-2xl border border-white/[0.08] bg-white/[0.03] open:bg-white/[0.04]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-white/80 [&::-webkit-details-marker]:hidden">
                    Öne çıkarma (isteğe bağlı)
                    <ChevronDown className="h-4 w-4 text-white/35 transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
                    <p className="text-xs leading-5 text-white/40">
                      Talebinizi keşifte daha görünür yapmak isterseniz süre
                      seçin. Ödeme yakında.
                    </p>
                    <label className="mt-3 block">
                      <span className="text-xs text-white/40">
                        Talep öne çıkarma
                      </span>
                      <select
                        value={featureBoost}
                        onChange={(event) =>
                          setFeatureBoost(
                            event.target.value as typeof featureBoost,
                          )
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
                      >
                        <option value="">Öne çıkarma istemiyorum</option>
                        <option value="FEATURE_24H">
                          24 saat öne çıkar · ₺99
                        </option>
                        <option value="FEATURE_3D">3 gün öne çıkar · ₺199</option>
                        <option value="FEATURE_7D">7 gün öne çıkar · ₺349</option>
                      </select>
                    </label>
                  </div>
                </details>

                <p className="mt-3 flex items-start gap-2 px-1 text-[11px] leading-5 text-white/30">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Fiyat ve firma sayıları örnek katsayılara dayanır; gerçek veri
                  bağlandığında güncellenecek.
                </p>

                {publishError && publishedVersion === "ai" && (
                  <div className="mt-3 rounded-2xl bg-[#ffe4df] p-4 text-sm font-semibold text-[#8b352b]">
                    {publishError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => publishRequest("ai")}
                  className="mt-4 flex min-h-[52px] w-full items-center justify-between rounded-2xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,118,110,0.35)] transition hover:bg-[#0d6a63] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    {isPublishing && publishedVersion === "ai" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isPublishing && publishedVersion === "ai"
                      ? "Yayınlanıyor..."
                      : "AI sürümünü yayınla"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="talepo-ai-metric rounded-2xl px-3.5 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-[0.95rem] font-semibold leading-snug tracking-tight text-white">
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-white/40">{description}</p>
    </div>
  );
}

function CommonField({
  label,
  value,
  onChange,
  placeholder,
  wide = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
  hint?: string;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-2 block text-xs font-medium text-black/40">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-black/[0.08] bg-[#fafaf8] px-4 text-sm font-medium outline-none transition focus:border-[#0f766e]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.1)]"
      />

      {hint ? (
        <span className="mt-1.5 block text-[11px] leading-4 text-[#0f766e]/80">
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
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-black/40">
          {field.label}
        </span>

        {field.required && (
          <span className="rounded-full bg-[#ffe8e3] px-2 py-0.5 text-[10px] font-semibold text-[#a44b3d]">
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
              className="h-12 w-full appearance-none rounded-2xl border border-black/[0.08] bg-[#fafaf8] px-4 pr-10 text-sm font-medium outline-none transition focus:border-[#0f766e]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.1)]"
            >
              <option value="">Seçiniz</option>

              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          </>
        ) : (
          <input
            type={field.type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            className="h-12 w-full rounded-2xl border border-black/[0.08] bg-[#fafaf8] px-4 pr-14 text-sm font-medium outline-none transition focus:border-[#0f766e]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.1)]"
          />
        )}

        {field.unit && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-black/30">
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
