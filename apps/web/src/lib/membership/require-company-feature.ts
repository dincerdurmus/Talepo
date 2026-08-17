import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { assertEntitlement } from "@/lib/membership/assert-entitlement";
import type { FeatureKey } from "@/lib/membership/entitlements";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import type { EntitlementContext } from "@/lib/membership/types";
import { EntitlementError } from "@/lib/membership/types";
import { hasHiddenInventoryAccess } from "@/lib/membership/hidden-inventory-access";
import {
  assertCompanyMembership,
  getCompanyWorkspace,
} from "@/lib/panel/company-workspace";

export type CompanyFeatureContext = {
  userId: string;
  companyId: string;
  companyName: string;
  entitlements: EntitlementContext;
  role: string;
};

/**
 * Resolve company workspace + entitlement gate for monetized features.
 * All V2 company-scoped APIs should use this.
 */
export async function requireCompanyFeature(
  userId: string,
  feature: FeatureKey,
): Promise<CompanyFeatureContext> {
  const entitlements = await resolveEntitlements(
    userId,
    await getCompanyContextOptions(),
  );

  assertEntitlement(entitlements, feature);

  if (entitlements.subject.type !== "company") {
    throw new EntitlementError(
      "PLAN_REQUIRED",
      "Bu özellik firma çalışma alanında kullanılabilir.",
      403,
    );
  }

  if (
    feature === "hidden_inventory" &&
    !hasHiddenInventoryAccess({
      effectivePlanTier: entitlements.effectivePlanTier,
      subjectType: entitlements.subject.type,
      features: entitlements.features,
    })
  ) {
    throw new EntitlementError(
      "FEATURE_NOT_AVAILABLE",
      "Gizli Envanter, firma çalışma alanında ücretli eklenti olarak açılır.",
      403,
    );
  }

  const membership = await assertCompanyMembership(
    userId,
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
    userId,
    companyId: entitlements.subject.id,
    companyName: entitlements.subject.name?.trim() || "Firma",
    entitlements,
    role: membership.role,
  };
}

export async function requireCompanyWorkspace(userId: string) {
  const workspace = await getCompanyWorkspace(userId);
  if (!workspace) {
    throw new EntitlementError(
      "PLAN_REQUIRED",
      "Firma çalışma alanı seçili değil.",
      400,
    );
  }
  return workspace;
}
