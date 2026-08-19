import { randomUUID } from "node:crypto";

import { encodeGroupFileName, sanitizeUserFileName } from "@/lib/message/attachment-group";
import { prisma } from "@/lib/prisma";
import {
  containsBlockedContactInfo,
  sanitizeCommercialText,
} from "@/lib/membership/contact-filter";

import { createNotification } from "../notifications/create-notification";
import { getSendableConversation } from "./conversation-access";
import { moderateMessageImage } from "./moderate-message-image";
import { MessageValidationError } from "./errors";

import { MAX_MESSAGE_IMAGES } from "@/lib/message/limits";

export type ImageMessageInput = {
  imageDataUrl: string;
  fileName?: string | null;
};

export async function sendImageMessages(
  userId: string,
  conversationId: string,
  input: {
    images: ImageMessageInput[];
    caption?: string | null;
  },
) {
  const images = input.images.slice(0, MAX_MESSAGE_IMAGES);
  if (images.length === 0) {
    throw new MessageValidationError("En az bir fotoğraf gerekli.");
  }

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

  const moderated: Array<{
    dataUrl: string;
    byteLength: number;
    mimeType: string;
    fileName: string;
  }> = [];

  for (let index = 0; index < images.length; index += 1) {
    const item = images[index];
    const moderation = await moderateMessageImage(item.imageDataUrl, {
      requestTitle: access.request.title,
      categoryName: access.request.category?.name ?? null,
      city: access.request.city,
      caption: index === 0 ? captionRaw || null : null,
      fileName: item.fileName ?? null,
    });

    if (!moderation.ok) {
      throw new MessageValidationError(
        images.length > 1
          ? `${index + 1}. fotoğraf reddedildi: ${moderation.message}`
          : moderation.message,
      );
    }

    const safeName = sanitizeUserFileName(
      item.fileName?.trim() || `fotograf-${index + 1}.jpg`,
    );

    moderated.push({
      dataUrl: moderation.dataUrl,
      byteLength: moderation.byteLength,
      mimeType: moderation.mimeType,
      fileName: safeName,
    });
  }

  const now = new Date();
  const caption = captionRaw ? sanitizeCommercialText(captionRaw) : null;
  const groupId = moderated.length > 1 ? randomUUID() : null;

  const messages = await prisma.$transaction(async (tx) => {
    const created = [];

    for (let index = 0; index < moderated.length; index += 1) {
      const item = moderated[index];
      const row = await tx.message.create({
        data: {
          conversationId,
          senderUserId: userId,
          senderCompanyId: access.senderCompanyId,
          content: index === 0 ? caption : null,
          type: "IMAGE",
          fileUrl: item.dataUrl,
          fileName: groupId
            ? encodeGroupFileName(groupId, index, item.fileName)
            : item.fileName,
          fileSize: item.byteLength,
          mimeType: item.mimeType,
        },
      });
      created.push(row);
    }

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

  const photoLabel =
    messages.length === 1 ? "yeni fotoğraf" : `${messages.length} yeni fotoğraf`;

  if (recipients.length > 0) {
    await Promise.all(
      recipients.map((recipientId) =>
        createNotification({
          userId: recipientId,
          type: "NEW_MESSAGE",
          title: "Yeni mesajınız var",
          message: `“${access.request.title}” sohbetinde ${photoLabel}.`,
          actionUrl: `/panel/mesajlar/${conversationId}`,
        }),
      ),
    );
  }

  return messages;
}

/** Backward-compatible single-image send. */
export async function sendImageMessage(
  userId: string,
  conversationId: string,
  input: {
    imageDataUrl: string;
    caption?: string | null;
    fileName?: string | null;
  },
) {
  const [message] = await sendImageMessages(userId, conversationId, {
    images: [{ imageDataUrl: input.imageDataUrl, fileName: input.fileName }],
    caption: input.caption,
  });
  return message;
}
