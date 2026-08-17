import {
  canonicalizePlanTier,
  isPaidPlan,
  normalizeStoredPlanTier,
  type PlanTierId,
} from "./plans";
import { getPublicFacingPlanLabel } from "./product-packaging";
import type { PersonalPlanSnapshot } from "./types";

/**
 * Resolve effective plan after expiry.
 * Persisted planTier is left untouched — only effective tier changes.
 */
export function resolveEffectivePlanTier(
  storedPlanTier: PlanTierId,
  expiresAt: Date | null | undefined,
  now: Date,
): { effectivePlanTier: PlanTierId; isExpired: boolean } {
  if (!isPaidPlan(storedPlanTier)) {
    return { effectivePlanTier: "STANDARD", isExpired: false };
  }

  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return { effectivePlanTier: "STANDARD", isExpired: true };
  }

  return { effectivePlanTier: canonicalizePlanTier(storedPlanTier), isExpired: false };
}

export function resolveStoredPlanTier(value: string | null | undefined): PlanTierId {
  return normalizeStoredPlanTier(value);
}

export function buildPersonalPlanSnapshot(
  storedPlanTier: PlanTierId,
  expiresAt: Date | null | undefined,
  now: Date,
): PersonalPlanSnapshot {
  const { effectivePlanTier, isExpired } = resolveEffectivePlanTier(
    storedPlanTier,
    expiresAt,
    now,
  );

  return {
    storedPlanTier,
    effectivePlanTier,
    planLabel: getPublicFacingPlanLabel(storedPlanTier, effectivePlanTier),
    expiresAt: expiresAt ?? null,
    isExpired,
  };
}
