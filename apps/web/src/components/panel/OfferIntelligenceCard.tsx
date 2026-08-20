"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import type { OfferIntelligenceDTO } from "@/lib/monetization/offer-intelligence";
import { SIGNAL_RAIL_PRO_TOOL_ICONS } from "@/lib/panel/signal-rail-pro-tools";

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

const TeklifZekasiIcon = SIGNAL_RAIL_PRO_TOOL_ICONS["teklif-zekasi"];

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
      reported.current = false;
    });
  }, [intelligence, requestId]);

  if (intelligence.state === "NOT_APPLICABLE") return null;

  const compactLocked =
    intelligence.state === "LOCKED_OWN_OFFER" ||
    intelligence.state === "LOCKED_PLAN" ||
    intelligence.state === "INSUFFICIENT_SAMPLE";

  return (
    <section
      className={`mt-5 rounded-[14px] border border-[#B28A35]/18 bg-[linear-gradient(145deg,#fbfaf7_0%,#f7f4ee_100%)] ${
        compactLocked ? "px-3.5 py-3.5" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#B28A35]/35 bg-[#B28A35]/14 text-[#9a7b4a] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          <TeklifZekasiIcon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a7b4a]">
            Profesyonel · Teklif Zekâsı
          </p>
          {intelligence.state === "LOCKED_PLAN" ? (
            <p className="mt-1 text-[13px] leading-5 text-[#0f1f1d]/62">
              Anonim teklif dağılımı Profesyonel ile açılır.{" "}
              <Link
                href="/panel/plan"
                className="font-semibold text-teal-800 underline-offset-2 hover:underline"
              >
                Planları incele
              </Link>
            </p>
          ) : null}
          {intelligence.state === "LOCKED_OWN_OFFER" ? (
            <p className="mt-1 text-[13px] leading-5 text-[#0f1f1d]/68">
              Anonim teklif verileri teklif gönderdikten sonra açılır.
            </p>
          ) : null}
          {intelligence.state === "INSUFFICIENT_SAMPLE" ? (
            <p className="mt-1 text-[13px] leading-5 text-[#0f1f1d]/62">
              Yeterli anonim teklif verisi henüz oluşmadı.
            </p>
          ) : null}
        </div>
      </div>

      {intelligence.state === "READY" &&
      intelligence.min != null &&
      intelligence.max != null &&
      intelligence.median != null &&
      intelligence.average != null ? (
        <div className="mt-4 space-y-3">
          <p className="text-[12px] text-[#0f1f1d]/50">
            Bu talepteki anonim teklifler. Piyasa fiyatı değildir.
          </p>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="text-[11px] text-[#0f1f1d]/45">
            Ortalama {formatMoney(intelligence.average, intelligence.currency)}.
            Gönderilmiş teklifler; taslak, geri çekilen ve süresi dolan dahil
            değildir.
          </p>
          {intelligence.viewerAmount != null ? (
            <div className="rounded-[12px] border border-[#B28A35]/15 bg-white/80 px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9a7b4a]">
                Kendi teklifiniz
              </p>
              <p className="mt-1 text-[15px] font-semibold tabular-nums text-[#0f1f1d]">
                {formatMoney(intelligence.viewerAmount, intelligence.currency)}
              </p>
              {formatVsMedian(intelligence.viewerVsMedianPct) ? (
                <p className="mt-1 text-[13px] text-[#0f1f1d]/55">
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
    <div className="rounded-[12px] border border-[#B28A35]/12 bg-white/85 px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#0f1f1d]/45">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] font-semibold tabular-nums text-[#0f1f1d]">
        {value}
      </dd>
    </div>
  );
}
