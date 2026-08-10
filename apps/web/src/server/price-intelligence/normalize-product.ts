import type { NormalizedProduct } from "@/lib/price-intelligence/types";
import {
  buildProductIdentity,
  identityToLegacyNormalized,
} from "@/lib/product-identity/identity-builder";

export { normalizeToken, buildProductFingerprint } from "./normalize-product-fingerprint";

/**
 * Normalize a request into a product fingerprint using the category engine.
 * Works for ALL categories defined in REQUEST_CATEGORIES.
 */
export function normalizeProductFromRequest(input: {
  categoryId: string;
  categorySlug: string;
  title: string;
  fieldValues?: { key: string; value: string | null }[];
  city?: string | null;
  district?: string | null;
}): NormalizedProduct {
  const identity = buildProductIdentity({
    categoryId: input.categoryId,
    categorySlug: input.categorySlug,
    title: input.title,
    fieldValues: input.fieldValues,
    city: input.city,
    district: input.district,
  });

  return identityToLegacyNormalized(identity) as NormalizedProduct;
}
