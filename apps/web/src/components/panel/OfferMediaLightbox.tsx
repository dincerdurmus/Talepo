"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { offerMediaSrc } from "@/lib/offer/offer-media";

type OfferMediaLightboxProps = {
  offerId: string;
  mediaIds: string[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
};

export function OfferMediaLightbox({
  offerId,
  mediaIds,
  startIndex = 0,
  open,
  onClose,
}: OfferMediaLightboxProps) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(mediaIds.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(0, current - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mediaIds.length, onClose, open]);

  if (!open || mediaIds.length === 0) return null;

  const mediaId = mediaIds[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1f1d]/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ürün fotoğrafı"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-[#0f1f1d]"
        aria-label="Kapat"
      >
        <X className="h-4 w-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={offerMediaSrc(offerId, mediaId)}
        alt={`Ürün fotoğrafı ${index + 1}`}
        className="max-h-[86vh] max-w-full rounded-2xl object-contain"
        onClick={(event) => event.stopPropagation()}
      />
      {mediaIds.length > 1 ? (
        <p className="absolute bottom-5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#0f1f1d]">
          {index + 1} / {mediaIds.length}
        </p>
      ) : null}
    </div>
  );
}
