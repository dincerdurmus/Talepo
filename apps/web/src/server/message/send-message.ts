import { prisma } from "@/lib/prisma";
import {
  containsBlockedContactInfo,
  sanitizeCommercialText,
} from "@/lib/membership/contact-filter";

import { createNotification } from "../notifications/create-notification";
import { getSendableConversation } from "./conversation-access";
import { MessageValidationError } from "./errors";

export { MessageValidationError };

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

  const access = await getSendableConversation(userId, conversationId);
  const now = new Date();
  const sanitized = sanitizeCommercialText(trimmed);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderUserId: userId,
        senderCompanyId: access.senderCompanyId,
        content: sanitized,
        type: "TEXT",
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    });

    await tx.conversationParticipant.update({
      where: { id: access.participant.id },
      data: { lastReadAt: now },
    });

    return created;
  });

  const recipients = access.participant.conversation.participants
    .map((item) => item.userId)
    .filter((id): id is string => Boolean(id && id !== userId));

  await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        userId: recipientId,
        type: "NEW_MESSAGE",
        title: "Yeni mesajınız var",
        message: `“${access.request.title}” sohbetinde yeni mesaj.`,
        actionUrl: `/panel/mesajlar/${conversationId}`,
      }),
    ),
  );

  return message;
}
