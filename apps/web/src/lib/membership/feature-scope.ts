/**
 * Product scope for plan features — PERSONAL vs COMPANY-NATIVE.
 * Used to stop company-gating capabilities that do not require a company.
 *
 * SavedSearch / AlertRule use ResourceOwnerType USER|COMPANY
 * (see resource-owner.ts + personal ownership migration).
 */

import type { FeatureKey } from "./entitlements";

export type FeatureScope =
  | "PERSONAL_CAPABLE"
  | "COMPANY_ONLY_BY_NATURE"
  | "AMBIGUOUS_DRIFT";

/** Features that semantically work for a personal subscriber. */
export const PERSONAL_CAPABLE_FEATURES: readonly FeatureKey[] = [
  "submit_offer",
  "instant_request_access",
  "unlimited_offers",
  "feature_request_boost",
  "smart_alerts",
  "alert_rules",
  "ai_offer_assistant",
  "smart_matching",
  "saved_searches",
  "advanced_filters",
  "basic_market_insights",
  "advanced_ai_pricing",
  "hot_opportunities",
  "urgent_request_priority",
  "high_budget_opportunities",
  "advanced_opportunity_analysis",
  "competition_signals",
  "budget_change_alerts",
  "watchlist",
  "professional_analytics",
  "talepo_insights",
] as const;

/** Features that fundamentally require company-owned resources/workflows. */
export const COMPANY_ONLY_FEATURES: readonly FeatureKey[] = [
  "team_management",
  "hidden_inventory",
  "automatic_opportunity_hunter",
  "inventory_import",
  "lead_distribution",
  "corporate_intelligence",
  "erp_integration",
] as const;

/**
 * Still company-resource-owned (no USER ownerType yet).
 * SavedSearch / AlertRule now support USER|COMPANY via resource-owner.ts.
 */
export const COMPANY_OWNED_RESOURCE_FEATURES: readonly FeatureKey[] = [
  "watchlist",
] as const;

export function featureScope(key: FeatureKey): FeatureScope {
  if ((COMPANY_ONLY_FEATURES as readonly string[]).includes(key)) {
    return "COMPANY_ONLY_BY_NATURE";
  }
  if ((COMPANY_OWNED_RESOURCE_FEATURES as readonly string[]).includes(key)) {
    return "AMBIGUOUS_DRIFT";
  }
  if ((PERSONAL_CAPABLE_FEATURES as readonly string[]).includes(key)) {
    return "PERSONAL_CAPABLE";
  }
  return "AMBIGUOUS_DRIFT";
}

/** API may resolve without company membership (no company-owned row write). */
export function isPersonalApiCapable(key: FeatureKey): boolean {
  return (
    featureScope(key) === "PERSONAL_CAPABLE" &&
    !(COMPANY_OWNED_RESOURCE_FEATURES as readonly string[]).includes(key)
  );
}
