import type { DynamicField } from "@/lib/request-category-engine";
import {
  getStrategyAttributeProfile,
  type PriceStrategyKey,
} from "@/lib/price-intelligence/price-strategy-registry";
import type { CompletenessBreakdown } from "@/lib/price-intelligence/strategy-completeness";

import type { QuestionCandidate } from "./types";

/** Strategy-critical fields get extra priority in question ranking */
const STRATEGY_FIELD_BOOST: Partial<Record<PriceStrategyKey, Record<string, number>>> = {
  VEHICLE: {
    brand: 0.15,
    model: 0.15,
    modelYear: 0.2,
    mileage: 0.18,
    fuel: 0.08,
    transmission: 0.06,
  },
  AUTO_PART: {
    modelYear: 0.2,
    condition: 0.18,
    partPreference: 0.16,
    city: 0.12,
    budget: 0.1,
    brand: 0.05,
    model: 0.05,
  },
  RETAIL_PRODUCT: {
    brand: 0.12,
    model: 0.12,
    condition: 0.15,
    specs: 0.1,
    solutionType: 0.08,
  },
  CUSTOM_MANUFACTURING: {
    quantity: 0.18,
    dimensions: 0.2,
    material: 0.15,
    printType: 0.1,
  },
  SERVICE_SCOPE: {
    serviceType: 0.15,
    scope: 0.12,
    city: 0.1,
    quantity: 0.1,
  },
  REAL_ESTATE_SALE: {
    listingType: 0.12,
    propertyType: 0.1,
    roomCount: 0.12,
    area: 0.15,
    city: 0.1,
  },
  REAL_ESTATE_RENT: {
    listingType: 0.12,
    propertyType: 0.1,
    roomCount: 0.12,
    area: 0.15,
    city: 0.1,
  },
};

/** Backend/schema placeholders that must never surface as primary human questions */
const GENERIC_BACKEND_QUESTION_KEYS = new Set([
  "solutionType",
  "productName",
  "specs",
  "technicalSpecs",
  "title",
]);

const COMMON_FIELD_WEIGHTS: Record<string, { publish: number; matching: number; price: number; confidence: number }> = {
  title: { publish: 1, matching: 0.6, price: 0.3, confidence: 0.2 },
  city: { publish: 0.9, matching: 0.95, price: 0.4, confidence: 0.3 },
  budget: { publish: 0.3, matching: 0.4, price: 0.85, confidence: 0.5 },
  quantity: { publish: 0.5, matching: 0.7, price: 0.6, confidence: 0.4 },
  delivery: { publish: 0.2, matching: 0.3, price: 0.2, confidence: 0.15 },
};

function fieldImpactFromProfile(
  fieldKey: string,
  strategy: PriceStrategyKey,
): { publish: number; matching: number; price: number; confidence: number } {
  const profile = getStrategyAttributeProfile(strategy);
  const inRequired = profile.required.includes(fieldKey);
  const inImportant = profile.important.includes(fieldKey);

  if (inRequired) {
    return { publish: 1, matching: 0.85, price: 0.75, confidence: 0.7 };
  }
  if (inImportant) {
    return { publish: 0.35, matching: 0.65, price: 0.8, confidence: 0.65 };
  }
  return { publish: 0.15, matching: 0.35, price: 0.4, confidence: 0.3 };
}

function resolveFieldMeta(
  fieldKey: string,
  dynamicFields: DynamicField[],
): Pick<QuestionCandidate, "label" | "inputType" | "options" | "placeholder" | "quickChoices"> {
  const dynamic = dynamicFields.find((f) => f.key === fieldKey);
  if (dynamic) {
    return {
      label: dynamic.label,
      inputType: dynamic.type,
      options: dynamic.options,
      placeholder: dynamic.placeholder,
      quickChoices: buildQuickChoices(dynamic),
    };
  }

  const commonLabels: Record<string, string> = {
    title: "Başlık",
    city: "Şehir",
    budget: "Bütçe",
    quantity: "Miktar",
    delivery: "Teslim süresi",
    brand: "Marka",
    model: "Model",
    modelYear: "Model yılı",
    mileage: "Kilometre",
    condition: "Durum",
    specs: "Teknik özellikler",
    productName: "Ürün adı",
    solutionType: "Çözüm / ürün",
    dimensions: "Ölçüler",
    material: "Malzeme",
    serviceType: "Hizmet türü",
    scope: "Kapsam",
    listingType: "İlan türü",
    propertyType: "Konut tipi",
    roomCount: "Oda sayısı",
    area: "Metrekare",
    part: "Parça",
  };

  return {
    label: commonLabels[fieldKey] ?? fieldKey,
    inputType: fieldKey === "budget" || fieldKey === "quantity" ? "text" : "text",
    placeholder: undefined,
    quickChoices: fieldKey === "modelYear" ? buildYearQuickChoices() : undefined,
  };
}

