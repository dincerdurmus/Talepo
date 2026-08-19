import { revealedReviewWhere } from "@/lib/offer/deal-review";
import { prisma } from "@/lib/prisma";

export type RatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export function emptyRatingDistribution(): RatingDistribution {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function toDistribution(
  rows: Array<{ rating: number; _count: { _all: number } }>,
): RatingDistribution {
  const distribution = emptyRatingDistribution();
  for (const row of rows) {
    const key = row.rating as 1 | 2 | 3 | 4 | 5;
    if (key >= 1 && key <= 5) {
      distribution[key] = row._count._all;
    }
  }
  return distribution;
}

export async function ratingDistributionForTarget(input: {
  targetType: "USER" | "COMPANY";
  targetUserId?: string;
  targetCompanyId?: string;
  reviewerSide: "BUYER" | "PROVIDER";
}) {
  const visible = revealedReviewWhere();
  const rows = await prisma.dealReview.groupBy({
    by: ["rating"],
    where: {
      targetType: input.targetType,
      targetUserId: input.targetUserId ?? undefined,
      targetCompanyId: input.targetCompanyId ?? undefined,
      reviewerSide: input.reviewerSide,
      ...visible,
    },
    _count: { _all: true },
  });
  return toDistribution(rows);
}

export async function getSelfRatingDistributions(input: {
  userId: string;
  companyId?: string | null;
}) {
  const [providerPersonal, providerCompany, buyer] = await Promise.all([
    ratingDistributionForTarget({
      targetType: "USER",
      targetUserId: input.userId,
      reviewerSide: "BUYER",
    }),
    input.companyId
      ? ratingDistributionForTarget({
          targetType: "COMPANY",
          targetCompanyId: input.companyId,
          reviewerSide: "BUYER",
        })
      : Promise.resolve(emptyRatingDistribution()),
    ratingDistributionForTarget({
      targetType: "USER",
      targetUserId: input.userId,
      reviewerSide: "PROVIDER",
    }),
  ]);

  return { providerPersonal, providerCompany, buyer };
}

export async function countPendingBlindReviewsForUser(userId: string) {
  const visible = revealedReviewWhere();
  return prisma.dealReview.count({
    where: {
      targetType: "USER",
      targetUserId: userId,
      NOT: visible,
    },
  });
}
