import type { PlanTierId } from "./plans";
import type { FeatureKey } from "./entitlements";

/** Who owns the effective plan, quota, and bonus pool. */
export type EntitlementSubject = {
  type: "user" | "company";
  id: string;
  /** Present when subject.type === "company". */
  name?: string | null;
};

/**
 * Explicit workspace context for entitlement resolution.
 * Without companyId (or with preferUserSubject), resolution is PERSONAL.
 * Company plan is never applied implicitly from membership alone.
 */
export type ResolveEntitlementsOptions = {
  /** Explicit company workspace (company switcher cookie / API). */
  companyId?: string;
  /**
   * When true, ignore company memberships and resolve as personal user.
   * Default when company cookie is missing or set to personal sentinel.
   */
  preferUserSubject?: boolean;
  now?: Date;
};

export type QuotaInfo = {
  /** Monthly included offer limit. `null` = unlimited. */
  limit: number | null;
  used: number;
  /** Remaining total (included + bonus). `null` = unlimited. */
  remaining: number | null;
  bonusCredits: number;
  isUnlimited: boolean;
};

/** User-owned plan snapshot — always computed, even in company context. */
export type PersonalPlanSnapshot = {
  storedPlanTier: PlanTierId;
  effectivePlanTier: PlanTierId;
  planLabel: string;
  expiresAt: Date | null;
  isExpired: boolean;
};

export type EntitlementContext = {
  userId: string;
  subject: EntitlementSubject;
  /** Plan tier stored on the subject (may still be paid after expiry). */
  storedPlanTier: PlanTierId;
  /** Plan used for all checks after expiry resolution. */
  effectivePlanTier: PlanTierId;
  planLabel: string;
  expiresAt: Date | null;
  isExpired: boolean;
  features: Record<FeatureKey, boolean>;
  quota: QuotaInfo;
  requestAccessDelayHours: number;
  /** Present when user record exists — used for personal-vs-company UX. */
  personalPlan?: PersonalPlanSnapshot;
};

export class EntitlementError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 403) {
    super(message);
    this.name = "EntitlementError";
    this.code = code;
    this.status = status;
  }
}
