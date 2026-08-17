import { isBilateralDealCompleted } from "@/lib/offer/deal-completion";

export const DEAL_REVIEW_MIN_RATING = 1;
export const DEAL_REVIEW_MAX_RATING = 5;
export const DEAL_REVIEW_COMMENT_MAX = 800;

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
