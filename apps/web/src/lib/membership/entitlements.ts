import type { PlanTierId } from "./plans";

/**
 * Canonical feature keys. Do not scatter string literals —
 * import FeatureKey / FEATURE_KEYS instead.
 */
export const FEATURE_KEYS = [
  "submit_offer",
  "instant_request_access",
  "ai_offer_assistant",
  "advanced_ai_pricing",
  "alert_rules",
  "hidden_inventory",
  "urgent_request_priority",
  "advanced_filters",
  /**
   * Buyer-side request boost.
   * FAZ 1: always granted (no payment gate yet — preserves current behavior).
   * FAZ 3+: must become payment-backed; remove from free plan grants.
   */
  "feature_request_boost",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

const ALL_FALSE: Record<FeatureKey, boolean> = {
  submit_offer: false,
  instant_request_access: false,
  ai_offer_assistant: false,
  advanced_ai_pricing: false,
  alert_rules: false,
  hidden_inventory: false,
  urgent_request_priority: false,
  advanced_filters: false,
  feature_request_boost: false,
};

/**
 * Plan → feature registry.
 * Features listed here may not have product surfaces yet (FAZ 1);
 * the registry still defines who is entitled when they ship.
 */
const PLAN_FEATURE_KEYS: Record<PlanTierId, readonly FeatureKey[]> = {
  STANDARD: [
    "submit_offer",
    // Payment-backed later — keep true so create-request boost still works.
    "feature_request_boost",
  ],
  PREMIUM: [
    "submit_offer",
    "instant_request_access",
    "ai_offer_assistant",
    "advanced_ai_pricing",
    "alert_rules",
    "feature_request_boost",
  ],
  PROFESSIONAL: [
    "submit_offer",
    "instant_request_access",
    "ai_offer_assistant",
    "advanced_ai_pricing",
    "alert_rules",
    "urgent_request_priority",
    "advanced_filters",
    "feature_request_boost",
  ],
  CORPORATE: [
    "submit_offer",
    "instant_request_access",
    "ai_offer_assistant",
    "advanced_ai_pricing",
    "alert_rules",
    "urgent_request_priority",
    "advanced_filters",
    "hidden_inventory",
    "feature_request_boost",
  ],
};

export function featuresForPlan(tier: PlanTierId): Record<FeatureKey, boolean> {
  const features = { ...ALL_FALSE };

  for (const key of PLAN_FEATURE_KEYS[tier]) {
    features[key] = true;
  }

  return features;
}

export function hasFeature(
  features: Record<FeatureKey, boolean>,
  key: FeatureKey,
): boolean {
  return features[key] === true;
}
