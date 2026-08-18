import type { OfferInboxRole } from "@/lib/offer/offer-event-unread";
import {
  canArchiveOffer,
  isArchivableOfferStatus,
  type OfferArchiveScope,
} from "@/lib/offer/offer-archive";
import {
  isActionRequiredOffer,
  type OfferCardInput,
} from "@/lib/offer/offer-card-status";
import { isOfferUnreadForRole } from "@/lib/offer/offer-event-unread";
import { prisma } from "@/lib/prisma";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";
import { assertOfferSeenAuthority } from "@/server/notifications/mark-offer-notifications-read";

function toNegotiationDtos(
  rows: Array<{
    id: string;
    amount: unknown;
    currency: string;
    status: OfferNegotiationDto["status"];
    proposedBySide: OfferNegotiationDto["proposedBySide"];
    createdAt: Date;
  }>,
): OfferNegotiationDto[] {
  return rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    proposedBySide: row.proposedBySide,
    createdAt: row.createdAt.toISOString(),
  }));
}

type ArchiveOfferRow = OfferCardInput & {
  id: string;
  submittedById: string;
  companyId: string | null;
  dealOutcome?: { status: string } | null;
};

export async function listArchivedOfferIds(scope: OfferArchiveScope) {
  const rows = await prisma.offerArchive.findMany({
    where: {
      userId: scope.userId,
      companyId: scope.companyId,
    },
    select: { offerId: true },
  });
  return new Set(rows.map((row) => row.offerId));
}

export async function isOfferArchived(scope: OfferArchiveScope, offerId: string) {
  const row = await prisma.offerArchive.findFirst({
    where: {
      userId: scope.userId,
      offerId,
      companyId: scope.companyId,
    },
    select: { id: true },
  });
  return Boolean(row);
}

export function resolveArchiveScope(input: {
  userId: string;
  companyId: string | null;
}): OfferArchiveScope {
  return {
    userId: input.userId,
    companyId: input.companyId,
  };
}

export async function assertOfferArchiveAuthority(input: {
  userId: string;
  offerId: string;
  role: OfferInboxRole;
}) {
  return assertOfferSeenAuthority(input);
}

function dealCompleted(dealOutcome?: { status: string } | null) {
  return dealOutcome?.status === "COMPLETED";
}

export async function archiveOfferForUser(input: {
  userId: string;
  offerId: string;
  role: OfferInboxRole;
  companyId: string | null;
  unreadOfferIds: ReadonlySet<string>;
}) {
  const offer = await prisma.offer.findFirst({
    where: { id: input.offerId },
    select: {
      id: true,
      status: true,
      submittedById: true,
      companyId: true,
      negotiations: {
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          proposedBySide: true,
          createdAt: true,
        },
      },
      dealOutcome: { select: { status: true } },
    },
  });
  if (!offer) {
    return { ok: false as const, status: 404, message: "Teklif bulunamadı." };
  }

  const cardInput: OfferCardInput = {
    status: offer.status,
    negotiations: toNegotiationDtos(offer.negotiations),
  };
  const isUnread = isOfferUnreadForRole(input.offerId, input.unreadOfferIds);
  const isActionRequired = isActionRequiredOffer(input.role, cardInput);
  const archivable = canArchiveOffer({
    offer: cardInput,
    isUnread,
    isActionRequired,
    dealCompleted: dealCompleted(offer.dealOutcome),
  });

  if (!archivable) {
    return {
      ok: false as const,
      status: 409,
      message: "Bu teklif arşivlenemez.",
    };
  }

  const scope = resolveArchiveScope({
    userId: input.userId,
    companyId: input.companyId,
  });

  const existing = await prisma.offerArchive.findFirst({
    where: {
      userId: scope.userId,
      offerId: input.offerId,
      companyId: scope.companyId,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.offerArchive.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });
  } else {
    await prisma.offerArchive.create({
      data: {
        userId: scope.userId,
        offerId: input.offerId,
        companyId: scope.companyId,
      },
    });
  }

  return { ok: true as const, status: 200 };
}

export async function unarchiveOfferForUser(input: {
  userId: string;
  offerId: string;
  companyId: string | null;
}) {
  const scope = resolveArchiveScope({
    userId: input.userId,
    companyId: input.companyId,
  });

  await prisma.offerArchive.deleteMany({
    where: {
      userId: scope.userId,
      offerId: input.offerId,
      companyId: scope.companyId,
    },
  });

  return { ok: true as const, status: 200 };
}

/** Auto-restore archived terminal offers when a fresh inbox event arrives. */
export async function unarchiveOfferOnNewEvent(input: {
  userId: string;
  offerId: string;
  companyId?: string | null;
}) {
  await prisma.offerArchive.deleteMany({
    where: {
      userId: input.userId,
      offerId: input.offerId,
      companyId: input.companyId ?? null,
    },
  });
}

export function isOfferEligibleForArchiveRow(
  offer: ArchiveOfferRow,
  role: OfferInboxRole,
  unreadOfferIds: ReadonlySet<string>,
) {
  const cardInput: OfferCardInput = {
    status: offer.status,
    negotiations: offer.negotiations,
  };
  return canArchiveOffer({
    offer: cardInput,
    isUnread: isOfferUnreadForRole(offer.id, unreadOfferIds),
    isActionRequired: isActionRequiredOffer(role, cardInput),
    dealCompleted: dealCompleted(offer.dealOutcome ?? null),
  });
}

export { isArchivableOfferStatus };
