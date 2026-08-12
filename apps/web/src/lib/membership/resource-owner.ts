/**
 * Single ownership resolver for SavedSearch / AlertRule.
 * Server-authoritative: ignore client ownerType/userId/companyId.
 *
 * PERSONAL workspace → USER owner
 * COMPANY workspace  → COMPANY owner (+ active membership)
 */

import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { assertEntitlement } from "@/lib/membership/assert-entitlement";
import type { FeatureKey } from "@/lib/membership/entitlements";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import type { EntitlementContext } from "@/lib/membership/types";
import { EntitlementError } from "@/lib/membership/types";
import { assertCompanyMembership } from "@/lib/panel/company-workspace";
import type { ResourceOwnerType } from "@/generated/prisma/client";

export type ResourceOwnerContext = {
  ownerType: ResourceOwnerType;
  /** Set only for USER owner */
  userId: string | null;
  /** Set only for COMPANY owner */
  companyId: string | null;
  entitlements: EntitlementContext;
  role: string | null;
  /** Authenticated actor (always present) */
  actorUserId: string;
};

const OWNED_FEATURES = [
  "saved_searches",
  "smart_alerts",
  "alert_rules",
] as const satisfies readonly FeatureKey[];

export type OwnedResourceFeature = (typeof OWNED_FEATURES)[number];

/**
 * Resolve commercial owner for SavedSearch/Alert from authenticated workspace.
 */
export async function requireResourceOwnerFeature(
  actorUserId: string,
  feature: OwnedResourceFeature,
): Promise<ResourceOwnerContext> {
  const entitlements = await resolveEntitlements(
    actorUserId,
    await getCompanyContextOptions(),
  );
  assertEntitlement(entitlements, feature);

  if (entitlements.subject.type === "company") {
    const membership = await assertCompanyMembership(
      actorUserId,
      entitlements.subject.id,
    );
    if (!membership) {
      throw new EntitlementError(
        "FEATURE_NOT_AVAILABLE",
        "Firma üyeliğiniz aktif değil.",
        403,
      );
    }
    return {
      ownerType: "COMPANY",
      userId: null,
      companyId: entitlements.subject.id,
      entitlements,
      role: membership.role,
      actorUserId,
    };
  }

  return {
    ownerType: "USER",
    userId: actorUserId,
    companyId: null,
    entitlements,
    role: null,
    actorUserId,
  };
}

/** Prisma where fragment — list/update/delete scoped to current owner. */
export function ownerScopeWhere(ctx: ResourceOwnerContext): {
  ownerType: ResourceOwnerType;
  userId?: string;
  companyId?: string;
} {
  if (ctx.ownerType === "USER") {
    if (!ctx.userId) {
      throw new EntitlementError(
        "FEATURE_NOT_AVAILABLE",
        "Kişisel sahiplik çözülemedi.",
        500,
      );
    }
    return { ownerType: "USER", userId: ctx.userId };
  }
  if (!ctx.companyId) {
    throw new EntitlementError(
      "FEATURE_NOT_AVAILABLE",
      "Firma sahipliği çözülemedi.",
      500,
    );
  }
  return { ownerType: "COMPANY", companyId: ctx.companyId };
}

/** Prisma create data — never trust client ownership fields. */
export function ownerCreateData(ctx: ResourceOwnerContext): {
  ownerType: ResourceOwnerType;
  userId: string | null;
  companyId: string | null;
} {
  if (ctx.ownerType === "USER") {
    return {
      ownerType: "USER",
      userId: ctx.userId,
      companyId: null,
    };
  }
  return {
    ownerType: "COMPANY",
    userId: null,
    companyId: ctx.companyId,
  };
}
