"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Lock, X } from "lucide-react";

import { compressImageToDataUrl } from "@/lib/media/compress-image";
import {
  OFFER_MEDIA_CLIENT_MAX_BYTES,
  OFFER_MEDIA_CLIENT_SIZE_MESSAGE,
  OFFER_MEDIA_COPY,
  OFFER_MEDIA_LIMIT_MESSAGE,
  OFFER_MEDIA_MAX_COUNT,
  OFFER_MEDIA_TYPE_MESSAGE,
  isOfferMediaMime,
  offerMediaSrc,
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

type PreviewItem = {
  key: string;
  src: string;
  alt: string;
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [brokenKeys, setBrokenKeys] = useState<Record<string, true>>({});

  useEffect(() => {
    return () => {
      for (const photo of photos) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
    // Revoke only on unmount; individual removes revoke immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lockedItems: PreviewItem[] =
    offerId && lockedMediaIds.length > 0
      ? lockedMediaIds.map((mediaId, index) => ({
          key: `locked-${mediaId}`,
          src: offerMediaSrc(offerId, mediaId),
          alt: `Gönderilmiş fotoğraf ${index + 1}`,
        }))
      : [];

  const pendingItems: PreviewItem[] = photos.map((photo) => ({
    key: photo.localId,
    src: photo.previewUrl,
    alt: photo.name,
  }));

  const previewItems = [...lockedItems, ...pendingItems];

  useEffect(() => {
    if (previewIndex == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewIndex(null);
        return;
      }
      if (previewItems.length < 2) return;
      if (event.key === "ArrowRight") {
        setPreviewIndex((current) =>
          current == null ? 0 : (current + 1) % previewItems.length,
        );
      }
      if (event.key === "ArrowLeft") {
        setPreviewIndex((current) =>
          current == null
            ? 0
            : (current - 1 + previewItems.length) % previewItems.length,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [previewIndex, previewItems.length]);

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
  const activePreview =
    previewIndex != null ? previewItems[previewIndex] : null;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3d5c58]/90">
        Görseller
      </p>
      <p className="mt-1 text-[13px] font-medium text-[#536b68]">
        Ürün fotoğrafları
      </p>
      <p className="mt-0.5 text-[13px] leading-5 text-[#0f1f1d]/55">
        Ürününüzü gösteren en fazla {OFFER_MEDIA_MAX_COUNT} görsel ekleyin.
      </p>
      <p className="mt-0.5 text-[12px] text-[#0f1f1d]/48">{OFFER_MEDIA_COPY}</p>

      {lockedMediaIds.length > 0 && offerId ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-teal-950/50">
          <Lock className="h-3 w-3" aria-hidden />
          Gönderilmiş {lockedMediaIds.length} fotoğraf kilitlidir.
        </p>
      ) : null}

      <ul className="mt-3 flex flex-wrap gap-2">
        {lockedItems.map((item, index) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => setPreviewIndex(index)}
              className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-[14px] bg-[#eef2f1] ring-1 ring-teal-900/10 transition hover:ring-teal-700/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/30"
              aria-label={`${item.alt} önizle`}
            >
              {brokenKeys[item.key] ? (
                <span className="flex h-full w-full items-center justify-center text-[10px] text-[#0f1f1d]/35">
                  Görsel
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.src}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() =>
                    setBrokenKeys((current) => ({ ...current, [item.key]: true }))
                  }
                />
              )}
            </button>
          </li>
        ))}

        {photos.map((photo, index) => {
          const previewAt = lockedItems.length + index;
          return (
            <li key={photo.localId} className="relative">
              <button
                type="button"
                onClick={() => setPreviewIndex(previewAt)}
                className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-[14px] bg-[#eef2f1] ring-1 ring-teal-900/10 transition hover:ring-teal-700/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/30"
                aria-label={`${photo.name} önizle`}
              >
                {brokenKeys[photo.localId] ? (
                  <span className="flex h-full w-full items-center justify-center text-[10px] text-[#0f1f1d]/35">
                    Görsel
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() =>
                      setBrokenKeys((current) => ({
                        ...current,
                        [photo.localId]: true,
                      }))
                    }
                  />
                )}
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
              </button>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removePhoto(photo.localId)}
                  className="absolute -right-1.5 -top-1.5 z-10 rounded-full border border-black/10 bg-white p-1 text-[#0f1f1d] shadow-sm"
                  aria-label={`${photo.name} dosyasını kaldır`}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          );
        })}

        {canAdd ? (
          <li>
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => void addFiles(event.target.files)}
            />
            <label
              htmlFor={inputId}
              className="flex h-[4.5rem] w-[4.5rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-teal-800/25 bg-[#fcfdfc] text-teal-900/75 transition hover:border-teal-700/40 hover:bg-white"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              <span className="sr-only">Fotoğraf ekle</span>
              <span className="text-[10px] font-semibold" aria-hidden>
                Ekle
              </span>
            </label>
          </li>
        ) : null}
      </ul>

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

      <p className="mt-2 text-[11px] text-[#0f1f1d]/40">
        {photos.length}/{OFFER_MEDIA_MAX_COUNT} · JPEG, PNG, WebP
      </p>

      {activePreview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f1f1d]/72 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Fotoğraf önizleme"
          onClick={() => setPreviewIndex(null)}
        >
          <div
            className="relative max-h-[min(88vh,720px)] w-full max-w-3xl overflow-hidden rounded-[18px] bg-[#111716] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={() => setPreviewIndex(null)}
              className="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-black/40 p-2 text-white backdrop-blur-sm"
              aria-label="Önizlemeyi kapat"
            >
              <X className="h-4 w-4" />
            </button>
            {brokenKeys[activePreview.key] ? (
              <div className="flex h-[min(70vh,560px)] items-center justify-center text-sm text-white/55">
                Görsel yüklenemedi
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activePreview.src}
                alt={activePreview.alt}
                className="max-h-[min(88vh,720px)] w-full object-contain"
                onError={() =>
                  setBrokenKeys((current) => ({
                    ...current,
                    [activePreview.key]: true,
                  }))
                }
              />
            )}
            {previewItems.length > 1 && previewIndex != null ? (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent px-3 py-3">
                <button
                  type="button"
                  className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white"
                  onClick={() =>
                    setPreviewIndex(
                      (previewIndex - 1 + previewItems.length) %
                        previewItems.length,
                    )
                  }
                >
                  Önceki
                </button>
                <p className="text-[12px] text-white/80">
                  {previewIndex + 1} / {previewItems.length}
                </p>
                <button
                  type="button"
                  className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white"
                  onClick={() =>
                    setPreviewIndex((previewIndex + 1) % previewItems.length)
                  }
                >
                  Sonraki
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
