import { canonicalizePlanTier, type PlanTierId } from "./plans";

/**
 * Seat policy — separate from featuresForPlan() and PlanTier sales catalog.
 *
 * Professional Company Workspace includes the owner seat only.
 * Extra members require purchased extra seats (billing not ready: price null).
 * Legacy Standard companies have no paid seat product (null = no cap).
 */
export type PlanSeatPolicy = {
  includedSeats: number | null;
};

/** Owner / base membership seat. Extra members are paid add-on seats. */
export const WORKSPACE_BASE_INCLUDED_SEATS = 1;

export const PLAN_SEAT_POLICY: Record<PlanTierId, PlanSeatPolicy> = {
  STANDARD: { includedSeats: null },
  PREMIUM: { includedSeats: null },
  PROFESSIONAL: { includedSeats: WORKSPACE_BASE_INCLUDED_SEATS },
  CORPORATE: { includedSeats: WORKSPACE_BASE_INCLUDED_SEATS },
};

export function getIncludedSeats(tier: PlanTierId): number | null {
  return PLAN_SEAT_POLICY[tier]?.includedSeats ?? null;
}

export function extraSeatsCount(purchased: number, expiresAt?: Date | null, now = new Date()): number {
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return 0;
  return Math.max(0, Math.floor(purchased) || 0);
}

export function includedSeatsForWorkspace(input: {
  workspaceEffectivePlanTier: PlanTierId;
  extraSeatsPurchased?: number;
  extraSeatsExpiresAt?: Date | null;
  now?: Date;
}): number | null {
  if (canonicalizePlanTier(input.workspaceEffectivePlanTier) !== "PROFESSIONAL") {
    return null;
  }
  return (
    WORKSPACE_BASE_INCLUDED_SEATS +
    extraSeatsCount(
      input.extraSeatsPurchased ?? 0,
      input.extraSeatsExpiresAt,
      input.now,
    )
  );
}

export type SeatUsage = {
  planTier: PlanTierId;
  includedSeats: number | null;
  activeSeats: number;
  remaining: number | null;
  atLimit: boolean;
  baseSeats: number | null;
  extraSeatsPurchased: number;
};

export function buildSeatUsage(input: {
  planTier: PlanTierId;
  activeSeats: number;
  extraSeatsPurchased?: number;
  extraSeatsExpiresAt?: Date | null;
  workspaceEffectivePlanTier?: PlanTierId;
  now?: Date;
}): SeatUsage {
  const workspaceTier = input.workspaceEffectivePlanTier ?? input.planTier;
  const extraSeatsPurchased = extraSeatsCount(
    input.extraSeatsPurchased ?? 0,
    input.extraSeatsExpiresAt,
    input.now,
  );
  const includedSeats = includedSeatsForWorkspace({
    workspaceEffectivePlanTier: workspaceTier,
    extraSeatsPurchased,
    extraSeatsExpiresAt: input.extraSeatsExpiresAt,
    now: input.now,
  });
  const baseSeats =
    canonicalizePlanTier(workspaceTier) === "PROFESSIONAL"
      ? WORKSPACE_BASE_INCLUDED_SEATS
      : null;

  if (includedSeats == null) {
    return {
      planTier: input.planTier,
      includedSeats: null,
      activeSeats: input.activeSeats,
      remaining: null,
      atLimit: false,
      baseSeats,
      extraSeatsPurchased,
    };
  }
  return {
    planTier: input.planTier,
    includedSeats,
    activeSeats: input.activeSeats,
    remaining: Math.max(0, includedSeats - input.activeSeats),
    atLimit: input.activeSeats >= includedSeats,
    baseSeats,
    extraSeatsPurchased,
  };
}
