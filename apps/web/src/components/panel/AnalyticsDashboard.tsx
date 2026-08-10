"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Clock,
  LoaderCircle,
  Target,
  TrendingUp,
} from "lucide-react";

import type { CompanyPerformanceMetrics } from "@/lib/monetization/types";

type RangeDays = 7 | 30 | 90;

function rangeDates(days: RangeDays) {
  const to = new Date();
  const from = new Date(Date.now() - days * 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatPercent(rate: number | null) {
  if (rate == null) return "—";
  return `%${Math.round(rate * 100)}`;
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-teal-900/8 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-teal-800/60">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-teal-950">{value}</p>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [range, setRange] = useState<RangeDays>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<CompanyPerformanceMetrics | null>(null);

  const load = useCallback(async (days: RangeDays) => {
    setLoading(true);
    setError(null);
    const { from, to } = rangeDates(days);
    try {
      const response = await fetch(
        `/api/monetization/analytics?type=performance&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      const data = (await response.json()) as {
        ok?: boolean;
        metrics?: CompanyPerformanceMetrics;
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "Analiz alınamadı.");
      setMetrics(data.metrics ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiz alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {([7, 30, 90] as RangeDays[]).map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => {
              setRange(days);
              void load(days);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              range === days
                ? "bg-teal-900 text-white"
                : "border border-teal-900/10 bg-white text-teal-900/70 hover:bg-teal-50"
            }`}
          >
            Son {days} gün
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-teal-950/50">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Metrikler yükleniyor...
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
      ) : null}

      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Gönderilen teklif"
            value={metrics.offersSubmitted}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <MetricCard
            label="Kabul edilen"
            value={metrics.offersAccepted}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            label="Kabul oranı"
            value={formatPercent(metrics.acceptanceRate)}
            icon={<Target className="h-4 w-4" />}
          />
          <MetricCard
            label="Ort. yanıt süresi"
            value={
              metrics.averageResponseTimeHours != null
                ? `${metrics.averageResponseTimeHours} sa`
                : "—"
            }
            icon={<Clock className="h-4 w-4" />}
          />
          <MetricCard
            label="Eşleşen talep"
            value={metrics.matchedRequests}
            icon={<Target className="h-4 w-4" />}
          />
          <MetricCard
            label="Dönemde takibe alınan"
            value={metrics.watchlistAddsInPeriod}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <MetricCard
            label="Aktif takip listesi"
            value={metrics.activeWatchedRequests}
            icon={<Target className="h-4 w-4" />}
          />
        </div>
      ) : null}

      <p className="text-xs text-teal-950/40">
        Metrikler firma bazında, seçilen tarih aralığında sunucu tarafında hesaplanır.
      </p>
    </div>
  );
}

export function BasicMarketInsights({
  requestCount,
  averageBudget,
  trend,
  insufficientData,
}: {
  requestCount: number;
  averageBudget: number | null;
  trend: string;
  insufficientData: boolean;
}) {
  if (insufficientData) {
    return (
      <section className="rounded-[24px] border border-teal-900/8 bg-teal-50/40 p-6">
        <h2 className="text-lg font-semibold text-teal-950">Temel piyasa özeti</h2>
        <p className="mt-2 text-sm text-teal-950/55">
          Anonim toplu veri henüz yeterli değil ({requestCount} talep). Profesyonel
          Insights ile daha detaylı trendler açılır.
        </p>
        <Link
          href="/panel/plan"
          className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline"
        >
          Profesyonel planı incele
        </Link>
      </section>
    );
  }

  const trendLabel =
    trend === "UP"
      ? "Yükseliş"
      : trend === "DOWN"
        ? "Düşüş"
        : trend === "FLAT"
          ? "Stabil"
          : "Belirsiz";

  return (
    <section className="rounded-[24px] border border-teal-900/8 bg-white p-6">
      <h2 className="text-lg font-semibold text-teal-950">Temel piyasa özeti</h2>
      <p className="mt-1 text-sm text-teal-950/50">
        Son 30 günde anonim toplu veri (Premium)
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase text-teal-950/45">Talep sayısı</dt>
          <dd className="mt-1 text-2xl font-semibold text-teal-950">{requestCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-teal-950/45">Ort. bütçe</dt>
          <dd className="mt-1 text-2xl font-semibold text-teal-950">
            {averageBudget != null
              ? `${averageBudget.toLocaleString("tr-TR")} ₺`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-teal-950/45">Trend</dt>
          <dd className="mt-1 text-2xl font-semibold text-teal-950">{trendLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
