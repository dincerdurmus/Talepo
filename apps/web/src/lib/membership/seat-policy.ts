import { canonicalizePlanTier, type PlanTierId } from "./plans";
import { normalizeCompanyRole } from "./company-permissions";

/**
 * Seat policy — separate from featuresForPlan() and PlanTier sales catalog.
 *
 * Professional Company Workspace includes 1 owner, 3 members and 1 analyst.
 * Extra purchased seats extend member capacity only.
 * Legacy Standard companies have no paid seat product (null = no cap).
 */
export type PlanSeatPolicy = {
  includedSeats: number | null;
};

export const WORKSPACE_OWNER_SEATS = 1;
export const WORKSPACE_MEMBER_SEATS = 3;
export const WORKSPACE_OPERATING_SEATS = WORKSPACE_OWNER_SEATS + WORKSPACE_MEMBER_SEATS;
export const WORKSPACE_ANALYSIS_SEATS = 1;
export const WORKSPACE_BASE_INCLUDED_SEATS = WORKSPACE_OPERATING_SEATS + WORKSPACE_ANALYSIS_SEATS;
export const WORKSPACE_SEAT_DESCRIPTION =
  "1 sahip (Owner) + 3 üye + 1 salt okunur analist koltuğu.";

export const PLAN_SEAT_POLICY: Record<PlanTierId, PlanSeatPolicy> = {
  STANDARD: { includedSeats: null },
  PREMIUM: { includedSeats: WORKSPACE_BASE_INCLUDED_SEATS },
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
  ownerSeats: SeatPoolUsage;
  memberSeats: SeatPoolUsage;
  operatingSeats: SeatPoolUsage;
  analysisSeats: SeatPoolUsage;
};

export type SeatPoolUsage = {
  limit: number | null;
  active: number;
  remaining: number | null;
  atLimit: boolean;
};

function seatPool(limit: number | null, active: number): SeatPoolUsage {
  return {
    limit,
    active,
    remaining: limit == null ? null : Math.max(0, limit - active),
    atLimit: limit != null && active >= limit,
  };
}

export function seatPoolForRole(usage: SeatUsage, role: string): SeatPoolUsage {
  const canonicalRole = normalizeCompanyRole(role);
  const pool = canonicalRole === "OWNER" ? usage.ownerSeats
    : canonicalRole === "MEMBER" ? usage.memberSeats
    : canonicalRole === "VIEWER" ? usage.analysisSeats
    : seatPool(0, 0);
  if (usage.includedSeats == null) return pool;
  const totalRemaining = Math.max(0, usage.includedSeats - usage.activeSeats);
  const operatingRemaining = canonicalRole === "OWNER" || canonicalRole === "MEMBER"
    ? usage.operatingSeats.remaining! : totalRemaining;
  return {
    ...pool,
    remaining: Math.min(pool.remaining!, totalRemaining, operatingRemaining),
    atLimit: pool.atLimit || totalRemaining === 0 || operatingRemaining === 0,
  };
}

export function buildSeatUsage(input: {
  planTier: PlanTierId;
  activeSeats: number;
  /** Owner vacancies cannot become additional member seats. */
  activeOwnerSeats: number;
  /** VIEWER seats cannot consume operating capacity. */
  activeAnalysisSeats?: number;
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
  const analysisCount = Math.min(input.activeSeats, Math.max(0, input.activeAnalysisSeats ?? 0));
  const ownerCount = Math.min(input.activeSeats - analysisCount, Math.max(0, input.activeOwnerSeats));
  // A company has a single owner, including legacy Standard workspaces.
  const ownerSeats = seatPool(WORKSPACE_OWNER_SEATS, ownerCount);
  const memberSeats = seatPool(
    includedSeats == null ? null : WORKSPACE_MEMBER_SEATS + extraSeatsPurchased,
    input.activeSeats - analysisCount - ownerCount,
  );
  const operatingSeats = seatPool(
    includedSeats == null ? null : WORKSPACE_OPERATING_SEATS + extraSeatsPurchased,
    input.activeSeats - analysisCount,
  );
  const analysisSeats = seatPool(
    includedSeats == null ? null : WORKSPACE_ANALYSIS_SEATS,
    analysisCount,
  );

  if (includedSeats == null) {
    return {
      planTier: input.planTier,
      includedSeats: null,
      activeSeats: input.activeSeats,
      remaining: null,
      atLimit: false,
      baseSeats,
      extraSeatsPurchased,
      ownerSeats,
      memberSeats,
      operatingSeats,
      analysisSeats,
    };
  }
  return {
    planTier: input.planTier,
    includedSeats,
    activeSeats: input.activeSeats,
    remaining: Math.min(Math.max(0, includedSeats - input.activeSeats), ownerSeats.remaining! + memberSeats.remaining! + analysisSeats.remaining!),
    atLimit: input.activeSeats >= includedSeats || (ownerSeats.atLimit && memberSeats.atLimit && analysisSeats.atLimit),
    baseSeats,
    extraSeatsPurchased,
    ownerSeats,
    memberSeats,
    operatingSeats,
    analysisSeats,
  };
}