function buildQuickChoices(field: DynamicField): { label: string; value: string }[] | undefined {
  if (field.options?.length) {
    return field.options.slice(0, 6).map((o) => ({ label: o.label, value: o.value }));
  }
  if (field.key === "modelYear") {
    return buildYearQuickChoices();
  }
  return undefined;
}

function buildYearQuickChoices(): { label: string; value: string }[] {
  // Stable reference year — avoid Date during SSR render for hydration safety
  const year = 2026;
  return [
    { label: `${year}+`, value: String(year) },
    { label: `${year - 2}+`, value: String(year - 2) },
    { label: `${year - 4}+`, value: String(year - 4) },
    { label: "Fark etmez", value: "" },
  ];
}

function isFieldFilled(
  fieldKey: string,
  fieldValues: Record<string, string>,
  commonDraft: { title: string; city: string; budget: string; quantity: string; delivery: string },
): boolean {
  if (fieldKey === "title") return Boolean(commonDraft.title.trim());
  if (fieldKey === "city") return Boolean(commonDraft.city.trim());
  if (fieldKey === "budget") return Boolean(commonDraft.budget.trim());
  if (fieldKey === "quantity") return Boolean(commonDraft.quantity.trim());
  if (fieldKey === "delivery" || fieldKey === "deliveryDays") {
    return Boolean(commonDraft.delivery.trim());
  }
  return Boolean(fieldValues[fieldKey]?.trim());
}

/**
 * Rank up to 3 high-value missing fields for the 20-second question engine.
 */
export function rankNextBestQuestions(input: {
  strategy: PriceStrategyKey;
  completeness: CompletenessBreakdown;
  fieldValues: Record<string, string>;
  commonDraft: { title: string; city: string; budget: string; quantity: string; delivery: string };
  dynamicFields: DynamicField[];
  requiredDynamicKeys: string[];
  maxQuestions?: number;
}): QuestionCandidate[] {
  const maxQuestions = input.maxQuestions ?? 3;

  const candidates = new Set<string>([
    ...input.completeness.missingRequiredFields.filter((k) => !k.includes("-like")),
    ...input.completeness.missingImportantFields.filter((k) => !k.includes("-like")),
    ...input.requiredDynamicKeys.filter((k) => !isFieldFilled(k, input.fieldValues, input.commonDraft)),
  ]);

  // Map semantic classes to best-effort field keys
  for (const sem of input.completeness.missingRequiredFields) {
    if (sem === "brand-like") candidates.add("brand");
    if (sem === "model-like") candidates.add("model");
    if (sem === "condition-like") candidates.add("condition");
    if (sem === "year-like") candidates.add("modelYear");
  }
  for (const sem of input.completeness.missingImportantFields) {
    if (sem === "brand-like") candidates.add("brand");
    if (sem === "model-like") candidates.add("model");
    if (sem === "condition-like") candidates.add("condition");
    if (sem === "year-like") candidates.add("modelYear");
  }

  const ranked: QuestionCandidate[] = [];

  for (const fieldKey of candidates) {
    if (isFieldFilled(fieldKey, input.fieldValues, input.commonDraft)) continue;
    // Never propose generic backend placeholders as primary questions
    if (GENERIC_BACKEND_QUESTION_KEYS.has(fieldKey)) continue;
    // When part/subject already known, skip asking for part name again
    if (
      fieldKey === "part" &&
      Boolean(input.fieldValues.part?.trim())
    ) {
      continue;
    }

    const profileImpact = fieldImpactFromProfile(fieldKey, input.strategy);
    const commonImpact = COMMON_FIELD_WEIGHTS[fieldKey];
    const impact = commonImpact ?? profileImpact;

    const boost = STRATEGY_FIELD_BOOST[input.strategy]?.[fieldKey] ?? 0;

    const priorityScore =
      impact.publish * 0.35 +
      impact.matching * 0.25 +
      impact.price * 0.25 +
      impact.confidence * 0.15 +
      boost;

    const meta = resolveFieldMeta(fieldKey, input.dynamicFields);

    ranked.push({
      fieldKey,
      label: meta.label,
      reason: commonImpact
        ? "Yayın ve eşleşme kalitesi için önemli"
        : input.completeness.missingRequiredFields.includes(fieldKey)
          ? "Fiyat analizi için gerekli"
          : "Teklif kalitesini artırabilir",
      publishImpact: impact.publish,
      matchingImpact: impact.matching,
      priceImpact: impact.price,
      confidenceImpact: impact.confidence,
      priorityScore,
      inputType: meta.inputType,
      options: meta.options,
      placeholder: meta.placeholder,
      quickChoices: meta.quickChoices,
      pickerOnly: fieldKey === "city" && input.fieldValues.listingType !== undefined,
    });
  }

  return ranked
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, maxQuestions);
}
