import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";

export class PublicProfileAccessError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404 = 403,
  ) {
    super(message);
    this.name = "PublicProfileAccessError";
  }
}

/** Fail-closed: viewer must be an active participant in the conversation. */
export async function assertConversationParticipantAccess(
  viewerUserId: string,
  conversationId: string,
): Promise<void> {
  const workspace = await getCompanyWorkspace(viewerUserId);

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      leftAt: null,
      OR: [
        { userId: viewerUserId },
        ...(workspace ? [{ companyId: workspace.companyId }] : []),
      ],
    },
    select: { id: true },
  });

  if (!participant) {
    throw new PublicProfileAccessError("Profil bulunamadı.", 404);
  }
}

/** Self-access is always allowed for own profile editing/view. */
export function isSelfProfile(viewerUserId: string, targetUserId: string) {
  return viewerUserId === targetUserId;
}
