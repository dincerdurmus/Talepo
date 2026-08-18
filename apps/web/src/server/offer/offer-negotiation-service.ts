import type { Prisma } from "@/generated/prisma/client";
import { isPrismaUniqueViolation } from "@/lib/observability/idempotency";
import {
  resolveOfferCommercialAmount,
  negotiationAmountsEqual,
  roundOfferAmount,
} from "@/lib/offer/commercial-amount";
import {
  NEGOTIABLE_OFFER_STATUSES,
  OPEN_REQUEST_FOR_OFFER_STATUSES,
  OFFER_NEGOTIATION_CLOSED_MESSAGE,
  OFFER_NEGOTIATION_PENDING_EXISTS_MESSAGE,
  OFFER_NEGOTIATION_PROVIDER_FIRST_MESSAGE,
  OFFER_NEGOTIATION_SAME_AMOUNT_MESSAGE,
  OFFER_NEGOTIATION_TURN_MESSAGE,
} from "@/lib/offer/offer-negotiation";
import { DomainError, DomainErrorCode } from "@/lib/observability/errors";
import { prisma } from "@/lib/prisma";
import { acceptOffer, OfferValidationError } from "@/server/offer/offer-service";
import { resolveNegotiationActorSide } from "@/server/offer/offer-negotiation-access";
import {
  notifyNegotiationAccepted,
  notifyNegotiationProposed,
  notifyNegotiationRejected,
} from "@/server/offer/offer-negotiation-notifications";

type Tx = Prisma.TransactionClient;

function validateCounterAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new OfferValidationError(["Geçerli bir karşı teklif tutarı girin."]);
  }
  const rounded = roundOfferAmount(amount);
  if (rounded <= 0) {
    throw new OfferValidationError(["Geçerli bir karşı teklif tutarı girin."]);
  }
  if (Math.abs(amount - rounded) > 0.001) {
    throw new OfferValidationError(["Karşı teklif tutarı en fazla kuruş hassasiyetinde olabilir."]);
  }
  return rounded;
}

async function loadNegotiableOffer(offerId: string) {
  return prisma.offer.findFirst({
    where: { id: offerId },
    select: {
      id: true,
      requestId: true,
      submittedById: true,
      companyId: true,
      amount: true,
      currency: true,
      status: true,
      request: {
        select: {
          id: true,
          title: true,
          createdById: true,
          deletedAt: true,
          status: true,
        },
      },
    },
  });
}

function assertOfferOpenForNegotiation(
  offer: NonNullable<Awaited<ReturnType<typeof loadNegotiableOffer>>>,
) {
  if (
    !NEGOTIABLE_OFFER_STATUSES.includes(
      offer.status as (typeof NEGOTIABLE_OFFER_STATUSES)[number],
    )
  ) {
    throw new OfferValidationError([OFFER_NEGOTIATION_CLOSED_MESSAGE]);
  }
  if (offer.request.deletedAt) {
    throw new OfferValidationError([OFFER_NEGOTIATION_CLOSED_MESSAGE]);
  }
  if (
    !OPEN_REQUEST_FOR_OFFER_STATUSES.includes(
      offer.request.status as (typeof OPEN_REQUEST_FOR_OFFER_STATUSES)[number],
    )
  ) {
    throw new OfferValidationError([OFFER_NEGOTIATION_CLOSED_MESSAGE]);
  }
}

export async function proposeOfferNegotiation(
  userId: string,
  offerId: string,
  rawAmount: number,
) {
  const amount = validateCounterAmount(rawAmount);
  const offer = await loadNegotiableOffer(offerId);
  if (!offer) {
    throw new OfferValidationError(["Teklif bulunamadı."]);
  }

  const side = await resolveNegotiationActorSide(offer, userId);
  if (!side) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: "Bu teklifte pazarlık yapamazsınız.",
    });
  }

  assertOfferOpenForNegotiation(offer);

  if (negotiationAmountsEqual(offer.amount.toString(), amount)) {
    throw new OfferValidationError([OFFER_NEGOTIATION_SAME_AMOUNT_MESSAGE]);
  }

  const now = new Date();

  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Offer" WHERE id = ${offer.id} FOR UPDATE`;

      const fresh = await tx.offer.findFirst({
        where: {
          id: offer.id,
          status: { in: [...NEGOTIABLE_OFFER_STATUSES] },
          request: {
            deletedAt: null,
            status: { in: [...OPEN_REQUEST_FOR_OFFER_STATUSES] },
          },
        },
        select: { id: true, status: true, amount: true, currency: true },
      });
      if (!fresh) {
        throw new OfferValidationError([OFFER_NEGOTIATION_CLOSED_MESSAGE]);
      }

      const pending = await tx.offerNegotiation.findFirst({
        where: { offerId: offer.id, status: "PENDING" },
      });

      if (!pending && side !== "BUYER") {
        throw new OfferValidationError([OFFER_NEGOTIATION_PROVIDER_FIRST_MESSAGE]);
      }

      if (pending) {
        if (pending.proposedBySide === side) {
          throw new OfferValidationError([OFFER_NEGOTIATION_TURN_MESSAGE]);
        }
        if (negotiationAmountsEqual(pending.amount.toString(), amount)) {
          throw new OfferValidationError([OFFER_NEGOTIATION_SAME_AMOUNT_MESSAGE]);
        }
        const superseded = await tx.offerNegotiation.updateMany({
          where: { id: pending.id, status: "PENDING" },
          data: { status: "SUPERSEDED", respondedAt: now },
        });
        if (superseded.count !== 1) {
          throw new OfferValidationError([OFFER_NEGOTIATION_PENDING_EXISTS_MESSAGE]);
        }
      }

      return tx.offerNegotiation.create({
        data: {
          offerId: offer.id,
          requestId: offer.requestId,
          proposedByUserId: userId,
          proposedBySide: side,
          amount,
          currency: offer.currency,
          status: "PENDING",
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          proposedBySide: true,
          status: true,
        },
      });
    });

    await notifyNegotiationProposed({
      actorUserId: userId,
      actorSide: side,
      offer,
      negotiationId: created.id,
      amount: created.amount,
      currency: created.currency,
    });

    return created;
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      throw new OfferValidationError([OFFER_NEGOTIATION_PENDING_EXISTS_MESSAGE]);
    }
    throw error;
  }
}

