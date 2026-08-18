import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Delegate subset the scope helpers need. Accepting it lets verifiers run the
 * production authority inside a rolled-back transaction.
 */
export type OfferScopeDb = Pick<
  PrismaClient,
  "offer" | "companyMember" | "notification" | "offerArchive"
>;

/**
 * Single source of truth for "which offers belong to this user's inbox surface".
 *
 * Notification rows only carry `userId` + `offerId`, and several notification
 * types (COUNTER_OFFER_RECEIVED / COUNTER_OFFER_REJECTED) are delivered to both
 * sides of a deal. Recipient + type alone therefore cannot decide a role
 * surface — offer/request ownership and workspace must be checked too.
 */

export type SellerOfferScope =
  | { kind: "personal"; userId: string }
  | { kind: "company"; companyId: string };

/** Buyer inbox authority — mirrors /panel/gelen-teklifler list query. */
export function buyerInboxOfferWhere(userId: string) {
  return {
    request: { createdById: userId, deletedAt: null },
    status: { not: "DRAFT" as const },
    NOT: { submittedById: userId, companyId: null },
  };
}

/** Personal seller inbox authority — mirrors /panel/teklifler personal query. */
export function personalSellerInboxOfferWhere(userId: string) {
  return {
    submittedById: userId,
    companyId: null,
    status: { not: "DRAFT" as const },
  };
}

/** Company seller inbox authority — mirrors /panel/teklifler workspace query. */
export function companySellerInboxOfferWhere(companyId: string) {
  return {
    companyId,
    status: { not: "DRAFT" as const },
  };
}

export function sellerInboxOfferWhere(scope: SellerOfferScope) {
  return scope.kind === "company"
    ? companySellerInboxOfferWhere(scope.companyId)
    : personalSellerInboxOfferWhere(scope.userId);
}

/**
 * Resolves the seller scope, downgrading to personal when the caller has no
 * ACTIVE membership for the requested company. Company ids are never trusted
 * blindly.
 */
export async function resolveSellerOfferScope(
  userId: string,
  companyId: string | null,
  db: OfferScopeDb = prisma,
): Promise<SellerOfferScope> {
  if (!companyId) return { kind: "personal", userId };

  const membership = await db.companyMember.findFirst({
    where: {
      userId,
      companyId,
      status: "ACTIVE",
      company: { deletedAt: null },
    },
    select: { id: true },
  });

  return membership
    ? { kind: "company", companyId }
    : { kind: "personal", userId };
}

/** Narrows candidate offer ids to those inside the buyer inbox surface. */
export async function filterOfferIdsInBuyerScope(
  userId: string,
  offerIds: string[],
  db: OfferScopeDb = prisma,
) {
  if (offerIds.length === 0) return new Set<string>();
  const rows = await db.offer.findMany({
    where: { id: { in: offerIds }, ...buyerInboxOfferWhere(userId) },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

/** Narrows candidate offer ids to those inside the seller inbox surface. */
export async function filterOfferIdsInSellerScope(
  scope: SellerOfferScope,
  offerIds: string[],
  db: OfferScopeDb = prisma,
) {
  if (offerIds.length === 0) return new Set<string>();
  const rows = await db.offer.findMany({
    where: { id: { in: offerIds }, ...sellerInboxOfferWhere(scope) },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

/** True when the offer is inside the buyer inbox surface for this user. */
export async function isOfferInBuyerScope(
  userId: string,
  offerId: string,
  db: OfferScopeDb = prisma,
) {
  const row = await db.offer.findFirst({
    where: { id: offerId, ...buyerInboxOfferWhere(userId) },
    select: { id: true },
  });
  return Boolean(row);
}

/** True when the offer is inside the seller inbox surface for this scope. */
export async function isOfferInSellerScope(
  scope: SellerOfferScope,
  offerId: string,
  db: OfferScopeDb = prisma,
) {
  const row = await db.offer.findFirst({
    where: { id: offerId, ...sellerInboxOfferWhere(scope) },
    select: { id: true },
  });
  return Boolean(row);
}
