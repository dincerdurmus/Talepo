import type { Prisma } from "@/generated/prisma/client";
import { resolveStoredPlanTier } from "@/lib/membership/plan-tier-utils";
import {
  buildSeatUsage,
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
  const { company, addon, workspace } = await loadWorkspaceSeatContext(
    input.companyId,
    db,
  );
  return buildSeatUsage({
    planTier: resolveStoredPlanTier(company?.planTier),
    workspaceEffectivePlanTier: workspace.effectivePlanTier,
    activeSeats,
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
  db?: Tx | typeof prisma;
}): Promise<SeatUsage> {
  const usage = await getCompanySeatUsage(input);
  if (usage.includedSeats != null && usage.atLimit) {
    throw new EntitlementError(
      "SEAT_LIMIT_REACHED",
      usage.extraSeatsPurchased > 0
        ? `Firma çalışma alanında ${usage.includedSeats} ekip koltuğu bulunuyor.`
        : "Ek koltuk gerekli. Extra seat satın alma henüz açık değil.",
      403,
    );
  }
  return usage;
}
