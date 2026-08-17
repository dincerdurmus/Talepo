import { randomBytes } from "node:crypto";

import {
  validateImageBuffer,
  type AllowedImageMime,
} from "@/lib/media/image-validation";
import {
  OFFER_MEDIA_ATTACH_WINDOW_MS,
  OFFER_MEDIA_FORBIDDEN_READ_MESSAGE,
  OFFER_MEDIA_FORBIDDEN_WRITE_MESSAGE,
  OFFER_MEDIA_IMMUTABLE_MESSAGE,
  OFFER_MEDIA_LIMIT_MESSAGE,
  OFFER_MEDIA_MAX_COUNT,
  OFFER_MEDIA_MAX_BYTES,
} from "@/lib/offer/offer-media";
import { DomainError, DomainErrorCode } from "@/lib/observability/errors";
import { prisma } from "@/lib/prisma";
import {
  canReadOfferMedia,
  canWriteOfferMedia,
  loadOfferForMediaAccess,
} from "@/server/offer/offer-media-access";
import { OfferValidationError } from "@/server/offer/offer-service";
import {
  buildOfferMediaStorageKey,
  deleteOfferMediaFile,
  readOfferMediaFile,
  writeOfferMediaFile,
} from "@/server/offer/offer-media-store";

function newMediaId() {
  return `om_${randomBytes(12).toString("hex")}`;
}

async function lockExpiredAttachWindow(offerId: string, createdAt: Date) {
  const elapsed = Date.now() - createdAt.getTime();
  if (elapsed <= OFFER_MEDIA_ATTACH_WINDOW_MS) return false;
  await prisma.offer.updateMany({
    where: { id: offerId, mediaFinalizedAt: null },
    data: { mediaFinalizedAt: new Date() },
  });
  return true;
}

export async function attachOfferMedia(
  userId: string,
  offerId: string,
  input: {
    bytes: Buffer;
    claimedMime?: string | null;
    originalName?: string | null;
  },
) {
  const offer = await loadOfferForMediaAccess(offerId);
  if (!offer) {
    throw new OfferValidationError(["Teklif bulunamadı."]);
  }

  if (!canWriteOfferMedia(offer, userId)) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: OFFER_MEDIA_FORBIDDEN_WRITE_MESSAGE,
    });
  }

  if (offer.mediaFinalizedAt) {
    throw new OfferValidationError([OFFER_MEDIA_IMMUTABLE_MESSAGE]);
  }

  if (await lockExpiredAttachWindow(offer.id, offer.createdAt)) {
    throw new OfferValidationError([OFFER_MEDIA_IMMUTABLE_MESSAGE]);
  }

  let validated;
  try {
    validated = validateImageBuffer(input.bytes, {
      claimedMime: input.claimedMime,
      originalName: input.originalName,
      maxBytes: OFFER_MEDIA_MAX_BYTES,
    });
  } catch (error) {
    throw new OfferValidationError([
      error instanceof Error ? error.message : "Görsel geçersiz.",
    ]);
  }

  const count = await prisma.offerMedia.count({ where: { offerId: offer.id } });
  if (count >= OFFER_MEDIA_MAX_COUNT) {
    throw new OfferValidationError([OFFER_MEDIA_LIMIT_MESSAGE]);
  }

  const mediaId = newMediaId();
  const storageKey = buildOfferMediaStorageKey(
    offer.id,
    mediaId,
    validated.mimeType,
  );
  const originalName = sanitizeOriginalName(input.originalName);

  await writeOfferMediaFile(storageKey, input.bytes);

  try {
    const created = await prisma.offerMedia.create({
      data: {
        id: mediaId,
        offerId: offer.id,
        storageKey,
        mimeType: validated.mimeType,
        byteLength: validated.byteLength,
        sortOrder: count,
        originalName,
      },
      select: {
        id: true,
        mimeType: true,
        byteLength: true,
        sortOrder: true,
      },
    });
    return created;
  } catch (error) {
    await deleteOfferMediaFile(storageKey);
    throw error;
  }
}

export async function finalizeOfferMedia(userId: string, offerId: string) {
  const offer = await loadOfferForMediaAccess(offerId);
  if (!offer) {
    throw new OfferValidationError(["Teklif bulunamadı."]);
  }

  if (!canWriteOfferMedia(offer, userId)) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: OFFER_MEDIA_FORBIDDEN_WRITE_MESSAGE,
    });
  }

  if (offer.mediaFinalizedAt) {
    return { id: offer.id, mediaFinalizedAt: offer.mediaFinalizedAt };
  }

  const updated = await prisma.offer.update({
    where: { id: offer.id },
    data: { mediaFinalizedAt: new Date() },
    select: { id: true, mediaFinalizedAt: true },
  });
  return updated;
}

export async function readOfferMediaBytes(
  userId: string,
  offerId: string,
  mediaId: string,
) {
  const offer = await loadOfferForMediaAccess(offerId);
  if (!offer) {
    throw new DomainError({
      code: DomainErrorCode.REQUEST_NOT_FOUND,
      userMessage: OFFER_MEDIA_FORBIDDEN_READ_MESSAGE,
    });
  }

  if (!(await canReadOfferMedia(offer, userId))) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: OFFER_MEDIA_FORBIDDEN_READ_MESSAGE,
    });
  }

  const media = await prisma.offerMedia.findFirst({
    where: { id: mediaId, offerId: offer.id },
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      byteLength: true,
    },
  });

  if (!media) {
    throw new DomainError({
      code: DomainErrorCode.REQUEST_NOT_FOUND,
      userMessage: "Fotoğraf bulunamadı.",
    });
  }

  const bytes = await readOfferMediaFile(media.storageKey);
  return {
    bytes,
    mimeType: media.mimeType as AllowedImageMime,
    byteLength: media.byteLength,
  };
}

function sanitizeOriginalName(name: string | null | undefined) {
  if (!name) return null;
  const base = name.split(/[/\\]/).pop()?.trim() ?? "";
  if (!base) return null;
  return base.slice(0, 120);
}
