import {
  listUnreadIncomingOfferIds,
  listUnreadOutgoingOfferIds,
  offerUnreadTypesForRole,
  type OfferInboxRole,
} from "@/lib/offer/offer-event-unread";
import {
  isOfferInBuyerScope,
  isOfferInSellerScope,
  resolveSellerOfferScope,
  type OfferScopeDb,
} from "@/lib/offer/offer-inbox-scope";
import { unreadNotificationWhere } from "@/lib/notifications/unread";
import { prisma } from "@/lib/prisma";

/**
 * Marks unread offer/negotiation notifications for one offer as READ.
 * Idempotent and ownership-scoped; does not mutate offer state.
 */
export async function markOfferNotificationsAsRead(
  userId: string,
  offerId: string,
  role: OfferInboxRole,
  db: OfferScopeDb = prisma,
) {
  const now = new Date();
  const types = [...offerUnreadTypesForRole(role)];

  return db.notification.updateMany({
    where: {
      userId,
      offerId,
      type: { in: types },
      ...unreadNotificationWhere,
    },
    data: {
      status: "READ",
      readAt: now,
    },
  });
}

/**
 * Marks all unread offer inbox notifications READ for the authenticated user's role surface.
 * Does not mutate offer state.
 */
export async function markAllOfferNotificationsAsRead(
  userId: string,
  role: OfferInboxRole,
  companyId: string | null = null,
  db: OfferScopeDb = prisma,
) {
  const now = new Date();
  const types = [...offerUnreadTypesForRole(role)];
  const scopedOfferIds =
    role === "buyer"
      ? await listUnreadIncomingOfferIds(userId, db)
      : await listUnreadOutgoingOfferIds(userId, companyId, db);

  if (scopedOfferIds.size === 0) {
    return { count: 0 };
  }

  return db.notification.updateMany({
    where: {
      userId,
      offerId: { in: [...scopedOfferIds] },
      type: { in: types },
      ...unreadNotificationWhere,
    },
    data: {
      status: "READ",
      readAt: now,
    },
  });
}

/**
 * Confirms the caller may mark this offer seen on the requested role surface.
 * Uses the same scope authority as the inbox list queries, so a request owner
 * can never clear seller-surface events (and vice versa).
 */
export async function assertOfferSeenAuthority(
  input: {
    userId: string;
    offerId: string;
    role: OfferInboxRole;
  },
  db: OfferScopeDb = prisma,
) {
  if (input.role === "buyer") {
    return isOfferInBuyerScope(input.userId, input.offerId, db);
  }

  const personalScope = await resolveSellerOfferScope(input.userId, null, db);
  if (await isOfferInSellerScope(personalScope, input.offerId, db)) {
    return true;
  }

  const offer = await db.offer.findFirst({
    where: { id: input.offerId },
    select: { companyId: true },
  });
  if (!offer?.companyId) return false;

  const companyScope = await resolveSellerOfferScope(
    input.userId,
    offer.companyId,
    db,
  );
  if (companyScope.kind !== "company") return false;

  return isOfferInSellerScope(companyScope, input.offerId, db);
}
