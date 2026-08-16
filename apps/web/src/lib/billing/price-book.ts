import type { PlanTierId } from "@/lib/membership/plans";

export type PriceBookProductKey = "STANDARD" | "PRO_PERSONAL" | "PRO_WORKSPACE";
export type BillingInterval = "MONTHLY" | "ANNUAL";
export type TaxMode = "TAX_INCLUDED" | "TAX_EXCLUSIVE" | "UNKNOWN";
export type PriceBookEntry = { productKey: PriceBookProductKey; context: "PERSONAL" | "WORKSPACE"; interval: BillingInterval; country: string; currency: "TRY"; amount: number | null; includedSeats: number | null; annualDiscount: number | null; active: boolean; checkoutEnabled: boolean; additionalSeatPrice: number | null; additionalSeatBillingEnabled: boolean; taxMode: TaxMode; providerMappingKey: PlanTierId | null };

export const PRICE_BOOK: readonly PriceBookEntry[] = [
  { productKey: "STANDARD", context: "PERSONAL", interval: "MONTHLY", country: "TR", currency: "TRY", amount: null, includedSeats: null, annualDiscount: null, active: true, checkoutEnabled: false, additionalSeatPrice: null, additionalSeatBillingEnabled: false, taxMode: "UNKNOWN", providerMappingKey: null },
  { productKey: "PRO_PERSONAL", context: "PERSONAL", interval: "MONTHLY", country: "TR", currency: "TRY", amount: 2490, includedSeats: null, annualDiscount: null, active: true, checkoutEnabled: true, additionalSeatPrice: null, additionalSeatBillingEnabled: false, taxMode: "UNKNOWN", providerMappingKey: "PROFESSIONAL" },
  { productKey: "PRO_PERSONAL", context: "PERSONAL", interval: "ANNUAL", country: "TR", currency: "TRY", amount: Math.round(2490 * 12 * 0.85), includedSeats: null, annualDiscount: 0.15, active: true, checkoutEnabled: false, additionalSeatPrice: null, additionalSeatBillingEnabled: false, taxMode: "UNKNOWN", providerMappingKey: "PROFESSIONAL" },
  { productKey: "PRO_WORKSPACE", context: "WORKSPACE", interval: "MONTHLY", country: "TR", currency: "TRY", amount: 2490, includedSeats: 5, annualDiscount: null, active: true, checkoutEnabled: true, additionalSeatPrice: null, additionalSeatBillingEnabled: false, taxMode: "UNKNOWN", providerMappingKey: "PROFESSIONAL" },
  { productKey: "PRO_WORKSPACE", context: "WORKSPACE", interval: "ANNUAL", country: "TR", currency: "TRY", amount: Math.round(2490 * 12 * 0.85), includedSeats: 5, annualDiscount: 0.15, active: true, checkoutEnabled: false, additionalSeatPrice: null, additionalSeatBillingEnabled: false, taxMode: "UNKNOWN", providerMappingKey: "PROFESSIONAL" },
];

export function getPriceBookEntry(productKey: PriceBookProductKey, interval: BillingInterval, country = "TR") {
  const entry = PRICE_BOOK.find((item) => item.productKey === productKey && item.interval === interval && item.country === country);
  if (!entry) throw new Error(`No price book entry for ${productKey}/${interval}/${country}`);
  return entry;
}

export function productKeyForLegacyTier(tier: PlanTierId, workspace = false): PriceBookProductKey {
  if (tier === "STANDARD") return "STANDARD";
  return workspace || tier === "CORPORATE" ? "PRO_WORKSPACE" : "PRO_PERSONAL";
}

export function providerMappingKeyForProduct(productKey: PriceBookProductKey): PlanTierId | null {
  return PRICE_BOOK.find((item) => item.productKey === productKey && item.interval === "MONTHLY")?.providerMappingKey ?? null;
}
