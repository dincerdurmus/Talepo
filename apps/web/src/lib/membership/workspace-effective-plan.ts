import {
  canonicalizePlanTier,
  type PlanTierId,
} from "./plans";
import { resolveEffectivePlanTier } from "./plan-tier-utils";

/**
 * Owner Professional membership is inherited by the company workspace.
 * Company.planTier stays a billing/storage field — not a second sold plan.
 */
export function resolveWorkspaceEffectivePlan(input: {
  companyStoredPlanTier: PlanTierId;
  companyExpiresAt: Date | null | undefined;
  ownerStoredPlanTier?: PlanTierId | null;
  ownerExpiresAt?: Date | null;
  now?: Date;
}): {
  effectivePlanTier: PlanTierId;
  inheritedFromOwner: boolean;
  companyEffectivePlanTier: PlanTierId;
  ownerEffectivePlanTier: PlanTierId | null;
} {
  const now = input.now ?? new Date();
  const company = resolveEffectivePlanTier(
    input.companyStoredPlanTier,
    input.companyExpiresAt,
    now,
  );
  const owner =
    input.ownerStoredPlanTier != null
      ? resolveEffectivePlanTier(
          input.ownerStoredPlanTier,
          input.ownerExpiresAt,
          now,
        )
      : null;

  if (canonicalizePlanTier(company.effectivePlanTier) === "PROFESSIONAL") {
    return {
      effectivePlanTier: "PROFESSIONAL",
      inheritedFromOwner: false,
      companyEffectivePlanTier: company.effectivePlanTier,
      ownerEffectivePlanTier: owner?.effectivePlanTier ?? null,
    };
  }

  if (
    owner &&
    canonicalizePlanTier(owner.effectivePlanTier) === "PROFESSIONAL"
  ) {
    return {
      effectivePlanTier: "PROFESSIONAL",
      inheritedFromOwner: true,
      companyEffectivePlanTier: company.effectivePlanTier,
      ownerEffectivePlanTier: owner.effectivePlanTier,
    };
  }

  return {
    effectivePlanTier: company.effectivePlanTier,
    inheritedFromOwner: false,
    companyEffectivePlanTier: company.effectivePlanTier,
    ownerEffectivePlanTier: owner?.effectivePlanTier ?? null,
  };
}

export function isProfessionalMembership(tier: PlanTierId): boolean {
  return canonicalizePlanTier(tier) === "PROFESSIONAL";
}

export function canCreateCompanyWorkspace(effectivePlanTier: PlanTierId): boolean {
  return isProfessionalMembership(effectivePlanTier);
}
