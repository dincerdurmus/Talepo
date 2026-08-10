/**
 * External provider capability profiles — strategy-based, NOT category-based.
 *
 * Providers bind to PRICE STRATEGY + capability requirements.
 * Category slug must never select a provider directly.
 */

import type { PriceStrategyKey } from "./price-strategy-registry";

export type ProviderCostClass = "free" | "paid" | "internal";
export type ProviderDataFreshness = "live" | "cached" | "historical";

/**
 * Identity requirement groups: any single group fully satisfied = pass.
 * Field keys refer to NormalizedProduct fields or attributes map keys.
 */
export type ProviderCapabilityProfile = {
  providerId: string;
  /** Price strategies this external provider can serve */
  supportedStrategies: PriceStrategyKey[];
  supportedCountries: string[];
  /** Condition classes accepted — USED excluded from DataForSEO until verified */
  supportedConditions: ("new" | "used" | "any")[];
  /** Per-strategy identity groups (OR across groups, AND within group) */
  identityRequirements: Partial<Record<PriceStrategyKey, string[][]>>;
  optionalAttributes: string[];
  dataFreshness: ProviderDataFreshness;
  costClass: ProviderCostClass;
  priority: number;
  canPersist: boolean;
  /** Aligns with PROVIDER_SUITABILITY_THRESHOLDS.use — second gate after capability match */
  minSuitability?: number;
};

/** Talepo internal observations — not an external paid provider */
export const INTERNAL_SIGNAL_PROVIDER_ID = "talepo-internal";

export const INTERNAL_SIGNAL_CAPABILITY: ProviderCapabilityProfile = {
  providerId: INTERNAL_SIGNAL_PROVIDER_ID,
  supportedStrategies: [
    "RETAIL_PRODUCT",
    "USED_PRODUCT",
    "VEHICLE",
    "AUTO_PART",
    "REAL_ESTATE_SALE",
    "REAL_ESTATE_RENT",
    "INDUSTRIAL_EQUIPMENT",
    "INDUSTRIAL_PARTS_SERVICE",
    "CUSTOM_MANUFACTURING",
    "SERVICE_SCOPE",
    "B2B_COMMODITY",
    "MEDICAL_DEVICE",
    "INTERNAL_ONLY",
    "UNKNOWN",
  ],
  supportedCountries: ["*"],
  supportedConditions: ["new", "used", "any"],
  identityRequirements: {},
  optionalAttributes: [],
  dataFreshness: "historical",
  costClass: "internal",
  priority: 0,
  canPersist: true,
};

/**
 * DataForSEO Google Shopping — verified for structured shopping-style products only.
 * USED_PRODUCT intentionally excluded: condition metadata in results is unreliable.
 * MEDICAL_DEVICE intentionally excluded: not validated for regulated product matching.
 */
export const DATAFORSEO_CAPABILITY: ProviderCapabilityProfile = {
  providerId: "dataforseo-google-shopping",
  supportedStrategies: ["RETAIL_PRODUCT", "AUTO_PART"],
  supportedCountries: ["TR"],
  supportedConditions: ["new", "any"],
  identityRequirements: {
    RETAIL_PRODUCT: [
      ["brand", "model"],
      ["solutionType"],
      ["brand", "productName"],
    ],
    AUTO_PART: [
      ["part", "brand"],
      ["part", "brandPreference"],
    ],
  },
  optionalAttributes: ["storage", "specs", "variant", "modelYear", "capacity"],
  dataFreshness: "live",
  costClass: "paid",
  priority: 10,
  canPersist: false,
  minSuitability: 0.6,
};

export const EXTERNAL_PROVIDER_CAPABILITIES: ProviderCapabilityProfile[] = [
  DATAFORSEO_CAPABILITY,
];

export function getProviderCapabilityProfile(
  providerId: string,
): ProviderCapabilityProfile | undefined {
  if (providerId === INTERNAL_SIGNAL_PROVIDER_ID) return INTERNAL_SIGNAL_CAPABILITY;
  return EXTERNAL_PROVIDER_CAPABILITIES.find((p) => p.providerId === providerId);
}

export function listExternalProviderCapabilities(): ProviderCapabilityProfile[] {
  return EXTERNAL_PROVIDER_CAPABILITIES;
}

export function supportsStrategy(
  profile: ProviderCapabilityProfile,
  strategy: PriceStrategyKey,
): boolean {
  return profile.supportedStrategies.includes(strategy);
}
