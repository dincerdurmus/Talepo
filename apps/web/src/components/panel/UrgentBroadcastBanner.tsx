"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Megaphone } from "lucide-react";

type UrgentBroadcastBannerProps = {
  requestId: string;
  /** From notification deep-link: `1` ask, `gonderildi` success. */
  mode: "ask" | "sent" | null;
};

export function UrgentBroadcastBanner({
  requestId,
  mode,
}: UrgentBroadcastBannerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSentMessage, setLocalSentMessage] = useState<string | null>(null);

  const sent = mode === "sent" || Boolean(localSentMessage);
  if (mode !== "ask" && !sent) return null;

  async function onSend() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/requests/${requestId}/urgent-broadcast`,
        { method: "POST" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Gönderilemedi.");
      }

      const message = data.message || "Talep tedarikçilere iletildi.";
      setLocalSentMessage(message);
      router.replace(
        `/panel/taleplerim/${requestId}?acil-yayin=gonderildi`,
      );
      router.refresh();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Gönderilirken bir hata oluştu.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-5 rounded-[24px] border border-amber-900/15 bg-gradient-to-br from-amber-50 via-[#fffaf0] to-white px-5 py-5 shadow-[0_14px_40px_rgba(180,120,20,0.08)] sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-amber-100 text-amber-800">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-950">
              {sent ? "Bildirim gönderildi" : "Teklif gelmedi"}
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-950/70">
              {sent
                ? localSentMessage ||
                  "Talep, eşleşen tedarikçilere yeniden bildirildi."
                : "Talebi, kayıtlı ve ürününüzü tedarik edebilecek kullanıcılara doğrudan bildirim olarak göndermek ister misiniz?"}
            </p>
            {error ? (
              <p className="mt-2 text-sm font-medium text-red-700">{error}</p>
            ) : null}
          </div>
        </div>

        {!sent ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void onSend()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-amber-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-950 disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Gönder
          </button>
        ) : null}
      </div>
    </section>
  );
}
