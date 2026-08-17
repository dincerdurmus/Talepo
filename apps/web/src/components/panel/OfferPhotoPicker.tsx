"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";

import { compressImageToDataUrl } from "@/lib/media/compress-image";
import {
  OFFER_MEDIA_CLIENT_MAX_BYTES,
  OFFER_MEDIA_CLIENT_SIZE_MESSAGE,
  OFFER_MEDIA_COPY,
  OFFER_MEDIA_LIMIT_MESSAGE,
  OFFER_MEDIA_MAX_COUNT,
  OFFER_MEDIA_TYPE_MESSAGE,
  isOfferMediaMime,
} from "@/lib/offer/offer-media";

export type PendingOfferPhoto = {
  localId: string;
  file: File;
  previewUrl: string;
  name: string;
  status: "ready" | "uploading" | "uploaded" | "error";
  error?: string;
};

type OfferPhotoPickerProps = {
  photos: PendingOfferPhoto[];
  onChange: (photos: PendingOfferPhoto[]) => void;
  disabled?: boolean;
  lockedMediaIds?: string[];
  offerId?: string | null;
};

function dataUrlToJpegFile(dataUrl: string, name: string) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw new Error("Görsel hazırlanamadı.");
  const binary = atob(match[1].replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const base = name.replace(/\.[^.]+$/, "") || "urun";
  return new File([bytes], `${base}.jpg`, { type: "image/jpeg" });
}

async function preparePhoto(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    throw new Error(OFFER_MEDIA_TYPE_MESSAGE);
  }
  if (!isOfferMediaMime(file.type) && !file.type.startsWith("image/")) {
    throw new Error(OFFER_MEDIA_TYPE_MESSAGE);
  }
  if (!isOfferMediaMime(file.type)) {
    throw new Error(OFFER_MEDIA_TYPE_MESSAGE);
  }
  if (file.size > OFFER_MEDIA_CLIENT_MAX_BYTES) {
    throw new Error(OFFER_MEDIA_CLIENT_SIZE_MESSAGE);
  }

  const keepOriginal =
    (file.type === "image/png" || file.type === "image/webp") &&
    file.size <= 2_500_000;

  if (keepOriginal) return file;

  const dataUrl = await compressImageToDataUrl(file, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
    maxBytes: 700_000,
  });
  return dataUrlToJpegFile(dataUrl, file.name);
}

export function OfferPhotoPicker({
  photos,
  onChange,
  disabled = false,
  lockedMediaIds = [],
  offerId = null,
}: OfferPhotoPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const photo of photos) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
    // Revoke only on unmount; individual removes revoke immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addFiles(fileList: FileList | null) {
    if (!fileList || disabled) return;
    setPickerError(null);

    const remaining = OFFER_MEDIA_MAX_COUNT - photos.length;
    if (remaining <= 0) {
      setPickerError(OFFER_MEDIA_LIMIT_MESSAGE);
      return;
    }

    const incoming = [...fileList].slice(0, remaining);
    if (fileList.length > remaining) {
      setPickerError(OFFER_MEDIA_LIMIT_MESSAGE);
    }

    const next = [...photos];
    for (const file of incoming) {
      try {
        const prepared = await preparePhoto(file);
        next.push({
          localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          file: prepared,
          previewUrl: URL.createObjectURL(prepared),
          name: file.name,
          status: "ready",
        });
      } catch (error) {
        setPickerError(
          `${file.name}: ${
            error instanceof Error ? error.message : OFFER_MEDIA_TYPE_MESSAGE
          }`,
        );
      }
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removePhoto(localId: string) {
    const target = photos.find((photo) => photo.localId === localId);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(photos.filter((photo) => photo.localId !== localId));
  }

  const canAdd = !disabled && photos.length < OFFER_MEDIA_MAX_COUNT;

  return (
    <div className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-3.5 py-3.5">
      <p className="text-sm font-medium text-teal-950/70">Ürün fotoğrafları</p>
      <p className="mt-1 text-xs leading-5 text-teal-950/45">
        {OFFER_MEDIA_COPY}
      </p>

      {lockedMediaIds.length > 0 && offerId ? (
        <p className="mt-2 text-xs text-teal-950/50">
          Gönderilmiş {lockedMediaIds.length} fotoğraf kilitlidir.
        </p>
      ) : null}

      {photos.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li
              key={photo.localId}
              className="relative h-20 w-20 overflow-hidden rounded-xl bg-white ring-1 ring-teal-900/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={photo.name}
                className="h-full w-full object-cover"
              />
              {photo.status === "uploading" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-[#0f1f1d]/40">
                  <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                </span>
              ) : null}
              {photo.status === "error" ? (
                <span className="absolute inset-x-0 bottom-0 bg-[#8b352b] px-1 py-0.5 text-[9px] font-semibold leading-3 text-white">
                  Hata
                </span>
              ) : null}
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removePhoto(photo.localId)}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-[#0f1f1d]"
                  aria-label={`${photo.name} dosyasını kaldır`}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {photos.some((photo) => photo.status === "error") ? (
        <ul className="mt-2 space-y-1">
          {photos
            .filter((photo) => photo.status === "error" && photo.error)
            .map((photo) => (
              <li
                key={`${photo.localId}-err`}
                className="text-xs text-[#8b352b]"
              >
                {photo.name}: {photo.error}
              </li>
            ))}
        </ul>
      ) : null}

      {pickerError ? (
        <p className="mt-2 text-xs text-[#8b352b]">{pickerError}</p>
      ) : null}

      <div className="mt-3">
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={!canAdd}
          className="sr-only"
          onChange={(event) => void addFiles(event.target.files)}
        />
        <label
          htmlFor={inputId}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-teal-800/15 bg-white px-3.5 py-2.5 text-sm font-semibold text-teal-950 ${
            canAdd ? "hover:bg-teal-50" : "cursor-not-allowed opacity-40"
          }`}
        >
          <ImagePlus className="h-4 w-4" />
          Fotoğraf ekle
        </label>
        <p className="mt-1.5 text-[11px] text-teal-950/40">
          {photos.length}/{OFFER_MEDIA_MAX_COUNT} · JPEG, PNG, WebP
        </p>
      </div>
    </div>
  );
}
