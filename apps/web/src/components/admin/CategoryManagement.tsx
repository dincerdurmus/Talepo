"use client";

import { useState, type FormEvent } from "react";
import { Archive, CheckCircle2, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  isBuiltIn: boolean;
  _count: {
    requests: number;
    companyCategories: number;
    forms: number;
    suggestions: number;
    alertRules: number;
    inventoryItems: number;
    priceObservations: number;
  };
};

export function CategoryManagement({ initialCategories, canDeleteCategories }: { initialCategories: Category[]; canDeleteCategories: boolean }) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, description }) });
      const data = await response.json() as { ok: boolean; message?: string; category?: Category };
      if (!response.ok || !data.ok || !data.category) throw new Error(data.message ?? "Kategori oluşturulamadı.");
      setCategories((current) => [...current, { ...data.category!, isBuiltIn: false, _count: { requests: 0, companyCategories: 0, forms: 0, suggestions: 0, alertRules: 0, inventoryItems: 0, priceObservations: 0 } }]);
      setName(""); setSlug(""); setDescription(""); setMessage("Kategori oluşturuldu.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kategori oluşturulamadı."); }
    finally { setBusy(false); }
  }

  async function changeStatus(category: Category) {
    const next = !category.isActive;
    const reason = window.prompt(next ? "Kategori yeniden açma gerekçesi:" : "Kategori arşivleme gerekçesi:");
    if (!reason || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: next, reason: reason.trim() }) });
      const data = await response.json() as { ok: boolean; message?: string; category?: { isActive: boolean } };
      if (!response.ok || !data.ok) throw new Error(data.message ?? "Kategori durumu güncellenemedi.");
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, isActive: next } : item));
      setMessage(next ? "Kategori açıldı; süresi kalan ilanlar yeniden yayınlandı." : "Kategori arşivlendi; aktif ilanlar pasife alındı.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kategori durumu güncellenemedi."); }
    finally { setBusy(false); }
  }

  async function deleteCategory(category: Category) {
    const confirmation = window.prompt(
      `"${category.name}" kategorisini kalıcı silmek için kategori adını aynen yazın:`,
    );
    if (confirmation !== category.name) return;
    const reason = window.prompt("Kalıcı silme gerekçesi:");
    if (!reason || reason.trim().length < 5) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), confirmationName: confirmation }),
      });
      const data = await response.json() as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.message ?? "Kategori silinemedi.");
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setMessage("Kategori kalıcı olarak silindi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kategori silinemedi."); }
    finally { setBusy(false); }
  }

  return <section className="mt-8 rounded-[26px] border border-emerald-300/15 bg-emerald-300/[.035] p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-200/65">Kategori yönetimi</p><h2 className="mt-2 text-xl font-semibold">Kategori arşivi ve yayın durumu</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Pasife alınan kategori kullanıcıya gösterilmez. O kategorideki ilanlar korunur; kategori yeniden açıldığında yalnızca bir aylık süresi dolmamış ilanlar geri gelir.</p></div><span className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs text-white/55">Yalnız Admin ve Süper Admin</span></div>
    <form onSubmit={createCategory} className="mt-5 grid gap-3 rounded-2xl border border-white/[.08] bg-black/15 p-4 md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end"><label className="grid gap-1 text-xs text-white/45">Kategori adı<input value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl border border-white/10 bg-[#102421] px-3 py-2.5 text-sm text-white" placeholder="Örn. Hobi" required /></label><label className="grid gap-1 text-xs text-white/45">Slug (opsiyonel)<input value={slug} onChange={(event) => setSlug(event.target.value)} className="rounded-xl border border-white/10 bg-[#102421] px-3 py-2.5 text-sm text-white" placeholder="hobi" /></label><label className="grid gap-1 text-xs text-white/45">Açıklama<input value={description} onChange={(event) => setDescription(event.target.value)} className="rounded-xl border border-white/10 bg-[#102421] px-3 py-2.5 text-sm text-white" placeholder="Kategori açıklaması" /></label><button disabled={busy} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-[#071310] disabled:opacity-50"><Plus className="h-4 w-4" />Ekle</button></form>
    {message ? <p className="mt-3 text-sm text-emerald-100/75" role="status">{message}</p> : null}
    <div className="mt-5 grid gap-2">{categories.map((category) => {
      const dependencyCount = Object.values(category._count).reduce((total, count) => total + count, 0);
      const canDelete = canDeleteCategories && !category.isBuiltIn && dependencyCount === 0;
      return <div key={category.id} data-category-id={category.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[.07] bg-black/15 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${category.isActive ? "bg-emerald-300/15 text-emerald-200" : "bg-white/[.07] text-white/35"}`}>{category.isActive ? <CheckCircle2 className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</span><div className="min-w-0"><p className="font-semibold">{category.name} <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${category.isActive ? "bg-emerald-300/10 text-emerald-200" : "bg-white/[.08] text-white/45"}`}>{category.isActive ? "Aktif" : "Pasif"}</span></p><p className="truncate text-xs text-white/35">{category.slug} · {category._count.requests} ilan · {category._count.companyCategories} firma bağlantısı · {category._count.alertRules} alarm · {category._count.inventoryItems} stok</p></div></div><div className="flex items-center gap-2"><button type="button" disabled={busy} onClick={() => void changeStatus(category)} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:border-emerald-300/40 hover:bg-white/[.06] disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : category.isActive ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}{category.isActive ? "Arşivle" : "Yeniden aç"}</button>{canDelete ? <button type="button" data-action="delete-category" disabled={busy} onClick={() => void deleteCategory(category)} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-xs text-red-100 transition hover:border-red-300/50 hover:bg-red-300/10 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Kalıcı sil</button> : null}</div></div>;
    })}</div>
  </section>;
}
