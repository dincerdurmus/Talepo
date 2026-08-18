"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ClipboardList, Loader2, ShieldAlert, X } from "lucide-react";
import { MetricCard } from "@/components/admin/MetricCard";

type Permission = string;
type Tab = "health" | "moderation" | "audit";
type Health = { periodDays: number; lastUpdatedAt: string; metrics: Record<string, number>; categoryGaps: { categoryId: string; categoryName: string; requests: number; offers: number; gap: number }[] };
type Case = { id: string; subjectType: string; subjectId: string; category: string; summary: string; priority: string; status: string; assignee: { name: string | null; email: string | null } | null };
type Audit = { id: string; action: string; reason: string; createdAt: string; actor: { name: string | null; email: string | null }; targetUser: { name: string | null; email: string | null } | null };
type Loaded = { health: Health | null; cases: Case[]; audits: Audit[] };

const emptyLoaded: Loaded = { health: null, cases: [], audits: [] };

export function AdminOperationsCenter({ permissions }: { permissions: Permission[] }) {
  const canModerate = permissions.includes("moderation.view");
  const canAudit = permissions.includes("audit.view");
  const canHealth = permissions.includes("analytics.view");
  const initialTab: Tab = canHealth ? "health" : canModerate ? "moderation" : "audit";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loaded, setLoaded] = useState<Loaded>(emptyLoaded);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => tab === "health" ? "/api/admin/health?days=30" : tab === "moderation" ? "/api/admin/moderation" : "/api/admin/audit?days=30", [tab]);
  const selectTab = (next: Tab) => { setBusy(true); setError(null); setTab(next); };

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok || data.ok === false) throw new Error(data.message ?? "Veriler alınamadı."); return data; })
      .then(data => { if (tab === "health") setLoaded(current => ({ ...current, health: data })); else if (tab === "moderation") setLoaded(current => ({ ...current, cases: data.items ?? [] })); else setLoaded(current => ({ ...current, audits: data.items ?? [] })); setError(null); setBusy(false); })
      .catch(reason => { if ((reason as DOMException).name !== "AbortError") { setError("Veriler alınamadı. Lütfen tekrar deneyin."); setBusy(false); } });
    return () => controller.abort();
  }, [endpoint, tab]);

  return <section className="mt-8 overflow-hidden rounded-[26px] border border-white/10 bg-white/[.045]">
    <nav className="flex flex-wrap gap-2 border-b border-white/10 p-4">
      {canHealth && <Nav active={tab === "health"} onClick={() => selectTab("health")} icon={Activity}>Marketplace sağlığı</Nav>}
      {canModerate && <Nav active={tab === "moderation"} onClick={() => selectTab("moderation")} icon={ShieldAlert}>Moderasyon</Nav>}
      {canAudit && <Nav active={tab === "audit"} onClick={() => selectTab("audit")} icon={ClipboardList}>Denetim kayıtları</Nav>}
    </nav>
    <div className="p-6">{busy ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-emerald-300" /></div> : error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[.06] p-5 text-sm text-rose-100">{error}<button onClick={() => selectTab(tab)} className="ml-3 underline">Yeniden dene</button></div> : tab === "health" && loaded.health ? <HealthView data={loaded.health} /> : tab === "moderation" ? <ModerationView items={loaded.cases} canManage={permissions.includes("moderation.manage")} onUpdated={() => selectTab("health")} /> : <AuditView items={loaded.audits} />}</div>
  </section>;
}

