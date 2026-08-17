import type { Prisma } from "@/generated/prisma/client";
import { isHiddenInventoryAddonActive } from "@/lib/membership/company-addon-policy";
import { extraSeatsCount } from "@/lib/membership/seat-policy";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export type CompanyAddonSnapshot = {
  companyId: string;
  hiddenInventoryEnabled: boolean;
  hiddenInventoryExpiresAt: Date | null;
  extraSeatsPurchased: number;
  extraSeatsExpiresAt: Date | null;
  hiddenInventoryActive: boolean;
  extraSeatsActiveCount: number;
};

type AddonPatch = {
  hiddenInventoryEnabled?: boolean;
  hiddenInventoryExpiresAt?: Date | null;
  extraSeatsPurchased?: number;
  extraSeatsExpiresAt?: Date | null;
};

const EMPTY = (companyId: string): CompanyAddonSnapshot => ({
  companyId,
  hiddenInventoryEnabled: false,
  hiddenInventoryExpiresAt: null,
  extraSeatsPurchased: 0,
  extraSeatsExpiresAt: null,
  hiddenInventoryActive: false,
  extraSeatsActiveCount: 0,
});

function toSnapshot(
  companyId: string,
  row: {
    hiddenInventoryEnabled: boolean;
    hiddenInventoryExpiresAt: Date | null;
    extraSeatsPurchased: number;
    extraSeatsExpiresAt: Date | null;
  } | null,
  now = new Date(),
): CompanyAddonSnapshot {
  if (!row) return EMPTY(companyId);
  return {
    companyId,
    hiddenInventoryEnabled: row.hiddenInventoryEnabled,
    hiddenInventoryExpiresAt: row.hiddenInventoryExpiresAt,
    extraSeatsPurchased: row.extraSeatsPurchased,
    extraSeatsExpiresAt: row.extraSeatsExpiresAt,
    hiddenInventoryActive: isHiddenInventoryAddonActive({
      enabled: row.hiddenInventoryEnabled,
      expiresAt: row.hiddenInventoryExpiresAt,
      now,
    }),
    extraSeatsActiveCount: extraSeatsCount(
      row.extraSeatsPurchased,
      row.extraSeatsExpiresAt,
      now,
    ),
  };
}

export async function getCompanyAddonSnapshot(
  companyId: string,
  db: Db = prisma,
  now = new Date(),
): Promise<CompanyAddonSnapshot> {
  const row = await db.companyAddonEntitlement.findUnique({
    where: { companyId },
    select: {
      hiddenInventoryEnabled: true,
      hiddenInventoryExpiresAt: true,
      extraSeatsPurchased: true,
      extraSeatsExpiresAt: true,
    },
  });
  return toSnapshot(companyId, row, now);
}

async function upsertAddon(companyId: string, patch: AddonPatch, db: Db = prisma) {
  const current = await db.companyAddonEntitlement.findUnique({
    where: { companyId },
    select: {
      hiddenInventoryEnabled: true,
      hiddenInventoryExpiresAt: true,
      extraSeatsPurchased: true,
      extraSeatsExpiresAt: true,
    },
  });
  const next = {
    hiddenInventoryEnabled:
      patch.hiddenInventoryEnabled ?? current?.hiddenInventoryEnabled ?? false,
    hiddenInventoryExpiresAt:
      patch.hiddenInventoryExpiresAt === undefined
        ? (current?.hiddenInventoryExpiresAt ?? null)
        : patch.hiddenInventoryExpiresAt,
    extraSeatsPurchased:
      patch.extraSeatsPurchased ?? current?.extraSeatsPurchased ?? 0,
    extraSeatsExpiresAt:
      patch.extraSeatsExpiresAt === undefined
        ? (current?.extraSeatsExpiresAt ?? null)
        : patch.extraSeatsExpiresAt,
  };
  return db.companyAddonEntitlement.upsert({
    where: { companyId },
    create: { companyId, ...next },
    update: next,
  });
}

/** Server grant path for future webhook. Does not delete inventory rows. */
export async function grantHiddenInventoryAddon(
  companyId: string,
  expiresAt: Date | null = null,
  db: Db = prisma,
) {
  await upsertAddon(
    companyId,
    {
      hiddenInventoryEnabled: true,
      hiddenInventoryExpiresAt: expiresAt,
    },
    db,
  );
}

/** Server revoke path for future webhook. Inventory rows are kept. */
export async function revokeHiddenInventoryAddon(
  companyId: string,
  db: Db = prisma,
) {
  await upsertAddon(companyId, { hiddenInventoryEnabled: false }, db);
}

export async function setPurchasedExtraSeats(
  companyId: string,
  count: number,
  expiresAt: Date | null = null,
  db: Db = prisma,
) {
  await upsertAddon(
    companyId,
    {
      extraSeatsPurchased: Math.max(0, Math.floor(count) || 0),
      extraSeatsExpiresAt: expiresAt,
    },
    db,
  );
}
