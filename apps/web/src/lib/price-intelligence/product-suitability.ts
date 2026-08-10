import type { NormalizedProduct } from "@/lib/price-intelligence/types";

import { getProviderProfile } from "@/lib/price-intelligence/category-registry";

/** Keys that strongly indicate a standardized purchasable product */
const PRODUCT_ID_KEYS = [
  "sku",
  "gtin",
  "ean",
  "upc",
  "mpn",
  "manufacturer",
] as const;

const STORAGE_KEYS = ["storage", "specs", "capacity", "energyClass"] as const;

const SERVICE_SIGNAL_KEYS = ["serviceType", "frequency", "duration", "serviceLocation"] as const;

const SOFTWARE_SIGNALS = ["software", "yazılım", "yazilim", "web sitesi", "uygulama geliştirme"];

function hasServiceSignals(attributes: Record<string, string>): boolean {
  if (attributes.serviceType?.trim()) return true;
  if (attributes.needType === "software" || attributes.needType === "service") return true;
  const solution = (attributes.solutionType ?? "").toLocaleLowerCase("tr-TR");
  return SOFTWARE_SIGNALS.some((s) => solution.includes(s));
}

function hasCustomPrintSignals(attributes: Record<string, string>): boolean {
  return Boolean(
    attributes.dimensions?.trim() &&
      (attributes.printType || attributes.lamination || attributes.paperWeight),
  );
}

/**
 * Product-level external shopping suitability (0–1).
 * Category slug alone must NOT dominate — product characteristics are primary.
 */
export function computeExternalShoppingSuitability(input: {
  categorySlug: string;
  normalized: NormalizedProduct;
}): number {
  const { normalized, categorySlug } = input;
  const attrs = normalized.attributes;

  let score = 0;

  // Strong product identity signals
  if (normalized.brand) score += 0.22;
  if (normalized.model) score += 0.22;
  else if (normalized.productType) score += 0.12;
  if (normalized.variant) score += 0.12;
  if (normalized.condition) score += 0.05;

  for (const key of PRODUCT_ID_KEYS) {
    if (attrs[key]?.trim()) score += 0.15;
  }

  for (const key of STORAGE_KEYS) {
    if (attrs[key]?.trim()) score += 0.08;
  }

  // Technology hardware with identifiable product description
  if (attrs.needType === "hardware" && attrs.solutionType?.trim()) {
    score += 0.18;
  }

  // Standardized product type (applianceType, machineType, etc.)
  const typeField = Object.entries(attrs).find(
    ([key, val]) =>
      val?.trim() &&
      /Type$/i.test(key) &&
      !["needType", "listingType", "printType", "serviceType"].includes(key),
  );
  if (typeField) score += 0.1;

  // Penalties — service / custom / non-standard product
  if (hasServiceSignals(attrs)) score -= 0.45;
  if (hasCustomPrintSignals(attrs)) score -= 0.35;
  if (categorySlug === "real-estate") score -= 0.4;
  if (categorySlug === "services") score -= 0.35;
  if (categorySlug === "automotive") score -= 0.35;

  // Title-only product hints when brand field absent
  if (!normalized.brand && normalized.providerQuery) {
    const q = normalized.providerQuery.toLocaleLowerCase("tr-TR");
    const hasModelLikeToken = /\b[a-z]{2,}\s*\d+\b/.test(q) || /\b\d+\s*(gb|tb|kg|ml|l)\b/.test(q);
    if (hasModelLikeToken) score += 0.12;
  }

  // Small category baseline — capped influence (max ~0.12)
  const categoryBaseline = getProviderProfile(categorySlug).shopping * 0.15;
  score += categoryBaseline;

  // Normalization confidence nudge
  score += normalized.confidence * 0.08;

  return Math.round(Math.min(1, Math.max(0, score)) * 1000) / 1000;
}
