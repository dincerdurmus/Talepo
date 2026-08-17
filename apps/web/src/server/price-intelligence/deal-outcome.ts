import {
  BILATERAL_COMPLETED_WHERE,
  DEAL_COMPLETION_FORBIDDEN_MESSAGE,
  DEAL_COMPLETION_NOT_ELIGIBLE_MESSAGE,
  isBilateralDealCompleted,
} from "@/lib/offer/deal-completion";
import { DomainError, DomainErrorCode } from "@/lib/observability/errors";
import { prisma } from "@/lib/prisma";
import type { TransactionConfirmationLevel } from "@/lib/price-intelligence/types";
import { createNotification } from "@/server/notifications/create-notification";
import { resolveNegotiationActorSide } from "@/server/offer/offer-negotiation-access";

import { recordConfirmedTransactionObservation } from "./record-observation";

function resolveConfirmationLevel(input: {
  buyerConfirmedAt: Date | null;
  supplierConfirmedAt: Date | null;
}): TransactionConfirmationLevel {
  const buyer = Boolean(input.buyerConfirmedAt);
  const supplier = Boolean(input.supplierConfirmedAt);
  if (buyer && supplier) return "BOTH_CONFIRMED";
  if (buyer) return "BUYER_CONFIRMED";
  if (supplier) return "SUPPLIER_CONFIRMED";
  return "NONE";
}

/**
 * Create a PENDING deal outcome after offer acceptance.
 * Idempotent — one outcome per accepted offer.
 * agreedPrice is a snapshot; completion must not rewrite it.
 */
export async function createPendingDealOutcome(input: {
  requestId: string;
  offerId: string;
  conversationId: string;
  buyerUserId: string;
  companyId: string | null;
  offerAmount: number;
  currency: string;
}) {
  return prisma.dealOutcome.upsert({
    where: { offerId: input.offerId },
    create: {
      requestId: input.requestId,
      offerId: input.offerId,
      conversationId: input.conversationId,
      buyerUserId: input.buyerUserId,
      companyId: input.companyId,
      status: "PENDING",
      currency: input.currency as "TRY",
      agreedPrice: input.offerAmount,
    },
    update: {
      conversationId: input.conversationId,
    },
    select: {
      id: true,
      status: true,
      confirmationLevel: true,
    },
  });
}

const dealOutcomeSelect = {
  id: true,
  status: true,
  agreedPrice: true,
  currency: true,
  confirmationLevel: true,
  buyerConfirmedAt: true,
  supplierConfirmedAt: true,
  completedAt: true,
  offerId: true,
  requestId: true,
  conversationId: true,
  buyerUserId: true,
  companyId: true,
} as const;

export async function getDealOutcomeForConversation(conversationId: string) {
  return prisma.dealOutcome.findUnique({
    where: { conversationId },
    select: dealOutcomeSelect,
  });
}

export async function assertCanAccessDealOutcome(
  userId: string,
  deal: {
    buyerUserId: string;
    offerId: string;
    offer?: {
      submittedById: string;
      companyId: string | null;
      request: { createdById: string };
    };
  },
) {
  const offer =
    deal.offer ??
    (await prisma.offer.findUnique({
      where: { id: deal.offerId },
      select: {
        submittedById: true,
        companyId: true,
        request: { select: { createdById: true } },
      },
    }));
  if (!offer) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: DEAL_COMPLETION_FORBIDDEN_MESSAGE,
    });
  }
  const side = await resolveNegotiationActorSide(
    {
      id: deal.offerId,
      submittedById: offer.submittedById,
      companyId: offer.companyId,
      request: offer.request,
    },
    userId,
  );
  if (!side) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: DEAL_COMPLETION_FORBIDDEN_MESSAGE,
    });
  }
  return side;
}

