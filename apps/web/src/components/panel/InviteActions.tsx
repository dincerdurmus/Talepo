"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, X } from "lucide-react";

export function InviteActions({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "reject") {
    setBusy(action);
    setError(null);

    try {
      const response = await fetch("/api/company/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, companyId }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.message ?? "İşlem başarısız.");
        return;
      }

      setDone(action === "accept" ? "accepted" : "rejected");
      router.refresh();
      if (action === "accept") {
        router.push("/panel");
      }
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(null);
    }
  }

  if (done === "accepted") {
    return (
      <p className="mt-3 text-sm font-medium text-teal-800">
        {companyName ? `${companyName} ekibine katıldınız.` : "Davet kabul edildi."}
      </p>
    );
  }

  if (done === "rejected") {
    return (
      <p className="mt-3 text-sm font-medium text-black/45">Davet reddedildi.</p>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void respond("accept")}
          className="inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy === "accept" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Kabul et
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void respond("reject")}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-2 text-xs font-semibold text-black/70 disabled:opacity-60"
        >
          {busy === "reject" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          Reddet
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
