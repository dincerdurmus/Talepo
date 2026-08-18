"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  LoaderCircle,
  X,
} from "lucide-react";

import {
  OfferDecisionOutcome,
  type OfferDecisionPhase,
} from "@/components/panel/OfferDecisionOutcome";

type OfferActionsProps = {
  offerId: string;
  hasPendingNegotiation?: boolean;
  originalAmountLabel?: string;
  acceptAmountLabel?: string;
  showBargain?: boolean;
  onBargain?: () => void;
  bargainDisabled?: boolean;
  locked?: boolean;
  layout?: "default" | "toolbar" | "stack" | "footer";
  pendingCounter?: {
    amountLabel: string;
    acceptLabel?: string;
    rejectLabel?: string;
    hideOfferLifecycle?: boolean;
    onAccept: () => Promise<void>;
    onReject: () => Promise<void>;
  };
  /** Controlled negotiation-sent success from parent submit */
  negotiationSent?: boolean;
  /** Parent-driven channel opening before the composer appears */
  onNegotiateStart?: () => Promise<void> | void;
  negotiatePhase?: OfferDecisionPhase;
  /** Composer open — keeps the price exchange channel visible */
  composerOpen?: boolean;
  /** Composer is posting a new price to the server */
  negotiationSubmitting?: boolean;
  /** Copy used when the result morphs into the waiting state */
  waitingMessage?: string;
  waitingHint?: string;
};

const SUCCESS_MS = 700;
const CHANNEL_OPEN_MS = 460;
/** Result dwell before the same area morphs into the waiting footer. */
const RESULT_DWELL_MS = 900;
const MORPH_MS = 520;

function resolvePendingHint(
  hasPendingNegotiation: boolean,
  originalAmountLabel?: string,
  counterMode?: boolean,
): string | null {
  if (counterMode || hasPendingNegotiation) {
    const base =
      "Karşı teklifi kabul ederseniz anlaşılan tutar o tutar olur.";
    if (!originalAmountLabel) return base;
    return `${base} Orijinal teklifi (${originalAmountLabel}) kabul etmek karşı teklifi iptal eder.`;
  }
  return null;
}