export async function rejectPendingNegotiation(userId: string, offerId: string) {
  const offer = await loadNegotiableOffer(offerId);
  if (!offer) {
    throw new OfferValidationError(["Teklif bulunamadı."]);
  }

  const side = await resolveNegotiationActorSide(offer, userId);
  if (!side) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: "Bu karşı teklife yanıt veremezsiniz.",
    });
  }

  assertOfferOpenForNegotiation(offer);
  const now = new Date();

  const pending = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Offer" WHERE id = ${offer.id} FOR UPDATE`;
    const row = await tx.offerNegotiation.findFirst({
      where: { offerId: offer.id, status: "PENDING" },
    });
    if (!row) {
      throw new OfferValidationError(["Yanıt bekleyen karşı teklif yok."]);
    }
    if (row.proposedBySide === side) {
      throw new OfferValidationError([OFFER_NEGOTIATION_TURN_MESSAGE]);
    }
    const updated = await tx.offerNegotiation.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "REJECTED", respondedAt: now },
    });
    if (updated.count !== 1) {
      throw new OfferValidationError(["Karşı teklif artık beklenmiyor."]);
    }
    return row;
  });

  await notifyNegotiationRejected({
    actorUserId: userId,
    offer,
    negotiationId: pending.id,
    proposedByUserId: pending.proposedByUserId,
    proposedBySide: pending.proposedBySide,
    amount: pending.amount,
    currency: pending.currency,
  });

  return { id: pending.id, status: "REJECTED" as const };
}

export async function acceptPendingNegotiation(userId: string, offerId: string) {
  const offer = await loadNegotiableOffer(offerId);
  if (!offer) {
    throw new OfferValidationError(["Teklif bulunamadı."]);
  }

  const side = await resolveNegotiationActorSide(offer, userId);
  if (!side) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: "Bu karşı teklifi kabul edemezsiniz.",
    });
  }

  const pending = await prisma.offerNegotiation.findFirst({
    where: { offerId: offer.id, status: "PENDING" },
  });
  if (!pending) {
    throw new OfferValidationError(["Yanıt bekleyen karşı teklif yok."]);
  }
  if (pending.proposedBySide === side) {
    throw new OfferValidationError([OFFER_NEGOTIATION_TURN_MESSAGE]);
  }

  const result = await acceptOffer(userId, offerId, {
    negotiationId: pending.id,
  });

  await notifyNegotiationAccepted({
    actorUserId: userId,
    offer,
    negotiationId: pending.id,
    proposedByUserId: pending.proposedByUserId,
    amount: pending.amount,
    currency: pending.currency,
    conversationId: result.conversationId,
  });

  return result;
}

export async function cancelPendingNegotiationsInTx(
  tx: Tx,
  offerIds: string[],
  now: Date,
) {
  if (offerIds.length === 0) return;
  await tx.offerNegotiation.updateMany({
    where: { offerId: { in: offerIds }, status: "PENDING" },
    data: { status: "CANCELLED", respondedAt: now },
  });
}

export function commercialAmountFromNegotiations(
  offerAmount: number | string,
  negotiations: { status: string; amount: unknown }[],
) {
  const accepted = negotiations.find((row) => row.status === "ACCEPTED");
  return resolveOfferCommercialAmount({
    offerAmount,
    acceptedNegotiationAmount: accepted ? Number(accepted.amount) : null,
  });
}
