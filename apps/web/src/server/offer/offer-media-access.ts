import { assertCompanyMembership } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";

export type OfferMediaAccessRow = {
  id: string;
  submittedById: string;
  companyId: string | null;
  createdAt: Date;
  mediaFinalizedAt: Date | null;
  request: { createdById: string };
};

export async function loadOfferForMediaAccess(offerId: string) {
  return prisma.offer.findFirst({
    where: { id: offerId },
    select: {
      id: true,
      submittedById: true,
      companyId: true,
      createdAt: true,
      mediaFinalizedAt: true,
      request: { select: { createdById: true } },
    },
  });
}

export function isOfferSubmitter(
  offer: Pick<OfferMediaAccessRow, "submittedById">,
  userId: string,
) {
  return offer.submittedById === userId;
}

export function isRequestOwner(
  offer: Pick<OfferMediaAccessRow, "request">,
  userId: string,
) {
  return offer.request.createdById === userId;
}

export async function isOfferCompanyMember(
  offer: Pick<OfferMediaAccessRow, "companyId">,
  userId: string,
) {
  if (!offer.companyId) return false;
  const membership = await assertCompanyMembership(userId, offer.companyId);
  return Boolean(membership);
}

/** Read: request owner, offer submitter, or active member of the offer company. */
export async function canReadOfferMedia(
  offer: OfferMediaAccessRow,
  userId: string,
) {
  if (isOfferSubmitter(offer, userId) || isRequestOwner(offer, userId)) {
    return true;
  }
  return isOfferCompanyMember(offer, userId);
}

/** Write/attach: only the user who submitted the offer. */
export function canWriteOfferMedia(
  offer: Pick<OfferMediaAccessRow, "submittedById">,
  userId: string,
) {
  return isOfferSubmitter(offer, userId);
}
