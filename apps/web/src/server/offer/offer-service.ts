import type { Prisma } from "@/generated/prisma/client";
import {
  assertCanAccessRequest,
  assertCanSubmitOffer,
} from "@/lib/membership/assert-entitlement";
import { containsBlockedContactInfo, sanitizeCommercialText } from "@/lib/membership/contact-filter";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { EntitlementError, type EntitlementContext } from "@/lib/membership/types";
import { isPrismaUniqueViolation } from "@/lib/observability/idempotency";
import { createSubsystemLogger } from "@/lib/observability/logger";
import { ProductEventName, trackProductEvent } from "@/lib/observability/product-events";
import {
  collectSubmittedCommercialLockIssues,
  OFFER_NO_LONGER_EDITABLE_MESSAGE,
} from "@/lib/offer/submitted-commercial-lock";
import { prisma } from "@/lib/prisma";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import { LEGACY_CHAT_NEGOTIATE_CLOSED_MESSAGE } from "@/lib/offer/offer-negotiation";
import { resolveNegotiationActorSide } from "@/server/offer/offer-negotiation-access";
import {
  persistOfferAttribution,
  resolveOfferAttribution,
} from "@/server/offer/resolve-offer-attribution";

const log = createSubsystemLogger("offer");

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
  /**
   * When true, leave mediaFinalizedAt null so the submitter can attach
   * 0–5 photos immediately after create. Default locks an empty set.
   */
  deferMediaFinalize?: boolean;
  /**
   * Signed acquisition touch from a product surface. Never trust bare source enums.
   * Missing/invalid → UNKNOWN attribution row.
   */
  attributionTouch?: string | null;
};

type UpdateOfferInput = {
  description: string;
  /** Present only when the client attempted to send amount. */
  amount?: number;
  amountProvided?: boolean;
  deliveryDays?: number | null;
  deliveryDaysProvided?: boolean;
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
        media: {
          orderBy: { sortOrder: "asc" },
          select: { id: true },
        },
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
      media: {
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      },
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
  const started = Date.now();
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

  const attribution = await resolveOfferAttribution({
    userId,
    requestId: input.requestId,
    companyId,
    attributionTouch: input.attributionTouch,
  });

  let offer;
  try {
    offer = await prisma.$transaction(async (tx) => {
    // Serialize concurrent offer submissions for the same quota subject.
    await lockEntitlementSubject(tx, entitlements);

    // Re-check duplicate under lock (app-level); DB partial unique is the hard gate.
    const raced = await tx.offer.findFirst({
      where: {
        requestId: input.requestId,
        status: { in: [...BLOCKING_OFFER_STATUSES] },
        ...(companyId
          ? { companyId }
          : { submittedById: userId, companyId: null }),
      },
      select: { id: true },
    });
    if (raced) {
      throw new OfferValidationError(["Bu talebe zaten teklif verdiniz."]);
    }

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
        mediaFinalizedAt: input.deferMediaFinalize ? null : now,
      },
      select: {
        id: true,
        requestId: true,
        amount: true,
        currency: true,
        mediaFinalizedAt: true,
      },
    });

    await persistOfferAttribution(tx, created.id, attribution);

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
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      throw new OfferValidationError(["Bu talebe zaten teklif verdiniz."]);
    }
    throw error;
  }

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
    log.warn("provider.price.failed", {
      outcome: "failure",
      requestId: request.id,
      context: {
        operation: "recordOfferPriceObservation",
        errorName:
          observationError instanceof Error ? observationError.name : "unknown",
      },
    });
  }

  trackProductEvent({
    eventName: ProductEventName.OFFER_SUBMITTED,
    actorType: companyId ? "corporate" : "seller",
    surface: "api.offers",
    plan: entitlements.effectivePlanTier,
    requestId: request.id,
    companyId: companyId ?? undefined,
    metadata: { offerId: offer.id },
  });
  log.info("offer.created", {
    outcome: "success",
    durationMs: Date.now() - started,
    requestId: request.id,
    userId,
    companyId: companyId ?? undefined,
    context: { offerId: offer.id },
  });

  return offer;
}

