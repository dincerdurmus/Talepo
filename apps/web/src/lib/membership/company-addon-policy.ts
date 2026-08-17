import type { FeatureKey } from "./entitlements";

/**
 * Company add-on commercial policy.
 * Prices are intentionally null until product gives a price authority.
 * Do not invent TRY amounts. Do not open production checkout from this module.
 */

export const HIDDEN_INVENTORY_ADDON = {
  key: "hidden_inventory" as const,
  checkoutEnabled: false,
  priceTry: null as number | null,
  sku: null as string | null,
};

export const EXTRA_SEAT_ADDON = {
  key: "extra_seat" as const,
  checkoutEnabled: false,
  priceTry: null as number | null,
  sku: null as string | null,
  billingEnabled: false,
};

export function isHiddenInventoryAddonActive(input: {
  enabled: boolean;
  expiresAt?: Date | null;
  now?: Date;
}): boolean {
  if (!input.enabled) return false;
  if (
    input.expiresAt &&
    input.expiresAt.getTime() <= (input.now ?? new Date()).getTime()
  ) {
    return false;
  }
  return true;
}

export function applyCompanyWorkspaceFeatureOverlay(input: {
  features: Record<FeatureKey, boolean>;
  workspaceEffectiveIsProfessional: boolean;
  hiddenInventoryAddonActive: boolean;
}): Record<FeatureKey, boolean> {
  const features = { ...input.features };
  if (!input.workspaceEffectiveIsProfessional) {
    features.team_management = false;
    features.hidden_inventory = false;
    return features;
  }
  features.team_management = true;
  features.hidden_inventory = input.hiddenInventoryAddonActive;
  return features;
}
