"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle } from "lucide-react";

type DealOutcomeState = {
  id: string;
  status: string;
  confirmationLevel: string;
  agreedPrice: number | null;
  currency: string;
  buyerConfirmedAt: string | null;
  supplierConfirmedAt: string | null;
};

const RESPONSES = [
  { value: "COMPLETED", label: "İşlem tamamlandı" },
  { value: "CANCELLED", label: "İptal edildi" },
  { value: "PRICE_DISAGREEMENT", label: "Fiyat konusunda anlaşamadık" },
  { value: "PRODUCT_UNAVAILABLE", label: "Ürün bulunamadı" },
  { value: "PENDING", label: "Henüz sonuçlanmadı" },
] as const;

export function DealOutcomePanel({
  dealOutcome,
  role,
}: {
  dealOutcome: DealOutcomeState;
  role: "buyer" | "supplier";
}) {
  const [selected, setSelected] = useState<string>("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [local, setLocal] = useState(dealOutcome);

  const alreadyConfirmed =
    role === "buyer"
      ? Boolean(local.buyerConfirmedAt)
      : Boolean(local.supplierConfirmedAt);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/deal-outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealOutcomeId: local.id,
          role,
          response: selected,
          agreedPrice:
            selected === "COMPLETED" && agreedPrice
              ? Number(agreedPrice)
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "Kaydedilemedi.");
        return;
      }
      setLocal(data.dealOutcome);
      setMessage("Yanıtınız kaydedildi.");
    } catch {
      setMessage("Bağlantı hatası.");
    } finally {
      setSubmitting(false);
    }
  }

  if (local.status === "COMPLETED" && local.confirmationLevel === "BOTH_CONFIRMED") {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          İşlem her iki tarafça tamamlandı olarak teyit edildi.
        </div>
        {local.agreedPrice != null && (
          <p className="mt-1 text-emerald-800/80">
            Anlaşılan tutar: {local.agreedPrice.toLocaleString("tr-TR")} {local.currency}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">
            Bu işlem gerçekleşti mi?
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Yanıtınız piyasa verisi kalitesini artırır. Alıcı ve firma bağımsız cevap verir.
          </p>

          {alreadyConfirmed ? (
            <p className="mt-2 text-xs font-medium text-teal-700">
              Yanıtınız kaydedildi. Karşı tarafın teyidini bekliyoruz.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {RESPONSES.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name="deal-response"
                    value={opt.value}
                    checked={selected === opt.value}
                    onChange={() => setSelected(opt.value)}
                    className="text-teal-700"
                  />
                  {opt.label}
                </label>
              ))}

              {selected === "COMPLETED" && (
                <input
                  type="number"
                  min={1}
                  placeholder="Gerçek anlaşma tutarı (opsiyonel)"
                  value={agreedPrice}
                  onChange={(e) => setAgreedPrice(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              )}

              <button
                type="button"
                disabled={!selected || submitting}
                onClick={handleSubmit}
                className="mt-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? "Kaydediliyor…" : "Yanıtı gönder"}
              </button>
            </div>
          )}

          {message && (
            <p className="mt-2 text-xs text-slate-600">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
