import type { PlanTierId } from "@/lib/membership/plans";
import { BillingError, BillingErrorCode } from "@/lib/billing/errors";

/**
 * Talepo plan → iyzico pricingPlanReferenceCode (server-side only).
 *
 * Env (preferred):
 *   TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY
 *   TALEPO_IYZICO_PLAN_PROFESSIONAL_MONTHLY
 *   TALEPO_IYZICO_PLAN_CORPORATE_MONTHLY
 *
 * Fallback (Phase 4C generic):
 *   TALEPO_PRICE_PREMIUM / PROFESSIONAL / CORPORATE
 */
export function getIyzicoPricingPlanReferenceCode(
  planTier: PlanTierId,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const specific = env[`TALEPO_IYZICO_PLAN_${planTier}_MONTHLY`]?.trim();
  if (specific) return specific;
  const generic = env[`TALEPO_PRICE_${planTier}`]?.trim();
  return generic || null;
}

export function assertIyzicoPlanMapping(planTier: PlanTierId): string {
  if (planTier === "STANDARD") {
    throw new BillingError({
      code: BillingErrorCode.PLAN_MAPPING_INVALID,
      userMessage: "Bu plan için ödeme gerekmez.",
    });
  }
  const ref = getIyzicoPricingPlanReferenceCode(planTier);
  if (!ref) {
    throw new BillingError({
      code: BillingErrorCode.PLAN_MAPPING_INVALID,
      userMessage: "Bu plan için ödeme yapılandırması eksik.",
      diagnostic: `missing_iyzico_plan_${planTier}`,
    });
  }
  return ref;
}

export function resolvePlanTierFromIyzicoPricingPlan(
  pricingPlanReferenceCode: string,
  env: NodeJS.ProcessEnv = process.env,
): PlanTierId | null {
  for (const tier of ["PREMIUM", "PROFESSIONAL", "CORPORATE"] as const) {
    const mapped = getIyzicoPricingPlanReferenceCode(tier, env);
    if (mapped && mapped === pricingPlanReferenceCode) return tier;
  }
  return null;
}
