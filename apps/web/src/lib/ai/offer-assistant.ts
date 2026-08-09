import { estimatePrice } from "./pricing/estimate";
import type { ParsedRequest } from "./types";

export type OfferAssistantInput = {
  title: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  city?: string | null;
  quantity?: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  isUrgent?: boolean;
  fieldSummaries?: string[];
};

export type OfferAssistantResult = {
  description: string;
  suggestedAmount: number;
  priceMin: number;
  priceMax: number;
  deliveryDays: number;
  deliveryNote: string;
  confidence: number;
  pricingExplanation: string;
};

const DELIVERY_BY_CATEGORY: Record<string, number> = {
  printing: 5,
  furniture: 10,
  automotive: 7,
  machinery: 21,
  technology: 14,
  services: 7,
  "real-estate": 3,
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}

export function generateOfferAssistantDraft(
  input: OfferAssistantInput,
): OfferAssistantResult {
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;

  const parsed: ParsedRequest = {
    rawText: `${input.title}\n${input.description}`,
    categoryId: input.categorySlug,
    quantity,
    city: input.city ?? undefined,
    budget: input.budgetMax ?? input.budgetMin ?? undefined,
    attributes: {},
  };

  const pricing = estimatePrice(parsed);

  let priceMin = pricing.min;
  let priceMax = pricing.max;

  if (input.budgetMin != null && input.budgetMax != null) {
    priceMin = Math.round((priceMin + Number(input.budgetMin)) / 2);
    priceMax = Math.round((priceMax + Number(input.budgetMax)) / 2);
  } else if (input.budgetMax != null) {
    priceMax = Math.min(priceMax, Number(input.budgetMax));
    priceMin = Math.round(priceMax * 0.75);
  } else if (input.budgetMin != null) {
    priceMin = Math.max(priceMin, Number(input.budgetMin));
    priceMax = Math.round(priceMin * 1.25);
  }

  if (priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  const suggestedAmount = roundTo((priceMin + priceMax) / 2, 50);
  const deliveryDays =
    DELIVERY_BY_CATEGORY[input.categorySlug] ??
    DELIVERY_BY_CATEGORY.services;

  const locationLine = input.city ? `${input.city} bölgesine` : "Belirtilen adrese";
  const urgencyLine = input.isUrgent
    ? "Acil talep olduğu için teslim planını önceliklendirebiliriz."
    : "Standart teslim takvimine uygun çalışırız.";

  const detailLines = [
    input.fieldSummaries?.length
      ? `Talep detayları: ${input.fieldSummaries.slice(0, 4).join(" · ")}.`
      : null,
    `Tahmini teslim: ${deliveryDays} iş günü içinde ${locationLine} teslim.`,
    urgencyLine,
    "Fiyat teklifimiz KDV hariç olup, kesin tutar keşif sonrası netleşir.",
  ].filter(Boolean);

  const description = [
    `Merhaba, "${input.title}" talebiniz için teklifimiz aşağıdadır.`,
    "",
    `Kategori: ${input.categoryName}.`,
    detailLines.join(" "),
    "",
    "Sorularınız için mesaj kutusundan ulaşabilirsiniz.",
  ].join("\n");

  const deliveryNote =
    input.isUrgent && deliveryDays > 3
      ? `${deliveryDays} iş günü (acil talep — mümkünse daha erken teslim için iletişime geçin)`
      : `${deliveryDays} iş günü`;

  return {
    description,
    suggestedAmount: clamp(suggestedAmount, priceMin, priceMax),
    priceMin,
    priceMax,
    deliveryDays,
    deliveryNote,
    confidence: pricing.confidence,
    pricingExplanation: pricing.explanation,
  };
}

export function formatTry(amount: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}
