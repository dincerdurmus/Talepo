import type { FeatureKey } from "./entitlements";

/**
 * Company add-on commercial policy.
 * Prices are intentionally null until product gives a price authority.
 * Do not invent TRY amounts. Do not open production checkout from this module.
 *
 * displayPriceLabel is presentation-only. It is not a billing amount and must
 * not be copied into price-book, checkout, or entitlement grants.
 */

/** Visible until a real TRY price authority exists. Not a billed amount. */
export const ADDON_PRICE_UNSET_DISPLAY = "Konuşulacak";
export const ADDON_PURCHASE_UNAVAILABLE_CTA = "Satın alma yakında";

export function formatAddonDisplayPriceLine(displayPriceLabel: string) {
  return `Fiyat: ${displayPriceLabel}`;
}

export const HIDDEN_INVENTORY_ADDON = {
  key: "hidden_inventory" as const,
  checkoutEnabled: false,
  priceTry: null as number | null,
  sku: null as string | null,
  title: "Gizli Envanter",
  description:
    "Firmanızın yayınlanmayan stoklarını Talepo fırsatlarıyla eşleştirin.",
  displayPriceLabel: ADDON_PRICE_UNSET_DISPLAY,
  purchaseCtaLabel: ADDON_PURCHASE_UNAVAILABLE_CTA,
};

export const EXTRA_SEAT_ADDON = {
  key: "extra_seat" as const,
  checkoutEnabled: false,
  priceTry: null as number | null,
  sku: null as string | null,
  billingEnabled: false,
  title: "Ek ekip koltuğu",
  description: "Ekip büyüdükçe yeni kullanıcı ekleyin.",
  displayPriceLabel: ADDON_PRICE_UNSET_DISPLAY,
  purchaseCtaLabel: ADDON_PURCHASE_UNAVAILABLE_CTA,
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
