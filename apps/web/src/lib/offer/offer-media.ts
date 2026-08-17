import { MESSAGE_IMAGE_MAX_BYTES } from "@/lib/media/image-validation";

/** Max product photos per offer. Photos are optional. */
export const OFFER_MEDIA_MAX_COUNT = 5;

/** Server stored size — reuse message image policy. */
export const OFFER_MEDIA_MAX_BYTES = MESSAGE_IMAGE_MAX_BYTES;

/** Client picker limit before compression (same as MessageComposer). */
export const OFFER_MEDIA_CLIENT_MAX_BYTES = 8_000_000;

/** Attach window after create when deferMediaFinalize is used. */
export const OFFER_MEDIA_ATTACH_WINDOW_MS = 15 * 60 * 1000;

export const OFFER_MEDIA_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type OfferMediaMime = (typeof OFFER_MEDIA_ALLOWED_MIME)[number];

export const OFFER_MEDIA_LIMIT_MESSAGE =
  "Teklife en fazla 5 fotoğraf eklenebilir.";

export const OFFER_MEDIA_TYPE_MESSAGE =
  "Yalnızca JPEG, PNG veya WebP kabul edilir. SVG, GIF ve belgeler yüklenemez.";

export const OFFER_MEDIA_SIZE_MESSAGE =
  "Görsel çok büyük. Lütfen 2.5 MB altındaki bir görsel yükleyin.";

export const OFFER_MEDIA_CLIENT_SIZE_MESSAGE =
  "Görsel en fazla 8 MB olabilir.";

export const OFFER_MEDIA_IMMUTABLE_MESSAGE =
  "Teklif gönderildikten sonra ürün fotoğrafları değiştirilemez.";

export const OFFER_MEDIA_FORBIDDEN_WRITE_MESSAGE =
  "Bu teklife yalnızca teklifi veren kişi fotoğraf ekleyebilir.";

export const OFFER_MEDIA_FORBIDDEN_READ_MESSAGE =
  "Bu ürün fotoğrafına erişim yetkiniz yok.";

export const OFFER_MEDIA_COPY =
  "Elinizdeki ürünü gösteren en fazla 5 fotoğraf ekleyebilirsiniz.";

export function isOfferMediaMime(value: string | null | undefined): value is OfferMediaMime {
  return Boolean(
    value &&
      OFFER_MEDIA_ALLOWED_MIME.includes(
        value.toLowerCase() as OfferMediaMime,
      ),
  );
}

export function offerMediaSrc(offerId: string, mediaId: string) {
  return `/api/offers/${offerId}/media/${mediaId}`;
}

export const offerListMediaInclude = {
  media: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true },
  },
};
