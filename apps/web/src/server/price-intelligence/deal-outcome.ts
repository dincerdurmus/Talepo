import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  DealOutcomeStatus,
  TransactionConfirmationLevel,
} from "@/lib/price-intelligence/types";

import { recordConfirmedTransactionObservation } from "./record-observation";

export type DealConfirmationResponse =
  | "COMPLETED"
  | "CANCELLED"
  | "PRICE_DISAGREEMENT"
  | "PRODUCT_UNAVAILABLE"
  | "NO_RESPONSE"
  | "PENDING";

const RESPONSE_TO_STATUS: Record<DealConfirmationResponse, DealOutcomeStatus> = {
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  PRICE_DISAGREEMENT: "PRICE_DISAGREEMENT",
  PRODUCT_UNAVAILABLE: "PRODUCT_UNAVAILABLE",
  NO_RESPONSE: "NO_RESPONSE",
  PENDING: "PENDING",
};

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

export async function getDealOutcomeForConversation(conversationId: string) {
  return prisma.dealOutcome.findUnique({
    where: { conversationId },
    select: {
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
    },
  });
}

export async function submitDealConfirmation(input: {
  dealOutcomeId: string;
  role: "buyer" | "supplier";
  response: DealConfirmationResponse;
  agreedPrice?: number | null;
  userId: string;
  companyId?: string | null;
}) {
  const deal = await prisma.dealOutcome.findUnique({
    where: { id: input.dealOutcomeId },
    include: {
      offer: { select: { submittedById: true, companyId: true, amount: true } },
    },
  });

  if (!deal) {
    throw new Error("İşlem kaydı bulunamadı.");
  }

  if (input.role === "buyer" && deal.buyerUserId !== input.userId) {
    throw new Error("Bu işlem için alıcı teyidi veremezsiniz.");
  }

  if (input.role === "supplier") {
    const isSupplier =
      deal.offer.submittedById === input.userId ||
      (input.companyId != null && deal.offer.companyId === input.companyId);
    if (!isSupplier) {
      throw new Error("Bu işlem için firma teyidi veremezsiniz.");
    }
  }

  const now = new Date();
  const status = RESPONSE_TO_STATUS[input.response];

  const data: Prisma.DealOutcomeUpdateInput = {
    status,
    buyerConfirmedAt:
      input.role === "buyer" ? now : deal.buyerConfirmedAt,
    supplierConfirmedAt:
      input.role === "supplier" ? now : deal.supplierConfirmedAt,
  };

  if (status === "COMPLETED") {
    data.completedAt = now;
    data.agreedPrice =
      input.agreedPrice ??
      deal.agreedPrice?.toNumber() ??
      deal.offer.amount.toNumber();
  }

  const buyerConfirmedAt =
    input.role === "buyer" ? now : deal.buyerConfirmedAt;
  const supplierConfirmedAt =
    input.role === "supplier" ? now : deal.supplierConfirmedAt;

  data.confirmationLevel = resolveConfirmationLevel({
    buyerConfirmedAt,
    supplierConfirmedAt,
  });

  const updated = await prisma.dealOutcome.update({
    where: { id: input.dealOutcomeId },
    data,
    select: {
      id: true,
      status: true,
      agreedPrice: true,
      confirmationLevel: true,
      buyerConfirmedAt: true,
      supplierConfirmedAt: true,
    },
  });

  if (
    updated.status === "COMPLETED" &&
    updated.confirmationLevel === "BOTH_CONFIRMED"
  ) {
    try {
      await recordConfirmedTransactionObservation(updated.id);
    } catch (error) {
      console.error("[deal-outcome] confirmed transaction observation failed", error);
    }
  }

  return updated;
}
