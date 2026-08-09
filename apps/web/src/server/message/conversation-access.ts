import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";

import { MessageValidationError } from "./errors";

export async function getSendableConversation(userId: string, conversationId: string) {
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
  const canNegotiateChat =
    status === "SUBMITTED" || status === "VIEWED" || status === "ACCEPTED";

  if (!canNegotiateChat) {
    throw new MessageValidationError(
      "Bu teklif için mesajlaşma artık açık değil.",
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
    /** Full accept unlocks images / post-deal flow; pazarlık allows text only. */
    offerAccepted: status === "ACCEPTED",
    canNegotiate: status === "SUBMITTED" || status === "VIEWED",
  };
}
