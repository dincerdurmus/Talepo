"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck, LoaderCircle } from "lucide-react";

export function MarkAllNotificationsReadButton({
  unreadCount,
}: {
  unreadCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (unreadCount <= 0 && !pending) return null;

  const disabled = pending;

  async function onClick() {
    if (disabled) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message || "Bildirimler güncellenemedi.");
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Bildirimler güncellenirken bir hata oluştu.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={disabled}
        aria-label="Tüm bildirimleri okundu işaretle"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#0f1f1d]/8 bg-transparent px-3 text-sm font-medium text-[#0f1f1d]/55 transition hover:border-[#0f1f1d]/12 hover:bg-white/80 hover:text-[#0f1f1d]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <CheckCheck className="h-4 w-4" aria-hidden />
        )}
        Tümü okundu
      </button>
      {error ? (
        <p className="mt-2 text-xs text-[#8b352b]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
