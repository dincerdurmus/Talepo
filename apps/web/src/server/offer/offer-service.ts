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
import { createPendingDealOutcome } from "../price-intelligence/deal-outcome";
import {
  recordAcceptedOfferObservation,
  recordOfferPriceObservation,
} from "../price-intelligence/record-observation";

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

type UpdateOfferInput = {
  description: string;
  amount: number;
  deliveryDays?: number | null;
  title?: string;
};

type Tx = Prisma.TransactionClient;

const AWAITING_RESPONSE_STATUSES = ["SUBMITTED", "VIEWED"] as const;
const BLOCKING_OFFER_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "VIEWED",
  "ACCEPTED",
] as const;

function validateOfferFields(input: {
  description: string;
  amount: number;
}) {
  const issues: string[] = [];

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

  return issues;
}

/** Active offer for the current supplier subject on a request (company or personal). */
export async function findSupplierOfferOnRequest(
  userId: string,
  requestId: string,
) {
  const entitlements = await resolveEntitlements(
    userId,
    await getCompanyContextOptions(),
  );

  if (entitlements.subject.type === "company") {
    return prisma.offer.findFirst({
      where: {
        requestId,
        companyId: entitlements.subject.id,
        status: { not: "DRAFT" },
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        description: true,
        amount: true,
        deliveryDays: true,
        title: true,
        conversation: { select: { id: true } },
      },
    });
  }

  return prisma.offer.findFirst({
    where: {
      requestId,
      submittedById: userId,
      companyId: null,
      status: { not: "DRAFT" },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      description: true,
      amount: true,
      deliveryDays: true,
      title: true,
      conversation: { select: { id: true } },
    },
  });
}

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
  issues.push(...validateOfferFields(input));

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
    if (error instanceof EntitlementError && (error.code === "QUOTA_EXCEEDED" || error.code === "OFFER_QUOTA_EXCEEDED")) {
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

  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const existingOffer = await prisma.offer.findFirst({
    where: {
      requestId: input.requestId,
      status: { in: [...BLOCKING_OFFER_STATUSES] },
      ...(companyId
        ? { companyId }
        : { submittedById: userId, companyId: null }),
    },
    select: { id: true },
  });

  if (existingOffer) {
    throw new OfferValidationError(["Bu talebe zaten teklif verdiniz."]);
  }

  const sanitizedDescription = sanitizeCommercialText(input.description.trim());
  const now = new Date();

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

  try {
    await createNotification({
      userId: request.createdById,
      type: "NEW_OFFER",
      title: "Talebinize yeni teklif geldi",
      message: `“${request.title}” talebinize yeni bir teklif gönderildi.`,
      actionUrl: `/panel/gelen-teklifler`,
      requestId: request.id,
      offerId: offer.id,
      companyId: companyId ?? undefined,
    });
  } catch (notificationError) {
    console.error("[createOffer] Bildirim oluşturulamadı:", notificationError);
  }

  try {
    await recordOfferPriceObservation(offer.id);
  } catch (observationError) {
    console.error("[createOffer] price observation failed", observationError);
  }

  return offer;
}

export async function updateOffer(
  userId: string,
  offerId: string,
  input: UpdateOfferInput,
) {
  const issues = validateOfferFields(input);
  if (issues.length) {
    throw new OfferValidationError(issues);
  }

  const entitlements = await resolveEntitlements(
    userId,
    await getCompanyContextOptions(),
  );

  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const existing = await prisma.offer.findFirst({
    where: {
      id: offerId,
      status: { in: [...AWAITING_RESPONSE_STATUSES] },
      ...(companyId
        ? { companyId }
        : { submittedById: userId, companyId: null }),
      request: {
        deletedAt: null,
        status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      },
    },
    select: {
      id: true,
      requestId: true,
      companyId: true,
      request: {
        select: {
          title: true,
          createdById: true,
        },
      },
    },
  });

  if (!existing) {
    throw new OfferValidationError([
      "Teklif bulunamadı veya artık güncellenemez.",
    ]);
  }

  const sanitizedDescription = sanitizeCommercialText(input.description.trim());

  const updated = await prisma.offer.update({
    where: { id: existing.id },
    data: {
      description: sanitizedDescription,
      amount: input.amount,
      deliveryDays:
        input.deliveryDays === undefined
          ? undefined
          : input.deliveryDays && input.deliveryDays > 0
            ? input.deliveryDays
            : null,
      title: input.title?.trim() || null,
      // Keep awaiting-response semantics; treat revision as a fresh submit signal.
      status: "SUBMITTED",
      viewedAt: null,
    },
    select: {
      id: true,
      requestId: true,
      amount: true,
      currency: true,
      status: true,
    },
  });

  try {
    await createNotification({
      userId: existing.request.createdById,
      type: "NEW_OFFER",
      title: "Teklif güncellendi",
      message: `“${existing.request.title}” talebinize gelen teklif revize edildi.`,
      actionUrl: `/panel/gelen-teklifler`,
      requestId: existing.requestId,
      offerId: existing.id,
      companyId: existing.companyId ?? undefined,
    });
  } catch (notificationError) {
    console.error("[updateOffer] Bildirim oluşturulamadı:", notificationError);
  }

  return updated;
}