export async function updateOffer(
  userId: string,
  offerId: string,
  input: UpdateOfferInput,
) {
  const descriptionIssues: string[] = [];
  if (!input.description || input.description.trim().length < 10) {
    descriptionIssues.push("Teklif açıklaması en az 10 karakter olmalı.");
  }
  if (containsBlockedContactInfo(input.description)) {
    descriptionIssues.push(
      "Teklif metninde telefon, IBAN veya platform dışı iletişim bilgisi paylaşılamaz.",
    );
  }
  if (descriptionIssues.length) {
    throw new OfferValidationError(descriptionIssues);
  }

  const entitlements = await resolveEntitlements(
    userId,
    await getCompanyContextOptions(),
  );

  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const ownerWhere = companyId
    ? { companyId }
    : { submittedById: userId, companyId: null };

  const existing = await prisma.offer.findFirst({
    where: {
      id: offerId,
      status: { in: [...AWAITING_RESPONSE_STATUSES] },
      ...ownerWhere,
      request: {
        deletedAt: null,
        status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      },
    },
    select: {
      id: true,
      requestId: true,
      companyId: true,
      amount: true,
      deliveryDays: true,
      request: {
        select: {
          title: true,
          createdById: true,
        },
      },
    },
  });

  if (!existing) {
    throw new OfferValidationError([OFFER_NO_LONGER_EDITABLE_MESSAGE]);
  }

  const commercialIssues = collectSubmittedCommercialLockIssues({
    currentAmount: existing.amount.toString(),
    currentDeliveryDays: existing.deliveryDays,
    nextAmount: input.amount,
    nextDeliveryDays: input.deliveryDays,
    amountProvided:
      input.amountProvided === true || input.amount !== undefined,
    deliveryDaysProvided:
      input.deliveryDaysProvided === true || input.deliveryDays !== undefined,
  });
  if (commercialIssues.length) {
    throw new OfferValidationError(commercialIssues);
  }

  const sanitizedDescription = sanitizeCommercialText(input.description.trim());

  const revised = await prisma.offer.updateMany({
    where: {
      id: existing.id,
      status: { in: [...AWAITING_RESPONSE_STATUSES] },
      ...ownerWhere,
      request: {
        deletedAt: null,
        status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      },
    },
    data: {
      description: sanitizedDescription,
      ...(input.title === undefined
        ? {}
        : { title: input.title.trim() || null }),
      // Text revision is a fresh signal for the buyer; commercial terms stay.
      status: "SUBMITTED",
      viewedAt: null,
    },
  });

  if (revised.count !== 1) {
    throw new OfferValidationError([OFFER_NO_LONGER_EDITABLE_MESSAGE]);
  }

  const updated = await prisma.offer.findUniqueOrThrow({
    where: { id: existing.id },
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

  try {
    return await tx.conversation.create({
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
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      const again = await tx.conversation.findUnique({
        where: { offerId: input.offerId },
        select: { id: true },
      });
      if (again) return again;
    }
    throw error;
  }
}

export async function acceptOffer(
  userId: string,
  offerId: string,
  options?: { negotiationId?: string },
) {
  const started = Date.now();

  // Idempotent replay: already accepted → return conversation for authorized parties
  const already = await prisma.offer.findFirst({
    where: {
      id: offerId,
      status: "ACCEPTED",
      request: { deletedAt: null },
    },
    select: {
      id: true,
      requestId: true,
      companyId: true,
      submittedById: true,
      amount: true,
      currency: true,
      conversation: { select: { id: true } },
      request: { select: { createdById: true } },
    },
  });
  if (already?.conversation?.id) {
    const replaySide = await resolveNegotiationActorSide(already, userId);
    if (replaySide || already.request.createdById === userId) {
      return { offer: already, conversationId: already.conversation.id };
    }
  }

  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      status: { in: ["SUBMITTED", "VIEWED"] },
      request: {
        deletedAt: null,
      },
    },
    include: {
      request: { select: { id: true, title: true, createdById: true } },
      submittedBy: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      conversation: { select: { id: true } },
    },
  });

  if (!offer) {
    throw new OfferValidationError(["Teklif bulunamadı veya kabul edilemez durumda."]);
  }

  const actorSide = await resolveNegotiationActorSide(offer, userId);
  if (!actorSide) {
    throw new OfferValidationError(["Teklif bulunamadı veya kabul edilemez durumda."]);
  }

  if (!options?.negotiationId && actorSide !== "BUYER") {
    throw new OfferValidationError(["Orijinal teklifi yalnız talep sahibi kabul edebilir."]);
  }

  const now = new Date();
  let commercialAmount = Number(offer.amount);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Offer" WHERE id = ${offerId} FOR UPDATE`;

    if (options?.negotiationId) {
      const claimedNegotiation = await tx.offerNegotiation.updateMany({
        where: {
          id: options.negotiationId,
          offerId,
          status: "PENDING",
          proposedBySide: actorSide === "BUYER" ? "PROVIDER" : "BUYER",
        },
        data: { status: "ACCEPTED", respondedAt: now },
      });
      if (claimedNegotiation.count !== 1) {
        throw new OfferValidationError(["Karşı teklif artık beklenmiyor."]);
      }
      const acceptedNegotiation = await tx.offerNegotiation.findUniqueOrThrow({
        where: { id: options.negotiationId },
        select: { amount: true },
      });
      commercialAmount = resolveOfferCommercialAmount({
        offerAmount: offer.amount.toString(),
        acceptedNegotiationAmount: acceptedNegotiation.amount.toString(),
      });
    } else {
      await tx.offerNegotiation.updateMany({
        where: { offerId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: now },
      });
    }

    // Atomic claim: only one accept can transition the request into OFFER_SELECTED.
    const claimedRequest = await tx.request.updateMany({
      where: {
        id: offer.requestId,
        createdById: offer.request.createdById,
        deletedAt: null,
        status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      },
      data: { status: "OFFER_SELECTED" },
    });

    if (claimedRequest.count !== 1) {
      throw new OfferValidationError([
        "Bu talep için başka bir teklif zaten kabul edilmiş olabilir.",
      ]);
    }

    const acceptedRows = await tx.offer.updateMany({
      where: {
        id: offerId,
        requestId: offer.requestId,
        status: { in: ["SUBMITTED", "VIEWED"] },
      },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
      },
    });

    if (acceptedRows.count !== 1) {
      throw new OfferValidationError([
        "Teklif kabul edilemedi — eşzamanlı işlem veya geçersiz durum.",
      ]);
    }

    const accepted = await tx.offer.findUniqueOrThrow({
      where: { id: offerId },
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
          status: { in: ["SUBMITTED", "VIEWED"] },
        },
        data: {
          status: "REJECTED",
          rejectedAt: now,
        },
      });
      await tx.offerNegotiation.updateMany({
        where: {
          offerId: { in: siblings.map((s) => s.id) },
          status: "PENDING",
        },
        data: { status: "CANCELLED", respondedAt: now },
      });
    }

    const conversation = await ensureOfferConversation(tx, {
      offerId: offer.id,
      requestTitle: offer.request.title,
      buyerUserId: offer.request.createdById,
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

    return {
      offer: accepted,
      conversationId: conversation.id,
      siblingNotify: siblings,
      requestTitle: offer.request.title,
    };
  }).then(async (result) => {
    if (!options?.negotiationId) {
      try {
        await createNotification({
          userId: offer.submittedById,
          type: "OFFER_ACCEPTED",
          title: "Teklifiniz kabul edildi",
          message: `“${result.requestTitle}” talebi için teklifiniz kabul edildi. Mesajlaşma açıldı.`,
          actionUrl: `/panel/mesajlar/${result.conversationId}`,
          requestId: offer.requestId,
          offerId: offer.id,
          companyId: offer.companyId ?? undefined,
        });
      } catch {
        /* non-blocking */
      }
    }

    for (const sibling of result.siblingNotify) {
      try {
        await createNotification({
          userId: sibling.submittedById,
          type: "OFFER_REJECTED",
          title: "Teklifiniz seçilmedi",
          message: `“${result.requestTitle}” talebi için başka bir teklif kabul edildi.`,
          actionUrl: `/panel/teklifler`,
          requestId: offer.requestId,
          offerId: sibling.id,
          companyId: sibling.companyId ?? undefined,
        });
      } catch {
        /* non-blocking */
      }
    }
    try {
      await createPendingDealOutcome({
        requestId: offer.requestId,
        offerId: offer.id,
        conversationId: result.conversationId,
        buyerUserId: offer.request.createdById,
        companyId: offer.companyId,
        offerAmount: commercialAmount,
        currency: offer.currency,
      });
    } catch (dealError) {
      console.error("[acceptOffer] deal outcome failed", dealError);
    }

    try {
      await recordAcceptedOfferObservation(offer.id);
    } catch (observationError) {
      log.warn("provider.price.failed", {
        outcome: "failure",
        requestId: offer.requestId,
        context: {
          operation: "recordAcceptedOfferObservation",
          errorName:
            observationError instanceof Error
              ? observationError.name
              : "unknown",
        },
      });
    }

    trackProductEvent({
      eventName: ProductEventName.OFFER_ACCEPTED,
      actorType: "buyer",
      surface: "api.offers.accept",
      requestId: offer.requestId,
      companyId: offer.companyId ?? undefined,
      metadata: { offerId: offer.id, conversationId: result.conversationId },
    });
    trackProductEvent({
      eventName: ProductEventName.CONVERSATION_STARTED,
      actorType: "buyer",
      surface: "api.offers.accept",
      requestId: offer.requestId,
      companyId: offer.companyId ?? undefined,
      metadata: { conversationId: result.conversationId },
    });
    log.info("offer.accepted", {
      outcome: "success",
      durationMs: Date.now() - started,
      requestId: offer.requestId,
      userId,
      companyId: offer.companyId ?? undefined,
      context: {
        offerId: offer.id,
        conversationId: result.conversationId,
      },
    });
    log.info("conversation.created", {
      outcome: "success",
      requestId: offer.requestId,
      context: { conversationId: result.conversationId, offerId: offer.id },
    });

    return result;
  });
}

/**
 * Legacy chat-based "pazarlık" — retired from the product journey.
 * Canonical path: OfferNegotiation (karşı teklif turları) → ACCEPTED → Conversation.
 * Kept as a hard reject so old clients cannot open pre-accept chat.
 */
export async function negotiateOffer(
  _userId: string,
  _offerId: string,
  _note?: string,
): Promise<{ conversationId: string }> {
  throw new OfferValidationError([LEGACY_CHAT_NEGOTIATE_CLOSED_MESSAGE]);
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

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Offer" WHERE id = ${offerId} FOR UPDATE`;
    const rows = await tx.offer.updateMany({
      where: {
        id: offerId,
        status: { in: ["SUBMITTED", "VIEWED"] },
        request: { createdById: userId, deletedAt: null },
      },
      data: {
        status: "REJECTED",
        rejectedAt: now,
      },
    });
    if (rows.count !== 1) {
      throw new OfferValidationError(["Teklif bulunamadı veya artık reddedilemez."]);
    }
    await tx.offerNegotiation.updateMany({
      where: { offerId, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: now },
    });
    return tx.offer.findUniqueOrThrow({ where: { id: offerId } });
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
