import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import type { PriceStrategyContext } from "@/lib/price-intelligence/strategy-resolver";
import type { BuildIdentityInput } from "@/lib/product-identity/identity-builder";
import type { RequestUnderstandingResult } from "./types";

/**
 * Shape adapters only — no re-interpretation of meaning.
 */

export function toStrategyContext(
  result: RequestUnderstandingResult,
): PriceStrategyContext {
  const attributes: Record<string, string> = {};
  for (const [k, v] of Object.entries(result.attributes)) {
    if (v?.value == null) continue;
    attributes[k] =
      typeof v.value === "object" ? JSON.stringify(v.value) : String(v.value);
  }
  if (result.quantity?.value?.value != null) {
    attributes.quantity = String(result.quantity.value.value);
  }
  if (result.identity.brand?.value) {
    attributes.brand = String(result.identity.brand.value);
  }
  if (result.identity.model?.value) {
    attributes.model = String(result.identity.model.value);
  }

  return {
    categorySlug:
      result.category.status === "CONFIDENT" && result.category.value
        ? result.category.value
        : "",
    title: result.rawInput,
    needType: attributes.needType ?? null,
    condition: result.condition
      ? result.condition.value === "NEW"
        ? "sıfır"
        : result.condition.value === "USED"
          ? "ikinci el"
          : null
      : null,
    attributes,
    brand: result.identity.brand?.value ?? null,
    model: result.identity.model?.value ?? null,
    productType: result.subject.productType?.value ?? null,
    identityConfidence: result.identity.confidence,
  };
}

export function toProductIdentityInput(
  result: RequestUnderstandingResult,
): BuildIdentityInput {
  const fieldValues = Object.entries(result.attributes)
    .filter(([, v]) => v?.value != null)
    .map(([key, v]) => ({
      key,
      value:
        typeof v!.value === "object"
          ? JSON.stringify(v!.value)
          : String(v!.value),
    }));

  return {
    categoryId: result.category.value ?? "unknown",
    categorySlug: result.category.value ?? "unknown",
    title: result.rawInput,
    fieldValues,
    city: result.location?.city?.value,
    district: result.location?.district?.value,
  };
}

/** Flatten for legacy form / preview draft consumers */
export function toLegacyFormHints(result: RequestUnderstandingResult): {
  categoryId: string | null;
  categoryStatus: string;
  strategy: PriceStrategyKey | null;
  needType: string | null;
  brand: string | null;
  model: string | null;
  quantity: number | null;
  condition: string | null;
  listingType: string | null;
  fieldValues: Record<string, string>;
} {
  const fieldValues: Record<string, string> = {};
  for (const [k, v] of Object.entries(result.attributes)) {
    if (v?.value == null) continue;
    fieldValues[k] =
      typeof v.value === "object" ? JSON.stringify(v.value) : String(v.value);
  }

  return {
    categoryId:
      result.category.status === "UNKNOWN" ? null : result.category.value,
    categoryStatus: result.category.status,
    strategy: result.strategy.value,
    needType: fieldValues.needType ?? null,
    brand: result.identity.brand?.value ?? null,
    model: result.identity.model?.value ?? null,
    quantity: result.quantity?.value?.value ?? null,
    condition: result.condition?.value ?? null,
    listingType: fieldValues.listingType ?? null,
    fieldValues,
  };
}
