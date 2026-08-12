import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { assertEntitlement } from "@/lib/membership/assert-entitlement";
import type { FeatureKey } from "@/lib/membership/entitlements";
import {
  isPersonalApiCapable,
} from "@/lib/membership/feature-scope";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import type { EntitlementContext } from "@/lib/membership/types";
import { EntitlementError } from "@/lib/membership/types";
import { requireCompanyFeature } from "@/lib/membership/require-company-feature";

export type EntitledFeatureContext = {
  userId: string;
  entitlements: EntitlementContext;
  /** Present only when active workspace is a company */
  companyId: string | null;
  companyName: string | null;
  role: string | null;
};

/**
 * Gate a feature by plan entitlement without forcing a company workspace
 * when the feature is personal-capable and not company-resource-owned.
 */
export async function requireEntitledFeature(
  userId: string,
  feature: FeatureKey,
): Promise<EntitledFeatureContext> {
  if (!isPersonalApiCapable(feature)) {
    const company = await requireCompanyFeature(userId, feature);
    return {
      userId,
      entitlements: company.entitlements,
      companyId: company.companyId,
      companyName: company.companyName,
      role: company.role,
    };
  }

  const entitlements = await resolveEntitlements(
    userId,
    await getCompanyContextOptions(),
  );
  assertEntitlement(entitlements, feature);

  if (entitlements.subject.type === "company") {
    return {
      userId,
      entitlements,
      companyId: entitlements.subject.id,
      companyName: entitlements.subject.name?.trim() || "Firma",
      role: null,
    };
  }

  return {
    userId,
    entitlements,
    companyId: null,
    companyName: null,
    role: null,
  };
}

/** @deprecated Ownership now supported via resource-owner.ts — kept for call-site safety. */
export function companyOwnedResourceMessage(feature: FeatureKey): string {
  throw new EntitlementError(
    "FEATURE_NOT_AVAILABLE",
    `Bu özellik firma kaynaklıdır: ${feature}`,
    403,
  );
}
