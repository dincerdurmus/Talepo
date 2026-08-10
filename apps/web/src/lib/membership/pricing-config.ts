import type { PlanTierId } from "./plans";

/**
 * Central pricing config — do not hardcode prices in business logic.
 * Payment provider integration will read from here later.
 */
export type PlanPricing = {
  tier: PlanTierId;
  priceTry: number | null;
  billingPeriod: "month" | "year" | "custom";
  label: string;
  tagline: string;
};

export const PLAN_PRICING: Record<PlanTierId, PlanPricing> = {
  STANDARD: {
    tier: "STANDARD",
    priceTry: null,
    billingPeriod: "month",
    label: "Standart",
    tagline: "Temel kullanım",
  },
  PREMIUM: {
    tier: "PREMIUM",
    priceTry: 990,
    billingPeriod: "month",
    label: "Premium",
    tagline: "Hız",
  },
  PROFESSIONAL: {
    tier: "PROFESSIONAL",
    priceTry: 2490,
    billingPeriod: "month",
    label: "Profesyonel",
    tagline: "Zeka",
  },
  CORPORATE: {
    tier: "CORPORATE",
    priceTry: null,
    billingPeriod: "custom",
    label: "Kurumsal",
    tagline: "Otomasyon ve veri",
  },
};

export function getPlanPricing(tier: PlanTierId): PlanPricing {
  return PLAN_PRICING[tier];
}
