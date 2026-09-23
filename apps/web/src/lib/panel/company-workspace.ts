import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { canMutateCompanyWorkspace, normalizeCompanyRole } from "@/lib/membership/company-permissions";
import { isWorkspaceEligible } from "@/lib/membership/plans";
import type { PlanTierId } from "@/lib/membership/plans";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { prisma } from "@/lib/prisma";

export type CompanyWorkspace = {
  companyId: string;
  companyName: string;
  isCorporate: boolean;
  /** Company subject effective plan (workspace isolation). */
  planTier: PlanTierId;
  features: Awaited<ReturnType<typeof resolveEntitlements>>["features"];
  role: string | null;
  canWrite: boolean;
};

/** Resolve the active company subject for panel company tools. */
export async function getCompanyWorkspace(
  userId: string,
): Promise<CompanyWorkspace | null> {
  const entitlements = await resolveEntitlements(
    userId,
    await getCompanyContextOptions(),
  );

  if (entitlements.subject.type !== "company") {
    return null;
  }

  return {
    companyId: entitlements.subject.id,
    companyName: entitlements.subject.name?.trim() || "Firma",
    isCorporate: isWorkspaceEligible(entitlements.effectivePlanTier),
    planTier: entitlements.effectivePlanTier,
    features: entitlements.features,
    role: entitlements.companyRole ?? null,
    canWrite: canMutateCompanyWorkspace(entitlements.companyRole),
  };
}

export async function assertCompanyMembership(userId: string, companyId: string) {
  const membership = await prisma.companyMember.findFirst({
    where: {
      userId,
      companyId,
      status: "ACTIVE",
      company: { deletedAt: null },
    },
    select: {
      role: true,
      company: { select: { id: true, name: true } },
    },
  });
  const role = normalizeCompanyRole(membership?.role);
  return membership && role ? { ...membership, role } : null;
}

/**
 * Company write authority used by inventory create/update.
 * ACTIVE membership is required separately. VIEWER is read-only.
 * Platform ADMIN is not a membership substitute.
 */
export { canMutateCompanyWorkspace } from "@/lib/membership/company-permissions";

export {
  formatMemberRole,
  formatMemberStatus,
  formatMoney,
  formatOfferStatus,
} from "./company-format";
