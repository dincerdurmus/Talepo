import type { PlanTierId } from "@/lib/membership/plans";
import { isPaidPlan, PLAN_DEFINITIONS } from "@/lib/membership/plans";
import { PLAN_PRICING } from "@/lib/membership/pricing-config";

import { BillingError, BillingErrorCode } from "./errors";

/**
 * Server-side plan ↔ provider price mapping.
 * Client never supplies authority; only planTier is accepted and mapped here.
 *
 * Real provider price IDs come from env when configured:
 *   TALEPO_PRICE_PREMIUM=price_xxx
 *   TALEPO_PRICE_PROFESSIONAL=price_yyy
 *   TALEPO_PRICE_CORPORATE=price_zzz
 *   TALEPO_CREDIT_PACK_5=price_...
 */
export type PlanPriceMapping = {
  planTier: PlanTierId;
  providerPriceId: string | null;
  displayPriceTry: number | null;
  checkoutAllowed: boolean;
};

export function getPlanPriceMapping(planTier: PlanTierId): PlanPriceMapping {
  const envKey = `TALEPO_PRICE_${planTier}`;
  const providerPriceId = process.env[envKey]?.trim() || null;
  const display =
    PLAN_PRICING[planTier]?.priceTry ?? PLAN_DEFINITIONS[planTier]?.priceTry;

  return {
    planTier,
    providerPriceId,
    displayPriceTry: display ?? null,
    checkoutAllowed: isPaidPlan(planTier) && planTier !== "CORPORATE"
      ? true
      : planTier === "CORPORATE"
        ? Boolean(providerPriceId)
        : false,
  };
}

export function assertCheckoutPlan(planTier: PlanTierId): PlanPriceMapping {
  if (!isPaidPlan(planTier)) {
    throw new BillingError({
      code: BillingErrorCode.PLAN_MAPPING_INVALID,
      userMessage: "Bu plan için ödeme gerekmez.",
    });
  }

  const mapping = getPlanPriceMapping(planTier);
  if (planTier === "CORPORATE" && !mapping.providerPriceId) {
    throw new BillingError({
      code: BillingErrorCode.PLAN_MAPPING_INVALID,
      userMessage: "Kurumsal plan için özel satış / fiyat yapılandırması gerekir.",
    });
  }

  if (!mapping.checkoutAllowed && planTier === "CORPORATE") {
    throw new BillingError({
      code: BillingErrorCode.PLAN_MAPPING_INVALID,
      userMessage: "Bu plan için checkout yapılandırılmamış.",
    });
  }

  return mapping;
}

export function resolvePlanTierFromProviderPriceId(
  providerPriceId: string,
): PlanTierId | null {
  for (const tier of ["PREMIUM", "PROFESSIONAL", "CORPORATE"] as PlanTierId[]) {
    const mapped = getPlanPriceMapping(tier).providerPriceId;
    if (mapped && mapped === providerPriceId) return tier;
  }
  // Mock / test price IDs
  if (providerPriceId.startsWith("mock_price_")) {
    const tier = providerPriceId.replace("mock_price_", "").toUpperCase();
    if (tier === "PREMIUM" || tier === "PROFESSIONAL" || tier === "CORPORATE") {
      return tier;
    }
  }
  return null;
}

export function getCreditPackProviderPriceId(packId: string): string | null {
  const envKey = `TALEPO_CREDIT_${packId}`;
  return process.env[envKey]?.trim() || `mock_credit_${packId}`;
}
