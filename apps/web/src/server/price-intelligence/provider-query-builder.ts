import type { NormalizedProduct } from "@/lib/price-intelligence/types";
import {
  buildProviderSearchQuery,
  isQueryRelevantField,
  selectFingerprintFieldKeys,
} from "@/lib/price-intelligence/category-registry";

/**
 * Build external provider search query from NormalizedProduct.
 * Prefers brand + model + variant + important attributes over raw title alone.
 */
export function buildQueryFromNormalizedProduct(
  normalized: NormalizedProduct,
  categorySlug: string,
  title: string,
  city?: string | null,
  district?: string | null,
): string {
  const parts: string[] = [];

  if (normalized.brand && normalized.model) {
    parts.push(`${normalized.brand} ${normalized.model}`);
  } else if (normalized.brand) {
    parts.push(normalized.brand);
  } else if (normalized.model) {
    parts.push(normalized.model);
  }

  if (normalized.variant) {
    const joined = parts.join(" ");
    if (!joined.toLocaleLowerCase("tr-TR").includes(normalized.variant.toLocaleLowerCase("tr-TR"))) {
      parts.push(normalized.variant);
    }
  }

  const importantKeys = selectFingerprintFieldKeys(categorySlug, normalized.attributes, 3);
  for (const key of importantKeys) {
    if (!isQueryRelevantField(key)) continue;
    const val = normalized.attributes[key]?.trim();
    if (!val) continue;
    const haystack = parts.join(" ").toLocaleLowerCase("tr-TR");
    if (haystack.includes(val.toLocaleLowerCase("tr-TR"))) continue;
    parts.push(val);
  }

  if (parts.length === 0 && title?.trim()) {
    parts.push(title.trim());
  }

  // Fallback to registry query builder
  if (parts.length === 0) {
    return buildProviderSearchQuery({
      categorySlug,
      title,
      attributes: normalized.attributes,
      city,
      district,
    });
  }

  return parts.filter(Boolean).join(" ").trim();
}

/** Simpler brand+model fallback when primary query returns RAW=0 */
export function buildFallbackProviderQuery(normalized: NormalizedProduct): string | null {
  if (normalized.brand && normalized.model) {
    return `${normalized.brand} ${normalized.model}`.trim();
  }
  if (normalized.brand) return normalized.brand.trim();
  return null;
}

export function queryFingerprint(query: string): string {
  return query
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
