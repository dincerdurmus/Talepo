import type { Prisma } from "@/generated/prisma/client";
import { resolveStoredPlanTier } from "@/lib/membership/plan-tier-utils";
import { normalizeCompanyRole } from "@/lib/membership/company-permissions";
import {
  buildSeatUsage,
  seatPoolForRole,
  type SeatUsage,
} from "@/lib/membership/seat-policy";
import { EntitlementError } from "@/lib/membership/types";
import { resolveWorkspaceEffectivePlan } from "@/lib/membership/workspace-effective-plan";
import { prisma } from "@/lib/prisma";

import { getCompanyAddonSnapshot } from "./company-addon-entitlement";

type Tx = Prisma.TransactionClient;

export async function countActiveCompanySeats(
  companyId: string,
  db: Tx | typeof prisma = prisma,
): Promise<number> {
  return db.companyMember.count({
    where: {
      companyId,
      status: "ACTIVE",
    },
  });
}

async function loadWorkspaceSeatContext(
  companyId: string,
  db: Tx | typeof prisma,
) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      planTier: true,
      planExpiresAt: true,
    },
  });
  const owner = await db.companyMember.findFirst({
    where: { companyId, role: "OWNER", status: "ACTIVE" },
    select: {
      user: { select: { planTier: true, planExpiresAt: true } },
    },
  });
  const addon = await getCompanyAddonSnapshot(companyId, db);
  const workspace = resolveWorkspaceEffectivePlan({
    companyStoredPlanTier: resolveStoredPlanTier(company?.planTier),
    companyExpiresAt: company?.planExpiresAt ?? null,
    ownerStoredPlanTier: owner
      ? resolveStoredPlanTier(owner.user.planTier)
      : null,
    ownerExpiresAt: owner?.user.planExpiresAt ?? null,
  });
  return { company, addon, workspace };
}

export async function getCompanySeatUsage(input: {
  companyId: string;
  db?: Tx | typeof prisma;
}): Promise<SeatUsage> {
  const db = input.db ?? prisma;
  const activeSeats = await countActiveCompanySeats(input.companyId, db);
  const activeAnalysisSeats = await db.companyMember.count({
    where: { companyId: input.companyId, status: "ACTIVE", role: "VIEWER" },
  });
  const activeOwnerSeats = await db.companyMember.count({
    where: { companyId: input.companyId, status: "ACTIVE", role: "OWNER" },
  });
  const { company, addon, workspace } = await loadWorkspaceSeatContext(
    input.companyId,
    db,
  );
  return buildSeatUsage({
    planTier: resolveStoredPlanTier(company?.planTier),
    workspaceEffectivePlanTier: workspace.effectivePlanTier,
    activeSeats,
    activeOwnerSeats,
    activeAnalysisSeats,
    extraSeatsPurchased: addon.extraSeatsActiveCount,
    extraSeatsExpiresAt: addon.extraSeatsExpiresAt,
  });
}

/**
 * Canonical seat gate before INVITED → ACTIVE (or any new ACTIVE seat).
 * Pending INVITED does not consume seats.
 */
export async function assertCanActivateCompanySeat(input: {
  companyId: string;
  role: string;
  db?: Tx | typeof prisma;
}): Promise<SeatUsage> {
  const role = normalizeCompanyRole(input.role);
  if (!role) {
    throw new EntitlementError("INVALID_COMPANY_ROLE", "Geçersiz ekip rolü.", 400);
  }
  const usage = await getCompanySeatUsage(input);
  const pool = seatPoolForRole(usage, role);
  if (pool.atLimit) {
    const rolePool = role === "OWNER" ? usage.ownerSeats
      : role === "VIEWER" ? usage.analysisSeats : usage.memberSeats;
    throw new EntitlementError(
      "SEAT_LIMIT_REACHED",
      !rolePool.atLimit
        ? "Firma çalışma alanındaki koltuk dağılımı bu role uygun değil. Dahil olan dağılım 1 sahip + 3 üye + 1 analisttir. Ekip üyelerini düzenleyin."
        : role === "OWNER"
        ? "Firma çalışma alanında yalnızca 1 sahip olabilir."
        : role === "VIEWER"
        ? "Firma çalışma alanında 1 analist koltuğu bulunuyor ve bu koltuk dolu."
        : `Firma çalışma alanında ${pool.limit} üye koltuğu bulunuyor ve hepsi dolu. Sahip ve analist koltukları ek üye için kullanılamaz.`,
      403,
    );
  }
  return usage;
}
