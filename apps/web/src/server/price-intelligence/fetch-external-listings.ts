import type { ExternalPriceObservation, NormalizedProduct } from "@/lib/price-intelligence/types";
import type { ExternalRoutingReason } from "@/lib/price-intelligence/types";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import {
  DATAFORSEO_CONFIG,
  EXTERNAL_MATCH_QUALITY,
  shouldCallExternalProvider,
} from "@/lib/price-intelligence/provider-config";
import { computeExternalShoppingSuitability } from "@/lib/price-intelligence/product-suitability";

import { filterByMatchQuality } from "./external-match-quality";
import {
  finalizeRoutingReason,
  resolveProviderCandidates,
} from "./provider-candidate-resolver";
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
  /** Phase 3 routing diagnostics */
  routingReason: ExternalRoutingReason;
  providerCandidates: string[];
  selectedProviderId: string | null;
  externalProviderAttempted: boolean;
  externalProviderUsed: string | null;
};

function resolveOutcome(rawCount: number, matchedCount: number): ProviderOutcomeStatus {
  if (rawCount === 0) return "PROVIDER_NO_RESULTS";
  if (matchedCount === 0) return "MATCH_NO_VALID_PRODUCTS";
  return "PROVIDER_SUCCESS_WITH_RESULTS";
}

function skippedResult(input: {
  suitabilityScore: number;
  query: string;
  routingReason: ExternalRoutingReason;
  providerCandidates: string[];
  selectedProviderId: string | null;
  providerId?: string | null;
  externalProviderAttempted?: boolean;
}): ExternalFetchResult {
  return {
    providerId: input.providerId ?? null,
    providerStatus: "SKIPPED",
    providerOutcome: "SKIPPED",
    suitabilityScore: input.suitabilityScore,
    query: input.query,
    rawCount: 0,
    matchedCount: 0,
    observations: [],
    cached: false,
    routingReason: input.routingReason,
    providerCandidates: input.providerCandidates,
    selectedProviderId: input.selectedProviderId,
    externalProviderAttempted: input.externalProviderAttempted ?? true,
    externalProviderUsed: null,
  };
}

export async function fetchExternalListings(input: {
  categorySlug: string;
  categoryId: string;
  title: string;
  normalized: NormalizedProduct;
  strategy: PriceStrategyKey;
  country?: string;
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

  const routing = resolveProviderCandidates({
    strategy: input.strategy,
    categorySlug: input.categorySlug,
    country: input.country ?? "TR",
    condition: input.normalized.condition,
    normalized: input.normalized,
  });

  // Strategy / capability gate — before suitability
  if (
    routing.routingReason === "STRATEGY_INTERNAL_ONLY" ||
    routing.routingReason === "STRATEGY_UNKNOWN" ||
    routing.routingReason === "NO_EXTERNAL_PROVIDER_FOR_STRATEGY" ||
    routing.routingReason === "IDENTITY_REQUIREMENTS_NOT_MET"
  ) {
    return skippedResult({
      suitabilityScore,
      query,
      routingReason: routing.routingReason,
      providerCandidates: routing.providerCandidateIds,
      selectedProviderId: routing.selectedProviderId,
    });
  }

  const selectedProviderId = routing.selectedProviderId;
  if (!selectedProviderId) {
    return skippedResult({
      suitabilityScore,
      query,
      routingReason: "NO_EXTERNAL_PROVIDER_FOR_STRATEGY",
      providerCandidates: routing.providerCandidateIds,
      selectedProviderId: null,
    });
  }

  if (!query.trim()) {
    return skippedResult({
      suitabilityScore,
      query,
      routingReason: finalizeRoutingReason(routing, "query"),
      providerCandidates: routing.providerCandidateIds,
      selectedProviderId,
    });
  }

  // Existing suitability gate — second security layer (before configured check)
  if (!shouldCallExternalProvider(suitabilityScore)) {
    return skippedResult({
      suitabilityScore,
      query,
      routingReason: finalizeRoutingReason(routing, "suitability"),
      providerCandidates: routing.providerCandidateIds,
      selectedProviderId,
    });
  }

  const selectedCandidate = routing.candidates.find(
    (c) => c.providerId === selectedProviderId,
  );
  if (
    selectedCandidate &&
    !selectedCandidate.configured &&
    !input.searchImpl
  ) {
    return skippedResult({
      suitabilityScore,
      query,
      routingReason: finalizeRoutingReason(routing, "configured"),
      providerCandidates: routing.providerCandidateIds,
      selectedProviderId,
      providerId: selectedProviderId,
    });
  }

  if (
    !input.searchImpl &&
    getDataForSeoProviderStatus() === "NOT_CONFIGURED"
  ) {
    return skippedResult({
      suitabilityScore,
      query,
      routingReason: "PROVIDER_NOT_CONFIGURED",
      providerCandidates: routing.providerCandidateIds,
      selectedProviderId,
      providerId: selectedProviderId,
    });
  }

  const fp = queryFingerprint(query);
  const cacheKey = buildProviderCacheKey({
    providerId: selectedProviderId,
    queryFingerprint: fp,
    location: DATAFORSEO_CONFIG.locationName,
    currency: DATAFORSEO_CONFIG.currency,
  });

  const cached = getCachedProviderResults(cacheKey);
  if (cached) {
    recordProviderTelemetry({
      provider: selectedProviderId,
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
      providerId: selectedProviderId,
      providerStatus: "CONFIGURED",
      providerOutcome: resolveOutcome(cached.length, filtered.length),
      suitabilityScore,
      query,
      rawCount: cached.length,
      matchedCount: filtered.length,
      observations: filtered,
      cached: true,
      routingReason: "EXTERNAL_CALL_ALLOWED",
      providerCandidates: routing.providerCandidateIds,
      selectedProviderId,
      externalProviderAttempted: true,
      externalProviderUsed: selectedProviderId,
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
      provider: selectedProviderId,
      queryFingerprint: fp,
      requestedAt: new Date(),
      durationMs: Date.now() - started,
      resultCount: filtered.length,
      success: true,
      cached: false,
    });

    return {
      providerId: selectedProviderId,
      providerStatus: "CONFIGURED",
      providerOutcome: resolveOutcome(raw.length, filtered.length),
      suitabilityScore,
      query,
      fallbackQuery,
      rawCount: raw.length,
      matchedCount: filtered.length,
      observations: filtered,
      cached: false,
      routingReason: "EXTERNAL_CALL_ALLOWED",
      providerCandidates: routing.providerCandidateIds,
      selectedProviderId,
      externalProviderAttempted: true,
      externalProviderUsed: selectedProviderId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "External provider error";
    recordProviderTelemetry({
      provider: selectedProviderId,
      queryFingerprint: fp,
      requestedAt: new Date(),
      durationMs: Date.now() - started,
      resultCount: 0,
      success: false,
      cached: false,
      errorCode: message.slice(0, 120),
    });

    return {
      providerId: selectedProviderId,
      providerStatus: "ERROR",
      providerOutcome: "PROVIDER_ERROR",
      suitabilityScore,
      query,
      rawCount: 0,
      matchedCount: 0,
      observations: [],
      cached: false,
      errorMessage: message,
      routingReason: "PROVIDER_ERROR",
      providerCandidates: routing.providerCandidateIds,
      selectedProviderId,
      externalProviderAttempted: true,
      externalProviderUsed: selectedProviderId,
    };
  }
}

export type { ExternalRoutingReason } from "@/lib/price-intelligence/types";
