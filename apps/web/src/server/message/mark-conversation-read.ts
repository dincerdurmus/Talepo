import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";

/**
 * Marks the conversation as read for the current user (and company
 * participant row when in a firm workspace). Also clears matching
 * NEW_MESSAGE notifications so the bell badge drops.
 */
export async function markConversationAsRead(
  userId: string,
  conversationId: string,
) {
  const workspace = await getCompanyWorkspace(userId);
  const now = new Date();
  const actionUrl = `/panel/mesajlar/${conversationId}`;

  await Promise.all([
    prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        leftAt: null,
        OR: [
          { userId },
          ...(workspace ? [{ companyId: workspace.companyId }] : []),
        ],
      },
      data: { lastReadAt: now },
    }),
    prisma.notification.updateMany({
      where: {
        userId,
        status: "UNREAD",
        type: "NEW_MESSAGE",
        actionUrl,
      },
      data: {
        status: "READ",
        readAt: now,
      },
    }),
  ]);
}
