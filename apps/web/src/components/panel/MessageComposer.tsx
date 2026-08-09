"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Send, X } from "lucide-react";

import { compressImageToDataUrl } from "@/lib/media/compress-image";

type MessageComposerProps = {
  conversationId: string;
  canSend?: boolean;
  canSendImages?: boolean;
  /** Text chat open before accept (pazarlık). */
  negotiationMode?: boolean;
};

const CLIENT_MAX_FILE_BYTES = 8_000_000;

export function MessageComposer({
  conversationId,
  canSend = true,
  canSendImages = false,
  negotiationMode = false,
}: MessageComposerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function onPickImage(file: File | undefined) {
    if (!file || !canSendImages) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Yalnızca görsel dosyaları yüklenebilir (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > CLIENT_MAX_FILE_BYTES) {
      setError("Görsel en fazla 8 MB olabilir.");
      return;
    }

    try {
      const dataUrl = await compressImageToDataUrl(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
        maxBytes: 700_000,
      });
      setImagePreview(dataUrl);
      setImageName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Görsel hazırlanamadı.");
      setImagePreview(null);
      setImageName(null);
    }
  }

  function clearImage() {
    setImagePreview(null);
    setImageName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSending || !canSend) return;
    if (!content.trim() && !imagePreview) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            imagePreview
              ? {
                  content: content.trim() || undefined,
                  imageDataUrl: imagePreview,
                  fileName: imageName ?? "fotograf.jpg",
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
      clearImage();
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
    canSend && !isSending && Boolean(content.trim() || imagePreview);

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-teal-900/8 bg-gradient-to-b from-white to-[#f7fbfa] p-4"
    >
      {!canSend && (
        <p className="mb-3 rounded-xl border border-amber-200/70 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-950/80">
          Bu sohbet için mesajlaşma kapalı.
        </p>
      )}
      {canSend && negotiationMode && (
        <p className="mb-3 rounded-xl border border-teal-800/15 bg-teal-50/90 px-3 py-2 text-sm font-medium text-teal-950/80">
          Pazarlık açık — teklif henüz kabul edilmedi. Telefon ve e-posta
          paylaşmayın.
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-xl border border-rose-200/70 bg-rose-50/90 px-3 py-2 text-sm font-medium text-rose-900/85">
          {error}
        </p>
      )}

      {imagePreview && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-teal-900/10 bg-white/90 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Gönderilecek görsel"
            className="h-16 w-16 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-teal-950/80">
              {imageName || "Fotoğraf"}
            </p>
            <p className="mt-0.5 text-[11px] text-teal-900/45">
              Göndermeden önce içerik kontrolünden geçer.
            </p>
          </div>
          <button
            type="button"
            onClick={clearImage}
            className="rounded-lg p-1.5 text-teal-900/40 transition hover:bg-teal-900/5 hover:text-teal-900/70"
            aria-label="Görseli kaldır"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2.5">
        {canSendImages && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => onPickImage(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={!canSend || isSending}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-teal-900/10 bg-white text-teal-800/80 transition hover:border-teal-800/25 hover:bg-[#eef8f5] disabled:opacity-40"
              aria-label="Fotoğraf ekle"
              title="Fotoğraf ekle"
            >
              <ImagePlus className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </button>
          </>
        )}

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={
            imagePreview
              ? "İsteğe bağlı açıklama yazın..."
              : "Mesajınızı yazın..."
          }
          disabled={!canSend}
          className="min-h-[48px] flex-1 resize-none rounded-xl border border-teal-900/10 bg-white px-4 py-3 text-sm text-teal-950/85 outline-none ring-teal-700/20 transition placeholder:text-teal-900/30 focus:border-teal-700/30 focus:ring-2 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0f766e] text-white transition hover:bg-[#115e59] disabled:opacity-40"
        >
          {isSending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="mt-2.5 text-[11px] leading-5 text-teal-900/40">
        {canSendImages
          ? "Fotoğraflar otomatik denetlenir; müstehcen veya taleple ilgisiz görseller reddedilir. Telefon ve IBAN paylaşılamaz."
          : negotiationMode
            ? "Pazarlık sohbeti: fiyat ve koşulları konuşun. Kabulden önce iletişim bilgileri gizlidir."
            : "Telefon, e-posta ve IBAN paylaşılamaz."}
      </p>
    </form>
  );
}
