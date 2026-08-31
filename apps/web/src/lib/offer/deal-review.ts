import { isBilateralDealCompleted } from "@/lib/offer/deal-completion";

export const DEAL_REVIEW_MIN_RATING = 1;
export const DEAL_REVIEW_MAX_RATING = 5;
export const DEAL_REVIEW_COMMENT_MAX = 800;

/** Canonical review window after bilateral completion. */
export const DEAL_REVIEW_WINDOW_DAYS = 14;
export const DEAL_REVIEW_WINDOW_MS =
  DEAL_REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const DEAL_REVIEW_NOT_ELIGIBLE_MESSAGE =
  "Yalnız taraflarca tamamlandı olarak onaylanan işlemler değerlendirilebilir.";

export const DEAL_REVIEW_DUPLICATE_MESSAGE =
  "Bu işlem için değerlendirmeniz zaten kaydedildi.";

export const DEAL_REVIEW_RATING_MESSAGE =
  "Değerlendirme 1 ile 5 arasında tam sayı olmalıdır.";

export const DEAL_REVIEW_COMMENT_LENGTH_MESSAGE =
  "Yorum en fazla 800 karakter olabilir.";

export const DEAL_REVIEW_CONTACT_MESSAGE =
  "Yorumda telefon, e-posta veya IBAN paylaşmayın.";

export const DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE =
  "Bu işlem için değerlendirme süresi sona erdi.";

export const DEAL_REVIEWS_PUBLISHED_TITLE = "Değerlendirmeler yayınlandı";
export const DEAL_REVIEWS_PUBLISHED_MESSAGE =
  "İşlem değerlendirmeleri artık görünür.";

export const DEAL_REVIEW_BLIND_HINT =
  "Değerlendirmeler, iki taraf da değerlendirmesini tamamladığında veya süre dolunca görünür. Gönderilen değerlendirme değiştirilemez.";

export const DEAL_REVIEW_WINDOW_HINT = `Değerlendirme için ${DEAL_REVIEW_WINDOW_DAYS} gününüz var.`;

export type TrustSummary = {
  completedTransactions: number;
  reviewCount: number;
  averageRating: number | null;
};

export type DealReviewDto = {
  id: string;
  reviewerSide: "BUYER" | "PROVIDER";
  rating: number;
  comment: string | null;
  createdAt: string;
};

export function isValidDealRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= DEAL_REVIEW_MIN_RATING &&
    value <= DEAL_REVIEW_MAX_RATING
  );
}

export function formatAverageRating(average: number | null) {
  if (average == null || !Number.isFinite(average)) return null;
  return `${average.toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} / 5`;
}

export function formatReviewCount(count: number) {
  return `${count} değerlendirme`;
}

export function roundAverageRating(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatTrustRatingMeta(summary: TrustSummary) {
  if (summary.reviewCount < 1 || summary.averageRating == null) return null;
  return `${formatAverageRating(summary.averageRating)} · ${formatReviewCount(summary.reviewCount)}`;
}

export function emptyTrustSummary(): TrustSummary {
  return {
    completedTransactions: 0,
    reviewCount: 0,
    averageRating: null,
  };
}

export function dealIsReviewEligible(deal: {
  status: string;
  confirmationLevel: string;
  completedAt?: Date | string | null;
  buyerConfirmedAt?: Date | string | null;
  supplierConfirmedAt?: Date | string | null;
}) {
  return isBilateralDealCompleted(deal);
}

export function getDealReviewDeadline(completedAt: Date | string) {
  const start = new Date(completedAt).getTime();
  if (!Number.isFinite(start)) {
    throw new Error("Invalid completedAt for review deadline");
  }
  return new Date(start + DEAL_REVIEW_WINDOW_MS);
}

/** Cutoff for SQL: completedAt <= now - window ⇒ deadline elapsed. */
export function getDealReviewWindowCutoff(now: Date = new Date()) {
  return new Date(now.getTime() - DEAL_REVIEW_WINDOW_MS);
}

/** Open window: completedAt .. deadline (exclusive end). */
export function isDealReviewWindowOpen(
  completedAt: Date | string | null | undefined,
  now: Date = new Date(),
) {
  if (!completedAt) return false;
  const deadline = getDealReviewDeadline(completedAt).getTime();
  if (!Number.isFinite(deadline)) return false;
  return now.getTime() < deadline;
}

export function isDealReviewDeadlineElapsed(
  completedAt: Date | string | null | undefined,
  now: Date = new Date(),
) {
  if (!completedAt) return false;
  const deadline = getDealReviewDeadline(completedAt).getTime();
  if (!Number.isFinite(deadline)) return false;
  return now.getTime() >= deadline;
}

export function formatDealReviewDeadline(completedAt: Date | string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(getDealReviewDeadline(completedAt));
}

export function resolveDealReviewTarget(
  offer: {
    companyId: string | null;
    submittedById: string;
    requestCreatedById: string;
  },
  side: "BUYER" | "PROVIDER",
) {
  if (side === "BUYER") {
    if (offer.companyId) {
      return {
        targetType: "COMPANY" as const,
        targetCompanyId: offer.companyId,
        targetUserId: null as string | null,
      };
    }
    return {
      targetType: "USER" as const,
      targetUserId: offer.submittedById,
      targetCompanyId: null as string | null,
    };
  }
  return {
    targetType: "USER" as const,
    targetUserId: offer.requestCreatedById,
    targetCompanyId: null as string | null,
  };
}

export function averageRatingFrom(ratings: number[]) {
  if (ratings.length === 0) return null;
  return roundAverageRating(
    ratings.reduce((sum, value) => sum + value, 0) / ratings.length,
  );
}

export function isDealReviewPairRevealed(
  sides: ReadonlyArray<"BUYER" | "PROVIDER">,
) {
  return sides.includes("BUYER") && sides.includes("PROVIDER");
}

/**
 * Canonical reveal: both sides submitted, OR review window deadline elapsed.
 * Deadline source is DealOutcome.completedAt (not review.createdAt).
 */
export function isDealReviewRevealed(input: {
  sides: ReadonlyArray<"BUYER" | "PROVIDER">;
  completedAt?: Date | string | null;
  now?: Date;
}) {
  if (isDealReviewPairRevealed(input.sides)) return true;
  return isDealReviewDeadlineElapsed(input.completedAt, input.now);
}

/**
 * Query-time visibility for trust aggregates / lists.
 * Pair present OR completedAt past the 14-day window.
 */
export function revealedReviewWhere(now: Date = new Date()) {
  const cutoff = getDealReviewWindowCutoff(now);
  return {
    OR: [
      {
        dealOutcome: {
          AND: [
            { reviews: { some: { reviewerSide: "BUYER" as const } } },
            { reviews: { some: { reviewerSide: "PROVIDER" as const } } },
          ],
        },
      },
      {
        dealOutcome: {
          completedAt: { lte: cutoff },
        },
      },
    ],
  };
}
