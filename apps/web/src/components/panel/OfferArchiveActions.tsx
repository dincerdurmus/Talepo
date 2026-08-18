"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";

export function OfferArchiveActions({
  offerId,
  role,
  canArchive,
  isArchived,
}: {
  offerId: string;
  role: "buyer" | "seller";
  canArchive: boolean;
  isArchived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canArchive && !isArchived) return null;

  const run = async (action: "archive" | "unarchive") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/offers/${offerId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message || "İşlem tamamlanamadı.");
      }
      setConfirmArchive(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  };

  if (isArchived) {
    return (
      <div className="mt-4 border-t border-teal-900/[0.06] pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("unarchive")}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-900/10 bg-white px-4 text-sm font-semibold text-teal-900/80"
        >
          <ArchiveRestore className="h-4 w-4" aria-hidden />
          Aktife geri al
        </button>
        {error ? (
          <p className="mt-2 text-xs font-semibold text-[#8b352b]">{error}</p>
        ) : null}
      </div>
    );
  }

  if (!canArchive) return null;

  return (
    <div className="mt-4 border-t border-teal-900/[0.06] pt-4">
      {!confirmArchive ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmArchive(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-900/10 bg-white px-4 text-sm font-semibold text-black/55"
        >
          <Archive className="h-4 w-4" aria-hidden />
          Arşivle
        </button>
      ) : (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
          <p className="text-sm text-amber-950/85">
            Bu teklifi yalnızca sizin görünümünüzden kaldırır; karşı taraf ve
            kayıtlar korunur.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("archive")}
              className="inline-flex min-h-11 items-center rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white"
            >
              Arşivle
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmArchive(false)}
              className="inline-flex min-h-11 items-center rounded-xl border border-teal-900/10 bg-white px-4 text-sm font-semibold text-black/55"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-xs font-semibold text-[#8b352b]">{error}</p>
      ) : null}
    </div>
  );
}
