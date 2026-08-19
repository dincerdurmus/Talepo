"use client";

import { useState } from "react";
import { Check, ChevronDown, RefreshCw } from "lucide-react";

import { ExportCsvButton } from "@/components/admin/ExportCsvButton";

const labels = { newUsers: "Yeni kullanıcı", companyRegistrations: "Firma kayıtları", companyClosures: "Firma kapatmaları", published: "Yayınlanan talep", offers: "Teklif", acceptanceRate: "Kabul oranı", offerCoverage: "Teklif kapsaması", noOffer: "Teklifsiz talep", activeSellers: "Aktif satıcı", openCases: "Açık vaka", failedBilling: "Başarısız ödeme" };
const colors = ["#6ee7b7", "#67e8f9", "#fbbf24", "#fda4af"];
type DateRange = { from: string; to: string; previousFrom: string; previousTo: string };
type Filters = { city: string; requestStatus: string };
type Point = { date: string; [key: string]: number | string };
type Data = { metrics: Record<string, number>; previousMetrics: Record<string, number>; trend: Point[] };

const date = (value: Date) => value.toISOString().slice(0, 10);
const labelDate = (value: string) => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
function range(days: number): DateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days + 1);
  const span = to.getTime() - from.getTime();
  return { from: date(from), to: date(to), previousFrom: date(new Date(from.getTime() - span - 86_400_000)), previousTo: date(new Date(from.getTime() - 86_400_000)) };
}

