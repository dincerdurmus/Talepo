import type { ExternalPriceObservation, NormalizedProduct } from "@/lib/price-intelligence/types";
import {
  DATAFORSEO_CONFIG,
  EXTERNAL_MATCH_QUALITY,
  shouldCallExternalProvider,
} from "@/lib/price-intelligence/provider-config";
import { computeExternalShoppingSuitability } from "@/lib/price-intelligence/product-suitability";

import { filterByMatchQuality } from "./external-match-quality";
import {
  buildProviderCacheKey,
  getCachedProviderResults,
  setCachedProviderResults,
} from "./provider-cache";
import {
  buildFallbackProviderQuery,
  buildQueryFromNormalizedProduct,
  queryFingerprint,
} from "./provider-query-builder";
import { recordProviderTelemetry } from "./provider-telemetry";
import {
  getDataForSeoProviderStatus,
  searchDataForSeoGoogleShopping,
} from "./providers/dataforseo";

export type ProviderConfigStatus = "CONFIGURED" | "NOT_CONFIGURED" | "SKIPPED" | "ERROR";

/** Outcome after provider call + matching — distinct from config status */
export type ProviderOutcomeStatus =
  | "PROVIDER_NO_RESULTS"
  | "PROVIDER_SUCCESS_WITH_RESULTS"
  | "PROVIDER_ERROR"
  | "MATCH_NO_VALID_PRODUCTS"
  | "SKIPPED";

export type ExternalFetchResult = {
  providerId: string | null;
  providerStatus: ProviderConfigStatus;
  providerOutcome: ProviderOutcomeStatus;
  suitabilityScore: number;
  query: string;
  fallbackQuery?: string | null;
  rawCount: number;
  matchedCount: number;
  observations: ExternalPriceObservation[];
  cached: boolean;
  errorMessage?: string;
};

function resolveOutcome(rawCount: number, matchedCount: number): ProviderOutcomeStatus {
  if (rawCount === 0) return "PROVIDER_NO_RESULTS";
  if (matchedCount === 0) return "MATCH_NO_VALID_PRODUCTS";
  return "PROVIDER_SUCCESS_WITH_RESULTS";
}

export async function fetchExternalListings(input: {
  categorySlug: string;
  categoryId: string;
  title: string;
  normalized: NormalizedProduct;
  city?: string | null;
  district?: string | null;
  /** Test injection */
  searchImpl?: typeof searchDataForSeoGoogleShopping;
}): Promise<ExternalFetchResult> {
  const suitabilityScore = computeExternalShoppingSuitability({
    categorySlug: input.categorySlug,
    normalized: input.normalized,
  });

  const query = buildQueryFromNormalizedProduct(
    input.normalized,
    input.categorySlug,
    input.title,
    input.city,
    input.district,
  );

  if (!query.trim() || !shouldCallExternalProvider(suitabilityScore)) {
    return {
      providerId: null,
      providerStatus: "SKIPPED",
      providerOutcome: "SKIPPED",
      suitabilityScore,
      query,
      rawCount: 0,
      matchedCount: 0,
      observations: [],
      cached: false,
    };
  }

  if (
    !input.searchImpl &&
    getDataForSeoProviderStatus() === "NOT_CONFIGURED"
  ) {
    return {
      providerId: "dataforseo-google-shopping",
      providerStatus: "NOT_CONFIGURED",
      providerOutcome: "SKIPPED",
      suitabilityScore,
      query,
      rawCount: 0,
      matchedCount: 0,
      observations: [],
      cached: false,
    };
  }

  const fp = queryFingerprint(query);
  const cacheKey = buildProviderCacheKey({
    providerId: "dataforseo-google-shopping",
    queryFingerprint: fp,
    location: DATAFORSEO_CONFIG.locationName,
    currency: DATAFORSEO_CONFIG.currency,
  });

  const cached = getCachedProviderResults(cacheKey);
  if (cached) {
    recordProviderTelemetry({
      provider: "dataforseo-google-shopping",
      queryFingerprint: fp,
      requestedAt: new Date(),
      durationMs: 0,
      resultCount: cached.length,
      success: true,
      cached: true,
    });

    const filtered = filterByMatchQuality(
      input.normalized,
      cached,
      EXTERNAL_MATCH_QUALITY.minAggregate,
    );

    return {
      providerId: "dataforseo-google-shopping",
      providerStatus: "CONFIGURED",
      providerOutcome: resolveOutcome(cached.length, filtered.length),
      suitabilityScore,
      query,
      rawCount: cached.length,
      matchedCount: filtered.length,
      observations: filtered,
      cached: true,
    };
  }

  const started = Date.now();
  try {
    const searchFn = input.searchImpl ?? searchDataForSeoGoogleShopping;
    let raw = await searchFn({ keyword: query });
    let fallbackQuery: string | null = null;

    if (raw.length === 0) {
      fallbackQuery = buildFallbackProviderQuery(input.normalized);
      if (fallbackQuery && fallbackQuery !== query) {
        raw = await searchFn({ keyword: fallbackQuery });
      }
    }

    const filtered = filterByMatchQuality(
      input.normalized,
      raw,
      EXTERNAL_MATCH_QUALITY.minAggregate,
    );

    setCachedProviderResults(cacheKey, raw, DATAFORSEO_CONFIG.cacheTtlMs);

    recordProviderTelemetry({
      provider: "dataforseo-google-shopping",
      queryFingerprint: fp,
      requestedAt: new Date(),
      durationMs: Date.now() - started,
      resultCount: filtered.length,
      success: true,
      cached: false,
    });

    return {
      providerId: "dataforseo-google-shopping",
      providerStatus: "CONFIGURED",
      providerOutcome: resolveOutcome(raw.length, filtered.length),
      suitabilityScore,
      query,
      fallbackQuery,
      rawCount: raw.length,
      matchedCount: filtered.length,
      observations: filtered,
      cached: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "External provider error";
    recordProviderTelemetry({
      provider: "dataforseo-google-shopping",
      queryFingerprint: fp,
      requestedAt: new Date(),
      durationMs: Date.now() - started,
      resultCount: 0,
      success: false,
      cached: false,
      errorCode: message.slice(0, 120),
    });

    return {
      providerId: "dataforseo-google-shopping",
      providerStatus: "ERROR",
      providerOutcome: "PROVIDER_ERROR",
      suitabilityScore,
      query,
      rawCount: 0,
      matchedCount: 0,
      observations: [],
      cached: false,
      errorMessage: message,
    };
  }
}
