import {
  ENABLE_STANDARD_REQUEST_ACCESS_DELAY,
  type PlanTierId,
  canonicalizePlanTier,
  planTierRank,
} from "./plans";

/**
 * Canonical V2 feature keys — do not scatter string literals.
 * Legacy keys (alert_rules, etc.) remain for backward compatibility.
 */
export const FEATURE_KEYS = [
  // Core
  "submit_offer",
  "instant_request_access",
  "unlimited_offers",

  // Premium — speed + access
  "smart_alerts",
  "ai_offer_assistant",
  "smart_matching",
  "saved_searches",
  "advanced_filters",
  "basic_market_insights",

  // Professional — intelligence + opportunity selection
  "hot_opportunities",
  "high_budget_opportunities",
  "advanced_opportunity_analysis",
  "competition_signals",
  "budget_change_alerts",
  "watchlist",
  "professional_analytics",
  "talepo_radar",
  "talepo_insights",

  // Corporate — automation + team + inventory + data
  "team_management",
  "hidden_inventory",
  "automatic_opportunity_hunter",
  "inventory_import",
  "lead_distribution",
  "corporate_intelligence",
  "erp_integration",

  // Legacy aliases (FAZ 1 surfaces — map to V2 equivalents in UI copy)
  "alert_rules",
  "advanced_ai_pricing",
  "urgent_request_priority",
  /** Buyer-side request boost — payment-backed later */
  "feature_request_boost",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

const ALL_FALSE = Object.fromEntries(
  FEATURE_KEYS.map((key) => [key, false]),
) as Record<FeatureKey, boolean>;

const STANDARD_KEYS: readonly FeatureKey[] = [
  "submit_offer",
  "feature_request_boost",
  ...(!ENABLE_STANDARD_REQUEST_ACCESS_DELAY
    ? (["instant_request_access"] as const)
    : []),
];

const PREMIUM_KEYS: readonly FeatureKey[] = [
  ...STANDARD_KEYS,
  "unlimited_offers",
  "instant_request_access",
  "smart_alerts",
  "alert_rules",
  "ai_offer_assistant",
  "smart_matching",
  "saved_searches",
  "advanced_filters",
  "basic_market_insights",
  "advanced_ai_pricing",
];

const PROFESSIONAL_KEYS: readonly FeatureKey[] = [
  ...PREMIUM_KEYS,
  "hot_opportunities",
  "urgent_request_priority",
  "high_budget_opportunities",
  "advanced_opportunity_analysis",
  "competition_signals",
  "budget_change_alerts",
  "watchlist",
  "professional_analytics",
  "talepo_radar",
  "talepo_insights",
];

const CORPORATE_KEYS: readonly FeatureKey[] = [
  ...PROFESSIONAL_KEYS,
  "team_management",
  "hidden_inventory",
  "automatic_opportunity_hunter",
  "inventory_import",
  "lead_distribution",
  "corporate_intelligence",
  "erp_integration",
];

/**
 * Plan → feature registry (V2 matrix).
 * Features may ship as INFRASTRUCTURE_READY before full UI.
 */
const PLAN_FEATURE_KEYS: Record<PlanTierId, readonly FeatureKey[]> = {
  STANDARD: STANDARD_KEYS,
  PREMIUM: PREMIUM_KEYS,
  PROFESSIONAL: PROFESSIONAL_KEYS,
  CORPORATE: CORPORATE_KEYS,
};

/** V2 feature groups for plan comparison UI. */
export const PLAN_FEATURE_GROUPS = {
  STANDARD: ["submit_offer"] as FeatureKey[],
  PREMIUM: [
    "unlimited_offers",
    "instant_request_access",
    "smart_alerts",
    "ai_offer_assistant",
    "smart_matching",
    "saved_searches",
    "advanced_filters",
    "basic_market_insights",
  ] as FeatureKey[],
  PROFESSIONAL: [
    "hot_opportunities",
    "high_budget_opportunities",
    "advanced_opportunity_analysis",
    "competition_signals",
    "budget_change_alerts",
    "watchlist",
    "professional_analytics",
    "talepo_radar",
    "talepo_insights",
  ] as FeatureKey[],
  CORPORATE: [
    "team_management",
    "hidden_inventory",
    "automatic_opportunity_hunter",
    "inventory_import",
    "lead_distribution",
    "corporate_intelligence",
    "erp_integration",
  ] as FeatureKey[],
} as const;

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
  if (features[key] === true) return true;

  // Legacy alias resolution
  if (key === "smart_alerts" && features.alert_rules) return true;
  if (key === "alert_rules" && features.smart_alerts) return true;
  if (key === "basic_market_insights" && features.advanced_ai_pricing) {
    return true;
  }
  if (key === "hot_opportunities" && features.urgent_request_priority) {
    return true;
  }

  return false;
}

function hasFeatureInPlanTier(tier: PlanTierId, key: FeatureKey): boolean {
  if (PLAN_FEATURE_KEYS[tier].includes(key)) return true;
  if (key === "smart_alerts" && PLAN_FEATURE_KEYS[tier].includes("alert_rules")) {
    return true;
  }
  if (key === "alert_rules" && PLAN_FEATURE_KEYS[tier].includes("smart_alerts")) {
    return true;
  }
  if (
    key === "basic_market_insights" &&
    PLAN_FEATURE_KEYS[tier].includes("advanced_ai_pricing")
  ) {
    return true;
  }
  if (
    key === "hot_opportunities" &&
    PLAN_FEATURE_KEYS[tier].includes("urgent_request_priority")
  ) {
    return true;
  }
  return false;
}

function buildMinimumPlanMap(): Record<FeatureKey, PlanTierId> {
  const map = {} as Record<FeatureKey, PlanTierId>;

  for (const feature of FEATURE_KEYS) {
    let minimum: PlanTierId | null = null;

    for (const storedTier of [
      "STANDARD",
      "PREMIUM",
      "PROFESSIONAL",
      "CORPORATE",
    ] as const) {
      if (!hasFeatureInPlanTier(storedTier, feature)) {
        continue;
      }

      const effective = canonicalizePlanTier(storedTier);
      if (minimum === null || planTierRank(effective) < planTierRank(minimum)) {
        minimum = effective;
      }
    }

    map[feature] = minimum ?? "PROFESSIONAL";
  }

  return map;
}

const MINIMUM_PLAN_FOR_FEATURE = buildMinimumPlanMap();

export function minimumPlanForFeature(key: FeatureKey): PlanTierId {
  return MINIMUM_PLAN_FOR_FEATURE[key] ?? "PROFESSIONAL";
}
