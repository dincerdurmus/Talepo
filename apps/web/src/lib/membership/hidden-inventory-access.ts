import { hasFeature, type FeatureKey } from "./entitlements";
import { canonicalizePlanTier, type PlanTierId } from "./plans";

/**
 * Hidden Inventory is a company-only paid add-on — not a Professional plan feature
 * and not unlocked by opening a Company Workspace.
 *
 * Condition:
 *   isProfessional AND hasCompanyWorkspace AND hasHiddenInventoryAddon
 *
 * The add-on flag is stored on CompanyAddonEntitlement and overlaid onto
 * features.hidden_inventory in resolveEntitlements. It is NOT in PROFESSIONAL_KEYS.
 * Purchase/checkout is not ready (price/SKU null).
 */
export function hasHiddenInventoryAddonEntitlement(
  features: Record<FeatureKey, boolean>,
): boolean {
  return hasFeature(features, "hidden_inventory");
}

export function hasHiddenInventoryAccess(input: {
  effectivePlanTier: PlanTierId;
  subjectType: "user" | "company";
  features: Record<FeatureKey, boolean>;
}): boolean {
  return (
    canonicalizePlanTier(input.effectivePlanTier) === "PROFESSIONAL" &&
    input.subjectType === "company" &&
    hasHiddenInventoryAddonEntitlement(input.features)
  );
}
