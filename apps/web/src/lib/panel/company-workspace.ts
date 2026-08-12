import { getCompanyContextOptions } from "@/lib/membership/company-context";
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
    isCorporate: entitlements.effectivePlanTier === "CORPORATE",
    planTier: entitlements.effectivePlanTier,
    features: entitlements.features,
  };
}

export async function assertCompanyMembership(userId: string, companyId: string) {
  return prisma.companyMember.findFirst({
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
}

export {
  formatMemberRole,
  formatMemberStatus,
  formatMoney,
  formatOfferStatus,
} from "./company-format";
