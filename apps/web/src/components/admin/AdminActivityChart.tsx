"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchAdminHealth } from "@/lib/admin-health-client";

type Point = { date: string; published: number; offers: number };
type ChartState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; points: Point[] };
const number = new Intl.NumberFormat("tr-TR");
const date = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });

export function AdminActivityChart() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [state, setState] = useState<ChartState>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const gradientId = useId().replaceAll(":", "");
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const data = await fetchAdminHealth<{ trend?: Point[] }>(`/api/admin/health?days=${days}`, { force: retry > 0 });
      if (!signal.aborted) setState({ status: "ready", points: data.trend ?? [] });
    } catch (error) {
      if (!signal.aborted) setState({ status: "error", message: error instanceof Error ? error.message : "Platform hareketleri alınamadı." });
    }
  }, [days, retry]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  const points = state.status === "ready" ? state.points : [];
  const max = Math.max(1, ...points.flatMap((point) => [point.published, point.offers]));
  const ceiling = Math.ceil(max / 4) * 4;
  const x = (index: number) => points.length === 1 ? 335 : 46 + index * 574 / (points.length - 1);
  const y = (value: number) => 194 - value / ceiling * 162;
  const path = (metric: "published" | "offers") => points.map((point, index) => `${index ? "L" : "M"} ${x(index)} ${y(point[metric])}`).join(" ");
  const totalRequests = points.reduce((sum, point) => sum + point.published, 0);
  const totalOffers = points.reduce((sum, point) => sum + point.offers, 0);
  const ticks = [...new Set([0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1])].filter((index) => index >= 0);

  return <Card className="admin-panel">
    <div className="admin-panel-heading"><div><h2>Platform hareketleri</h2><p>Yayınlanan talepler ve gönderilen teklifler</p></div>
      <div className="admin-chart-periods" aria-label="Grafik dönemi">{([7, 30, 90] as const).map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => { if (days !== value) { setState({ status: "loading" }); setDays(value); } }}>{value} gün</button>)}</div>
    </div>
    {state.status === "loading" ? <div className="admin-chart-state" role="status"><Loader2 className="size-5 animate-spin text-primary" />Platform hareketleri yükleniyor.</div> : state.status === "error" ? <div className="admin-chart-state" role="alert"><p>{state.message}</p><Button variant="outline" size="sm" onClick={() => { setState({ status: "loading" }); setRetry((value) => value + 1); }}><RefreshCw />Yeniden dene</Button></div> : points.length === 0 ? <div className="admin-chart-state">Bu dönem için hareket verisi bulunmuyor.</div> : <>
      <div className="admin-chart-totals"><div><i style={{ background: "#0d9488" }} /><span>Yayınlanan talep<strong>{number.format(totalRequests)}</strong></span></div><div><i style={{ background: "#78a39d" }} /><span>Gönderilen teklif<strong>{number.format(totalOffers)}</strong></span></div></div>
      <figure className="admin-chart-body">
        <svg viewBox="0 0 654 232" role="img" aria-label={`Son ${days} gün: ${number.format(totalRequests)} yayınlanan talep, ${number.format(totalOffers)} gönderilen teklif.`}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d9488" stopOpacity=".17" /><stop offset="100%" stopColor="#0d9488" stopOpacity=".01" /></linearGradient></defs>
          {[0, 1, 2, 3, 4].map((tick) => { const value = ceiling * tick / 4; return <g key={tick}><line x1="46" x2="620" y1={y(value)} y2={y(value)} stroke="#e3ede9" strokeDasharray="3 4" /><text x="34" y={y(value) + 4} textAnchor="end" fill="#526f66" fontSize="10">{number.format(value)}</text></g>; })}
          <path d={`${path("published")} L ${x(points.length - 1)} 194 L ${x(0)} 194 Z`} fill={`url(#${gradientId})`} />
          <path d={path("offers")} fill="none" stroke="#78a39d" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
          <path d={path("published")} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinejoin="round" />
          {points.map((point, index) => <g key={point.date}><circle cx={x(index)} cy={y(point.published)} r={points.length === 1 ? 4 : 2.5} fill="#0d9488"><title>{date.format(new Date(point.date))}: {point.published} talep</title></circle><circle cx={x(index)} cy={y(point.offers)} r={points.length === 1 ? 4 : 2} fill="#78a39d"><title>{date.format(new Date(point.date))}: {point.offers} teklif</title></circle></g>)}
          {ticks.map((index) => <text key={index} x={x(index)} y="219" textAnchor="middle" fill="#526f66" fontSize="10">{date.format(new Date(points[index].date))}</text>)}
        </svg>
        <figcaption className="sr-only">Günlük talep ve teklif sayıları. Düz çizgi talepleri, kesikli çizgi teklifleri gösterir.</figcaption>
      </figure>
    </>}
  </Card>;
}
