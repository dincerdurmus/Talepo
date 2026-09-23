import { assertCompanyWriteAccess, assertSelectedCompanyWriteAccess } from "@/server/company/company-write-access";
import { assertCompanyMembership } from "@/lib/panel/company-workspace";

export type NegotiationOfferAccess = {
  id: string;
  submittedById: string;
  companyId: string | null;
  request: { createdById: string; companyId?: string | null };
};

export function isNegotiationBuyer(
  offer: Pick<NegotiationOfferAccess, "request">,
  userId: string,
) {
  return offer.request.createdById === userId;
}

export function isNegotiationPersonalProvider(
  offer: Pick<NegotiationOfferAccess, "submittedById" | "companyId">,
  userId: string,
) {
  return offer.companyId == null && offer.submittedById === userId;
}

export async function isNegotiationCompanyProvider(
  offer: Pick<NegotiationOfferAccess, "companyId">,
  userId: string,
) {
  if (!offer.companyId) return false;
  const membership = await assertCompanyMembership(userId, offer.companyId);
  return Boolean(membership);
}

export async function isNegotiationProvider(
  offer: NegotiationOfferAccess,
  userId: string,
) {
  if (offer.submittedById === userId) return true;
  return isNegotiationCompanyProvider(offer, userId);
}

export async function resolveNegotiationActorSide(
  offer: NegotiationOfferAccess,
  userId: string,
): Promise<"BUYER" | "PROVIDER" | null> {
  if (isNegotiationBuyer(offer, userId)) return "BUYER";
  if (await isNegotiationProvider(offer, userId)) return "PROVIDER";
  return null;
}

/** Mutation authority is separate from readable participation/history. */
export async function assertNegotiationWriteAccess(offer: NegotiationOfferAccess, userId: string) {
  await assertSelectedCompanyWriteAccess(userId);
  await assertCompanyWriteAccess(userId, isNegotiationBuyer(offer, userId) ? offer.request.companyId : offer.companyId);
}
