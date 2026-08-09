import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertCanAccessRequest,
  assertCanSubmitOffer,
} from "@/lib/membership/assert-entitlement";
import { containsBlockedContactInfo, sanitizeCommercialText } from "@/lib/membership/contact-filter";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { EntitlementError, type EntitlementContext } from "@/lib/membership/types";

import { createNotification } from "../notifications/create-notification";

export class OfferQuotaExceededError extends Error {
  constructor(message = "Aylık ücretsiz teklif hakkınız doldu.") {
    super(message);
    this.name = "OfferQuotaExceededError";
  }
}

export class OfferValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(issues[0] ?? "Teklif bilgileri geçersiz.");
    this.name = "OfferValidationError";
    this.issues = issues;
  }
}

type CreateOfferInput = {
  requestId: string;
  description: string;
  amount: number;
  deliveryDays?: number;
  title?: string;
};

type Tx = Prisma.TransactionClient;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function lockEntitlementSubject(tx: Tx, ctx: EntitlementContext) {
  if (ctx.subject.type === "company") {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${ctx.subject.id} FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ctx.subject.id} FOR UPDATE`;
  }
}

async function countUsedOffersInTx(
  tx: Tx,
  ctx: EntitlementContext,
  monthStart: Date,
) {
  if (ctx.subject.type === "company") {
    return tx.offer.count({
      where: {
        companyId: ctx.subject.id,
        submittedAt: { gte: monthStart },
        status: { notIn: ["DRAFT", "WITHDRAWN"] },
      },
    });
  }

  return tx.offer.count({
    where: {
      submittedById: ctx.userId,
      companyId: null,
      submittedAt: { gte: monthStart },
      status: { notIn: ["DRAFT", "WITHDRAWN"] },
    },
  });
}

async function readBonusCreditsInTx(tx: Tx, ctx: EntitlementContext) {
  if (ctx.subject.type === "company") {
    const company = await tx.company.findUnique({
      where: { id: ctx.subject.id },
      select: { bonusOfferCredits: true },
    });
    return company?.bonusOfferCredits ?? 0;
  }

  const user = await tx.user.findUnique({
    where: { id: ctx.userId },
    select: { bonusOfferCredits: true },
  });
  return user?.bonusOfferCredits ?? 0;
}

export async function createOffer(userId: string, input: CreateOfferInput) {
  const issues: string[] = [];

  if (!input.requestId) issues.push("Talep bilgisi eksik.");
  if (!input.description || input.description.trim().length < 10) {
    issues.push("Teklif açıklaması en az 10 karakter olmalı.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    issues.push("Geçerli bir teklif tutarı girin.");
  }
  if (containsBlockedContactInfo(input.description)) {
    issues.push(
      "Teklif metninde telefon, IBAN veya platform dışı iletişim bilgisi paylaşılamaz.",
    );
  }

  if (issues.length) {
    throw new OfferValidationError(issues);
  }

  const entitlements = await resolveEntitlements(
    userId,
    await getCompanyContextOptions(),
  );

  try {
    assertCanSubmitOffer(entitlements);
  } catch (error) {
    if (error instanceof EntitlementError && error.code === "OFFER_QUOTA_EXCEEDED") {
      throw new OfferQuotaExceededError(error.message);
    }
    throw error;
  }

  const request = await prisma.request.findFirst({
    where: {
      id: input.requestId,
      deletedAt: null,
      createdById: { not: userId },
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
    },
    select: {
      id: true,
      title: true,
      createdById: true,
      visibleToSuppliersAt: true,
    },
  });

  if (!request) {
    throw new OfferValidationError(["Talep bulunamadı veya teklife kapalı."]);
  }

  try {
    assertCanAccessRequest(entitlements, request);
  } catch (error) {
    if (error instanceof EntitlementError) {
      throw new OfferValidationError([error.message]);
    }
    throw error;
  }

  const existingOffer = await prisma.offer.findFirst({
    where: {
      requestId: input.requestId,
      submittedById: userId,
      status: { notIn: ["WITHDRAWN", "REJECTED", "EXPIRED"] },
    },
    select: { id: true },
  });

  if (existingOffer) {
    throw new OfferValidationError(["Bu talebe zaten teklif verdiniz."]);
  }

  const sanitizedDescription = sanitizeCommercialText(input.description.trim());
  const now = new Date();
  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const offer = await prisma.$transaction(async (tx) => {
    // Serialize concurrent offer submissions for the same quota subject.
    await lockEntitlementSubject(tx, entitlements);

    // Re-check quota under lock (race-safe).
    if (!entitlements.quota.isUnlimited && entitlements.quota.limit !== null) {
      const monthStart = startOfMonth(now);
      const used = await countUsedOffersInTx(tx, entitlements, monthStart);
      const bonusCredits = await readBonusCreditsInTx(tx, entitlements);
      const remaining =
        Math.max(0, entitlements.quota.limit - used) + Math.max(0, bonusCredits);

      if (remaining <= 0) {
        throw new OfferQuotaExceededError();
      }
    }

    const created = await tx.offer.create({
      data: {
        requestId: input.requestId,
        submittedById: userId,
        companyId,
        title: input.title?.trim() || null,
        description: sanitizedDescription,
        amount: input.amount,
        deliveryDays: input.deliveryDays,
        status: "SUBMITTED",
        submittedAt: now,
      },
      select: {
        id: true,
        requestId: true,
        amount: true,
        currency: true,
      },
    });

    await tx.request.update({
      where: { id: input.requestId },
      data: {
        offerCount: { increment: 1 },
        status: "RECEIVING_OFFERS",
      },
    });

    /**
     * Consume bonus only after included monthly quota is exhausted.
     * Unlimited plans never consume bonus.
     * usedBefore = offers already counted before this create.
     */
    if (!entitlements.quota.isUnlimited && entitlements.quota.limit !== null) {
      const monthStart = startOfMonth(now);
      const usedAfter = await countUsedOffersInTx(tx, entitlements, monthStart);
      const usedBefore = Math.max(0, usedAfter - 1);

      if (usedBefore >= entitlements.quota.limit) {
        if (entitlements.subject.type === "company") {
          const updated = await tx.company.updateMany({
            where: {
              id: entitlements.subject.id,
              bonusOfferCredits: { gt: 0 },
            },
            data: { bonusOfferCredits: { decrement: 1 } },
          });
          if (updated.count === 0) {
            throw new OfferQuotaExceededError();
          }
        } else {
          const updated = await tx.user.updateMany({
            where: {
              id: userId,
              bonusOfferCredits: { gt: 0 },
            },
            data: { bonusOfferCredits: { decrement: 1 } },
          });
          if (updated.count === 0) {
            throw new OfferQuotaExceededError();
          }
        }
      }
    }

    return created;
  });

  await createNotification({
    userId: request.createdById,
    type: "NEW_OFFER",
    title: "Talebinize yeni teklif geldi",
    message: `“${request.title}” talebinize yeni bir teklif gönderildi.`,
    actionUrl: `/panel/taleplerim/${request.id}`,
    requestId: request.id,
    offerId: offer.id,
    companyId: companyId ?? undefined,
  });

  return offer;
}

export async function acceptOffer(userId: string, offerId: string) {
  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      status: { in: ["SUBMITTED", "VIEWED"] },
      request: {
        createdById: userId,
        deletedAt: null,
      },
    },
    include: {
      request: { select: { id: true, title: true } },
      submittedBy: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
  });

  if (!offer) {
    throw new OfferValidationError(["Teklif bulunamadı veya kabul edilemez durumda."]);
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const accepted = await tx.offer.update({
      where: { id: offerId },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
      },
    });

    await tx.offer.updateMany({
      where: {
        requestId: offer.requestId,
        id: { not: offerId },
        status: { in: ["SUBMITTED", "VIEWED"] },
      },
      data: {
        status: "REJECTED",
        rejectedAt: now,
      },
    });

    await tx.request.update({
      where: { id: offer.requestId },
      data: {
        status: "OFFER_SELECTED",
      },
    });

    const conversation = await tx.conversation.create({
      data: {
        offerId: offer.id,
        title: offer.request.title,
        lastMessageAt: now,
        participants: {
          create: [
            { userId },
            { userId: offer.submittedById },
            ...(offer.companyId ? [{ companyId: offer.companyId }] : []),
          ],
        },
      },
    });

    await createNotification({
      userId: offer.submittedById,
      type: "OFFER_ACCEPTED",
      title: "Teklifiniz kabul edildi",
      message: `“${offer.request.title}” talebi için teklifiniz kabul edildi. Mesajlaşma açıldı.`,
      actionUrl: `/panel/mesajlar/${conversation.id}`,
      requestId: offer.requestId,
      offerId: offer.id,
      companyId: offer.companyId ?? undefined,
    });

    return { offer: accepted, conversationId: conversation.id };
  });
}

export async function rejectOffer(userId: string, offerId: string) {
  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      status: { in: ["SUBMITTED", "VIEWED"] },
      request: { createdById: userId, deletedAt: null },
    },
    include: {
      request: { select: { id: true, title: true } },
    },
  });

  if (!offer) {
    throw new OfferValidationError(["Teklif bulunamadı."]);
  }

  const updated = await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
    },
  });

  await createNotification({
    userId: offer.submittedById,
    type: "OFFER_REJECTED",
    title: "Teklifiniz reddedildi",
    message: `“${offer.request.title}” talebi için teklifiniz reddedildi.`,
    actionUrl: `/panel/talepler/${offer.requestId}`,
    requestId: offer.requestId,
    offerId: offer.id,
  });

  return updated;
}
