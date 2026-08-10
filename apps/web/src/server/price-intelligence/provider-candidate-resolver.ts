import type { NormalizedProduct } from "@/lib/price-intelligence/types";
import type { ExternalRoutingReason } from "@/lib/price-intelligence/types";
import {
  listExternalProviderCapabilities,
  supportsStrategy,
  type ProviderCapabilityProfile,
} from "@/lib/price-intelligence/provider-capability-registry";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";

import { getPriceDataProvider } from "./providers/registry";

/** Diagnostic reasons for external routing decisions */
export type { ExternalRoutingReason };

export type ProviderCandidateContext = {
  strategy: PriceStrategyKey;
  categorySlug: string;
  country?: string;
  condition?: string | null;
  normalized: NormalizedProduct;
};

export type ProviderCandidate = {
  providerId: string;
  priority: number;
  identitySatisfied: boolean;
  configured: boolean;
  reasons: string[];
};

export type ProviderCandidateResolution = {
  candidates: ProviderCandidate[];
  selectedProviderId: string | null;
  providerCandidateIds: string[];
  routingReason: ExternalRoutingReason;
};

function fieldPresent(normalized: NormalizedProduct, key: string): boolean {
  const attrs = normalized.attributes;
  switch (key) {
    case "brand":
      return Boolean(
        normalized.brand?.trim() ||
          attrs.brand?.trim() ||
          attrs.brandPreference?.trim(),
      );
    case "model":
      return Boolean(normalized.model?.trim() || attrs.model?.trim());
    default:
      return Boolean(attrs[key]?.trim());
  }
}

export function satisfiesIdentityRequirements(
  profile: ProviderCapabilityProfile,
  strategy: PriceStrategyKey,
  normalized: NormalizedProduct,
): boolean {
  const groups = profile.identityRequirements[strategy];
  if (!groups || groups.length === 0) return true;
  return groups.some((group) => group.every((field) => fieldPresent(normalized, field)));
}

function isProviderConfigured(providerId: string): boolean {
  const provider = getPriceDataProvider(providerId);
  if (!provider) return false;
  return (provider.getStatus?.() ?? "CONFIGURED") === "CONFIGURED";
}

function supportsCountry(profile: ProviderCapabilityProfile, country: string): boolean {
  if (profile.supportedCountries.includes("*")) return true;
  return profile.supportedCountries.includes(country.toUpperCase());
}

/**
 * Resolve external provider candidates for a resolved price strategy.
 * Category slug is NOT used for provider selection.
 */
export function resolveProviderCandidates(
  context: ProviderCandidateContext,
): ProviderCandidateResolution {
  const { strategy, normalized } = context;
  const country = (context.country ?? "TR").toUpperCase();

  if (strategy === "INTERNAL_ONLY") {
    return {
      candidates: [],
      selectedProviderId: null,
      providerCandidateIds: [],
      routingReason: "STRATEGY_INTERNAL_ONLY",
    };
  }

  if (strategy === "UNKNOWN") {
    return {
      candidates: [],
      selectedProviderId: null,
      providerCandidateIds: [],
      routingReason: "STRATEGY_UNKNOWN",
    };
  }

  const candidates: ProviderCandidate[] = [];

  for (const profile of listExternalProviderCapabilities()) {
    if (!supportsStrategy(profile, strategy)) continue;
    if (!supportsCountry(profile, country)) continue;

    const identitySatisfied = satisfiesIdentityRequirements(
      profile,
      strategy,
      normalized,
    );
    const configured = isProviderConfigured(profile.providerId);
    const reasons: string[] = [`supports strategy=${strategy}`];

    if (!identitySatisfied) reasons.push("identity requirements not met");
    if (!configured) reasons.push("provider not configured");

    candidates.push({
      providerId: profile.providerId,
      priority: profile.priority,
      identitySatisfied,
      configured,
      reasons,
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);

  const eligible = candidates.filter((c) => c.identitySatisfied);
  const providerCandidateIds = eligible.map((c) => c.providerId);

  if (eligible.length === 0) {
    const reason =
      candidates.length > 0
        ? "IDENTITY_REQUIREMENTS_NOT_MET"
        : "NO_EXTERNAL_PROVIDER_FOR_STRATEGY";
    return {
      candidates,
      selectedProviderId: null,
      providerCandidateIds: [],
      routingReason: reason,
    };
  }

  return {
    candidates,
    selectedProviderId: eligible[0]!.providerId,
    providerCandidateIds,
    routingReason: "EXTERNAL_CALL_ALLOWED",
  };
}

/** Update routing reason after suitability / query gates */
export function finalizeRoutingReason(
  resolution: ProviderCandidateResolution,
  gate: "suitability" | "query" | "configured",
): ExternalRoutingReason {
  if (gate === "suitability") return "SUITABILITY_BELOW_THRESHOLD";
  if (gate === "query") return "EMPTY_PROVIDER_QUERY";
  if (gate === "configured") return "PROVIDER_NOT_CONFIGURED";
  return resolution.routingReason;
}
