import type { PlanTierId } from "./plans";

/**
 * Seat policy — separate from featuresForPlan().
 * Seat limits are Talepo product policy, not payment-provider logic.
 *
 * null includedSeats → no seat-cap enforcement in this phase.
 */
export type PlanSeatPolicy = {
  includedSeats: number | null;
};

export const PLAN_SEAT_POLICY: Record<PlanTierId, PlanSeatPolicy> = {
  STANDARD: { includedSeats: null },
  PREMIUM: { includedSeats: null },
  PROFESSIONAL: { includedSeats: 5 },
  CORPORATE: { includedSeats: 5 },
};

export function getIncludedSeats(tier: PlanTierId): number | null {
  return PLAN_SEAT_POLICY[tier]?.includedSeats ?? null;
}

export type SeatUsage = {
  planTier: PlanTierId;
  includedSeats: number | null;
  activeSeats: number;
  remaining: number | null;
  atLimit: boolean;
};

export function buildSeatUsage(input: {
  planTier: PlanTierId;
  activeSeats: number;
}): SeatUsage {
  const includedSeats = getIncludedSeats(input.planTier);
  if (includedSeats == null) {
    return {
      planTier: input.planTier,
      includedSeats: null,
      activeSeats: input.activeSeats,
      remaining: null,
      atLimit: false,
    };
  }
  return {
    planTier: input.planTier,
    includedSeats,
    activeSeats: input.activeSeats,
    remaining: Math.max(0, includedSeats - input.activeSeats),
    atLimit: input.activeSeats >= includedSeats,
  };
}
