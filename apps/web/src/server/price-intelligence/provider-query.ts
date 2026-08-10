import type { NormalizedProduct } from "@/lib/price-intelligence/types";
import {
  getSuitabilityBand,
  shouldCallExternalProvider,
} from "@/lib/price-intelligence/provider-config";
import { computeExternalShoppingSuitability } from "@/lib/price-intelligence/product-suitability";
import type { CategoryProviderProfile } from "@/lib/price-intelligence/category-registry";
import { getProviderProfile } from "@/lib/price-intelligence/category-registry";

import { listPriceDataProviders } from "./providers/registry";
import { buildQueryFromNormalizedProduct } from "./provider-query-builder";

export type ProviderQueryInput = {
  categoryId: string;
  categorySlug: string;
  title: string;
  attributes?: Record<string, string>;
  city?: string | null;
  district?: string | null;
  normalizedProduct?: NormalizedProduct;
};

export type ProviderRoutingResult = {
  categorySlug: string;
  query: string;
  profile: CategoryProviderProfile;
  productSuitabilityScore: number;
  suitabilityBand: "skip" | "optional" | "use";
  shouldCallExternal: boolean;
  eligibleProviders: {
    providerId: string;
    score: number;
    status: "CONFIGURED" | "NOT_CONFIGURED";
  }[];
};

/**
 * Product-aware provider routing.
 * Category slug alone does not determine external call — product characteristics do.
 */
export function buildProviderRouting(input: ProviderQueryInput): ProviderRoutingResult {
  const profile = getProviderProfile(input.categorySlug);

  const normalized: NormalizedProduct =
    input.normalizedProduct ??
    ({
      categoryId: input.categoryId,
      brand: null,
      model: null,
      variant: null,
      condition: null,
      attributes: input.attributes ?? {},
      fingerprint: null,
      confidence: 0,
    } satisfies NormalizedProduct);

  const productSuitabilityScore = computeExternalShoppingSuitability({
    categorySlug: input.categorySlug,
    normalized,
  });

  const query = buildQueryFromNormalizedProduct(
    normalized,
    input.categorySlug,
    input.title,
    input.city,
    input.district,
  );

  const eligibleProviders = listPriceDataProviders()
    .filter((p) => p.id !== "talepo-internal")
    .map((p) => ({
      providerId: p.id,
      score: p.supportsCategory
        ? p.supportsCategory({
            categoryId: input.categoryId,
            categorySlug: input.categorySlug,
            normalizedProduct: normalized,
          })
        : productSuitabilityScore,
      status: (p.getStatus?.() ?? "CONFIGURED") as "CONFIGURED" | "NOT_CONFIGURED",
    }))
    .filter((p) => p.score >= 0.2)
    .sort((a, b) => b.score - a.score);

  return {
    categorySlug: input.categorySlug,
    query,
    profile,
    productSuitabilityScore,
    suitabilityBand: getSuitabilityBand(productSuitabilityScore),
    shouldCallExternal: shouldCallExternalProvider(productSuitabilityScore),
    eligibleProviders,
  };
}

export { shouldCallExternalProvider };
