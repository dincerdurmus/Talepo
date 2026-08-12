import type { PlanTierId } from "@/lib/membership/plans";
import { prisma } from "@/lib/prisma";
import { assertCanActivateCompanySeat } from "@/server/company/assert-company-seat";
import { createNotification } from "@/server/notifications/create-notification";

export class InviteError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "InviteError";
    this.status = status;
  }
}

export async function acceptCompanyInvite(userId: string, companyId: string) {
  const outcome = await prisma.$transaction(async (tx) => {
    // Serialize seat activations per company (soft race hardening; no schema change).
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;

    const membership = await tx.companyMember.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
            status: true,
            planTier: true,
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!membership || membership.company.deletedAt) {
      throw new InviteError("Davet bulunamadı.", 404);
    }

    if (membership.status === "ACTIVE") {
      return {
        kind: "already_active" as const,
        membership,
        companyName: membership.company.name,
        inviteeLabel:
          membership.user.name?.trim() ||
          membership.user.email?.trim() ||
          "Yeni üye",
      };
    }

    if (membership.status !== "INVITED") {
      throw new InviteError("Bu davet kabul edilemez.", 409);
    }

    if (
      !["ACTIVE", "PENDING_VERIFICATION", "DRAFT"].includes(
        membership.company.status,
      )
    ) {
      throw new InviteError("Firma şu an davet kabul etmiyor.", 409);
    }

    await assertCanActivateCompanySeat({
      companyId,
      planTier: membership.company.planTier as PlanTierId,
      db: tx,
    });

    const updated = await tx.companyMember.update({
      where: { id: membership.id },
      data: {
        status: "ACTIVE",
        joinedAt: new Date(),
        removedAt: null,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    return {
      kind: "activated" as const,
      membership: updated,
      companyName: membership.company.name,
      inviteeLabel:
        membership.user.name?.trim() ||
        membership.user.email?.trim() ||
        "Yeni üye",
    };
  });

  if (outcome.kind === "already_active") {
    return { membership: outcome.membership, alreadyActive: true as const };
  }

  const managers = await prisma.companyMember.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "MANAGER"] },
      userId: { not: userId },
    },
    select: { userId: true },
  });

  await Promise.all(
    managers.map((manager) =>
      createNotification({
        userId: manager.userId,
        type: "COMPANY_MEMBER_JOINED",
        title: "Ekibe katılım",
        message: `${outcome.inviteeLabel} ${outcome.companyName} ekibine katıldı.`,
        actionUrl: "/panel/ekip",
        companyId,
      }),
    ),
  );

  await prisma.notification.updateMany({
    where: {
      userId,
      companyId,
      type: "COMPANY_INVITATION",
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  return { membership: outcome.membership, alreadyActive: false as const };
}

export async function rejectCompanyInvite(userId: string, companyId: string) {
  const membership = await prisma.companyMember.findUnique({
    where: {
      companyId_userId: { companyId, userId },
    },
    select: {
      id: true,
      status: true,
      company: { select: { deletedAt: true, name: true } },
    },
  });

  if (!membership || membership.company.deletedAt) {
    throw new InviteError("Davet bulunamadı.", 404);
  }

  if (membership.status === "REJECTED") {
    return { alreadyRejected: true as const };
  }

  if (membership.status !== "INVITED") {
    throw new InviteError("Bu davet reddedilemez.", 409);
  }

  await prisma.companyMember.update({
    where: { id: membership.id },
    data: {
      status: "REJECTED",
      removedAt: new Date(),
    },
  });

  await prisma.notification.updateMany({
    where: {
      userId,
      companyId,
      type: "COMPANY_INVITATION",
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  return { alreadyRejected: false as const, companyName: membership.company.name };
}
