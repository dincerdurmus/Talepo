"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type MessageImageLightboxProps = {
  images: { src: string; alt: string }[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
};

export function MessageImageLightbox({
  images,
  startIndex = 0,
  open,
  onClose,
}: MessageImageLightboxProps) {
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
        setIndex((current) => Math.min(images.length - 1, current + 1));
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
        } else if (!document.activeElement?.contains(last) && !event.shiftKey) {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [images.length, onClose, open]);

  if (!open || images.length === 0) return null;

  const current = images[index];

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0f1f1d]/80 p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:pb-4 motion-reduce:transition-none"
      role="dialog"
      aria-modal="true"
      aria-label="Sohbet fotoğrafını büyüt"
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
      {images.length > 1 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIndex((currentIndex) => Math.max(0, currentIndex - 1));
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
        src={current.src}
        alt={current.alt}
        className="max-h-[min(72vh,calc(100dvh-10rem))] max-w-full rounded-2xl object-contain"
        onClick={(event) => event.stopPropagation()}
      />
      {images.length > 1 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIndex((currentIndex) =>
              Math.min(images.length - 1, currentIndex + 1),
            );
          }}
          disabled={index === images.length - 1}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-[#0f1f1d] disabled:opacity-40 sm:right-16"
          aria-label="Sonraki fotoğraf"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}
      {images.length > 1 ? (
        <p className="absolute bottom-5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#0f1f1d]">
          {index + 1} / {images.length}
        </p>
      ) : null}
    </div>
  );
}
