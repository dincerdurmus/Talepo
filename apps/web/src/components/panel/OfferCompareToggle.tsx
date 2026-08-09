"use client";

import { useState } from "react";
import { ChevronDown, GitCompareArrows } from "lucide-react";

import type { OfferCompleteness } from "@/lib/offer/offer-completeness";

type CompareOffer = {
  id: string;
  firmName: string;
  amount: number;
  deliveryDays: number | null;
  completeness: OfferCompleteness;
  verified: boolean;
};

export function OfferCompareToggle({ offers }: { offers: CompareOffer[] }) {
  const [open, setOpen] = useState(true);

  if (offers.length < 2) return null;

  return (
    <div className="rounded-2xl border border-teal-800/12 bg-gradient-to-b from-teal-50/80 to-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-teal-50/50"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-teal-950">
          <GitCompareArrows className="h-4 w-4 text-[#0f766e]" />
          Karşılaştır ({offers.length} teklif · doluluğa göre)
        </span>
        <ChevronDown
          className={`h-4 w-4 text-teal-900/40 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="overflow-x-auto border-t border-teal-900/[0.06] px-2 pb-3 pt-1 sm:px-3">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-teal-950/40">
                <th className="px-2 py-2.5 font-semibold">Sıra</th>
                <th className="px-2 py-2.5 font-semibold">Firma</th>
                <th className="px-2 py-2.5 font-semibold">Tutar</th>
                <th className="px-2 py-2.5 font-semibold">Teslim</th>
                <th className="px-2 py-2.5 font-semibold">Doluluk</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer, index) => (
                <tr
                  key={offer.id}
                  className="border-t border-teal-900/[0.05] text-[#0f1f1d]"
                >
                  <td className="px-2 py-3">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[#0f1f1d] px-1 text-[11px] font-bold text-white">
                      #{index + 1}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <p className="font-semibold">{offer.firmName}</p>
                    {offer.verified ? (
                      <p className="text-[11px] text-emerald-700">Doğrulanmış</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-3 font-semibold tabular-nums">
                    {Number.isFinite(offer.amount)
                      ? `₺${offer.amount.toLocaleString("tr-TR")}`
                      : "—"}
                  </td>
                  <td className="px-2 py-3 text-black/60">
                    {offer.deliveryDays != null
                      ? `${offer.deliveryDays} gün`
                      : "—"}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-teal-900/10">
                        <div
                          className="h-full rounded-full bg-[#0f766e]"
                          style={{
                            width: `${offer.completeness.score}%`,
                          }}
                        />
                      </div>
                      <span className="tabular-nums text-xs font-semibold text-teal-950/70">
                        {offer.completeness.score}% · {offer.completeness.label}
                      </span>
                    </div>
                    {offer.completeness.missing.length > 0 ? (
                      <p className="mt-1 text-[10px] text-black/35">
                        Eksik: {offer.completeness.missing.join(", ")}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 px-2 text-[11px] leading-5 text-black/40">
            * Sıralama teklif doluluğuna göre (tutar, süre, açıklama, başlık,
            geçerlilik). Aynı dolulukta daha uygun fiyat öne çıkar.
          </p>
        </div>
      ) : null}
    </div>
  );
}
