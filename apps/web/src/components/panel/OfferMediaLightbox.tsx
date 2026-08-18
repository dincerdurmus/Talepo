"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { offerMediaSrc } from "@/lib/offer/offer-media";

type OfferMediaLightboxProps = {
  offerId: string;
  mediaIds: string[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
  sellerName?: string;
};

export function OfferMediaLightbox({
  offerId,
  mediaIds,
  startIndex = 0,
  open,
  onClose,
  sellerName,
}: OfferMediaLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(mediaIds.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = [
          ...dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((node) => !node.hasAttribute("disabled"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [mediaIds.length, onClose, open]);

  if (!open || mediaIds.length === 0) return null;

  const mediaId = mediaIds[index];
  const alt = sellerName
    ? `${sellerName} teklifine ait fotoğraf ${index + 1}`
    : `Ürün fotoğrafı ${index + 1}`;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1f1d]/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Teklif fotoğrafını büyüt"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-[#0f1f1d]"
        aria-label="Kapat"
      >
        <X className="h-4 w-4" />
      </button>
      {mediaIds.length > 1 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIndex((current) => Math.max(0, current - 1));
          }}
          disabled={index === 0}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-[#0f1f1d] disabled:opacity-40 sm:left-6"
          aria-label="Önceki fotoğraf"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={offerMediaSrc(offerId, mediaId)}
        alt={alt}
        className="max-h-[86vh] max-w-full rounded-2xl object-contain"
        onClick={(event) => event.stopPropagation()}
      />
      {mediaIds.length > 1 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIndex((current) => Math.min(mediaIds.length - 1, current + 1));
          }}
          disabled={index === mediaIds.length - 1}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-[#0f1f1d] disabled:opacity-40 sm:right-16"
          aria-label="Sonraki fotoğraf"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}
      {mediaIds.length > 1 ? (
        <p className="absolute bottom-5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#0f1f1d]">
          {index + 1} / {mediaIds.length}
        </p>
      ) : null}
    </div>
  );
}
