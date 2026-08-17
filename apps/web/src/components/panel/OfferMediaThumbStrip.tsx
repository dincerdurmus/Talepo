"use client";

import { useState } from "react";

import { OfferMediaLightbox } from "@/components/panel/OfferMediaLightbox";
import { offerMediaSrc } from "@/lib/offer/offer-media";

type OfferMediaThumbStripProps = {
  offerId: string;
  mediaIds: string[];
  compact?: boolean;
};

export function OfferMediaThumbStrip({
  offerId,
  mediaIds,
  compact = false,
}: OfferMediaThumbStripProps) {
  const [open, setOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  if (mediaIds.length === 0) return null;

  const first = mediaIds[0];
  const size = compact ? "h-11 w-11" : "h-14 w-14";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStartIndex(0);
          setOpen(true);
        }}
        className="mt-3 flex min-w-0 items-center gap-2.5 text-left"
        aria-label={`${mediaIds.length} ürün fotoğrafı`}
      >
        <span
          className={`${size} shrink-0 overflow-hidden rounded-xl bg-teal-900/5 ring-1 ring-teal-900/10`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={offerMediaSrc(offerId, first)}
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
        <span className="text-xs font-semibold text-teal-900/70">
          {mediaIds.length} fotoğraf
        </span>
      </button>
      <OfferMediaLightbox
        offerId={offerId}
        mediaIds={mediaIds}
        startIndex={startIndex}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
