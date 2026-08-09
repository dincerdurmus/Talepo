import { prisma } from "@/lib/prisma";
import {
  containsBlockedContactInfo,
  sanitizeCommercialText,
} from "@/lib/membership/contact-filter";

import { createNotification } from "../notifications/create-notification";
import { getSendableConversation } from "./conversation-access";
import { moderateMessageImage } from "./moderate-message-image";
import { MessageValidationError } from "./errors";

export async function sendImageMessage(
  userId: string,
  conversationId: string,
  input: {
    imageDataUrl: string;
    caption?: string | null;
    fileName?: string | null;
  },
) {
  const access = await getSendableConversation(userId, conversationId);

  if (!access.offerAccepted) {
    throw new MessageValidationError(
      "Fotoğraf gönderme yalnızca teklif kabul edildikten sonra açılır.",
    );
  }

  if (!access.isSupplier) {
    throw new MessageValidationError(
      "Fotoğraf gönderme yalnızca teklif veren firma tarafında kullanılabilir.",
    );
  }

  const captionRaw = input.caption?.trim() || "";
  if (captionRaw && containsBlockedContactInfo(captionRaw)) {
    throw new MessageValidationError(
      "Mesajlarda telefon, IBAN veya platform dışı iletişim bilgisi paylaşılamaz.",
    );
  }

  const moderation = await moderateMessageImage(input.imageDataUrl, {
    requestTitle: access.request.title,
    categoryName: access.request.category?.name ?? null,
    city: access.request.city,
    caption: captionRaw || null,
    fileName: input.fileName ?? null,
  });

  if (!moderation.ok) {
    throw new MessageValidationError(moderation.message);
  }

  const now = new Date();
  const caption = captionRaw ? sanitizeCommercialText(captionRaw) : null;
  const safeName =
    (input.fileName?.trim() || "fotograf.jpg")
      .replace(/[^\w.\-()+\sğüşıöçĞÜŞİÖÇ]/gi, "")
      .slice(0, 120) || "fotograf.jpg";

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderUserId: userId,
        senderCompanyId: access.senderCompanyId,
        content: caption,
        type: "IMAGE",
        fileUrl: moderation.dataUrl,
        fileName: safeName,
        fileSize: moderation.byteLength,
        mimeType: moderation.mimeType,
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
        message: `“${access.request.title}” sohbetinde yeni fotoğraf.`,
        actionUrl: `/panel/mesajlar/${conversationId}`,
      }),
    ),
  );

  return message;
}
