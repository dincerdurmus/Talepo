import { prisma } from "@/lib/prisma";
import { listUnreadIncomingOfferIds } from "@/lib/offer/offer-event-unread";
import { offerNegotiationListInclude } from "@/lib/offer/offer-negotiation";
import { listArchivedOfferIds } from "@/server/offer/offer-archive-service";

export type BuyerIncomingOfferRow = {
  id: string;
  amount: unknown;
  currency: string;
  deliveryDays: number | null;
  title: string | null;
  description: string;
  validUntil: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  request: {
    id: string;
    title: string;
    city: string | null;
    status: string;
    coverImageUrl: string | null;
    budgetMin: unknown;
    budgetMax: unknown;
    currency: string;
    category: { name: string; slug: string };
    fieldValues: Array<{
      textValue: string | null;
      numberValue: unknown;
    }>;
  };
  company: { id: string; name: string; isVerified: boolean } | null;
  submittedBy: { id: string; name: string | null };
  conversation: { id: string } | null;
  media: { id: string }[];
  negotiations: Array<{
    id: string;
    amount: unknown;
    currency: string;
    proposedBySide: string;
    status: string;
    createdAt: Date;
    respondedAt?: Date | null;
  }>;
};

export async function loadBuyerIncomingOffers(userId: string) {
  const [offers, archivedOfferIds, unreadOfferIds] = await Promise.all([
    prisma.offer.findMany({
      where: {
        isModerationHidden: false,
        request: {
          createdById: userId,
          deletedAt: null,
          isModerationHidden: false,
        },
        status: { not: "DRAFT" },
        NOT: { submittedById: userId, companyId: null },
      },
      orderBy: { createdAt: "desc" },
      include: {
        request: {
          select: {
            id: true,
            title: true,
            city: true,
            status: true,
            coverImageUrl: true,
            budgetMin: true,
            budgetMax: true,
            currency: true,
            category: { select: { name: true, slug: true } },
            fieldValues: {
              where: { field: { key: { in: ["quantity", "commonQuantity"] } } },
              take: 1,
              select: { textValue: true, numberValue: true },
            },
          },
        },
        company: { select: { id: true, name: true, isVerified: true } },
        submittedBy: { select: { id: true, name: true } },
        conversation: { select: { id: true } },
        media: {
          orderBy: { sortOrder: "asc" },
          select: { id: true },
        },
        negotiations: offerNegotiationListInclude,
      },
    }) as Promise<BuyerIncomingOfferRow[]>,
    listArchivedOfferIds({ userId, companyId: null }),
    listUnreadIncomingOfferIds(userId),
  ]);

  return { offers, archivedOfferIds, unreadOfferIds };
}

export async function loadBuyerIncomingOfferById(
  userId: string,
  offerId: string,
) {
  return prisma.offer.findFirst({
    where: {
      id: offerId,
      isModerationHidden: false,
      request: {
        createdById: userId,
        deletedAt: null,
        isModerationHidden: false,
      },
      status: { not: "DRAFT" },
      NOT: { submittedById: userId, companyId: null },
    },
    select: { id: true, requestId: true },
  });
}
