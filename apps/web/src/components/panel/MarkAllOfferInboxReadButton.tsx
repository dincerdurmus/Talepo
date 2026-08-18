"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck, LoaderCircle } from "lucide-react";

import type { OfferInboxRole } from "@/lib/offer/offer-event-unread";
import { dispatchOfferInboxBadgeUpdate } from "@/lib/offer/offer-inbox-badge-events";

export function MarkAllOfferInboxReadButton({
  unreadCount,
  role,
}: {
  unreadCount: number;
  role: OfferInboxRole;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = unreadCount <= 0 || pending;

  async function onClick() {
    if (disabled) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/offers/inbox/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message || "Teklifler güncellenemedi.");
      }
      dispatchOfferInboxBadgeUpdate({ role, mode: "clear" });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Teklifler güncellenirken bir hata oluştu.",
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
        aria-label={
          unreadCount > 0
            ? "Tümünü okundu işaretle"
            : "Tüm teklifler okundu"
        }
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-900/10 bg-white px-3.5 py-2 text-sm font-semibold text-teal-950/75 transition hover:bg-[#f7faf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/25 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <CheckCheck className="h-4 w-4" aria-hidden />
        )}
        {unreadCount > 0 ? "Tümünü okundu işaretle" : "Tümü okundu"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-[#8b352b]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
