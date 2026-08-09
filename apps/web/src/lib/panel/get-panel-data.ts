import { prisma } from "@/lib/prisma";

const ACTIVE_REQUEST_STATUSES = [
  "PUBLISHED",
  "RECEIVING_OFFERS",
  "OFFER_SELECTED",
  "IN_PROGRESS",
] as const;

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
        where: { userId, status: "UNREAD" },
      }),
      prisma.offer.count({
        where: {
          request: { createdById: userId, deletedAt: null },
          status: { in: ["SUBMITTED", "VIEWED"] },
        },
      }),
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
  const participants = await prisma.conversationParticipant.findMany({
    where: {
      userId,
      leftAt: null,
    },
    select: {
      lastReadAt: true,
      conversation: {
        select: { lastMessageAt: true },
      },
    },
  });

  return participants.filter((participant) => {
    const lastMessageAt = participant.conversation.lastMessageAt;
    if (!lastMessageAt) return false;
    if (!participant.lastReadAt) return true;
    return participant.lastReadAt < lastMessageAt;
  }).length;
}
