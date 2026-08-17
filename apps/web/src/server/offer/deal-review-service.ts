import { isPrismaUniqueViolation } from "@/lib/observability/idempotency";
import { DomainError, DomainErrorCode } from "@/lib/observability/errors";
import {
  containsBlockedContactInfo,
  sanitizeCommercialText,
} from "@/lib/membership/contact-filter";
import {
  DEAL_REVIEW_COMMENT_LENGTH_MESSAGE,
  DEAL_REVIEW_COMMENT_MAX,
  DEAL_REVIEW_CONTACT_MESSAGE,
  DEAL_REVIEW_DUPLICATE_MESSAGE,
  DEAL_REVIEW_NOT_ELIGIBLE_MESSAGE,
  DEAL_REVIEW_RATING_MESSAGE,
  dealIsReviewEligible,
  isValidDealRating,
  resolveDealReviewTarget,
  type DealReviewDto,
} from "@/lib/offer/deal-review";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/notifications/create-notification";
import { resolveNegotiationActorSide } from "@/server/offer/offer-negotiation-access";
import { BILATERAL_COMPLETED_WHERE } from "@/lib/offer/deal-completion";

function toDto(row: {
  id: string;
  reviewerSide: "BUYER" | "PROVIDER";
  rating: number;
  comment: string | null;
  createdAt: Date;
}): DealReviewDto {
  return {
    id: row.id,
    reviewerSide: row.reviewerSide,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getDealReviewForSide(
  dealOutcomeId: string,
  side: "BUYER" | "PROVIDER",
) {
  const row = await prisma.dealReview.findUnique({
    where: {
      dealOutcomeId_reviewerSide: { dealOutcomeId, reviewerSide: side },
    },
    select: {
      id: true,
      reviewerSide: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  });
  return row ? toDto(row) : null;
}

export async function createDealReview(input: {
  userId: string;
  dealOutcomeId: string;
  rating: unknown;
  comment?: string | null;
}) {
  if (!isValidDealRating(input.rating)) {
    throw new DomainError({
      code: DomainErrorCode.VALIDATION_FAILED,
      userMessage: DEAL_REVIEW_RATING_MESSAGE,
    });
  }

  let comment: string | null = null;
  if (input.comment != null && String(input.comment).trim()) {
    const raw = String(input.comment).trim();
    if (raw.length > DEAL_REVIEW_COMMENT_MAX) {
      throw new DomainError({
        code: DomainErrorCode.VALIDATION_FAILED,
        userMessage: DEAL_REVIEW_COMMENT_LENGTH_MESSAGE,
      });
    }
    if (containsBlockedContactInfo(raw)) {
      throw new DomainError({
        code: DomainErrorCode.VALIDATION_FAILED,
        userMessage: DEAL_REVIEW_CONTACT_MESSAGE,
      });
    }
    comment = sanitizeCommercialText(raw);
  }

  const deal = await prisma.dealOutcome.findFirst({
    where: {
      id: input.dealOutcomeId,
      ...BILATERAL_COMPLETED_WHERE,
    },
    include: {
      offer: {
        select: {
          id: true,
          submittedById: true,
          companyId: true,
          request: { select: { createdById: true } },
        },
      },
    },
  });

  if (!deal || !dealIsReviewEligible(deal)) {
    throw new DomainError({
      code: DomainErrorCode.VALIDATION_FAILED,
      userMessage: DEAL_REVIEW_NOT_ELIGIBLE_MESSAGE,
    });
  }

  const side = await resolveNegotiationActorSide(
    {
      id: deal.offer.id,
      submittedById: deal.offer.submittedById,
      companyId: deal.offer.companyId,
      request: deal.offer.request,
    },
    input.userId,
  );
  if (!side) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: "Bu işlem için değerlendirme yazamazsınız.",
    });
  }

  const target = resolveDealReviewTarget(
    {
      companyId: deal.offer.companyId,
      submittedById: deal.offer.submittedById,
      requestCreatedById: deal.offer.request.createdById,
    },
    side,
  );

  try {
    const created = await prisma.dealReview.create({
      data: {
        dealOutcomeId: deal.id,
        offerId: deal.offerId,
        requestId: deal.requestId,
        reviewerUserId: input.userId,
        reviewerSide: side,
        targetType: target.targetType,
        targetUserId: target.targetUserId,
        targetCompanyId: target.targetCompanyId,
        rating: input.rating,
        comment,
      },
      select: {
        id: true,
        reviewerSide: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    });

    const recipientId =
      side === "BUYER" ? deal.offer.submittedById : deal.buyerUserId;
    if (recipientId && recipientId !== input.userId) {
      try {
        await createNotification({
          userId: recipientId,
          type: "DEAL_REVIEW_RECEIVED",
          title: "Yeni değerlendirme aldınız",
          message: "Tamamlanan bir işlem için yeni bir değerlendirme var.",
          actionUrl: deal.conversationId
            ? `/panel/mesajlar/${deal.conversationId}`
            : "/panel/mesajlar",
          requestId: deal.requestId,
          offerId: deal.offerId,
          companyId: deal.companyId ?? undefined,
        });
      } catch {
        /* non-blocking */
      }
    }

    return toDto(created);
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      throw new DomainError({
        code: DomainErrorCode.VALIDATION_FAILED,
        userMessage: DEAL_REVIEW_DUPLICATE_MESSAGE,
      });
    }
    throw error;
  }
}
