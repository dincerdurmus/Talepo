/**
 * Single question control registry — maps fieldKey + category → UI control.
 * text_fallback is NOT the default for critical fields.
 */

import type {
  ControlResolveContext,
  QuestionControlDef,
  QuestionControlType,
} from "./question-control-types";
import {
  areaSqmPresets,
  brandModelSoftOptions,
  budgetEntryOptions,
  conditionOptions,
  deliveryDeadlineOptions,
  listingTypeOptions,
  locationSoftOptions,
  modelOptionsForBrand,
  popularBrandOptions,
  printDesignReadyOptions,
  printSizePresets,
  quantityPresets,
  roomCountOptions,
  yesNoDontCareOptions,
} from "./option-providers";
import { budgetBasisForListing } from "./listing-budget-basis";
import { getCategoryById } from "@/lib/request-category-engine";

function softFromCtx(ctx: ControlResolveContext): {
  unknown?: { label: string; value: string; soft: true };
  dontCare?: { label: string; value: string; soft: true };
} {
  return {
    unknown: ctx.allowUnknown
      ? { label: "Henüz bilmiyorum", value: "unknown", soft: true as const }
      : undefined,
    dontCare: ctx.allowDontCare
      ? { label: "Fark etmez", value: "no_preference", soft: true as const }
      : undefined,
  };
}

function withSoft(
  options: QuestionControlDef["options"],
  ctx: ControlResolveContext,
  extraSoft: QuestionControlDef["softOptions"] = [],
): Pick<QuestionControlDef, "options" | "softOptions"> {
  const { unknown, dontCare } = softFromCtx(ctx);
  const soft = [
    ...extraSoft,
    ...(unknown ? [unknown] : []),
    ...(dontCare && !extraSoft.some((s) => s.value === "no_preference")
      ? [dontCare]
      : []),
  ];
  // Deduplicate soft from primary options
  const softValues = new Set(soft.map((s) => s.value));
  return {
    options: options.filter((o) => !softValues.has(o.value) || o.opensCustom),
    softOptions: soft,
  };
}

