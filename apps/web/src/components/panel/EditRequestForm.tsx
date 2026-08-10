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

import { RealEstateLocationFields } from "@/components/request/RealEstateLocationFields";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import {
  composeProfessionalDescription,
  composeRequestTitle,
} from "@/lib/ai/request-text-composer";
import {
  neighborhoodsFieldValue,
  realEstateLocationError,
  realEstateLocationToCity,
  type RealEstateLocation,
} from "@/lib/geo/real-estate-location";
import { parseNeighborhoods } from "@/lib/geo/neighborhoods";
import { parseRealEstateCity } from "@/lib/geo/turkey-districts";
import {
  getCategoryById,
  getVisibleCategoryFields,
  isFieldRequired,
  resolveCommonField,
  withCategoryFieldDefaults,
  type DynamicField,
} from "@/lib/request-category-engine";
import { understandRequest } from "@/lib/request-understanding/understand-request";
import {
  budgetDisplayFromUnderstanding,
  safeDraftAttributes,
  seedFieldValuesFromUnderstanding,
} from "@/lib/request-understanding/activation-bridge";

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
  const initialParsed = parseRealEstateCity(initial.city);
  const [realEstateLocation, setRealEstateLocation] =
    useState<RealEstateLocation>({
      il: initialParsed?.il ?? "",
      ilce: initialParsed?.ilce ?? "",
      mahalleler: parseNeighborhoods(initial.fieldValues.neighborhoods),
    });

  function updateRealEstateLocation(next: RealEstateLocation) {
    setRealEstateLocation(next);
    setManualValues((current) => ({
      ...current,
      neighborhoods: neighborhoodsFieldValue(next),
    }));
  }

  const understanding = useMemo(
    () =>
      understandRequest({
        rawInput: requestText,
        structured: {
          // Persisted category is a locked structured override on edit
          categoryId: initial.categorySlug,
          city: commonDraft.city || null,
          district: realEstateLocation.ilce || null,
          fieldValues: {
            ...manualValues,
            ...(commonDraft.quantity ? { quantity: commonDraft.quantity } : {}),
            ...(commonDraft.budget ? { budget: commonDraft.budget } : {}),
            ...(commonDraft.delivery ? { delivery: commonDraft.delivery } : {}),
          },
        },
      }),
    [
      commonDraft.budget,
      commonDraft.city,
      commonDraft.delivery,
      commonDraft.quantity,
      initial.categorySlug,
      manualValues,
      realEstateLocation.ilce,
      requestText,
    ],
  );

  // Düzenlemede kategori sabit kalır (persisted STRUCTURED_FIELD).
  const activeCategoryId = initial.categorySlug;
  const isRealEstate = activeCategoryId === "real-estate";
  const selectedCategory = getCategoryById(activeCategoryId);
  const visibleCommonFields = selectedCategory.commonFields.map(
    resolveCommonField,
  );
  const visibleCommonFieldKeys = new Set(
    visibleCommonFields.map((field) => field.key),
  );

  const seededFields = useMemo(
    () => seedFieldValuesFromUnderstanding(understanding),
    [understanding],
  );
  const understandingCity = understanding.location?.city?.value ?? "";
  const understandingBudgetDisplay =
    budgetDisplayFromUnderstanding(understanding);

  const dynamicValues = useMemo(() => {
    const category = getCategoryById(activeCategoryId);
    const values: Record<string, string> = {};
    for (const field of category.fields) {
      const seeded = seededFields[field.key];
      values[field.key] =
        manualValues[field.key] ??
        (seeded === undefined || seeded === null ? "" : String(seeded));
    }
    return withCategoryFieldDefaults(activeCategoryId, values);
  }, [activeCategoryId, seededFields, manualValues]);

  const draftSafeAttributes = useMemo(
    () =>
      safeDraftAttributes(understanding, {
        ...seededFields,
        ...dynamicValues,
      }),
    [understanding, seededFields, dynamicValues],
  );

  const mergedCommonDraft: CommonDraft = {
    title:
      commonDraft.title ||
      composeRequestTitle({
        categoryId: activeCategoryId,
        rawText: requestText,
        attributes: { ...seededFields, ...dynamicValues },
        city: commonDraft.city || understandingCity || "",
        fields: selectedCategory.fields,
        fieldValues: dynamicValues,
      }),
    quantity: visibleCommonFieldKeys.has("quantity")
      ? commonDraft.quantity ||
        (understanding.quantity?.value?.value != null
          ? `${understanding.quantity.value.value} ${understanding.quantity.value.unit ?? "adet"}`
          : "")
      : "",
    city: isRealEstate
      ? realEstateLocationToCity(realEstateLocation) ||
        commonDraft.city ||
        understandingCity ||
        ""
      : visibleCommonFieldKeys.has("city")
        ? commonDraft.city || understandingCity || ""
        : "",
    delivery: visibleCommonFieldKeys.has("delivery")
      ? commonDraft.delivery
      : "",
    budget: visibleCommonFieldKeys.has("budget")
      ? commonDraft.budget || understandingBudgetDisplay
      : "",
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

  const realEstateLocationMissing = isRealEstate
    ? Boolean(realEstateLocationError(realEstateLocation))
    : false;

  const professionalText = composeProfessionalDescription({
    categoryId: activeCategoryId,
    rawText: requestText,
    attributes: draftSafeAttributes,
    city: mergedCommonDraft.city || understandingCity,
    budget:
      understanding.budget?.value?.max ?? understanding.budget?.value?.min,
    quantity: understanding.quantity?.value?.value,
    unit: understanding.quantity?.value?.unit,
    fields: visibleDynamicFields,
    fieldValues: dynamicValues,
    commonDraft: mergedCommonDraft,
    commonFields: visibleCommonFields,
  });

  async function saveRequest() {
    if (
      isSaving ||
      missingFields.length > 0 ||
      realEstateLocationMissing
    ) {
      return;
    }
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
          district: isRealEstate ? realEstateLocation.ilce : undefined,
          quantity: mergedCommonDraft.quantity,
          delivery: mergedCommonDraft.delivery,
          budget: mergedCommonDraft.budget,
          aiScore: Math.round(understanding.understandingConfidence * 100),
          aiSummary: [
            `Kategori: ${selectedCategory.label}`,
            `AI güveni: %${Math.round(understanding.understandingConfidence * 100)}`,
            `Strategy: ${understanding.strategy.value ?? "UNKNOWN"}`,
            "Talep kullanıcı tarafından güncellendi",
          ].join("\n"),
          isUrgent,
          publishVersion: "ai",
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
        <span className="rounded-full bg-[#0f766e] px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
          Talebi düzenliyorsunuz
        </span>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-teal-900/10 bg-white p-6 shadow-[0_16px_48px_rgba(15,31,29,0.05)] sm:p-8">
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0f766e] text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0f1f1d] sm:text-3xl">
              Talebimi düzelt
            </h1>
            <p className="mt-1 text-sm text-teal-950/45">
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
          {visibleCommonFields.map((field) => {
            if (isRealEstate && field.key === "city") {
              return (
                <RealEstateLocationFields
                  key="real-estate-location"
                  il={realEstateLocation.il}
                  ilce={realEstateLocation.ilce}
                  mahalleler={realEstateLocation.mahalleler}
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
                  selectClassName="h-12 w-full appearance-none rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-4 pr-10 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
                  labelClassName="text-xs font-medium text-black/40"
                  neighborhoodControlClassName="min-h-12 w-full rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-3 py-2 text-sm outline-none transition focus-within:border-teal-500/40 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
                />
              );
            }

            const fieldClassName =
              "h-12 w-full rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-4 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]";

            const setFieldValue = (next: string) =>
              setCommonDraft((current) => ({
                ...current,
                [field.key]: next,
              }));

            return (
              <label
                key={field.key}
                className={field.key === "title" ? "sm:col-span-2" : ""}
              >
                <span className="mb-2 block text-xs font-medium text-black/40">
                  {field.label}
                </span>
                {field.key === "budget" ? (
                  <TrMoneyInput
                    value={mergedCommonDraft[field.key]}
                    onValueChange={setFieldValue}
                    placeholder={field.placeholder}
                    allowFreeText
                    className={fieldClassName}
                  />
                ) : (
                  <input
                    value={mergedCommonDraft[field.key]}
                    onChange={(event) => setFieldValue(event.target.value)}
                    placeholder={field.placeholder}
                    className={fieldClassName}
                  />
                )}
              </label>
            );
          })}

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

        {(missingFields.length > 0 || realEstateLocationMissing) && (
          <div className="relative mt-4 rounded-[18px] border border-[#efb8b0] bg-[#fff1ee] px-4 py-3 text-sm text-[#8b352b]">
            Eksik zorunlu alanlar:{" "}
            {[
              ...(realEstateLocationMissing
                ? [realEstateLocationError(realEstateLocation) ?? "İl / İlçe / Mahalle"]
                : []),
              ...missingFields.map((field) => field.label),
            ].join(", ")}
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
            disabled={
              isSaving || missingFields.length > 0 || realEstateLocationMissing
            }
            onClick={() => void saveRequest()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-40"
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

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f766e] via-[#0d9488] to-[#115e59] p-6 text-white shadow-[0_20px_56px_rgba(15,118,110,0.22)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-300/20 blur-[70px]" />
        <div className="relative flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-teal-100/70">
          <Sparkles className="h-4 w-4 text-amber-200" />
          Güncel AI özeti
        </div>
        <p className="relative mt-4 whitespace-pre-line text-sm leading-7 text-white/75">
          {professionalText}
        </p>
        {missingFields.length === 0 && !realEstateLocationMissing ? (
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
              className="h-12 w-full appearance-none rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-4 pr-10 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
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
            className="h-12 w-full rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-4 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
          />
        )}
      </div>
    </label>
  );
}
