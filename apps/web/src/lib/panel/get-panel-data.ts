import { unreadNotificationWhere } from "@/lib/notifications/unread";
import { buyerActionableIncomingOffersWhere } from "@/lib/offer/incoming-offer-inbox";
import { sellerActionableOutgoingOffersWhere } from "@/lib/offer/outgoing-offer-inbox";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";

const ACTIVE_REQUEST_STATUSES = [
  "PUBLISHED",
  "RECEIVING_OFFERS",
  "OFFER_SELECTED",
  "IN_PROGRESS",
] as const;

/** Open incoming offers that still need a buyer response. */
export const NEW_INCOMING_OFFER_STATUSES = ["SUBMITTED", "VIEWED"] as const;

export function newIncomingOffersWhere(userId: string) {
  return {
    ...buyerActionableIncomingOffersWhere(userId),
    status: { in: [...NEW_INCOMING_OFFER_STATUSES] },
  };
}

export async function countNewIncomingOffers(userId: string) {
  return prisma.offer.count({ where: newIncomingOffersWhere(userId) });
}

export async function countSellerActionableOutgoingOffersForScope(scope: {
  userId: string;
  companyId: string | null;
}) {
  return prisma.offer.count({
    where: sellerActionableOutgoingOffersWhere(scope),
  });
}

export async function getPanelSummary(userId: string) {
  const [activeRequests, unreadNotifications, offersOnMyRequests, recentNotifications] =
    await Promise.all([
      prisma.request.count({
        where: {
          createdById: userId,
          deletedAt: null,
          status: { in: [...ACTIVE_REQUEST_STATUSES] },
        },
      }),
      prisma.notification.count({
        where: { userId, ...unreadNotificationWhere },
      }),
      countNewIncomingOffers(userId),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

  return {
    activeRequests,
    unreadNotifications,
    newOffers: offersOnMyRequests,
    recentNotifications,
  };
}

export async function getUnreadMessageCount(userId: string) {
  const workspace = await getCompanyWorkspace(userId);

  const participants = await prisma.conversationParticipant.findMany({
    where: {
      leftAt: null,
      OR: [
        { userId },
        ...(workspace ? [{ companyId: workspace.companyId }] : []),
      ],
    },
    select: {
      conversationId: true,
      lastReadAt: true,
      conversation: {
        select: { lastMessageAt: true },
      },
    },
  });

  // Prefer the freshest lastReadAt when user + company rows both exist.
  const byConversation = new Map<
    string,
    { lastReadAt: Date | null; lastMessageAt: Date | null }
  >();

  for (const row of participants) {
    const existing = byConversation.get(row.conversationId);
    if (!existing) {
      byConversation.set(row.conversationId, {
        lastReadAt: row.lastReadAt,
        lastMessageAt: row.conversation.lastMessageAt,
      });
      continue;
    }

    const existingTs = existing.lastReadAt?.getTime() ?? 0;
    const nextTs = row.lastReadAt?.getTime() ?? 0;
    if (nextTs > existingTs) {
      existing.lastReadAt = row.lastReadAt;
    }
  }

  let unread = 0;
  for (const row of byConversation.values()) {
    if (!row.lastMessageAt) continue;
    if (!row.lastReadAt || row.lastReadAt < row.lastMessageAt) {
      unread += 1;
    }
  }

  return unread;
}