export function resolveQuestionControl(
  ctx: ControlResolveContext,
): QuestionControlDef {
  const key = ctx.fieldKey;
  const isRE = ctx.isRealEstate || ctx.categoryId === "real-estate";

  if (key === "budget") {
    const basis =
      isRE
        ? budgetBasisForListing(ctx.listingType) ?? undefined
        : ctx.categoryId === "printing"
          ? "total"
          : ctx.categoryId === "services"
            ? "service"
            : "total";
    return {
      controlType: "money_range",
      options: budgetEntryOptions(),
      softOptions: [],
      allowCustom: true,
      customLabel: "Tutar gir",
      currency: "TRY",
      budgetBasis: basis,
      commitOnSelect: true,
    };
  }

  if (key === "city" || key === "location") {
    return {
      controlType: "location_picker",
      options: [],
      softOptions: locationSoftOptions({ ...ctx, isRealEstate: isRE }),
      allowCustom: false,
      commitOnSelect: true,
    };
  }

  if (key === "delivery" || key === "deliveryDays" || key === "timing") {
    const opts = deliveryDeadlineOptions();
    return {
      controlType: "date_or_deadline",
      ...withSoft(
        opts.filter((o) => !o.soft),
        ctx,
        opts.filter((o) => o.soft),
      ),
      allowCustom: true,
      customLabel: "Tarih seç",
      commitOnSelect: true,
    };
  }

  if (key === "quantity") {
    return {
      controlType: "number_presets",
      options: quantityPresets(ctx),
      softOptions: ctx.allowUnknown
        ? [{ label: "Henüz bilmiyorum", value: "unknown", soft: true }]
        : [],
      allowCustom: true,
      customLabel: "Özel adet",
      unit: "adet",
      commitOnSelect: true,
    };
  }

  if (key === "condition") {
    return {
      controlType: "single_choice",
      options: conditionOptions().filter((o) => !o.soft),
      softOptions: conditionOptions().filter((o) => o.soft),
      allowCustom: false,
      commitOnSelect: true,
    };
  }

  if (key === "brand") {
    return {
      controlType: "searchable_entity",
      options: popularBrandOptions(ctx).filter((o) => !o.opensCustom && !o.soft),
      softOptions: brandModelSoftOptions().filter((o) => o.soft || o.opensCustom),
      allowCustom: true,
      customLabel: "Başka marka",
      commitOnSelect: true,
    };
  }

  if (key === "model" || key === "series") {
    return {
      controlType: "searchable_entity",
      options: modelOptionsForBrand(ctx),
      softOptions: brandModelSoftOptions(),
      allowCustom: true,
      customLabel: "Başka model",
      commitOnSelect: true,
      placeholder: "Model ara veya yaz",
    };
  }

  if (key === "listingType") {
    return {
      controlType: "single_choice",
      options: listingTypeOptions(),
      softOptions: [],
      allowCustom: false,
      commitOnSelect: true,
    };
  }

  if (key === "propertyType" || key === "rooms" || key === "roomCount") {
    if (key === "rooms" || key === "roomCount") {
      return {
        controlType: "single_choice",
        options: roomCountOptions(),
        softOptions: [],
        allowCustom: true,
        customLabel: "Diğer oda",
        commitOnSelect: true,
      };
    }
    return {
      controlType: "single_choice",
      options: [
        { label: "Daire", value: "Daire" },
        { label: "Villa", value: "Villa" },
        { label: "Müstakil", value: "Müstakil" },
        { label: "Diğer", value: "__custom__", opensCustom: true },
      ],
      softOptions: [],
      allowCustom: true,
      commitOnSelect: true,
    };
  }

  if (key === "area" || key === "areaSqm" || key === "squareMeters") {
    return {
      controlType: "number_presets",
      options: areaSqmPresets(),
      softOptions: [],
      allowCustom: true,
      customLabel: "Özel m²",
      unit: "m²",
      commitOnSelect: true,
    };
  }

  if (key === "furnished" || key === "furniture") {
    return {
      controlType: "yes_no",
      options: yesNoDontCareOptions().filter((o) => !o.soft),
      softOptions: yesNoDontCareOptions().filter((o) => o.soft),
      allowCustom: false,
      commitOnSelect: true,
    };
  }

  if (key === "needType" || key === "locationMode") {
    /**
     * TALEP TÜRÜ SEÇENEKLERİ KATEGORİNİN KENDİ ŞEMASINDAN GELİR (kurucu,
     * 2026-09-01). Eski sabit liste (Araç/Yedek parça/Servis/Filo)
     * otomotive aitti ve televizyon talebine "Filo" öneriyordu (ölçüldü).
     * Kanonik kanal profileChoices'tır; yalnız o boşsa otomotiv varsayılanı
     * (bu sabitin asıl sahibi) kullanılır.
     */
    const options =
      key === "locationMode"
        ? [
            { label: "Uzaktan uygun", value: "remote" },
            { label: "Yerinde olsun", value: "onsite" },
          ]
        : (() => {
            /* TEK YETKİLİ KAYNAK: kategori şemasının kendi needType
               seçenekleri — HANGİ yoldan gelinirse gelinsin (profil,
               hybrid aday, düzenleme). profileChoices yalnız yedektir;
               otomotiv sabiti YALNIZ otomotivde ve son çaredir. */
            const schema = (getCategoryById(ctx.categoryId)?.fields ?? [])
              .filter((f) => f.key === "needType")
              .flatMap((f) => f.options ?? [])
              .map((o) => ({
                label: String(o.label ?? o.value ?? ""),
                value: String(o.value ?? o.label ?? ""),
              }))
              .filter((o) => o.value);
            if (schema.length) return schema;
            if (ctx.profileChoices?.length) {
              return ctx.profileChoices.map((o) => ({
                label: o.label,
                value: o.value,
              }));
            }
            return ctx.categoryId === "automotive"
              ? [
                  { label: "Araç", value: "vehicle" },
                  { label: "Yedek parça", value: "part" },
                  { label: "Servis", value: "service" },
                  { label: "Filo", value: "fleet" },
                ]
              : [];
          })();
    return {
      controlType: "single_choice",
      options,
      softOptions: [],
      allowCustom: false,
      commitOnSelect: true,
    };
  }

  if (
    key === "dimensions" ||
    key === "size" ||
    key === "printSize" ||
    key === "paperSize"
  ) {
    return {
      controlType: "dimensions",
      options: printSizePresets(),
      softOptions: ctx.allowUnknown
        ? [{ label: "Ölçüyü bilmiyorum", value: "unknown", soft: true }]
        : [],
      allowCustom: true,
      customLabel: "Özel ölçü",
      commitOnSelect: true,
    };
  }

  if (key === "designReady" || key === "artworkReady") {
    return {
      controlType: "single_choice",
      options: printDesignReadyOptions(),
      softOptions: [],
      allowCustom: false,
      commitOnSelect: true,
    };
  }

  // Fallback — only for non-critical descriptive fields
  const soft = softFromCtx(ctx);
  const escapes = [
    ...(soft.unknown ? [soft.unknown] : []),
    ...(soft.dontCare ? [soft.dontCare] : []),
  ];

  /**
   * PROFİL SEÇENEKLERİ SON ÇAREDEN ÖNCE OKUNUR (2026-08-29).
   *
   * Ölçüldü: 34 profil alanı kanonik hızlı seçenek taşıdığı hâlde burada
   * seçeneksiz metin kutusuna düşüyordu; kullanıcı tek dokunuşla
   * cevaplayabileceği soruyu elle yazmak zorunda kalıyordu.
   *
   * İki sınır korunur. (1) Bu dal EN SONDADIR: budget, city, delivery,
   * dimensions, searchable_entity gibi özel kontroller zaten yukarıda
   * çözülmüştür ve etkilenmez. (2) `allowCustom` AÇIK bırakılır: profil
   * seçenekleri kapalı enum değildir, listede olmayan geçerli cevap arayüzün
   * mevcut 'Listede yok / Özel değer' yolundan yazılmaya devam eder.
   *
   * Kaçış cevapları buraya elle EKLENMEZ; yalnız `softFromCtx` sözleşmesinden
   * gelir. Seçeneklerin sırası, etiketi ve gönderilecek değeri profilden
   * aynen taşınır.
   */
  if (ctx.profileChoices && ctx.profileChoices.length > 0) {
    return {
      controlType: "single_choice",
      options: ctx.profileChoices.map((o) => ({
        label: o.label,
        value: o.value,
      })),
      softOptions: escapes,
      allowCustom: true,
      customLabel: "Listede yok / Özel değer",
      commitOnSelect: true,
    };
  }

  return {
    controlType: "text_fallback",
    options: [],
    softOptions: escapes,
    allowCustom: true,
    customLabel: "Cevabınız",
    commitOnSelect: false,
    placeholder: "Kısaca yazın",
  };
}

/** Critical fields that must not resolve to text_fallback. */
export const CRITICAL_CONTROL_KEYS = new Set([
  "budget",
  "city",
  "location",
  "delivery",
  "quantity",
  "listingType",
  "propertyType",
  "needType",
  "locationMode",
  "condition",
  "brand",
]);

export function controlTypeForField(
  ctx: ControlResolveContext,
): QuestionControlType {
  return resolveQuestionControl(ctx).controlType;
}

export function assertCriticalControlNotTextFallback(
  ctx: ControlResolveContext,
): { ok: boolean; fieldKey: string; controlType: QuestionControlType } {
  const def = resolveQuestionControl(ctx);
  const critical =
    CRITICAL_CONTROL_KEYS.has(ctx.fieldKey) ||
    ctx.importance === "publish_required" ||
    ctx.importance === "routing_critical" ||
    ctx.importance === "quote_critical";
  const ok = !critical || def.controlType !== "text_fallback";
  return { ok, fieldKey: ctx.fieldKey, controlType: def.controlType };
}
