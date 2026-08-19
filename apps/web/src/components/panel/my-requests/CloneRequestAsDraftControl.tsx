"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export function CloneRequestAsDraftControl({
  requestId,
  variant = "menu",
}: {
  requestId: string;
  variant?: "menu" | "header";
}) {
  const router = useRouter();
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    if (!confirming || loading) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setConfirming(false);
        setError(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming, loading]);

  async function onClone() {
    if (loading) return;
    setLoading(true);
    setError(null);
    if (!idempotencyKey.current) {
      idempotencyKey.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `clone-${requestId}-${crypto.randomUUID()}`
          : `clone-${requestId}-${Date.now()}`;
    }
    try {
      const response = await fetch(`/api/requests/${requestId}/clone-draft`, {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey.current,
        },
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Taslak oluşturulamadı.");
      }
      router.push(result.redirectTo || "/panel/taleplerim?durum=taslak");
      router.refresh();
    } catch (cloneError) {
      setError(
        cloneError instanceof Error
          ? cloneError.message
          : "Taslak oluşturulurken bir hata oluştu.",
      );
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        role={variant === "menu" ? "menuitem" : undefined}
        className={
          variant === "menu"
            ? "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-[#0f1f1d] hover:bg-[#f4f7f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30"
            : "inline-flex min-h-11 items-center rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[#0f1f1d] transition hover:bg-black/[0.04]"
        }
        onClick={() => {
          setConfirming(true);
          setError(null);
        }}
      >
        Taslak olarak yeniden oluştur
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={
        variant === "menu"
          ? "rounded-xl bg-[#f4f7f6] px-3 py-2.5"
          : "max-w-sm rounded-2xl border border-black/10 bg-white p-3"
      }
    >
      <p id={titleId} className="text-sm font-semibold text-[#0f1f1d]">
        Bu talebi yeniden kullanmak ister misiniz?
      </p>
      <p className="mt-1 text-[13px] leading-5 text-[#0f1f1d]/60">
        Talep bilgileri yeni bir taslağa kopyalanır. Eski süreç ve teklifler
        değişmeden kalır.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#0f766e] px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40 disabled:opacity-50"
          disabled={loading}
          onClick={() => void onClone()}
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            "Taslak oluştur"
          )}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#0f1f1d]/10 bg-white px-3 text-sm font-medium text-[#0f1f1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30 disabled:opacity-50"
          disabled={loading}
          onClick={() => {
            if (loading) return;
            setConfirming(false);
            setError(null);
          }}
        >
          Vazgeç
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs font-medium text-[#8b352b]">{error}</p>
      ) : null}
    </div>
  );
}
