"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LineChart } from "lucide-react";

import type { OfferIntelligenceDTO } from "@/lib/monetization/offer-intelligence";

function formatMoney(amount: number, currency: string | null) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency || "TRY",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("tr-TR")} ${currency ?? "TRY"}`;
  }
}

function formatVsMedian(pct: number | null) {
  if (pct == null) return null;
  if (pct === 0) return "Medyana eşit";
  const abs = Math.abs(pct).toLocaleString("tr-TR", {
    maximumFractionDigits: 1,
  });
  return pct > 0 ? `Medyanın %${abs} üzerinde` : `Medyanın %${abs} altında`;
}

/**
 * READY stats are decision assistance. Locked / insufficient shells are not exposure.
 * First real READY mount POSTs requestId; server re-validates and writes once.
 */
export function OfferIntelligenceCard({
  intelligence,
  requestId,
}: {
  intelligence: OfferIntelligenceDTO;
  requestId: string;
}) {
  const reported = useRef(false);

  useEffect(() => {
    if (intelligence.state !== "READY") return;
    if (
      intelligence.min == null ||
      intelligence.max == null ||
      intelligence.median == null ||
      intelligence.average == null
    ) {
      return;
    }
    if (reported.current) return;
    reported.current = true;

    void fetch("/api/monetization/offer-intelligence/exposure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    }).catch(() => {
      // Non-blocking telemetry — do not surface to the user.
      reported.current = false;
    });
  }, [intelligence, requestId]);

  if (intelligence.state === "NOT_APPLICABLE") return null;

  return (
    <section className="mt-6 rounded-2xl border border-teal-900/10 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <LineChart className="h-4 w-4 text-teal-800" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-800/50">
            Professional
          </p>
          <h2 className="text-base font-semibold text-teal-950">Teklif Zekâsı</h2>
        </div>
      </div>
      <p className="mt-1 text-xs text-teal-950/45">
        Bu talepteki anonim teklifler. Piyasa fiyatı değildir.
      </p>

      {intelligence.state === "LOCKED_PLAN" ? (
        <p className="mt-3 text-sm text-teal-950/60">
          Teklif Zekâsı Professional ile kullanılabilir.{" "}
          <Link href="/panel/plan" className="font-semibold text-teal-800 underline">
            Planları incele
          </Link>
        </p>
      ) : null}

      {intelligence.state === "LOCKED_OWN_OFFER" ? (
        <p className="mt-3 text-sm text-teal-950/60">
          Anonim teklif verileri, teklifinizi gönderdikten sonra açılır.
        </p>
      ) : null}

      {intelligence.state === "INSUFFICIENT_SAMPLE" ? (
        <p className="mt-3 text-sm text-teal-950/60">
          Yeterli anonim teklif verisi henüz oluşmadı.
        </p>
      ) : null}

      {intelligence.state === "READY" &&
      intelligence.min != null &&
      intelligence.max != null &&
      intelligence.median != null &&
      intelligence.average != null ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Diğer teklif"
              value={String(intelligence.otherCount ?? 0)}
            />
            <Stat
              label="En düşük"
              value={formatMoney(intelligence.min, intelligence.currency)}
            />
            <Stat
              label="Medyan"
              value={formatMoney(intelligence.median, intelligence.currency)}
            />
            <Stat
              label="En yüksek"
              value={formatMoney(intelligence.max, intelligence.currency)}
            />
          </dl>
          <p className="text-xs text-teal-950/40">
            Ortalama {formatMoney(intelligence.average, intelligence.currency)}.
            Gönderilmiş teklifler; taslak, geri çekilen ve süresi dolan dahil
            değildir.
          </p>
          {intelligence.viewerAmount != null ? (
            <div className="rounded-xl border border-teal-900/8 bg-teal-50/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800/50">
                Kendi teklifiniz
              </p>
              <p className="mt-1 text-lg font-semibold text-teal-950">
                {formatMoney(intelligence.viewerAmount, intelligence.currency)}
              </p>
              {formatVsMedian(intelligence.viewerVsMedianPct) ? (
                <p className="mt-1 text-sm text-teal-950/60">
                  {formatVsMedian(intelligence.viewerVsMedianPct)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-3 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-teal-950/40">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-teal-950">
        {value}
      </dd>
    </div>
  );
}
