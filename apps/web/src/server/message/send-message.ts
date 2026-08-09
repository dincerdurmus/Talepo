import { prisma } from "@/lib/prisma";
import { containsBlockedContactInfo, sanitizeCommercialText } from "@/lib/membership/contact-filter";

import { createNotification } from "../notifications/create-notification";

export class MessageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessageValidationError";
  }
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  content: string,
) {
  const trimmed = content.trim();

  if (trimmed.length < 1) {
    throw new MessageValidationError("Mesaj boş olamaz.");
  }

  if (containsBlockedContactInfo(trimmed)) {
    throw new MessageValidationError(
      "Mesajlarda telefon, IBAN veya platform dışı iletişim bilgisi paylaşılamaz.",
    );
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId,
      leftAt: null,
    },
    include: {
      conversation: {
        include: {
          offer: {
            select: {
              status: true,
              request: { select: { createdById: true, title: true } },
              submittedById: true,
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

  if (participant.conversation.offer.status !== "ACCEPTED") {
    throw new MessageValidationError(
      "Mesajlaşma yalnızca kabul edilen tekliflerden sonra açılır.",
    );
  }

  const now = new Date();
  const sanitized = sanitizeCommercialText(trimmed);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderUserId: userId,
        content: sanitized,
        type: "TEXT",
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    });

    await tx.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: now },
    });

    return created;
  });

  const recipients = participant.conversation.participants
    .map((item) => item.userId)
    .filter((id): id is string => Boolean(id && id !== userId));

  await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        userId: recipientId,
        type: "NEW_MESSAGE",
        title: "Yeni mesajınız var",
        message: `“${participant.conversation.offer.request.title}” sohbetinde yeni mesaj.`,
        actionUrl: `/panel/mesajlar/${conversationId}`,
      }),
    ),
  );

  return message;
}
