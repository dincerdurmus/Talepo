"use client";

import { useState } from "react";
import { LoaderCircle, Star } from "lucide-react";

import { FeatureUpgradeGate } from "./FeatureUpgradeGate";

type WatchlistToggleProps = {
  requestId: string;
  initialWatchlisted: boolean;
  entitled: boolean;
};

export function WatchlistToggle({
  requestId,
  initialWatchlisted,
  entitled,
}: WatchlistToggleProps) {
  const [watchlisted, setWatchlisted] = useState(initialWatchlisted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!entitled) {
    return (
      <div className="mt-5">
        <FeatureUpgradeGate feature="watchlist" entitled={false} />
      </div>
    );
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/monetization/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: watchlisted ? "remove" : "add",
          requestId,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok) {
        setError(data.message ?? "İşlem başarısız.");
        return;
      }
      setWatchlisted((v) => !v);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-teal-900/10 bg-white p-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
          watchlisted
            ? "bg-teal-900 text-white"
            : "border border-teal-900/15 text-teal-900/75 hover:bg-teal-50"
        }`}
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Star className={`h-4 w-4 ${watchlisted ? "fill-current" : ""}`} />
        )}
        {watchlisted ? "Takipten çıkar" : "Takibe al"}
      </button>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