async function ensureOfferConversation(
  tx: Tx,
  input: {
    offerId: string;
    requestTitle: string;
    buyerUserId: string;
    supplierUserId: string;
    companyId?: string | null;
    now: Date;
  },
) {
  const existing = await tx.conversation.findUnique({
    where: { offerId: input.offerId },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return tx.conversation.create({
    data: {
      offerId: input.offerId,
      title: input.requestTitle,
      lastMessageAt: input.now,
      participants: {
        create: [
          { userId: input.buyerUserId },
          { userId: input.supplierUserId },
          ...(input.companyId ? [{ companyId: input.companyId }] : []),
        ],
      },
    },
    select: { id: true },
  });
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
      conversation: { select: { id: true } },
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

    const siblings = await tx.offer.findMany({
      where: {
        requestId: offer.requestId,
        id: { not: offerId },
        status: { in: ["SUBMITTED", "VIEWED"] },
      },
      select: {
        id: true,
        submittedById: true,
        companyId: true,
      },
    });

    if (siblings.length > 0) {
      await tx.offer.updateMany({
        where: {
          id: { in: siblings.map((s) => s.id) },
        },
        data: {
          status: "REJECTED",
          rejectedAt: now,
        },
      });
    }

    await tx.request.update({
      where: { id: offer.requestId },
      data: {
        status: "OFFER_SELECTED",
      },
    });

    const conversation = await ensureOfferConversation(tx, {
      offerId: offer.id,
      requestTitle: offer.request.title,
      buyerUserId: userId,
      supplierUserId: offer.submittedById,
      companyId: offer.companyId,
      now,
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: userId,
        type: "SYSTEM",
        content: `“${offer.request.title}” talebi için teklif kabul edildi. Bu sohbet bu talebe aittir.`,
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

    for (const sibling of siblings) {
      await createNotification({
        userId: sibling.submittedById,
        type: "OFFER_REJECTED",
        title: "Teklifiniz seçilmedi",
        message: `“${offer.request.title}” talebi için başka bir teklif kabul edildi.`,
        actionUrl: `/panel/teklifler`,
        requestId: offer.requestId,
        offerId: sibling.id,
        companyId: sibling.companyId ?? undefined,
      });
    }

    return { offer: accepted, conversationId: conversation.id };
  }).then(async (result) => {
    try {
      await createPendingDealOutcome({
        requestId: offer.requestId,
        offerId: offer.id,
        conversationId: result.conversationId,
        buyerUserId: userId,
        companyId: offer.companyId,
        offerAmount: offer.amount.toNumber(),
        currency: offer.currency,
      });
    } catch (dealError) {
      console.error("[acceptOffer] deal outcome failed", dealError);
    }

    try {
      await recordAcceptedOfferObservation(offer.id);
    } catch (observationError) {
      console.error("[acceptOffer] accepted offer observation failed", observationError);
    }

    return result;
  });
}

/** Buyer opens negotiation (pazarlık) — unlocks chat without accepting yet. */
export async function negotiateOffer(
  userId: string,
  offerId: string,
  note?: string,
) {
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
      submittedBy: { select: { id: true } },
      company: { select: { id: true } },
    },
  });

  if (!offer) {
    throw new OfferValidationError(["Teklif bulunamadı veya pazarlık açılamaz."]);
  }

  const cleanNote = note?.trim() ?? "";
  if (cleanNote.length > 2000) {
    throw new OfferValidationError(["Pazarlık notu çok uzun."]);
  }
  if (cleanNote && containsBlockedContactInfo(cleanNote)) {
    throw new OfferValidationError([
      "Pazarlık notunda telefon veya e-posta paylaşmayın.",
    ]);
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Mark as viewed so buyer engagement is visible.
    if (offer.status === "SUBMITTED") {
      await tx.offer.update({
        where: { id: offerId },
        data: { status: "VIEWED", viewedAt: now },
      });
    }

    const conversation = await ensureOfferConversation(tx, {
      offerId: offer.id,
      requestTitle: offer.request.title,
      buyerUserId: userId,
      supplierUserId: offer.submittedById,
      companyId: offer.companyId,
      now,
    });

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: userId,
        type: "SYSTEM",
        content:
          "Alıcı pazarlık başlattı. Teklif henüz kabul edilmedi — fiyat ve koşulları bu sohbette konuşabilirsiniz.",
      },
    });

    if (cleanNote) {
      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderUserId: userId,
          type: "TEXT",
          content: sanitizeCommercialText(cleanNote),
        },
      });
    }

    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });

    await createNotification({
      userId: offer.submittedById,
      type: "OFFER_NEGOTIATE",
      title: "Pazarlık talebi",
      message: cleanNote
        ? `“${offer.request.title}” için alıcı pazarlık istedi: ${cleanNote.slice(0, 120)}`
        : `“${offer.request.title}” için alıcı pazarlık istedi. Sohbet açıldı.`,
      actionUrl: `/panel/mesajlar/${conversation.id}`,
      requestId: offer.requestId,
      offerId: offer.id,
      companyId: offer.companyId ?? undefined,
    });

    return { conversationId: conversation.id };
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
    actionUrl: `/panel/teklifler`,
    requestId: offer.requestId,
    offerId: offer.id,
  });

  return updated;
}
