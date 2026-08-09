import type { FeatureKey } from "./entitlements";
import { hasFeature } from "./entitlements";
import type { EntitlementContext } from "./types";
import { EntitlementError } from "./types";

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
    throw new EntitlementError(
      "ENTITLEMENT_REQUIRED",
      message ?? `Bu işlem için gerekli yetki yok: ${key}`,
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
      "OFFER_QUOTA_EXCEEDED",
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
