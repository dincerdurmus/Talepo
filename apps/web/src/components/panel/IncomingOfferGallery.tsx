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
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  if (mediaIds.length === 0) return null;

  const safeIndex = Math.min(selected, mediaIds.length - 1);
  const currentId = mediaIds[safeIndex];
  const countLabel =
    mediaIds.length === 1 ? "1 fotoğraf" : `${mediaIds.length} fotoğraf`;
  const photoAlt = `${sellerName} teklifine ait fotoğraf ${safeIndex + 1}`;

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-900/45">
          Teklif fotoğrafları
        </p>
        <p className="text-[11px] font-medium text-black/40">{countLabel}</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 block w-full overflow-hidden rounded-xl bg-teal-900/5 ring-1 ring-teal-900/10"
        aria-label="Teklif fotoğrafını büyüt"
      >
        {failed[currentId] ? (
          <span className="flex aspect-[16/10] items-center justify-center text-xs text-black/40">
            Görsel yüklenemedi
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={offerMediaSrc(offerId, currentId)}
            alt={photoAlt}
            className="aspect-[16/10] w-full object-cover"
            onError={() =>
              setFailed((current) => ({ ...current, [currentId]: true }))
            }
          />
        )}
      </button>
      {mediaIds.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
          {mediaIds.map((id, index) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(index)}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-2 ${
                index === safeIndex
                  ? "ring-[#0f766e]"
                  : "ring-transparent hover:ring-teal-900/20"
              }`}
              aria-label={`${sellerName} teklifine ait fotoğraf ${index + 1}`}
              aria-current={index === safeIndex}
            >
              {failed[id] ? (
                <span className="flex h-full w-full items-center justify-center bg-teal-900/5 text-[10px] text-black/35">
                  —
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={offerMediaSrc(offerId, id)}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() =>
                    setFailed((current) => ({ ...current, [id]: true }))
                  }
                />
              )}
            </button>
          ))}
        </div>
      ) : null}
      <OfferMediaLightbox
        offerId={offerId}
        mediaIds={mediaIds}
        startIndex={safeIndex}
        open={open}
        onClose={() => setOpen(false)}
        sellerName={sellerName}
      />
    </div>
  );
}
