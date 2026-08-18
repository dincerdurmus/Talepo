"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Check,
  Handshake,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";

type OfferActionsProps = {
  offerId: string;
  hasPendingNegotiation?: boolean;
  originalAmountLabel?: string;
  showBargain?: boolean;
  onBargain?: () => void;
  bargainDisabled?: boolean;
  locked?: boolean;
  alignEnd?: boolean;
  layout?: "default" | "toolbar" | "stack";
  pendingCounter?: {
    amountLabel: string;
    onAccept: () => void;
    onReject: () => void;
    busy: string | null;
  };
};

function DecisionShell({
  alignEnd,
  flush = false,
  eyebrow,
  hint,
  children,
  footer,
  error,
}: {
  alignEnd: boolean;
  flush?: boolean;
  eyebrow: string;
  hint?: string;
  children: ReactNode;
  footer?: ReactNode;
  error?: string | null;
}) {
  if (flush) {
    return (
      <div>
        {hint ? (
          <p className="mb-3 text-xs leading-5 text-black/50">{hint}</p>
        ) : null}
        {children}
        {footer}
        {error ? (
          <p className="mt-2 text-xs font-semibold text-[#8b352b]">{error}</p>
        ) : null}
      </div>
    );
  }
  if (!alignEnd) {
    return (
      <div className="border-t border-teal-900/8 px-4 py-3 sm:px-5">
        {hint ? (
          <p className="mb-3 text-xs leading-5 text-black/50">{hint}</p>
        ) : null}
        {children}
        {footer}
        {error ? (
          <p className="mt-2 text-xs font-semibold text-[#8b352b]">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-t border-teal-900/[0.06] bg-gradient-to-r from-[#f4faf9] via-[#f8fbfa] to-white px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0 sm:max-w-[18rem]">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-900/55">
            <Sparkles className="h-3.5 w-3.5 text-teal-700/70" aria-hidden />
            {eyebrow}
          </p>
          {hint ? (
            <p className="mt-1 text-xs leading-5 text-black/48">{hint}</p>
          ) : null}
        </div>
        <div className="min-w-0 sm:shrink-0">{children}</div>
      </div>
      {footer}
      {error ? (
        <p className="mt-3 text-xs font-semibold text-[#8b352b]">{error}</p>
      ) : null}
    </div>
  );
}

export function OfferActions({
  offerId,
  hasPendingNegotiation = false,
  originalAmountLabel,
  showBargain = false,
  onBargain,
  bargainDisabled = false,
  locked = false,
  alignEnd = false,
  layout,
  pendingCounter,
}: OfferActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"accept" | "reject" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: "accept" | "reject") {
    if (loadingAction) return;

    setLoadingAction(action);
    setError(null);

    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = (await response.json()) as {
        message?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || "İşlem tamamlanamadı.");
      }

      if (action === "accept" && result.redirectTo) {
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

  const busy =
    locked || Boolean(loadingAction) || Boolean(pendingCounter?.busy);
  const resolvedLayout = layout ?? (alignEnd ? "toolbar" : "default");
  const isToolbar = resolvedLayout === "toolbar";
  const isStack = resolvedLayout === "stack";

  const inboxToolbar =
    "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:rounded-xl sm:border sm:border-teal-900/10 sm:bg-white/90 sm:p-1 sm:shadow-[0_4px_18px_rgba(15,31,29,0.04)]";
  const stackRow = "flex w-full flex-col gap-2";
  const plainRow = "flex flex-col gap-2 sm:flex-row sm:flex-wrap";

  const primaryClass = isStack
    ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(15,118,110,0.18)] transition hover:bg-[#0d6a63] disabled:opacity-50"
    : isToolbar
      ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(15,118,110,0.24)] transition hover:bg-[#0d6a63] hover:shadow-[0_8px_22px_rgba(15,118,110,0.28)] disabled:opacity-50 sm:w-auto sm:min-w-[8.5rem] sm:rounded-lg"
      : "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white transition hover:bg-[#0d6a63] disabled:opacity-50 sm:w-auto";

  const bargainClass = isStack
    ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/80 bg-white px-4 text-sm font-semibold text-amber-950 transition hover:bg-amber-50 disabled:opacity-50"
    : isToolbar
      ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/70 bg-gradient-to-b from-amber-50 to-[#fff8eb] px-4 text-sm font-semibold text-amber-950 shadow-[0_2px_10px_rgba(180,83,9,0.08)] transition hover:border-amber-400/80 hover:from-amber-100/80 hover:to-amber-50 disabled:opacity-50 sm:w-auto sm:min-w-[8.5rem] sm:rounded-lg sm:border-transparent sm:bg-transparent sm:shadow-none sm:hover:bg-amber-50/90"
      : "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-200/90 bg-amber-50 px-4 text-sm font-semibold text-amber-950 transition hover:bg-amber-100/80 disabled:opacity-50 sm:w-auto";

  const rejectClass = isStack
    ? "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium text-black/50 transition hover:border-[#8b352b]/25 hover:text-[#8b352b] disabled:opacity-50"
    : isToolbar
      ? "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-black/45 transition hover:bg-black/[0.03] hover:text-[#8b352b] disabled:opacity-50 sm:w-auto sm:rounded-lg"
      : "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-black/10 bg-transparent px-4 text-sm font-medium text-black/55 transition hover:bg-black/[0.03] hover:text-[#8b352b] disabled:opacity-50 sm:w-auto";

  const secondaryAcceptClass =
    "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/70 transition hover:bg-black/[0.03] disabled:opacity-50 sm:w-auto";

  const buttonRow = isStack ? stackRow : isToolbar ? inboxToolbar : plainRow;

  if (pendingCounter) {
    return (
      <DecisionShell
        alignEnd={isToolbar}
        flush={isStack}
        eyebrow="Pazarlık turu"
        hint={
          isToolbar
            ? "Bekleyen tutarı onaylayabilir, yeni fiyat önerebilir veya bu turu kapatabilirsiniz."
            : "Bekleyen pazarlık tutarını kabul edebilir, yeni fiyat önerebilir veya bu turu reddedebilirsiniz."
        }
        error={error}
        footer={
          <div
            className={`mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 ${isToolbar ? "sm:justify-end" : ""}`}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("accept")}
              className="inline-flex min-h-10 items-center text-left text-xs font-medium text-black/40 underline-offset-2 hover:text-black/60 hover:underline disabled:opacity-50"
            >
              {loadingAction === "accept" ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : originalAmountLabel ? (
                `Orijinal teklifi kabul et · ${originalAmountLabel}`
              ) : (
                "Orijinal teklifi kabul et"
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("reject")}
              className="inline-flex min-h-10 items-center text-left text-xs font-medium text-black/40 underline-offset-2 hover:text-[#8b352b] hover:underline disabled:opacity-50"
              aria-label="Teklifi reddet"
            >
              {loadingAction === "reject" ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Teklifi reddet"
              )}
            </button>
          </div>
        }
      >
        <div className={buttonRow}>
          <button
            type="button"
            disabled={busy}
            onClick={pendingCounter.onAccept}
            className={primaryClass}
            aria-label={`Kabul et, ${pendingCounter.amountLabel}`}
          >
            {pendingCounter.busy === "accept" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 shrink-0" aria-hidden />
                <span>Kabul et · {pendingCounter.amountLabel}</span>
              </>
            )}
          </button>
          {showBargain ? (
            <button
              type="button"
              disabled={busy || bargainDisabled}
              onClick={onBargain}
              className={bargainClass}
              aria-label="Pazarlık yap"
            >
              <Handshake className="h-4 w-4 shrink-0" aria-hidden />
              Pazarlık yap
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={pendingCounter.onReject}
            className={rejectClass}
            aria-label="Karşı teklifi reddet"
          >
            {pendingCounter.busy === "reject" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Karşı teklifi reddet
              </>
            )}
          </button>
        </div>
      </DecisionShell>
    );
  }

  const defaultHint = hasPendingNegotiation
    ? `Yukarıdaki karşı teklifi kabul ederseniz anlaşılan tutar o tutar olur.${
        originalAmountLabel
          ? ` Orijinal teklifi (${originalAmountLabel}) kabul etmek karşı teklifi iptal eder.`
          : " Orijinal teklifi kabul etmek bekleyen karşı teklifi iptal eder."
      }`
    : isToolbar
      ? "Anlaşmayı tamamlayın, fiyatınızı iletin veya teklifi değerlendirmek için reddedin."
      : undefined;

  return (
    <DecisionShell
      alignEnd={isToolbar}
      flush={isStack}
      eyebrow="Kararınız"
      hint={defaultHint}
      error={error}
    >
      <div className={buttonRow}>
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction("accept")}
          className={
            hasPendingNegotiation ? secondaryAcceptClass : primaryClass
          }
          aria-label="Kabul et"
        >
          {loadingAction === "accept" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : hasPendingNegotiation ? (
            originalAmountLabel ? (
              `Orijinal teklifi kabul et · ${originalAmountLabel}`
            ) : (
              "Orijinal teklifi kabul et"
            )
          ) : (
            <>
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              Kabul et
            </>
          )}
        </button>
        {showBargain ? (
          <button
            type="button"
            disabled={busy || bargainDisabled}
            onClick={onBargain}
            className={bargainClass}
            aria-label="Pazarlık yap"
          >
            <Handshake className="h-4 w-4 shrink-0" aria-hidden />
            Pazarlık yap
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction("reject")}
          className={rejectClass}
          aria-label="Teklifi reddet"
        >
          {loadingAction === "reject" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Teklifi reddet
            </>
          )}
        </button>
      </div>
    </DecisionShell>
  );
}
