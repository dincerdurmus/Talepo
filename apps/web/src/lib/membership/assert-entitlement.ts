import { createSubsystemLogger } from "@/lib/observability/logger";

import type { FeatureKey } from "./entitlements";
import { hasFeature } from "./entitlements";
import type { EntitlementContext } from "./types";
import { EntitlementError } from "./types";

const log = createSubsystemLogger("entitlements");

export type RequestVisibilityFields = {
  visibleToSuppliersAt: Date | null | undefined;
};

/**
 * Server-side feature gate. Prefer this over UI-only checks.
 */
export function assertEntitlement(
  ctx: EntitlementContext,
  key: FeatureKey,
  message?: string,
): void {
  if (!hasFeature(ctx.features, key)) {
    log.warn("entitlement.denied", {
      outcome: "denied",
      errorCode: "FEATURE_NOT_AVAILABLE",
      context: {
        feature: key,
        plan: ctx.effectivePlanTier,
        subjectType: ctx.subject.type,
        subjectId: ctx.subject.id,
      },
    });
    throw new EntitlementError(
      "FEATURE_NOT_AVAILABLE",
      message ?? `Bu özellik mevcut planınızda kapalı: ${key}`,
      403,
    );
  }
}

export function assertPlanAtLeast(
  ctx: EntitlementContext,
  required: EntitlementContext["effectivePlanTier"],
  message?: string,
): void {
  const rank: Record<string, number> = {
    STANDARD: 0,
    PREMIUM: 1,
    PROFESSIONAL: 2,
    CORPORATE: 3,
  };
  if ((rank[ctx.effectivePlanTier] ?? 0) < (rank[required] ?? 99)) {
    throw new EntitlementError(
      "PLAN_REQUIRED",
      message ?? `${required} planı gerekli.`,
      403,
    );
  }
}

/**
 * Offer submission requires remaining quota (included or bonus).
 * Unlimited plans always pass.
 */
export function assertCanSubmitOffer(ctx: EntitlementContext): void {
  assertEntitlement(ctx, "submit_offer");

  if (ctx.quota.isUnlimited) return;

  if (ctx.quota.remaining === null || ctx.quota.remaining <= 0) {
    throw new EntitlementError(
      "QUOTA_EXCEEDED",
      "Aylık ücretsiz teklif hakkınız doldu.",
      402,
    );
  }
}

/**
 * Single source of truth for supplier request visibility.
 * Instant-access plans always pass; others wait until visibleToSuppliersAt.
 */
export function canAccessRequest(
  ctx: EntitlementContext,
  request: RequestVisibilityFields,
  now = new Date(),
): boolean {
  if (hasFeature(ctx.features, "instant_request_access")) {
    return true;
  }

  if (!request.visibleToSuppliersAt) {
    return true;
  }

  return request.visibleToSuppliersAt <= now;
}

export function assertCanAccessRequest(
  ctx: EntitlementContext,
  request: RequestVisibilityFields,
  now = new Date(),
): void {
  if (!canAccessRequest(ctx, request, now)) {
    throw new EntitlementError(
      "REQUEST_ACCESS_DELAYED",
      "Bu talep henüz standart erişime açılmadı. Premium ile anında erişebilirsiniz.",
      403,
    );
  }
}

/**
 * Prisma `where` fragment for listing requests the supplier may see.
 * Must stay aligned with `canAccessRequest`.
 */
export function buildSupplierVisibilityFilter(
  ctx: EntitlementContext,
  now = new Date(),
) {
  if (hasFeature(ctx.features, "instant_request_access")) {
    return {};
  }

  return {
    OR: [
      { visibleToSuppliersAt: { lte: now } },
      { visibleToSuppliersAt: null },
    ],
  };
}
