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
 * Future company switcher can pass companyId explicitly.
 * Until then resolver picks the same membership as before
 * (most recently joined ACTIVE membership).
 */
export type ResolveEntitlementsOptions = {
  /** Optional explicit company context (company switcher). */
  companyId?: string;
  /**
   * When true, ignore company memberships and resolve as personal user.
   * Used when the switcher explicitly selects "Kişisel hesap".
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
