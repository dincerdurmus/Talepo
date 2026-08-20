"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Send, X } from "lucide-react";

import { MAX_MESSAGE_IMAGES } from "@/lib/message/limits";
import { compressImageToDataUrl } from "@/lib/media/compress-image";

type MessageComposerProps = {
  conversationId: string;
  canSend?: boolean;
  canSendImages?: boolean;
};

type PendingImage = {
  id: string;
  dataUrl: string;
  name: string;
  fingerprint: string;
};

const CLIENT_MAX_FILE_BYTES = 8_000_000;

function fingerprintFile(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function MessageComposer({
  conversationId,
  canSend = true,
  canSendImages = false,
}: MessageComposerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function onPickImages(fileList: FileList | null) {
    if (!fileList || !canSendImages) return;
    setError(null);

    const files = Array.from(fileList);
    if (images.length + files.length > MAX_MESSAGE_IMAGES) {
      setError("Bir mesaja en fazla 3 fotoğraf ekleyebilirsiniz.");
      return;
    }

    const next: PendingImage[] = [];
    const existing = new Set(images.map((item) => item.fingerprint));

    for (const file of files) {
      if (images.length + next.length >= MAX_MESSAGE_IMAGES) {
        setError("Bir mesaja en fazla 3 fotoğraf ekleyebilirsiniz.");
        break;
      }

      if (!file.type.startsWith("image/")) {
        setError("Yalnızca görsel dosyaları yüklenebilir (JPEG, PNG, WebP).");
        continue;
      }

      if (file.size > CLIENT_MAX_FILE_BYTES) {
        setError("Görsel en fazla 8 MB olabilir.");
        continue;
      }

      const fingerprint = fingerprintFile(file);
      if (existing.has(fingerprint)) continue;

      try {
        const dataUrl = await compressImageToDataUrl(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.82,
          maxBytes: 700_000,
        });
        next.push({
          id: `${fingerprint}-${Date.now()}`,
          dataUrl,
          name: file.name,
          fingerprint,
        });
        existing.add(fingerprint);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Görsel hazırlanamadı.");
      }
    }

    if (next.length > 0) {
      setImages((current) => [...current, ...next].slice(0, MAX_MESSAGE_IMAGES));
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(id: string) {
    setImages((current) => current.filter((item) => item.id !== id));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSending || !canSend) return;
    if (!content.trim() && images.length === 0) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            images.length > 0
              ? {
                  content: content.trim() || undefined,
                  images: images.map((item) => ({
                    imageDataUrl: item.dataUrl,
                    fileName: item.name,
                  })),
                }
              : { content },
          ),
        },
      );

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Mesaj gönderilemedi.");
      }

      setContent("");
      setImages([]);
      router.refresh();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Mesaj gönderilirken bir hata oluştu.",
      );
    } finally {
      setIsSending(false);
    }
  }

  const canSubmit =
    canSend && !isSending && Boolean(content.trim() || images.length > 0);

  return (
    <form onSubmit={handleSubmit} className="talepo-conversation-composer">
      {!canSend && (
        <p className="talepo-activity-alert mb-3">
          Mesajlaşma yalnızca anlaşmadan sonra açılır.
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-[0.95rem] border border-[#8b352b]/20 bg-[#fff1ee] px-3 py-2 text-sm font-medium text-[#8b352b]" role="alert">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:max-w-sm">
          {images.map((item) => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-xl border border-teal-900/10 bg-white/90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.dataUrl}
                alt={item.name}
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(item.id)}
                className="absolute right-1 top-1 rounded-lg bg-black/55 p-1 text-white"
                aria-label={`${item.name} fotoğrafını kaldır`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2.5">
        {canSendImages && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => void onPickImages(event.target.files)}
            />
            <button
              type="button"
              disabled={!canSend || isSending || images.length >= MAX_MESSAGE_IMAGES}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#0f1f1d]/10 bg-white text-[#0f4a43] transition hover:border-[#0f1f1d]/16 hover:bg-[#f7fbfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30 disabled:opacity-40"
              aria-label="Fotoğraf ekle"
              title="Fotoğraf ekle"
            >
              <ImagePlus className="h-[18px] w-[18px]" />
            </button>
          </>
        )}

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={
            images.length > 0
              ? "İsteğe bağlı açıklama yazın..."
              : "Mesajınızı yazın..."
          }
          disabled={!canSend}
          className="min-h-[48px] flex-1 resize-none rounded-xl border border-[#0f1f1d]/10 bg-white px-4 py-3 text-sm text-[#0f1f1d]/85 outline-none transition placeholder:text-[#0f1f1d]/32 focus:border-[#0f4a43]/30 focus:ring-2 focus:ring-[#0f1f1d]/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0f1f1d] text-[#f4fbf9] transition hover:bg-[#16302c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/40 disabled:opacity-40"
          aria-label="Mesaj gönder"
        >
          {isSending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      {canSendImages ? (
        <p className="mt-2.5 text-[11px] leading-5 text-[#0f1f1d]/38">
          Mesaj başına en fazla 3 fotoğraf. Görseller otomatik denetlenir.
        </p>
      ) : null}
    </form>
  );
}
