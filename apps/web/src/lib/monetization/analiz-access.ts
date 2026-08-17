import { hasFeature, type FeatureKey } from "@/lib/membership/entitlements";

/**
 * Analiz access model (single route `/panel/analiz`, single nav item).
 *
 * Basic Analiz is a core authenticated panel surface — not a plan feature.
 * `professional_analytics` remains in the plan matrix as an advanced
 * capability key; it does not gate page, nav, or basic performance API access.
 */
export const ANALIZ_HREF = "/panel/analiz";

export function hasPlatformRequestSummary(
  features: Record<FeatureKey, boolean>,
): boolean {
  return hasFeature(features, "basic_market_insights");
}

export function hasAdvancedAnaliz(
  features: Record<FeatureKey, boolean>,
): boolean {
  return hasFeature(features, "professional_analytics");
}
