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
  DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE,
  DEAL_REVIEWS_PUBLISHED_MESSAGE,
  DEAL_REVIEWS_PUBLISHED_TITLE,
  dealIsReviewEligible,
  formatDealReviewDeadline,
  getDealReviewDeadline,
  isDealReviewDeadlineElapsed,
  isDealReviewPairRevealed,
  isDealReviewRevealed,
  isDealReviewWindowOpen,
  isValidDealRating,
  resolveDealReviewTarget,
  type DealReviewDto,
} from "@/lib/offer/deal-review";
import { prisma } from "@/lib/prisma";
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

export async function getDealReviewConversationState(
  dealOutcomeId: string,
  side: "BUYER" | "PROVIDER",
  now: Date = new Date(),
) {
  const deal = await prisma.dealOutcome.findUnique({
    where: { id: dealOutcomeId },
    select: { completedAt: true },
  });
  const completedAt = deal?.completedAt ?? null;

  const rows = await prisma.dealReview.findMany({
    where: { dealOutcomeId },
    select: {
      id: true,
      reviewerSide: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  });
  const sides = rows.map((row) => row.reviewerSide);
  const revealed = isDealReviewRevealed({
    sides,
    completedAt,
    now,
  });
  const own = rows.find((row) => row.reviewerSide === side) ?? null;
  const opposite = revealed
    ? (rows.find((row) => row.reviewerSide !== side) ?? null)
    : null;
  const windowOpen = isDealReviewWindowOpen(completedAt, now);
  const windowExpired = isDealReviewDeadlineElapsed(completedAt, now);

  return {
    ownReview: own ? toDto(own) : null,
    oppositeReview: opposite ? toDto(opposite) : null,
    canCreateReview: !own && windowOpen,
    windowExpired,
    reviewDeadlineIso: completedAt
      ? getDealReviewDeadline(completedAt).toISOString()
      : null,
    reviewDeadlineLabel: completedAt
      ? formatDealReviewDeadline(completedAt)
      : null,
  };
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
  const rating = input.rating;

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

  if (isDealReviewDeadlineElapsed(deal.completedAt)) {
    throw new DomainError({
      code: DomainErrorCode.VALIDATION_FAILED,
      userMessage: DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE,
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
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DealOutcome" WHERE id = ${deal.id} FOR UPDATE`;

      const fresh = await tx.dealOutcome.findUniqueOrThrow({
        where: { id: deal.id },
        select: { completedAt: true },
      });
      if (isDealReviewDeadlineElapsed(fresh.completedAt)) {
        throw new DomainError({
          code: DomainErrorCode.VALIDATION_FAILED,
          userMessage: DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE,
        });
      }

      const created = await tx.dealReview.create({
        data: {
          dealOutcomeId: deal.id,
          offerId: deal.offerId,
          requestId: deal.requestId,
          reviewerUserId: input.userId,
          reviewerSide: side,
          targetType: target.targetType,
          targetUserId: target.targetUserId,
          targetCompanyId: target.targetCompanyId,
          rating,
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

      const sides = await tx.dealReview.findMany({
        where: { dealOutcomeId: deal.id },
        select: { reviewerSide: true },
      });

      if (isDealReviewPairRevealed(sides.map((row) => row.reviewerSide))) {
        const alreadyPublished = await tx.notification.findFirst({
          where: {
            offerId: deal.offerId,
            type: "DEAL_REVIEW_RECEIVED",
            title: DEAL_REVIEWS_PUBLISHED_TITLE,
          },
          select: { id: true },
        });

        if (!alreadyPublished) {
          const recipients = [
            ...new Set([deal.buyerUserId, deal.offer.submittedById]),
          ];
          const actionUrl = deal.conversationId
            ? `/panel/mesajlar/${deal.conversationId}`
            : "/panel/mesajlar";
          for (const userId of recipients) {
            await tx.notification.create({
              data: {
                userId,
                type: "DEAL_REVIEW_RECEIVED",
                title: DEAL_REVIEWS_PUBLISHED_TITLE,
                message: DEAL_REVIEWS_PUBLISHED_MESSAGE,
                actionUrl,
                requestId: deal.requestId,
                offerId: deal.offerId,
                companyId: deal.companyId,
              },
            });
          }
        }
      }

      return toDto(created);
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isPrismaUniqueViolation(error)) {
      throw new DomainError({
        code: DomainErrorCode.VALIDATION_FAILED,
        userMessage: DEAL_REVIEW_DUPLICATE_MESSAGE,
      });
    }
    throw error;
  }
}
