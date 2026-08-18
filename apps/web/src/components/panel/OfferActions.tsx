"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

type OfferActionsProps = {
  offerId: string;
  hasPendingNegotiation?: boolean;
  originalAmountLabel?: string;
  showBargain?: boolean;
  onBargain?: () => void;
  bargainDisabled?: boolean;
  locked?: boolean;
  pendingCounter?: {
    amountLabel: string;
    onAccept: () => void;
    onReject: () => void;
    busy: string | null;
  };
};

export function OfferActions({
  offerId,
  hasPendingNegotiation = false,
  originalAmountLabel,
  showBargain = false,
  onBargain,
  bargainDisabled = false,
  locked = false,
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
  const buttonRow =
    "flex flex-col gap-2 sm:flex-row sm:flex-wrap";
  const primaryClass =
    "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white transition hover:bg-[#0d6a63] disabled:opacity-50 sm:w-auto";
  const bargainClass =
    "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-200/90 bg-amber-50 px-4 text-sm font-semibold text-amber-950 transition hover:bg-amber-100/80 disabled:opacity-50 sm:w-auto";
  const rejectClass =
    "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-black/10 bg-transparent px-4 text-sm font-medium text-black/55 transition hover:bg-black/[0.03] hover:text-[#8b352b] disabled:opacity-50 sm:w-auto";

  if (pendingCounter) {
    return (
      <div className="border-t border-teal-900/8 px-4 py-3 sm:px-5">
        <p className="mb-3 text-xs leading-5 text-black/50">
          Bekleyen pazarlık tutarını kabul edebilir, yeni fiyat önerebilir veya
          bu turu reddedebilirsiniz.
        </p>
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
              `Kabul et · ${pendingCounter.amountLabel}`
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
              "Karşı teklifi reddet"
            )}
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction("accept")}
            className="inline-flex min-h-11 items-center text-left text-xs font-medium text-black/40 underline-offset-2 hover:text-black/60 hover:underline disabled:opacity-50"
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
            className="inline-flex min-h-11 items-center text-left text-xs font-medium text-black/40 underline-offset-2 hover:text-[#8b352b] hover:underline disabled:opacity-50"
            aria-label="Teklifi reddet"
          >
            {loadingAction === "reject" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Teklifi reddet"
            )}
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-xs font-semibold text-[#8b352b]">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-t border-teal-900/8 px-4 py-3 sm:px-5">
      {hasPendingNegotiation ? (
        <p className="mb-3 text-xs leading-5 text-black/50">
          Yukarıdaki karşı teklifi kabul ederseniz anlaşılan tutar o tutar olur.
          {originalAmountLabel
            ? ` Orijinal teklifi (${originalAmountLabel}) kabul etmek karşı teklifi iptal eder.`
            : " Orijinal teklifi kabul etmek bekleyen karşı teklifi iptal eder."}
        </p>
      ) : null}
      <div className={buttonRow}>
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction("accept")}
          className={
            hasPendingNegotiation
              ? "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/70 transition hover:bg-black/[0.03] disabled:opacity-50 sm:w-auto"
              : primaryClass
          }
          aria-label="Kabul et"
        >
          {loadingAction === "accept" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : hasPendingNegotiation ? (
            originalAmountLabel
              ? `Orijinal teklifi kabul et · ${originalAmountLabel}`
              : "Orijinal teklifi kabul et"
          ) : (
            "Kabul et"
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
            "Teklifi reddet"
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs font-semibold text-[#8b352b]">{error}</p>
      )}
    </div>
  );
}
