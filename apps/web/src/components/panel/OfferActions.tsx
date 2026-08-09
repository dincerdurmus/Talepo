"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Handshake, LoaderCircle, X } from "lucide-react";

type OfferActionsProps = {
  offerId: string;
};

export function OfferActions({ offerId }: OfferActionsProps) {
  const router = useRouter();
  const noteId = useId();
  const [loadingAction, setLoadingAction] = useState<
    "accept" | "reject" | "negotiate" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!negotiateOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setNegotiateOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [negotiateOpen]);

  async function runAction(
    action: "accept" | "reject" | "negotiate",
    negotiateNote?: string,
  ) {
    if (loadingAction) return;

    setLoadingAction(action);
    setError(null);

    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "negotiate" ? { note: negotiateNote ?? "" } : {}),
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || "İşlem tamamlanamadı.");
      }

      if (
        (action === "accept" || action === "negotiate") &&
        result.redirectTo
      ) {
        router.push(result.redirectTo);
        return;
      }

      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "İşlem sırasında bir hata oluştu.",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(loadingAction)}
          onClick={() => runAction("accept")}
          className="inline-flex items-center justify-center rounded-xl bg-[#0f766e] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0d6a63] disabled:opacity-50"
        >
          {loadingAction === "accept" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            "Kabul et"
          )}
        </button>
        <button
          type="button"
          disabled={Boolean(loadingAction)}
          onClick={() => setNegotiateOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-800/15 bg-teal-50/80 px-4 py-2.5 text-xs font-semibold text-teal-950 transition hover:bg-teal-50 disabled:opacity-50"
        >
          {loadingAction === "negotiate" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Handshake className="h-3.5 w-3.5" />
              Pazarlık et
            </>
          )}
        </button>
        <button
          type="button"
          disabled={Boolean(loadingAction)}
          onClick={() => runAction("reject")}
          className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold text-black/70 transition hover:bg-black/[0.03] disabled:opacity-50"
        >
          {loadingAction === "reject" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            "Reddet"
          )}
        </button>
        {error && (
          <p className="w-full text-xs font-semibold text-[#8b352b]">{error}</p>
        )}
      </div>

      {negotiateOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f1f1d]/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${noteId}-title`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !loadingAction) {
              setNegotiateOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-teal-900/10 bg-white p-5 shadow-[0_24px_64px_rgba(15,31,29,0.18)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id={`${noteId}-title`}
                  className="text-lg font-semibold tracking-tight text-[#0f1f1d]"
                >
                  Pazarlık başlat
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-black/50">
                  Teklifi kabul etmeden sohbet açılır. Fiyat veya koşulları
                  konuşabilir; firma teklifini güncelleyebilir.
                </p>
              </div>
              <button
                type="button"
                aria-label="Kapat"
                disabled={Boolean(loadingAction)}
                onClick={() => setNegotiateOpen(false)}
                className="rounded-lg p-1.5 text-black/40 transition hover:bg-black/[0.04] hover:text-black/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label
              htmlFor={noteId}
              className="mt-5 block text-[11px] font-medium uppercase tracking-[0.14em] text-teal-950/40"
            >
              Notunuz (isteğe bağlı)
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Örn. Bütçem 45.000 TL civarı, teslim 10 gün olursa konuşabiliriz…"
              className="mt-2 w-full resize-none rounded-xl border border-teal-900/10 bg-[#f8faf9] px-3.5 py-3 text-sm leading-6 text-[#0f1f1d] outline-none transition focus:border-[#0f766e]/35 focus:bg-white focus:ring-2 focus:ring-[#0f766e]/12"
            />
            <p className="mt-2 text-[11px] leading-5 text-black/40">
              * Telefon veya e-posta yazmayın. Kabulden önce iletişim bilgileri
              gizli kalır.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(loadingAction)}
                onClick={() => {
                  void runAction("negotiate", note).then(() => {
                    setNegotiateOpen(false);
                  });
                }}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white transition hover:bg-[#0a1614] disabled:opacity-50"
              >
                {loadingAction === "negotiate" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Handshake className="h-4 w-4" />
                    Pazarlığa geç
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={Boolean(loadingAction)}
                onClick={() => setNegotiateOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-medium text-black/45 transition hover:text-[#0f1f1d]"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
