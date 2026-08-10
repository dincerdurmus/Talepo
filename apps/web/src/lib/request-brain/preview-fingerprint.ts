import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import { getStrategyAttributeProfile } from "@/lib/price-intelligence/price-strategy-registry";
import {
  buildPriceStrategyContext,
  resolvePriceStrategy,
} from "@/lib/price-intelligence/strategy-resolver";

/**
 * Fingerprint for price preview cost control.
 * Only identity/strategy-critical changes should trigger external refetch.
 * Description typos alone must not change the fingerprint.
 *
 * When `canonicalStrategy` is supplied (request flow), do NOT independently
 * re-resolve strategy — fingerprint must use the same authority as price routing.
 */
export function buildPreviewFingerprint(input: {
  categorySlug: string;
  title: string;
  fieldValues: Record<string, string>;
  city?: string;
  district?: string | null;
  condition?: string | null;
  /** Authoritative strategy from understandRequest — preferred */
  canonicalStrategy?: PriceStrategyKey | null;
}): string {
  const fv = Object.entries(input.fieldValues)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => ({ key: k, value: v.trim() }));

  const strategyKey: PriceStrategyKey =
    input.canonicalStrategy ??
    resolvePriceStrategy(
      buildPriceStrategyContext({
        categorySlug: input.categorySlug,
        title: input.title,
        condition: input.condition ?? input.fieldValues.condition ?? null,
        fieldValues: fv,
      }),
    ).strategy;

  const profile = getStrategyAttributeProfile(strategyKey);

  const criticalKeys = new Set([
    ...profile.required,
    ...profile.important.filter((k) => !k.includes("-like")),
    "needType",
    "listingType",
    "condition",
    "modelYear",
    "brand",
    "model",
    "part",
    "quantity",
    "dimensions",
    "serviceType",
    "propertyType",
    "roomCount",
    "area",
  ]);

  const parts: string[] = [
    input.categorySlug,
    strategyKey,
    (input.city ?? input.fieldValues.city ?? "").trim().toLowerCase(),
    (input.district ?? "").trim().toLowerCase(),
    (input.condition ?? input.fieldValues.condition ?? "").trim().toLowerCase(),
    input.title.trim().toLowerCase().slice(0, 120),
  ];

  const sortedFields = Object.entries(input.fieldValues)
    .filter(([k, v]) => v?.trim() && criticalKeys.has(k))
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [key, value] of sortedFields) {
    parts.push(`${key}=${value.trim().toLowerCase()}`);
  }

  if (input.fieldValues.brand?.trim()) {
    parts.push(`brand=${input.fieldValues.brand.trim().toLowerCase()}`);
  }
  if (input.fieldValues.model?.trim()) {
    parts.push(`model=${input.fieldValues.model.trim().toLowerCase()}`);
  }

  return parts.join("|");
}
