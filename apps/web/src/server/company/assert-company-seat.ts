import type { Prisma } from "@/generated/prisma/client";
import type { PlanTierId } from "@/lib/membership/plans";
import {
  buildSeatUsage,
  type SeatUsage,
} from "@/lib/membership/seat-policy";
import { EntitlementError } from "@/lib/membership/types";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export async function countActiveCompanySeats(
  companyId: string,
  db: Tx | typeof prisma = prisma,
): Promise<number> {
  // @@unique([companyId, userId]) → one row per user; no double-count.
  return db.companyMember.count({
    where: {
      companyId,
      status: "ACTIVE",
    },
  });
}

export async function getCompanySeatUsage(input: {
  companyId: string;
  planTier: PlanTierId;
  db?: Tx | typeof prisma;
}): Promise<SeatUsage> {
  const activeSeats = await countActiveCompanySeats(
    input.companyId,
    input.db ?? prisma,
  );
  return buildSeatUsage({
    planTier: input.planTier,
    activeSeats,
  });
}

/**
 * Gate before INVITED → ACTIVE (or any new ACTIVE seat).
 * Pending INVITED does not consume seats.
 */
export async function assertCanActivateCompanySeat(input: {
  companyId: string;
  planTier: PlanTierId;
  db?: Tx | typeof prisma;
}): Promise<SeatUsage> {
  const usage = await getCompanySeatUsage(input);
  if (usage.includedSeats != null && usage.activeSeats >= usage.includedSeats) {
    throw new EntitlementError(
      "SEAT_LIMIT_REACHED",
      `Kurumsal planınızda ${usage.includedSeats} ekip koltuğu bulunuyor.`,
      403,
    );
  }
  return usage;
}