export async function confirmDealCompletion(userId: string, dealOutcomeId: string) {
  const deal = await prisma.dealOutcome.findUnique({
    where: { id: dealOutcomeId },
    include: {
      offer: {
        select: {
          id: true,
          status: true,
          submittedById: true,
          companyId: true,
          request: {
            select: {
              id: true,
              createdById: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  if (!deal) {
    throw new DomainError({
      code: DomainErrorCode.VALIDATION_FAILED,
      userMessage: "İşlem kaydı bulunamadı.",
    });
  }

  const side = await assertCanAccessDealOutcome(userId, deal);
  if (deal.offer.status !== "ACCEPTED" || deal.offer.request.deletedAt) {
    throw new DomainError({
      code: DomainErrorCode.VALIDATION_FAILED,
      userMessage: DEAL_COMPLETION_NOT_ELIGIBLE_MESSAGE,
    });
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "DealOutcome" WHERE id = ${deal.id} FOR UPDATE`;

    const fresh = await tx.dealOutcome.findUniqueOrThrow({
      where: { id: deal.id },
    });
    const offer = await tx.offer.findUnique({
      where: { id: deal.offerId },
      select: { status: true },
    });
    if (offer?.status !== "ACCEPTED") {
      throw new DomainError({
        code: DomainErrorCode.VALIDATION_FAILED,
        userMessage: DEAL_COMPLETION_NOT_ELIGIBLE_MESSAGE,
      });
    }

    let buyerConfirmedAt = fresh.buyerConfirmedAt;
    let supplierConfirmedAt = fresh.supplierConfirmedAt;
    const alreadyThisSide =
      side === "BUYER" ? Boolean(buyerConfirmedAt) : Boolean(supplierConfirmedAt);

    if (!alreadyThisSide) {
      if (side === "BUYER") buyerConfirmedAt = now;
      else supplierConfirmedAt = now;

      const claimed = await tx.dealOutcome.updateMany({
        where: {
          id: deal.id,
          ...(side === "BUYER"
            ? { buyerConfirmedAt: null }
            : { supplierConfirmedAt: null }),
        },
        data: {
          buyerConfirmedAt,
          supplierConfirmedAt,
          confirmationLevel: resolveConfirmationLevel({
            buyerConfirmedAt,
            supplierConfirmedAt,
          }),
        },
      });
      if (claimed.count !== 1) {
        const raced = await tx.dealOutcome.findUniqueOrThrow({
          where: { id: deal.id },
        });
        buyerConfirmedAt = raced.buyerConfirmedAt;
        supplierConfirmedAt = raced.supplierConfirmedAt;
      }
    }

    let justCompleted = false;
    if (buyerConfirmedAt && supplierConfirmedAt) {
      const completedRows = await tx.dealOutcome.updateMany({
        where: {
          id: deal.id,
          buyerConfirmedAt: { not: null },
          supplierConfirmedAt: { not: null },
          OR: [
            { completedAt: null },
            { confirmationLevel: { not: "BOTH_CONFIRMED" } },
          ],
        },
        data: {
          status: "COMPLETED",
          completedAt: fresh.completedAt ?? now,
          confirmationLevel: "BOTH_CONFIRMED",
        },
      });
      justCompleted = completedRows.count === 1;
      if (justCompleted) {
        await tx.request.updateMany({
          where: {
            id: deal.requestId,
            deletedAt: null,
            status: { in: ["OFFER_SELECTED", "IN_PROGRESS"] },
          },
          data: { status: "COMPLETED", completedAt: now },
        });
      }
    }

    const updated = await tx.dealOutcome.findUniqueOrThrow({
      where: { id: deal.id },
      select: dealOutcomeSelect,
    });

    return { updated, alreadyThisSide, justCompleted, side };
  });

  if (!result.alreadyThisSide) {
    await notifyDealCompletionParties({
      deal,
      actorUserId: userId,
      side: result.side,
      justCompleted: result.justCompleted,
    });
  }

  if (result.justCompleted && isBilateralDealCompleted(result.updated)) {
    try {
      await recordConfirmedTransactionObservation(result.updated.id);
    } catch (error) {
      console.error("[deal-outcome] confirmed transaction observation failed", error);
    }
  }

  return result.updated;
}

async function notifyDealCompletionParties(input: {
  deal: {
    requestId: string;
    offerId: string;
    conversationId: string | null;
    buyerUserId: string;
    companyId: string | null;
    offer: { submittedById: string };
  };
  actorUserId: string;
  side: "BUYER" | "PROVIDER";
  justCompleted: boolean;
}) {
  const otherUserId =
    input.side === "BUYER"
      ? input.deal.offer.submittedById
      : input.deal.buyerUserId;
  if (!otherUserId || otherUserId === input.actorUserId) return;

  const actionUrl = input.deal.conversationId
    ? `/panel/mesajlar/${input.deal.conversationId}`
    : "/panel/mesajlar";

  try {
    if (input.justCompleted) {
      await createNotification({
        userId: otherUserId,
        type: "DEAL_COMPLETED",
        title: "İşlem tamamlandı",
        message: "İşlem taraflarca tamamlandı olarak onaylandı.",
        actionUrl,
        requestId: input.deal.requestId,
        offerId: input.deal.offerId,
        companyId: input.deal.companyId ?? undefined,
      });
      return;
    }
    await createNotification({
      userId: otherUserId,
      type: "DEAL_COMPLETION_REQUESTED",
      title: "İşlem onayı bekleniyor",
      message: "Karşı taraf işlemin tamamlandığını onayladı.",
      actionUrl,
      requestId: input.deal.requestId,
      offerId: input.deal.offerId,
      companyId: input.deal.companyId ?? undefined,
    });
  } catch {
    /* non-blocking */
  }
}

export async function countCompletedTransactions(where: {
  companyId?: string;
  personalProviderUserId?: string;
  buyerUserId?: string;
}) {
  return prisma.dealOutcome.count({
    where: {
      ...BILATERAL_COMPLETED_WHERE,
      ...(where.companyId ? { companyId: where.companyId } : {}),
      ...(where.buyerUserId ? { buyerUserId: where.buyerUserId } : {}),
      ...(where.personalProviderUserId
        ? {
            companyId: null,
            offer: {
              submittedById: where.personalProviderUserId,
              companyId: null,
            },
          }
        : {}),
    },
  });
}

export async function loadCompletedTransactionCounts(input: {
  personalUserIds: string[];
  companyIds: string[];
}) {
  const personal = new Map<string, number>();
  const company = new Map<string, number>();
  const personalIds = [...new Set(input.personalUserIds.filter(Boolean))];
  const companyIds = [...new Set(input.companyIds.filter(Boolean))];

  await Promise.all([
    ...personalIds.map(async (userId) => {
      personal.set(
        userId,
        await countCompletedTransactions({ personalProviderUserId: userId }),
      );
    }),
    ...companyIds.map(async (companyId) => {
      company.set(companyId, await countCompletedTransactions({ companyId }));
    }),
  ]);

  return { personal, company };
}
