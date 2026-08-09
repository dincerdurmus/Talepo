"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

type OfferActionsProps = {
  offerId: string;
};

export function OfferActions({ offerId }: OfferActionsProps) {
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
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={Boolean(loadingAction)}
        onClick={() => runAction("accept")}
        className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
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
        onClick={() => runAction("reject")}
        className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold disabled:opacity-50"
      >
        {loadingAction === "reject" ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          "Reddet"
        )}
      </button>
      {error && <p className="w-full text-xs font-semibold text-[#8b352b]">{error}</p>}
    </div>
  );
}
