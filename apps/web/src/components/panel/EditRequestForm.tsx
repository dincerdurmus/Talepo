"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  Save,
  Sparkles,
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

export type EditRequestInitial = {
  id: string;
  title: string;
  description: string;
  professionalDescription: string | null;
  city: string | null;
  budget: string | null;
  isUrgent: boolean;
  categorySlug: string;
  fieldValues: Record<string, string>;
};

type CommonDraft = {
  title: string;
  quantity: string;
  city: string;
  delivery: string;
  budget: string;
};

export function EditRequestForm({ initial }: { initial: EditRequestInitial }) {
  const router = useRouter();
  const [requestText, setRequestText] = useState(
    initial.description || initial.professionalDescription || "",
  );
  const [manualValues, setManualValues] = useState<Record<string, string>>(
    initial.fieldValues,
  );
  const [commonDraft, setCommonDraft] = useState<CommonDraft>({
    title: initial.title,
    quantity: "",
    city: initial.city ?? "",
    delivery: "",
    budget: initial.budget ?? "",
  });
  const [isUrgent, setIsUrgent] = useState(initial.isUrgent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const aiResult = useMemo(() => runTalepoAiCore(requestText), [requestText]);
  // Düzenlemede kategori sabit kalır (oluşturma anındaki kategori).
  const activeCategoryId = initial.categorySlug || aiResult.parsed.categoryId;
  const selectedCategory = getCategoryById(activeCategoryId);
  const visibleCommonFields = selectedCategory.commonFields.map(
    resolveCommonField,
  );
  const visibleCommonFieldKeys = new Set(
    visibleCommonFields.map((field) => field.key),
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

  const mergedCommonDraft: CommonDraft = {
    title:
      commonDraft.title ||
      composeRequestTitle({
        categoryId: activeCategoryId,
        rawText: requestText,
        attributes: { ...aiResult.parsed.attributes, ...dynamicValues },
        city: commonDraft.city || aiResult.parsed.city || "",
        fields: selectedCategory.fields,
        fieldValues: dynamicValues,
      }),
    quantity: visibleCommonFieldKeys.has("quantity")
      ? commonDraft.quantity
      : "",
    city: visibleCommonFieldKeys.has("city")
      ? commonDraft.city || aiResult.parsed.city || ""
      : "",
    delivery: visibleCommonFieldKeys.has("delivery")
      ? commonDraft.delivery
      : "",
    budget: visibleCommonFieldKeys.has("budget") ? commonDraft.budget : "",
  };

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
    attributes: { ...aiResult.parsed.attributes, ...dynamicValues },
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

  async function saveRequest() {
    if (isSaving || missingFields.length > 0) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/requests/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mergedCommonDraft.title,
          description: requestText.trim() || professionalText,
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
            "Talep kullanıcı tarafından güncellendi",
          ].join("\n"),
          isUrgent,
          publishVersion: "ai",
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
        throw new Error(result.message || "Talep güncellenemedi.");
      }

      router.push(result.redirectTo || `/panel/taleplerim/${initial.id}`);
      router.refresh();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Talep güncellenirken bir hata oluştu.",
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="relative space-y-5 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[32px]">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-emerald-300/40 blur-[90px]" />
        <div className="absolute -right-16 top-24 h-80 w-80 rounded-full bg-sky-300/40 blur-[90px]" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-amber-200/35 blur-[80px]" />
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/80 bg-white/85 px-5 py-4 shadow-[0_12px_40px_rgba(13,148,136,0.08)] backdrop-blur-xl">
        <Link
          href={`/panel/taleplerim/${initial.id}`}
          className="flex items-center gap-2 text-sm font-medium text-black/45 transition hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Talebe dön
        </Link>
        <span className="rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
          Talebi düzenliyorsunuz
        </span>
      </header>

      <section className="relative overflow-hidden rounded-[30px] border border-white/80 bg-gradient-to-br from-white via-[#f0fdf9] to-[#e0f2fe] p-6 shadow-[0_22px_70px_rgba(14,116,144,0.12)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-300/35 blur-[70px]" />
        <div className="pointer-events-none absolute -bottom-20 left-0 h-56 w-56 rounded-full bg-emerald-300/30 blur-[70px]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-teal-500 to-sky-500 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Talebimi düzelt
            </h1>
            <p className="mt-1 text-sm text-black/45">
              Metni veya alanları güncelleyin, sonra kaydedin.
            </p>
          </div>
        </div>

        <label className="relative mt-8 block">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-teal-900">
              Talep metni
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
              {requestText.length} karakter
            </span>
          </div>
          <textarea
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            className="min-h-[320px] w-full resize-y rounded-[24px] border-2 border-teal-500/25 bg-white/95 px-5 py-4 text-base leading-8 outline-none transition focus:border-teal-500/55 focus:shadow-[0_16px_45px_rgba(13,148,136,0.14)] sm:min-h-[380px] sm:text-lg sm:leading-9"
            placeholder="Talebinizi buradan güncelleyin..."
          />
        </label>

        <div className="relative mt-6">
          <p className="mb-2 text-xs font-medium text-black/40">Kategori</p>
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-100 to-sky-100 px-3.5 py-2 text-xs font-semibold text-teal-950 shadow-sm">
            {selectedCategory.label}
            <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-black/40">
              Kilitli
            </span>
          </div>
        </div>

        <div className="relative mt-6 grid gap-4 sm:grid-cols-2">
          {visibleCommonFields.map((field) => (
            <label
              key={field.key}
              className={field.key === "title" ? "sm:col-span-2" : ""}
            >
              <span className="mb-2 block text-xs font-medium text-black/40">
                {field.label}
              </span>
              <input
                value={mergedCommonDraft[field.key]}
                onChange={(event) =>
                  setCommonDraft((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
                placeholder={field.placeholder}
                className="h-12 w-full rounded-[17px] border border-teal-900/10 bg-gradient-to-br from-white to-sky-50/60 px-4 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
              />
            </label>
          ))}

          {visibleDynamicFields.map((field) => (
            <DynamicFieldInput
              key={field.key}
              field={{
                ...field,
                required: isFieldRequired(field, dynamicValues),
              }}
              value={dynamicValues[field.key] ?? ""}
              onChange={(value) =>
                setManualValues((current) => ({
                  ...current,
                  [field.key]: value,
                }))
              }
            />
          ))}
        </div>

        <label className="relative mt-5 flex items-center gap-3 rounded-[18px] border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 text-sm font-medium text-amber-950">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(event) => setIsUrgent(event.target.checked)}
            className="h-4 w-4 rounded border-black/20"
          />
          Acil alıcıyım
        </label>

        {missingFields.length > 0 && (
          <div className="relative mt-4 rounded-[18px] border border-[#efb8b0] bg-[#fff1ee] px-4 py-3 text-sm text-[#8b352b]">
            Eksik zorunlu alanlar:{" "}
            {missingFields.map((field) => field.label).join(", ")}
          </div>
        )}

        {saveError && (
          <div className="relative mt-4 flex items-start gap-2 rounded-[18px] border border-[#efb8b0] bg-[#fff1ee] px-4 py-3 text-sm text-[#8b352b]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {saveError}
          </div>
        )}

        <div className="relative mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isSaving || missingFields.length > 0}
            onClick={() => void saveRequest()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-700 to-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Değişiklikleri kaydet
          </button>
          <Link
            href={`/panel/taleplerim/${initial.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-5 py-3 text-sm font-semibold text-black/60"
          >
            Vazgeç
          </Link>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#0f766e] via-[#0c4a6e] to-[#172554] p-6 text-white shadow-[0_24px_70px_rgba(15,118,110,0.25)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-300/20 blur-[70px]" />
        <div className="relative flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-teal-100/70">
          <Sparkles className="h-4 w-4 text-amber-200" />
          Güncel AI özeti
        </div>
        <p className="relative mt-4 whitespace-pre-line text-sm leading-7 text-white/75">
          {professionalText}
        </p>
        {missingFields.length === 0 ? (
          <div className="relative mt-4 flex items-center gap-2 text-sm text-emerald-200">
            <Check className="h-4 w-4" />
            Kaydetmeye hazır
            <ArrowRight className="h-4 w-4" />
          </div>
        ) : null}
      </section>
    </div>
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
        <span className="text-xs font-medium text-black/40">{field.label}</span>
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
              className="h-12 w-full appearance-none rounded-[17px] border border-teal-900/10 bg-gradient-to-br from-white to-sky-50/60 px-4 pr-10 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
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
            type={field.type === "number" ? "number" : "text"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            className="h-12 w-full rounded-[17px] border border-teal-900/10 bg-gradient-to-br from-white to-sky-50/60 px-4 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
          />
        )}
      </div>
    </label>
  );
}
