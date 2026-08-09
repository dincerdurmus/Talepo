import type { FeatureKey } from "./entitlements";
import type { EntitlementContext, EntitlementSubject, QuotaInfo } from "./types";
import type { PlanTierId } from "./plans";

/**
 * JSON-safe entitlement payload for Client Components.
 * Dates become ISO strings.
 */
export type EntitlementDTO = {
  userId: string;
  subject: EntitlementSubject;
  storedPlanTier: PlanTierId;
  effectivePlanTier: PlanTierId;
  planLabel: string;
  expiresAt: string | null;
  isExpired: boolean;
  features: Record<FeatureKey, boolean>;
  quota: QuotaInfo;
  requestAccessDelayHours: number;
};

export function toEntitlementDTO(ctx: EntitlementContext): EntitlementDTO {
  return {
    userId: ctx.userId,
    subject: ctx.subject,
    storedPlanTier: ctx.storedPlanTier,
    effectivePlanTier: ctx.effectivePlanTier,
    planLabel: ctx.planLabel,
    expiresAt: ctx.expiresAt ? ctx.expiresAt.toISOString() : null,
    isExpired: ctx.isExpired,
    features: ctx.features,
    quota: ctx.quota,
    requestAccessDelayHours: ctx.requestAccessDelayHours,
  };
}

export function formatQuotaRemaining(quota: Pick<QuotaInfo, "remaining" | "isUnlimited">) {
  if (quota.isUnlimited || quota.remaining === null) return "Sınırsız";
  return String(quota.remaining);
}
