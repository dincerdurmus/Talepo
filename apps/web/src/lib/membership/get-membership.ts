import { getCompanyContextOptions } from "./company-context";
import { legacyQuotaDisplay, type PlanTierId } from "./plans";
import { resolveEntitlements } from "./resolve-entitlements";
import type { EntitlementContext } from "./types";

/**
 * @deprecated Prefer `resolveEntitlements` for new code.
 * Kept as a thin compatibility wrapper for existing UI consumers.
 */
export type MembershipContext = {
  userId: string;
  planTier: PlanTierId;
  planLabel: string;
  monthlyOfferQuota: number;
  bonusOfferCredits: number;
  usedOffersThisMonth: number;
  remainingOffers: number;
  instantRequestAccess: boolean;
  requestAccessDelayHours: number;
  companyId: string | null;
  companyName: string | null;
  /** Extra fields for gradual migration — safe for consumers to ignore. */
  storedPlanTier: PlanTierId;
  isExpired: boolean;
  expiresAt: Date | null;
};

/** Map EntitlementContext → legacy MembershipContext (no DB). */
export function toMembershipContext(ctx: EntitlementContext): MembershipContext {
  return {
    userId: ctx.userId,
    planTier: ctx.effectivePlanTier,
    planLabel: ctx.planLabel,
    monthlyOfferQuota: legacyQuotaDisplay(ctx.quota.limit),
    bonusOfferCredits: ctx.quota.bonusCredits,
    usedOffersThisMonth: ctx.quota.used,
    remainingOffers: legacyQuotaDisplay(ctx.quota.remaining),
    instantRequestAccess: ctx.features.instant_request_access,
    requestAccessDelayHours: ctx.requestAccessDelayHours,
    companyId: ctx.subject.type === "company" ? ctx.subject.id : null,
    companyName:
      ctx.subject.type === "company" ? (ctx.subject.name ?? null) : null,
    storedPlanTier: ctx.storedPlanTier,
    isExpired: ctx.isExpired,
    expiresAt: ctx.expiresAt,
  };
}

/**
 * @deprecated Use `resolveEntitlements(userId)` instead.
 */
export async function getMembershipContext(
  userId: string,
): Promise<MembershipContext> {
  return toMembershipContext(
    await resolveEntitlements(userId, await getCompanyContextOptions()),
  );
}

/**
 * @deprecated Prefer `buildSupplierVisibilityFilter` from `assert-entitlement`
 * with a full EntitlementContext. Kept for MembershipContext callers.
 * Rule must stay identical to `canAccessRequest`.
 */
export function buildSupplierVisibilityFilter(
  membership: Pick<MembershipContext, "instantRequestAccess">,
  now = new Date(),
) {
  if (membership.instantRequestAccess) {
    return {};
  }

  return {
    OR: [
      { visibleToSuppliersAt: { lte: now } },
      { visibleToSuppliersAt: null },
    ],
  };
}
