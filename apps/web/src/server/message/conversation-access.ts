import { assertCompanyWriteAccess, assertSelectedCompanyWriteAccess } from "@/server/company/company-write-access";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";

import { MessageValidationError } from "./errors";

export async function getSendableConversation(userId: string, conversationId: string) {
  await assertSelectedCompanyWriteAccess(userId);
  const workspace = await getCompanyWorkspace(userId);

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      leftAt: null,
      OR: [
        { userId },
        ...(workspace ? [{ companyId: workspace.companyId }] : []),
      ],
    },
    include: {
      conversation: {
        include: {
          offer: {
            select: {
              status: true,
              companyId: true,
              submittedById: true,
              request: {
                select: {
                  createdById: true,
                  companyId: true,
                  title: true,
                  city: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
          participants: {
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!participant) {
    throw new MessageValidationError("Bu sohbete erişiminiz yok.");
  }

  const offer = participant.conversation.offer;
  const status = offer.status;
  await assertCompanyWriteAccess(userId, offer.request.createdById === userId ? offer.request.companyId : offer.companyId);

  // Messaging is only for agreed deals. Historical pre-accept chats remain
  // readable via the conversation page, but new sends are blocked.
  if (status !== "ACCEPTED") {
    throw new MessageValidationError(
      "Mesajlaşma yalnızca teklif kabul edildikten sonra açılır. Fiyat için karşı teklif kullanın.",
    );
  }

  const isSupplier =
    offer.submittedById === userId ||
    Boolean(workspace && offer.companyId === workspace.companyId);

  return {
    participant,
    workspace,
    senderCompanyId: isSupplier ? (workspace?.companyId ?? offer.companyId) : null,
    isSupplier,
    request: offer.request,
    offerAccepted: true,
    canNegotiate: false,
  };
}
