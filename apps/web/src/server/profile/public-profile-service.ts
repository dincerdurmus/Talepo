import {
  formatMemberSince,
  formatParticipantLocation,
  type PublicCompanyProfileDto,
  type PublicProfileDto,
  type PublicUserProfileDto,
} from "@/lib/profile/public-profile";
import {
  buildCompanyVerifiedIndicators,
  buildUserVerifiedIndicators,
} from "@/lib/profile/verified-indicators";
import { prisma } from "@/lib/prisma";
import {
  getCompanyTrustSummary,
  getUserTrustSummary,
} from "@/server/offer/trust-summary";
import { ratingDistributionForTarget } from "@/server/profile/self-profile-trust";

import {
  assertConversationParticipantAccess,
  isSelfProfile,
  PublicProfileAccessError,
} from "./public-profile-access";

/** Provider-side expertise only — never buyer-created request categories. */
async function loadUserCategories(userId: string): Promise<string[]> {
  const rows = await prisma.offer.findMany({
    where: {
      submittedById: userId,
      companyId: null,
      status: { in: ["SUBMITTED", "VIEWED", "ACCEPTED"] },
    },
    include: {
      request: { select: { category: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
  const names = rows
    .map((row) => row.request.category?.name)
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)].slice(0, 6);
}

async function loadCompanyCategories(companyId: string): Promise<string[]> {
  const rows = await prisma.companyCategory.findMany({
    where: { companyId },
    select: { category: { select: { name: true } } },
    take: 8,
  });
  return rows.map((row) => row.category.name);
}

export async function getPublicUserProfile(
  viewerUserId: string,
  targetUserId: string,
  options?: { conversationId?: string },
): Promise<PublicUserProfileDto> {
  if (!isSelfProfile(viewerUserId, targetUserId)) {
    if (!options?.conversationId) {
      throw new PublicProfileAccessError("Profil bulunamadı.", 404);
    }
    await assertConversationParticipantAccess(
      viewerUserId,
      options.conversationId,
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: targetUserId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      image: true,
      biography: true,
      city: true,
      district: true,
      country: true,
      createdAt: true,
      emailVerified: true,
    },
  });

  if (!user) {
    throw new PublicProfileAccessError("Profil bulunamadı.", 404);
  }

  const [trust, expertiseCategories, ratingDistribution] = await Promise.all([
    getUserTrustSummary(user.id),
    loadUserCategories(user.id),
    ratingDistributionForTarget({
      targetType: "USER",
      targetUserId: user.id,
      reviewerSide: "BUYER",
    }),
  ]);

  const verifiedIndicators = buildUserVerifiedIndicators({
    emailVerified: user.emailVerified,
  });

  return {
    kind: "user",
    id: user.id,
    displayName: user.name?.trim() || "Kullanıcı",
    avatarUrl: user.image,
    accountType: "personal",
    biography: user.biography,
    locationLabel: formatParticipantLocation(user.city, user.country),
    memberSinceLabel: formatMemberSince(user.createdAt),
    expertiseCategories,
    trust: {
      completedTransactions: trust.completedTransactions,
      reviewCount: trust.reviewCount,
      averageRating: trust.averageRating,
    },
    verifiedIndicators,
    ratingDistribution,
    recentVisibleReviews: trust.recentComments.slice(0, 5),
  };
}

export async function getPublicCompanyProfile(
  viewerUserId: string,
  companyId: string,
  options: {
    conversationId: string;
    representativeUserId?: string | null;
  },
): Promise<PublicCompanyProfileDto> {
  await assertConversationParticipantAccess(
    viewerUserId,
    options.conversationId,
  );

  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      logoUrl: true,
      city: true,
      district: true,
      country: true,
      isVerified: true,
      createdAt: true,
    },
  });

  if (!company) {
    throw new PublicProfileAccessError("Profil bulunamadı.", 404);
  }

  let representativeName: string | null = null;
  let representativeAvatarUrl: string | null = null;

  if (options.representativeUserId) {
    const rep = await prisma.user.findFirst({
      where: { id: options.representativeUserId, deletedAt: null },
      select: { name: true, image: true },
    });
    representativeName = rep?.name?.trim() || null;
    representativeAvatarUrl = rep?.image ?? null;
  }

  const [trust, expertiseCategories, ratingDistribution] = await Promise.all([
    getCompanyTrustSummary(company.id),
    loadCompanyCategories(company.id),
    ratingDistributionForTarget({
      targetType: "COMPANY",
      targetCompanyId: company.id,
      reviewerSide: "BUYER",
    }),
  ]);

  const verifiedIndicators = buildCompanyVerifiedIndicators({
    isVerified: company.isVerified,
  });

  return {
    kind: "company",
    id: company.id,
    displayName: company.name,
    avatarUrl: company.logoUrl,
    accountType: "company",
    companyName: company.name,
    representativeName,
    representativeAvatarUrl,
    biography: company.description,
    locationLabel: formatParticipantLocation(company.city, company.country),
    memberSinceLabel: formatMemberSince(company.createdAt),
    expertiseCategories,
    trust: {
      completedTransactions: trust.completedTransactions,
      reviewCount: trust.reviewCount,
      averageRating: trust.averageRating,
    },
    verifiedIndicators,
    ratingDistribution,
    recentVisibleReviews: trust.recentComments.slice(0, 5),
  };
}

export async function getConversationCounterpartProfile(
  viewerUserId: string,
  conversationId: string,
): Promise<PublicProfileDto> {
  await assertConversationParticipantAccess(viewerUserId, conversationId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      offer: {
        select: {
          companyId: true,
          company: { select: { id: true, name: true } },
          submittedById: true,
          request: { select: { createdById: true } },
        },
      },
    },
  });

  if (!conversation) {
    throw new PublicProfileAccessError("Profil bulunamadı.", 404);
  }

  const { offer } = conversation;
  const isBuyer = offer.request.createdById === viewerUserId;

  if (isBuyer) {
    if (offer.companyId && offer.company) {
      return getPublicCompanyProfile(viewerUserId, offer.company.id, {
        conversationId,
        representativeUserId: offer.submittedById,
      });
    }
    return getPublicUserProfile(viewerUserId, offer.submittedById, {
      conversationId,
    });
  }

  return getPublicUserProfile(viewerUserId, offer.request.createdById, {
    conversationId,
  });
}

export async function resolvePublicProfileByUserId(
  viewerUserId: string,
  targetUserId: string,
  conversationId: string,
): Promise<PublicProfileDto> {
  await assertConversationParticipantAccess(viewerUserId, conversationId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      offer: {
        select: {
          companyId: true,
          submittedById: true,
          request: { select: { createdById: true } },
        },
      },
    },
  });

  if (!conversation) {
    throw new PublicProfileAccessError("Profil bulunamadı.", 404);
  }

  const { offer } = conversation;
  const participants = new Set([
    offer.request.createdById,
    offer.submittedById,
  ]);

  if (!participants.has(targetUserId)) {
    throw new PublicProfileAccessError("Profil bulunamadı.", 404);
  }

  if (
    offer.companyId &&
    targetUserId === offer.submittedById &&
    offer.request.createdById !== targetUserId
  ) {
    return getPublicCompanyProfile(viewerUserId, offer.companyId, {
      conversationId,
      representativeUserId: offer.submittedById,
    });
  }

  return getPublicUserProfile(viewerUserId, targetUserId, { conversationId });
}
