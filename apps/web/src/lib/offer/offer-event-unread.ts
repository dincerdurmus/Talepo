import { unreadNotificationWhere } from "@/lib/notifications/unread";
import {
  filterOfferIdsInBuyerScope,
  filterOfferIdsInSellerScope,
  resolveSellerOfferScope,
  type OfferScopeDb,
} from "@/lib/offer/offer-inbox-scope";
import { prisma } from "@/lib/prisma";

/**
 * Notification types that create buyer-side unread offer inbox events.
 *
 * COUNTER_OFFER_* types intentionally appear on both role lists: the same
 * notification type is emitted to whichever side receives the counter. Role
 * separation comes from offer/request ownership in `offer-inbox-scope`, never
 * from the type list alone.
 */
export const BUYER_OFFER_UNREAD_TYPES = [
  "NEW_OFFER",
  "COUNTER_OFFER_RECEIVED",
  "COUNTER_OFFER_REJECTED",
] as const;

/** Notification types that create seller-side unread offer inbox events. */
export const SELLER_OFFER_UNREAD_TYPES = [
  "COUNTER_OFFER_RECEIVED",
  "COUNTER_OFFER_ACCEPTED",
  "COUNTER_OFFER_REJECTED",
  "OFFER_ACCEPTED",
  "OFFER_REJECTED",
] as const;

export type OfferInboxRole = "buyer" | "seller";

export function offerUnreadTypesForRole(role: OfferInboxRole) {
  return role === "buyer"
    ? ([...BUYER_OFFER_UNREAD_TYPES] as const)
    : ([...SELLER_OFFER_UNREAD_TYPES] as const);
}

export function unreadIncomingOfferEventsWhere(userId: string) {
  return {
    userId,
    offerId: { not: null },
    type: { in: [...BUYER_OFFER_UNREAD_TYPES] },
    ...unreadNotificationWhere,
  };
}

export function unreadOutgoingOfferEventsWhere(userId: string) {
  return {
    userId,
    offerId: { not: null },
    type: { in: [...SELLER_OFFER_UNREAD_TYPES] },
    ...unreadNotificationWhere,
  };
}

async function archivedOfferIdsForScope(
  input: {
    userId: string;
    companyId: string | null;
  },
  db: OfferScopeDb = prisma,
) {
  const rows = await db.offerArchive.findMany({
    where: {
      userId: input.userId,
      companyId: input.companyId,
    },
    select: { offerId: true },
  });
  return rows.map((row) => row.offerId);
}

/** Unique unread offer count — deduped by offerId, not raw notification rows. */
export async function countUnreadIncomingOfferEvents(
  userId: string,
  db: OfferScopeDb = prisma,
) {
  const unreadOfferIds = await listUnreadIncomingOfferIds(userId, db);
  return unreadOfferIds.size;
}

/** Unique unread offer count — deduped by offerId, not raw notification rows. */
export async function countUnreadOutgoingOfferEvents(
  userId: string,
  companyId: string | null = null,
  db: OfferScopeDb = prisma,
) {
  const unreadOfferIds = await listUnreadOutgoingOfferIds(userId, companyId, db);
  return unreadOfferIds.size;
}

async function candidateUnreadOfferIds(
  where: object,
  archivedOfferIds: string[],
  db: OfferScopeDb,
) {
  const rows = await db.notification.findMany({
    where: {
      ...where,
      ...(archivedOfferIds.length > 0
        ? { offerId: { not: null, notIn: archivedOfferIds } }
        : {}),
    },
    select: { offerId: true },
    distinct: ["offerId"],
  });
  return rows
    .map((row) => row.offerId)
    .filter((id): id is string => Boolean(id));
}

export async function listUnreadIncomingOfferIds(
  userId: string,
  db: OfferScopeDb = prisma,
) {
  const archivedOfferIds = await archivedOfferIdsForScope(
    { userId, companyId: null },
    db,
  );
  const candidates = await candidateUnreadOfferIds(
    unreadIncomingOfferEventsWhere(userId),
    archivedOfferIds,
    db,
  );
  return filterOfferIdsInBuyerScope(userId, candidates, db);
}

export async function listUnreadOutgoingOfferIds(
  userId: string,
  companyId: string | null = null,
  db: OfferScopeDb = prisma,
) {
  const scope = await resolveSellerOfferScope(userId, companyId, db);
  const archivedOfferIds = await archivedOfferIdsForScope(
    {
      userId,
      companyId: scope.kind === "company" ? scope.companyId : null,
    },
    db,
  );
  const candidates = await candidateUnreadOfferIds(
    unreadOutgoingOfferEventsWhere(userId),
    archivedOfferIds,
    db,
  );
  return filterOfferIdsInSellerScope(scope, candidates, db);
}

export function isOfferUnreadForRole(
  offerId: string,
  unreadOfferIds: ReadonlySet<string>,
) {
  return unreadOfferIds.has(offerId);
}