export function DateRangeComparison() {
  const [dates, setDates] = useState(() => range(30));
  const [filters, setFilters] = useState<Filters>({ city: "", requestStatus: "" });
  const [selected, setSelected] = useState<string[]>(["offers"]);
  const [active, setActive] = useState<number | "custom">(30);
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; point: Point } | null>(null);

  async function load(next = dates, nextFilters = filters) {
    setBusy(true);
    try {
      const params = new URLSearchParams({ ...next, ...(nextFilters.city ? { city: nextFilters.city } : {}), ...(nextFilters.requestStatus ? { requestStatus: nextFilters.requestStatus } : {}) });
      const response = await fetch(`/api/admin/health?${params}`, { cache: "no-store" });
      if (response.ok) setData(await response.json() as Data);
    } finally { setBusy(false); }
  }

  const max = Math.max(...(data?.trend ?? []).flatMap((point) => selected.map((key) => Number(point[key] ?? 0))), 1);
  const top = Math.ceil(max / 5) * 5 || 5;
  const ticks = Array.from({ length: 6 }, (_, index) => Math.max(0, top - index * top / 5));
  const rows = data ? selected.map((key) => ({ Metrik: labels[key as keyof typeof labels], "Bu dönem": data.metrics[key] ?? 0, "Önceki dönem": data.previousMetrics[key] ?? 0 })) : [];

  return <section className="mt-6 overflow-hidden rounded-2xl border border-white/[.08] bg-black/10">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="group flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-emerald-300/[.06]">
      <span><span className="block font-semibold text-white">Özel tarih karşılaştırması</span><span className="mt-1 block text-xs text-white/40">Dönem, talep durumu ve şehir bazında raporla.</span></span>
      <ChevronDown className={`mr-3 h-5 w-5 shrink-0 text-emerald-200 transition-all duration-300 group-hover:text-emerald-100 ${open ? "rotate-180" : ""}`} />
    </button>
    {open ? <div className="border-t border-white/[.08] p-4">
      <div className="flex justify-end"><div className="relative">
        <button type="button" onClick={() => setMenu((value) => !value)} className="flex min-w-52 items-center justify-between rounded-xl border border-white/10 bg-[#102421] px-3 py-2 text-xs text-white">{selected.length} metrik seçildi<ChevronDown className="h-4 w-4" /></button>
        {menu ? <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-white/10 bg-[#102421] p-2">{Object.entries(labels).map(([key, label]) => <button type="button" key={key} onClick={() => setSelected((value) => value.includes(key) ? value.filter((item) => item !== key) : [...value, key])} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/[.06]"><span className={`flex h-4 w-4 items-center justify-center rounded border ${selected.includes(key) ? "border-emerald-300 bg-emerald-300 text-[#071310]" : "border-white/20"}`}>{selected.includes(key) ? <Check className="h-3 w-3" /> : null}</span>{label}</button>)}</div> : null}
      </div></div>
      <div className="mt-4 flex flex-wrap gap-2">{[7, 30, 90].map((days) => <button type="button" key={days} aria-pressed={active === days} onClick={() => { const next = range(days); setActive(days); setDates(next); void load(next); }} className={`rounded-xl border px-3 py-2 text-xs ${active === days ? "border-emerald-300 bg-emerald-300 font-semibold text-[#071310]" : "border-white/10 text-white/55 hover:bg-white/[.05]"}`}>Son {days} gün</button>)}<button type="button" onClick={() => setActive("custom")} className={`rounded-xl border px-3 py-2 text-xs ${active === "custom" ? "border-emerald-300 bg-emerald-300 text-[#071310]" : "border-white/10 text-white/55 hover:bg-white/[.05]"}`}>Özel Tarih Seç</button></div>
      {active === "custom" ? <div className="mt-3 grid gap-2 sm:grid-cols-4">{(["from", "to", "previousFrom", "previousTo"] as const).map((key) => <input key={key} type="date" value={dates[key]} onChange={(event) => setDates((value) => ({ ...value, [key]: event.target.value }))} className="rounded-xl border border-white/10 bg-[#102421] px-3 py-2 text-white" />)}</div> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-white/45">Talep şehri<input value={filters.city} onChange={(event) => setFilters((value) => ({ ...value, city: event.target.value }))} placeholder="Örn. İstanbul" className="rounded-xl border border-white/10 bg-[#102421] px-3 py-2 text-sm text-white placeholder:text-white/25" /></label>
        <label className="grid gap-1 text-xs text-white/45">Talep durumu<select value={filters.requestStatus} onChange={(event) => setFilters((value) => ({ ...value, requestStatus: event.target.value }))} className="rounded-xl border border-white/10 bg-[#102421] px-3 py-2 text-sm text-white"><option value="">Tüm durumlar</option><option value="PUBLISHED">Yayında</option><option value="RECEIVING_OFFERS">Teklif alıyor</option><option value="OFFER_SELECTED">Teklif seçildi</option><option value="IN_PROGRESS">Devam ediyor</option><option value="COMPLETED">Tamamlandı</option><option value="CANCELLED">İptal</option><option value="EXPIRED">Süresi doldu</option></select></label>
      </div>
      <p className="mt-2 text-xs text-white/35">Şehir ve durum filtreleri talep, teklif ve kategori metriklerini daraltır; kullanıcı, firma ve ödeme toplamları genel kalır.</p>
      <div className="mt-4 flex gap-2"><button type="button" onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-bold text-[#071310] disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />Karşılaştır</button>{data ? <ExportCsvButton rows={rows} filename="talepo-tarih-karsilastirmasi.csv" /> : null}</div>
      <div className="mt-5 rounded-2xl border border-white/[.07] bg-[#071310] p-4">{data ? <div className="flex gap-2"><div className="flex w-8 shrink-0 flex-col justify-between py-1 text-[10px] text-white/45">{ticks.map((tick, index) => <span key={`${tick}-${index}`}>{tick}</span>)}</div><div className="relative min-w-[520px] flex-1"><svg viewBox="0 0 400 190" className="h-56 w-full">{ticks.map((tick, index) => <line key={`grid-${tick}-${index}`} x1="0" x2="400" y1={index * 30 + 10} y2={index * 30 + 10} stroke="white" strokeOpacity=".08" />)}{selected.map((key, index) => { const color = colors[index % colors.length]; const path = data.trend.map((point, itemIndex) => `${itemIndex ? "L" : "M"} ${10 + itemIndex * 380 / Math.max(data.trend.length - 1, 1)} ${170 - (Number(point[key] ?? 0) / top) * 160}`).join(" "); return <g key={key}><path d={path} fill="none" stroke={color} strokeWidth="3" />{data.trend.map((point, itemIndex) => { const x = 10 + itemIndex * 380 / Math.max(data.trend.length - 1, 1); const y = 170 - (Number(point[key] ?? 0) / top) * 160; return <circle key={`${key}-${point.date}`} cx={x} cy={y} r="4" fill={color} onMouseEnter={() => setHover({ x, y, point })} onMouseLeave={() => setHover(null)} />; })}</g>; })}<text x="10" y="175" fill="white" fillOpacity=".5" fontSize="8">Başlangıç Tarihi</text><text x="10" y="187" fill="white" fillOpacity=".7" fontSize="9">{labelDate(dates.from)}</text><text x="390" y="175" fill="white" fillOpacity=".5" fontSize="8" textAnchor="end">Bitiş Tarihi</text><text x="390" y="187" fill="white" fillOpacity=".7" fontSize="9" textAnchor="end">{labelDate(dates.to)}</text></svg>{hover ? <div className="pointer-events-none absolute z-30 rounded-lg border border-white/15 bg-[#102421] px-3 py-2 text-xs shadow-xl" style={{ left: `${Math.min(78, Math.max(0, hover.x / 4 - 8))}%`, top: `${Math.max(0, hover.y / 1.9 - 50)}px` }}>{selected.map((key) => <p key={key} className="text-white/70">{labels[key as keyof typeof labels]}: <strong className="text-emerald-200">{hover.point[key] ?? 0}</strong></p>)}</div> : null}</div></div> : <p className="py-12 text-center text-sm text-white/35">Bir dönem seçip karşılaştırdığında grafik burada görünecek.</p>}</div>
    </div> : null}
  </section>;
}
