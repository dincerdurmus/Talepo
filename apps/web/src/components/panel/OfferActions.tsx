"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

type OfferActionsProps = {
  offerId: string;
  hasPendingNegotiation?: boolean;
  originalAmountLabel?: string;
};

export function OfferActions({
  offerId,
  hasPendingNegotiation = false,
  originalAmountLabel,
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

  return (
    <div className="mt-4 space-y-2">
      {hasPendingNegotiation ? (
        <p className="text-xs leading-5 text-black/50">
          Yukarıdaki karşı teklifi kabul ederseniz anlaşılan tutar o tutar olur.
          {originalAmountLabel
            ? ` Orijinal teklifi (${originalAmountLabel}) kabul etmek karşı teklifi iptal eder.`
            : " Orijinal teklifi kabul etmek bekleyen karşı teklifi iptal eder."}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(loadingAction)}
          onClick={() => runAction("accept")}
          className={
            hasPendingNegotiation
              ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-xs font-semibold text-black/70 transition hover:bg-black/[0.03] disabled:opacity-50"
              : "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f766e] px-4 text-xs font-semibold text-white transition hover:bg-[#0d6a63] disabled:opacity-50"
          }
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
        <button
          type="button"
          disabled={Boolean(loadingAction)}
          onClick={() => runAction("reject")}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-4 text-xs font-semibold text-black/70 transition hover:bg-black/[0.03] disabled:opacity-50"
        >
          {loadingAction === "reject" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            "Teklifi reddet"
          )}
        </button>
      </div>
      {error && (
        <p className="text-xs font-semibold text-[#8b352b]">{error}</p>
      )}
    </div>
  );
}
