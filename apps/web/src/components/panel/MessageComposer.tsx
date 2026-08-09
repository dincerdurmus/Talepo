"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

type MessageComposerProps = {
  conversationId: string;
};

export function MessageComposer({ conversationId }: MessageComposerProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSending || !content.trim()) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Mesaj gönderilemedi.");
      }

      setContent("");
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

  return (
    <form onSubmit={handleSubmit} className="border-t border-black/[0.06] p-4">
      {error && (
        <p className="mb-3 text-sm font-semibold text-[#8b352b]">{error}</p>
      )}
      <div className="flex gap-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Mesajınızı yazın..."
          className="min-h-[56px] flex-1 resize-none rounded-[16px] border border-black/[0.07] bg-[#fafaf8] px-4 py-3 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={isSending || !content.trim()}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white disabled:opacity-40"
        >
          {isSending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="mt-2 text-xs text-black/35">
        Mesajlaşma yalnızca kabul edilen tekliflerden sonra açılır. Telefon ve IBAN
        paylaşılamaz.
      </p>
    </form>
  );
}