function DecisionButtons({
  primaryClass,
  bargainClass,
  rejectClass,
  secondaryAcceptClass,
  buttonRow,
  busy,
  loadingAction,
  hasPendingNegotiation,
  originalAmountLabel,
  showBargain,
  bargainDisabled,
  pendingCounter,
  onAccept,
  onReject,
  onBargain,
}: {
  primaryClass: string;
  bargainClass: string;
  rejectClass: string;
  secondaryAcceptClass: string;
  buttonRow: string;
  busy: boolean;
  loadingAction: "accept" | "reject" | null;
  hasPendingNegotiation: boolean;
  originalAmountLabel?: string;
  showBargain: boolean;
  bargainDisabled: boolean;
  pendingCounter?: OfferActionsProps["pendingCounter"];
  onAccept: () => void;
  onReject: () => void;
  onBargain?: () => void;
}) {
  if (pendingCounter) {
    return (
      <div className={buttonRow}>
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className={primaryClass}
          aria-label={`Kabul et, ${pendingCounter.amountLabel}`}
          aria-busy={loadingAction === "accept"}
        >
          {loadingAction === "accept" ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              Teklif doğrulanıyor…
            </>
          ) : (
            <>
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                {pendingCounter.acceptLabel ??
                  `Kabul et · ${pendingCounter.amountLabel}`}
              </span>
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
            <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden />
            Pazarlık yap
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className={rejectClass}
          aria-label={pendingCounter.rejectLabel ?? "Karşı teklifi reddet"}
          aria-busy={loadingAction === "reject"}
        >
          {loadingAction === "reject" ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              Karar işleniyor…
            </>
          ) : (
            <>
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {pendingCounter.rejectLabel ?? "Karşı teklifi reddet"}
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={buttonRow}>
      <button
        type="button"
        disabled={busy}
        onClick={onAccept}
        className={hasPendingNegotiation ? secondaryAcceptClass : primaryClass}
        aria-label="Teklifi kabul et"
        aria-busy={loadingAction === "accept"}
      >
        {loadingAction === "accept" ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            Teklif doğrulanıyor…
          </>
        ) : hasPendingNegotiation ? (
          originalAmountLabel ? (
            `Orijinal teklifi kabul et · ${originalAmountLabel}`
          ) : (
            "Orijinal teklifi kabul et"
          )
        ) : (
          <>
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            Teklifi kabul et
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
          <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden />
          Pazarlık yap
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={onReject}
        className={rejectClass}
        aria-label="Teklifi reddet"
        aria-busy={loadingAction === "reject"}
      >
        {loadingAction === "reject" ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            Karar işleniyor…
          </>
        ) : (
          <>
            <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Teklifi reddet
          </>
        )}
      </button>
    </div>
  );
}

export function OfferActions({
  offerId,
  hasPendingNegotiation = false,
  originalAmountLabel,
  acceptAmountLabel,
  showBargain = false,
  onBargain,
  bargainDisabled = false,
  locked = false,
  layout = "footer",
  pendingCounter,
  negotiationSent = false,
  onNegotiateStart,
  negotiatePhase,
  composerOpen = false,
  negotiationSubmitting = false,
  waitingMessage,
  waitingHint,
}: OfferActionsProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<OfferDecisionPhase>("idle");
  const [sentStage, setSentStage] = useState<"result" | "waiting">("result");
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);
  const sentHandled = useRef(false);

  // Composer-driven states are derived from the parent, so closing or
  // submitting the composer never needs an effect to unwind local state.
  const negotiationPhase: OfferDecisionPhase | null = negotiationSent
    ? sentStage === "waiting"
      ? "negotiation-waiting"
      : "negotiation-sent"
    : negotiationSubmitting
      ? "negotiation-sending"
      : composerOpen
        ? "negotiate-composer"
        : null;

  const resolvedPhase = negotiatePhase ?? negotiationPhase ?? phase;
  const counterMode = Boolean(pendingCounter);

  useEffect(() => {
    mounted.current = true;
    const pending = timers.current;
    return () => {
      mounted.current = false;
      for (const timer of pending) clearTimeout(timer);
      pending.length = 0;
    };
  }, []);

  const schedule = useCallback((run: () => void, delay: number) => {
    const timer = setTimeout(() => {
      if (!mounted.current) return;
      run();
    }, delay);
    timers.current.push(timer);
  }, []);

  useEffect(() => {
    if (!negotiationSent || sentHandled.current) return;
    sentHandled.current = true;
    // The result dwells, then the same area morphs into the waiting state so
    // the footer never collapses to empty space before the refresh lands.
    schedule(() => setSentStage("waiting"), RESULT_DWELL_MS);
    schedule(() => router.refresh(), RESULT_DWELL_MS + MORPH_MS);
  }, [negotiationSent, router, schedule]);

  const runLifecycleAction = useCallback(
    async (action: "accept" | "reject") => {
      if (
        resolvedPhase !== "idle" &&
        resolvedPhase !== "error" &&
        resolvedPhase !== "reject-confirm"
      ) {
        return;
      }

      setPhase(action === "accept" ? "accept-loading" : "reject-loading");
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

        setPhase(action === "accept" ? "accept-success" : "reject-success");

        schedule(() => {
          if (action === "accept" && result.redirectTo) {
            router.push(result.redirectTo);
            return;
          }
          router.refresh();
        }, SUCCESS_MS);
      } catch (actionError) {
        setPhase("error");
        setError(
          actionError instanceof Error
            ? actionError.message
            : "İşlem sırasında bir hata oluştu.",
        );
      }
    },
    [offerId, resolvedPhase, router, schedule],
  );

  const runPendingAction = useCallback(
    async (action: "accept" | "reject") => {
      if (
        !pendingCounter ||
        (resolvedPhase !== "idle" &&
          resolvedPhase !== "error" &&
          resolvedPhase !== "reject-confirm")
      ) {
        return;
      }

      setPhase(action === "accept" ? "accept-loading" : "reject-loading");
      setError(null);

      try {
        await (action === "accept"
          ? pendingCounter.onAccept()
          : pendingCounter.onReject());

        setPhase(action === "accept" ? "accept-success" : "reject-success");

        schedule(() => {
          router.refresh();
        }, SUCCESS_MS);
      } catch (actionError) {
        setPhase("error");
        setError(
          actionError instanceof Error
            ? actionError.message
            : "İşlem sırasında bir hata oluştu.",
        );
      }
    },
    [pendingCounter, resolvedPhase, router, schedule],
  );

  function requestReject() {
    if (
      locked ||
      resolvedPhase === "accept-loading" ||
      resolvedPhase === "reject-loading"
    ) {
      return;
    }
    setError(null);
    setPhase("reject-confirm");
  }

  function cancelReject() {
    setPhase("idle");
  }

  async function handleBargain() {
    if (locked || bargainDisabled) return;
    setError(null);
    setPhase("negotiate-channel");
    await onNegotiateStart?.();
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await new Promise((resolve) =>
      setTimeout(resolve, reducedMotion ? 0 : CHANNEL_OPEN_MS),
    );
    if (!mounted.current) return;
    onBargain?.();
    // composerOpen now drives the phase; local state returns to its resting value.
    setPhase("idle");
  }

  const busy =
    locked ||
    resolvedPhase === "accept-loading" ||
    resolvedPhase === "reject-loading" ||
    resolvedPhase === "negotiate-channel" ||
    resolvedPhase === "negotiate-composer" ||
    resolvedPhase === "negotiation-sending" ||
    resolvedPhase === "accept-success" ||
    resolvedPhase === "reject-success" ||
    resolvedPhase === "negotiation-sent" ||
    resolvedPhase === "negotiation-waiting";

  const isFooter = layout === "footer" || layout === "stack";
  const isToolbar = layout === "toolbar";

  const footerRow =
    "flex w-full flex-col gap-2 sm:flex-row sm:items-stretch";
  const plainRow = "flex flex-col gap-2 sm:flex-row sm:flex-wrap";
  const inboxToolbar =
    "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:rounded-xl sm:border sm:border-teal-900/10 sm:bg-white/90 sm:p-1 sm:shadow-[0_4px_18px_rgba(15,31,29,0.04)]";

  const buttonRow = isFooter
    ? footerRow
    : isToolbar
      ? inboxToolbar
      : plainRow;

  const primaryClass = isFooter
    ? "inline-flex min-h-11 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(15,118,110,0.18)] transition hover:bg-[#0d6a63] disabled:opacity-50 sm:min-w-0"
    : isToolbar
      ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(15,118,110,0.24)] transition hover:bg-[#0d6a63] hover:shadow-[0_8px_22px_rgba(15,118,110,0.28)] disabled:opacity-50 sm:w-auto sm:min-w-[8.5rem] sm:rounded-lg"
      : "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white transition hover:bg-[#0d6a63] disabled:opacity-50 sm:w-auto";

  const bargainClass = isFooter
    ? "inline-flex min-h-11 w-full flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300/80 bg-gradient-to-b from-amber-50 to-white px-4 text-sm font-semibold text-amber-950 shadow-[0_2px_10px_rgba(180,83,9,0.06)] transition hover:border-amber-400/80 hover:from-amber-100/80 disabled:opacity-50 sm:min-w-0"
    : isToolbar
      ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/70 bg-gradient-to-b from-amber-50 to-[#fff8eb] px-4 text-sm font-semibold text-amber-950 shadow-[0_2px_10px_rgba(180,83,9,0.08)] transition hover:border-amber-400/80 hover:from-amber-100/80 hover:to-amber-50 disabled:opacity-50 sm:w-auto sm:min-w-[8.5rem] sm:rounded-lg sm:border-transparent sm:bg-transparent sm:shadow-none sm:hover:bg-amber-50/90"
      : "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-200/90 bg-amber-50 px-4 text-sm font-semibold text-amber-950 transition hover:bg-amber-100/80 disabled:opacity-50 sm:w-auto";

  const rejectClass = isFooter
    ? "inline-flex min-h-11 w-full flex-1 items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium text-[#8b352b]/80 transition hover:border-[#8b352b]/25 hover:bg-red-50/40 hover:text-[#8b352b] disabled:opacity-50 sm:min-w-0"
    : isToolbar
      ? "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-black/45 transition hover:bg-black/[0.03] hover:text-[#8b352b] disabled:opacity-50 sm:w-auto sm:rounded-lg"
      : "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-black/10 bg-transparent px-4 text-sm font-medium text-black/55 transition hover:bg-black/[0.03] hover:text-[#8b352b] disabled:opacity-50 sm:w-auto";

  const secondaryAcceptClass =
    "inline-flex min-h-11 w-full flex-1 items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/70 transition hover:bg-black/[0.03] disabled:opacity-50 sm:min-w-0";

  const buttons = (
    <DecisionButtons
      primaryClass={primaryClass}
      bargainClass={bargainClass}
      rejectClass={rejectClass}
      secondaryAcceptClass={secondaryAcceptClass}
      buttonRow={buttonRow}
      busy={busy}
      loadingAction={
        resolvedPhase === "accept-loading"
          ? "accept"
          : resolvedPhase === "reject-loading"
            ? "reject"
            : null
      }
      hasPendingNegotiation={hasPendingNegotiation}
      originalAmountLabel={originalAmountLabel}
      showBargain={showBargain}
      bargainDisabled={bargainDisabled}
      pendingCounter={pendingCounter}
      onAccept={() =>
        void (counterMode
          ? runPendingAction("accept")
          : runLifecycleAction("accept"))
      }
      onReject={requestReject}
      onBargain={() => void handleBargain()}
    />
  );

  const pendingHint = resolvePendingHint(
    hasPendingNegotiation,
    originalAmountLabel,
    counterMode,
  );

  const lifecycleFooter =
    pendingCounter && !pendingCounter.hideOfferLifecycle ? (
      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runLifecycleAction("accept")}
          className="inline-flex min-h-10 items-center text-left text-xs font-medium text-black/40 underline-offset-2 hover:text-black/60 hover:underline disabled:opacity-50"
        >
          {originalAmountLabel
            ? `Orijinal teklifi kabul et · ${originalAmountLabel}`
            : "Orijinal teklifi kabul et"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={requestReject}
          className="inline-flex min-h-10 items-center text-left text-xs font-medium text-black/40 underline-offset-2 hover:text-[#8b352b] hover:underline disabled:opacity-50"
          aria-label="Teklifi reddet"
        >
          Teklifi reddet
        </button>
      </div>
    ) : null;

  if (isFooter) {
    return (
      <OfferDecisionOutcome
        phase={resolvedPhase}
        error={error}
        acceptAmountLabel={acceptAmountLabel ?? originalAmountLabel}
        rejectVariant={counterMode ? "counter" : "offer"}
        waitingMessage={waitingMessage}
        waitingHint={waitingHint}
        onConfirmReject={() =>
          void (counterMode
            ? runPendingAction("reject")
            : runLifecycleAction("reject"))
        }
        onCancelReject={cancelReject}
        confirmRejectBusy={resolvedPhase === "reject-loading"}
      >
        {pendingHint ? (
          <p className="mb-3 text-xs leading-5 text-black/50">{pendingHint}</p>
        ) : null}
        {buttons}
        {lifecycleFooter}
      </OfferDecisionOutcome>
    );
  }

  return (
    <div className="border-t border-teal-900/8 px-4 py-3 sm:px-5">
      {buttons}
      {lifecycleFooter}
      {error ? (
        <p className="mt-2 text-xs font-semibold text-[#8b352b]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
