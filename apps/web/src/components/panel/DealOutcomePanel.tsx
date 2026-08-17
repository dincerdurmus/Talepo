"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

import { isBilateralDealCompleted } from "@/lib/offer/deal-completion";

type DealOutcomeState = {
  id: string;
  status: string;
  confirmationLevel: string;
  agreedPrice: number | null;
  currency: string;
  buyerConfirmedAt: string | null;
  supplierConfirmedAt: string | null;
  completedAt?: string | null;
};

export function DealOutcomePanel({
  dealOutcome,
  role,
}: {
  dealOutcome: DealOutcomeState;
  role: "buyer" | "supplier";
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [local, setLocal] = useState(dealOutcome);

  const mineConfirmed =
    role === "buyer"
      ? Boolean(local.buyerConfirmedAt)
      : Boolean(local.supplierConfirmedAt);
  const otherConfirmed =
    role === "buyer"
      ? Boolean(local.supplierConfirmedAt)
      : Boolean(local.buyerConfirmedAt);
  const completed = isBilateralDealCompleted(local);

  async function confirm() {
    if (submitting || mineConfirmed) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/deal-outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealOutcomeId: local.id,
          response: "COMPLETED",
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        dealOutcome?: DealOutcomeState;
      };
      if (!res.ok) {
        setMessage(data.message ?? "Kaydedilemedi.");
        return;
      }
      if (data.dealOutcome) setLocal(data.dealOutcome);
      router.refresh();
    } catch {
      setMessage("Bağlantı hatası.");
    } finally {
      setSubmitting(false);
    }
  }

  const amountLabel =
    local.agreedPrice != null
      ? `${local.agreedPrice.toLocaleString("tr-TR")} ${local.currency}`
      : null;

  if (completed) {
    return (
      <div className="mt-4 rounded-xl border border-teal-900/10 bg-[#eef6f4] px-4 py-3.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-950">
          <CheckCircle2 className="h-4 w-4 text-teal-800" />
          İşlem taraflarca tamamlandı olarak onaylandı.
        </p>
        {amountLabel ? (
          <p className="mt-1 text-xs text-teal-900/65">Anlaşılan tutar: {amountLabel}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-teal-900/10 bg-white px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
        İşlem durumu
      </p>
      <p className="mt-1.5 text-sm font-medium text-[#0f1f1d]">
        {mineConfirmed
          ? "Karşı tarafın onayı bekleniyor."
          : otherConfirmed
            ? "Karşı taraf işlemin tamamlandığını onayladı."
            : "Henüz kimse tamamlandığını onaylamadı."}
      </p>
      <p className="mt-1 text-xs leading-5 text-black/45">
        Onay, ürün teslimini veya ödemeyi Talepo’nun doğruladığı anlamına gelmez.
        {amountLabel ? ` Anlaşılan tutar: ${amountLabel}.` : ""}
      </p>

      {mineConfirmed ? (
        <p className="mt-3 text-xs font-medium text-amber-900/80">
          Siz onayladınız. Karşı tarafın onayı bekleniyor.
        </p>
      ) : (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void confirm()}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            "Bu işlemin tamamlandığını onaylıyorum"
          )}
        </button>
      )}

      {message ? (
        <p className="mt-2 text-xs font-semibold text-[#8b352b]">{message}</p>
      ) : null}
    </div>
  );
}