function Nav({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Activity; children: React.ReactNode }) { return <button onClick={onClick} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${active ? "bg-emerald-300 font-semibold text-[#071310]" : "text-white/50 hover:bg-white/[.05]"}`}><Icon className="h-4 w-4" />{children}</button>; }
function HealthView({ data }: { data: Health }) { const metrics = data.metrics; const cards = [["Yeni kullanıcı", metrics.newUsers, "Yeni hesaplar."], ["Yayınlanan talep", metrics.published, "Yayınlanan talepler."], ["Teklif", metrics.offers, "Gönderilen teklifler."], ["Kabul oranı", `%${metrics.acceptanceRate}`, "Teklif kabul oranı."], ["Teklif kapsaması", `%${metrics.offerCoverage}`, "Teklif alan talepler."], ["Teklifsiz talep", metrics.noOffer, "Teklif bekleyen talepler."], ["Aktif satıcı", metrics.activeSellers, "Teklif gönderen satıcılar."], ["Açık vaka", metrics.openCases, "Açık moderasyon vakaları."], ["Başarısız ödeme", metrics.failedBilling, "Başarısız ödemeler."]]; return <><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-emerald-300/60">Son {data.periodDays} gün</p><h3 className="mt-1 text-xl font-semibold">Marketplace sağlık merkezi</h3></div><p className="text-xs text-white/35">Son güncelleme: {new Date(data.lastUpdatedAt).toLocaleString("tr-TR")}</p></div><div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">{cards.map(([label, value, description]) => <MetricCard key={String(label)} label={String(label)} value={value as string | number} description={String(description)} />)}</div><h4 className="mt-7 font-semibold">Arz-talep boşluğu yüksek kategoriler</h4><div className="mt-3 space-y-2">{data.categoryGaps.map(item => <div key={item.categoryId} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 rounded-xl bg-white/[.035] px-4 py-3 text-sm"><Link href={`/panel/talepler?tab=all&category=${encodeURIComponent(item.categoryId)}`} className="group"><strong className="block font-semibold text-white/90 group-hover:text-emerald-200">{item.categoryName}</strong><small className="mt-1 block font-mono text-[11px] text-white/35">{item.categoryId}</small></Link><span className="text-white/45">{item.requests} talep</span><span className="text-white/45">{item.offers} teklif</span><span className="font-semibold text-amber-300">Açık {item.gap}</span></div>)}</div></>; }

function ModerationView({ items, canManage, onUpdated }: { items: Case[]; canManage: boolean; onUpdated: () => void }) { const [pending, setPending] = useState<{ item: Case; status: string } | null>(null); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const update = useCallback(async () => { if (!pending || note.trim().length < 5) return; setBusy(true); try { const response = await fetch("/api/admin/moderation", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pending.item.id, status: pending.status, priority: pending.item.priority, resolutionNote: note.trim() }) }); if (response.ok) { setPending(null); setNote(""); onUpdated(); } } finally { setBusy(false); } }, [pending, note, onUpdated]); return <><h3 className="text-xl font-semibold">Moderasyon kuyruğu</h3><div className="mt-5 space-y-3">{items.length ? items.map(item => <div key={item.id} className="rounded-2xl border border-white/[.07] bg-black/15 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-white/35">{item.subjectType} · {item.subjectId}</p><p className="mt-1 font-semibold">{item.category}</p><p className="mt-2 text-sm text-white/55">{item.summary}</p></div><div className="text-right"><span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs text-amber-200">{item.priority}</span><p className="mt-2 text-xs text-white/40">{item.status}</p></div></div>{canManage && !["RESOLVED", "DISMISSED"].includes(item.status) && <div className="mt-4 flex gap-2">{["INVESTIGATING", "RESOLVED", "DISMISSED"].map(status => <button key={status} onClick={() => { setPending({ item, status }); setNote(""); }} className="rounded-xl border border-white/10 px-3 py-2 text-xs">{status === "INVESTIGATING" ? "İncelemede" : status === "RESOLVED" ? "Çözüldü" : "Kapat"}</button>)}</div>}</div>) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">Açık moderasyon kaydı yok.</p>}</div>{pending && <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4" onMouseDown={event => { if (event.currentTarget === event.target) setPending(null); }}><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-[26px] border border-white/10 bg-[#0b1d19] p-6"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[.16em] text-amber-300/60">Moderasyon işlemi</p><h4 className="mt-2 text-xl font-semibold">Gerekçe ve çözüm notu</h4><p className="mt-2 text-sm text-white/45">Yeni durum: {pending.status}</p></div><button onClick={() => setPending(null)} className="rounded-xl border border-white/10 p-2"><X className="h-4 w-4" /></button></div><textarea autoFocus rows={4} value={note} onChange={event => setNote(event.target.value)} className="mt-5 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setPending(null)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm">Vazgeç</button><button disabled={busy || note.trim().length < 5} onClick={() => void update()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-[#071310] disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Kaydet</button></div></div></div>}</>; }

function AuditView({ items }: { items: Audit[] }) { return <><h3 className="text-xl font-semibold">Değiştirilemez denetim kayıtları</h3><div className="mt-5 space-y-2">{items.map(item => <div key={item.id} className="grid gap-2 rounded-2xl border border-white/[.07] bg-black/15 p-4 sm:grid-cols-[180px_1fr_180px]"><div><p className="text-xs font-semibold text-emerald-200">{item.action}</p><p className="mt-1 text-[11px] text-white/35">{new Date(item.createdAt).toLocaleString("tr-TR")}</p></div><div><p className="text-sm">{item.reason}</p><p className="mt-1 text-xs text-white/35">Hedef: {item.targetUser?.name ?? item.targetUser?.email ?? "Sistem"}</p></div><p className="text-xs text-white/45 sm:text-right">{item.actor.name ?? item.actor.email}</p></div>)}</div></>; }
