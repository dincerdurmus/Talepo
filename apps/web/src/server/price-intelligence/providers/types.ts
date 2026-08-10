import type {
  ExternalDataPolicy,
  ExternalPriceObservation,
  NormalizedProduct,
  ProviderCapability,
} from "@/lib/price-intelligence/types";
import { computeExternalShoppingSuitability } from "@/lib/price-intelligence/product-suitability";
import {
  getDataForSeoProviderStatus,
} from "./dataforseo";

export type PriceDataProvider = {
  id: string;
  name: string;
  capabilities: ProviderCapability[];
  dataPolicy: ExternalDataPolicy;
  /** 0–1 suitability; uses product data when normalizedProduct provided */
  supportsCategory?: (input: {
    categoryId: string;
    categorySlug: string;
    normalizedProduct?: NormalizedProduct;
  }) => number;
  searchProduct?: (query: {
    categoryId: string;
    categorySlug: string;
    title: string;
    brand?: string | null;
    model?: string | null;
    searchQuery?: string;
    normalizedProduct?: NormalizedProduct;
  }) => Promise<ExternalPriceObservation[]>;
  getListingPrices?: (externalId: string) => Promise<ExternalPriceObservation[]>;
  getSoldPrices?: (externalId: string) => Promise<ExternalPriceObservation[]>;
  normalizeExternalProduct?: (title: string) => Promise<{
    brand: string | null;
    model: string | null;
    attributes: Record<string, string>;
  }>;
  getStatus?: () => "CONFIGURED" | "NOT_CONFIGURED";
};

export type { ExternalPriceObservation, ExternalDataPolicy, ProviderCapability };

export const dataForSeoGoogleShoppingProvider: PriceDataProvider = {
  id: "dataforseo-google-shopping",
  name: "DataForSEO Google Shopping",
  capabilities: ["LISTING_PRICE"],
  dataPolicy: {
    canPersist: false,
    retentionPolicy: "in-memory-cache-only",
    termsReference: "https://dataforseo.com/terms-of-service",
  },
  supportsCategory: ({ categorySlug, normalizedProduct }) => {
    if (!normalizedProduct) return 0;
    return computeExternalShoppingSuitability({ categorySlug, normalized: normalizedProduct });
  },
  getStatus: getDataForSeoProviderStatus,
};
