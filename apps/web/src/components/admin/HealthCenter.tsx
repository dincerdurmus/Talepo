"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ADMIN_HEALTH_LABELS, healthMetricDisplay, healthMetricSummary } from "@/lib/admin-health-presentation";

type Data = { metrics: Record<string, number>; lastUpdatedAt: string };
type State = { status: "idle" | "loading" | "success" | "error"; data: Data | null; error: string };
type Action = { type: "loading" } | { type: "success"; data: Data } | { type: "error"; error: string };
const initial: State = { status: "idle", data: null, error: "" };

function reducer(state: State, action: Action): State {
  if (action.type === "loading") return { ...state, status: "loading", error: "" };
  if (action.type === "success") return { status: "success", data: action.data, error: "" };
  return { ...state, status: "error", error: action.error };
}

export function HealthCenter() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [state, dispatch] = useReducer(reducer, initial);
  const load = useCallback(async (signal?: AbortSignal) => {
    dispatch({ type: "loading" });
    try {
      const response = await fetch(`/api/admin/health?days=${days}`, { cache: "no-store", signal });
      const value = await response.json();
      if (!response.ok || value.ok === false) throw new Error(value.message ?? "Veriler alınamadı.");
      dispatch({ type: "success", data: value });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      dispatch({ type: "error", error: error instanceof Error ? error.message : "Veriler alınamadı." });
    }
  }, [days]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  const data = state.data;
  const summary = healthMetricSummary(data?.metrics ?? {});
  const attention = summary.alerts.length > 0 || summary.unknown.length > 0;
  const loading = state.status === "idle" || state.status === "loading";

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Admin panele dön</Link>
        <h1 className="mt-5 text-3xl font-semibold">Platform sağlığı</h1>
        <p className="mt-2 text-sm text-muted-foreground">Uyarıları ve tüm sağlık metriklerini buradan incele.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([7, 30, 90] as const).map(value => <Button key={value} size="sm" variant={days === value ? "default" : "outline"} aria-pressed={days === value} onClick={() => setDays(value)}>{value} gün</Button>)}
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" />Yenile</Button>
      </div>
    </div>
    {loading ? <div className="mt-8 grid gap-3 sm:grid-cols-4" role="status">
      <span className="sr-only">Sağlık verileri yükleniyor.</span>{[1, 2, 3, 4].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
    </div> : state.status === "error" ? <div className="mt-8 rounded-2xl bg-rose-50 p-5 text-sm text-rose-700" role="alert">
      <p>{state.error}</p><Button className="mt-3" variant="outline" onClick={() => void load()}>Tekrar dene</Button>
    </div> : data ? <>
      <section className={`mt-8 rounded-2xl border p-5 ${attention ? "border-amber-200 bg-amber-50" : "border-primary/25 bg-accent"}`}>
        <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" /><h2 className="font-semibold">{summary.alerts.length ? `${summary.alerts.length} uyarı bulundu` : summary.unknown.length ? "Bazı ölçümler tamamlanamadı" : "Kritik uyarı yok"}</h2></div>
        {summary.alerts.length > 0 && <ul className="mt-3 space-y-2 text-sm text-muted-foreground">{summary.alerts.map(([key, value]) => <li key={key}>{ADMIN_HEALTH_LABELS[key] ?? key}: <strong>{healthMetricDisplay(key, value)}</strong></li>)}</ul>}
        {summary.unknown.length > 0 && <p className="mt-3 text-sm text-amber-800">{summary.unknown.map(([key]) => ADMIN_HEALTH_LABELS[key] ?? key).join(", ")}: ölçülemedi. Bu ölçümler için sağlıklı sonuç doğrulanmadı.</p>}
        {(data.metrics.billingDriftTruncated ?? 0) > 0 && <p className="mt-3 text-sm text-amber-800">Ayrışma taraması sınıra ulaştı. Gösterilen sayı tüm hesapları kapsamıyor olabilir.</p>}
        {!attention && <p className="mt-2 text-sm text-muted-foreground">İzlenen eşiklerde sorun görünmüyor.</p>}
      </section>
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Tüm metrikler</h2><span className="text-xs text-muted-foreground">Son güncelleme: {new Date(data.lastUpdatedAt).toLocaleString("tr-TR")}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(data.metrics).map(([key, value]) => <Card key={key}><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{ADMIN_HEALTH_LABELS[key] ?? key}</p>
          <p className="mt-2 break-words text-2xl font-semibold">{healthMetricDisplay(key, value)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{!Number.isFinite(value) || value < 0 ? "Tekrar ölçüm gerekiyor" : summary.alerts.some(([alertKey]) => alertKey === key) ? "İnceleme gerekiyor" : "Normal"}</p>
        </CardContent></Card>)}</div>
      </section>
    </> : null}
  </div>;
}
