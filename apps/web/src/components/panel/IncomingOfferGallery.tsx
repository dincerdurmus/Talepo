"use client";

import { useState } from "react";

import { OfferMediaLightbox } from "@/components/panel/OfferMediaLightbox";
import { offerMediaSrc } from "@/lib/offer/offer-media";

export function IncomingOfferGallery({
  offerId,
  mediaIds,
  sellerName,
}: {
  offerId: string;
  mediaIds: string[];
  sellerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (mediaIds.length === 0) return null;

  const thumbId = mediaIds[0];
  const photoCountLabel =
    mediaIds.length === 1 ? "1 fotoğraf" : `${mediaIds.length} fotoğraf`;
  const countLabel = `Fotoğrafları görüntüle (${mediaIds.length})`;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-teal-900/10 bg-white px-2.5 py-1.5 text-left"
        aria-label={`${sellerName} teklifine ait fotoğraf, ${photoCountLabel}. Teklif fotoğrafını büyüt`}
      >
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-teal-900/5">
          {failed ? (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-black/35">
              —
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offerMediaSrc(offerId, thumbId)}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setFailed(true)}
            />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-900/45">
            Teklif fotoğrafları
          </span>
          <span className="block truncate text-sm font-semibold text-[#0f1f1d]">
            {countLabel}
          </span>
        </span>
      </button>
      <OfferMediaLightbox
        offerId={offerId}
        mediaIds={mediaIds}
        startIndex={0}
        open={open}
        onClose={() => setOpen(false)}
        sellerName={sellerName}
      />
    </div>
  );
}
