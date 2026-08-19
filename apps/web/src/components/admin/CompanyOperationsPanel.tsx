"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

type Company = { id: string; name: string; status: "ACTIVE" | "SUSPENDED" | string; planTier: "STANDARD" | "PREMIUM" | "PROFESSIONAL" | "CORPORATE" | string };

export function CompanyOperationsPanel({ company }: { company: Company }) {
  const router = useRouter();
  const [status, setStatus] = useState(company.status);
  const [planTier, setPlanTier] = useState(company.planTier);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"company" | "members" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(action: "company" | "members", memberStatus?: "ACTIVE" | "REMOVED") {
    if (reason.trim().length < 5) { setMessage("İşlem gerekçesi en az 5 karakter olmalı."); return; }
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, status, planTier, memberStatus, reason }),
      });
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "İşlem tamamlandı.");
      if (response.ok) { setReason(""); router.refresh(); }
    } finally { setBusy(null); }
  }

  return <section className="mt-6 rounded-[26px] border border-amber-200/15 bg-amber-200/[.04] p-5">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-200/70">Firma operasyonları</p>
    <h2 className="mt-2 text-lg font-semibold">{company.name} için üyelik ve erişim işlemleri</h2>
    <p className="mt-2 text-sm text-white/55">Firma üyeliklerini değiştirmek, kişilerin bireysel hesabını veya diğer firmalardaki üyeliklerini etkilemez.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs text-white/55">Firma durumu
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-white/10 bg-[#102421] px-3 py-2.5 text-sm text-white"><option value="ACTIVE">Aktif</option><option value="SUSPENDED">Askıya alındı</option></select>
      </label>
      <label className="grid gap-1 text-xs text-white/55">Firma planı
        <select value={planTier} onChange={(event) => setPlanTier(event.target.value)} className="rounded-xl border border-white/10 bg-[#102421] px-3 py-2.5 text-sm text-white"><option value="STANDARD">Standart</option><option value="PREMIUM">Premium</option><option value="PROFESSIONAL">Profesyonel</option><option value="CORPORATE">Kurumsal</option></select>
      </label>
    </div>
    <label className="mt-3 grid gap-1 text-xs text-white/55">İşlem gerekçesi
      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Örn. ödeme ve sözleşme incelemesi" className="rounded-xl border border-white/10 bg-[#102421] px-3 py-2.5 text-sm text-white placeholder:text-white/25" />
    </label>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={busy !== null} onClick={() => void save("company")} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-[#071310] transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${busy === "company" ? "animate-spin" : ""}`} />Firma ayarlarını kaydet</button>
      <button type="button" disabled={busy !== null} onClick={() => void save("members", "REMOVED")} className="cursor-pointer rounded-xl border border-amber-200/35 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:-translate-y-0.5 hover:bg-amber-200/10 disabled:cursor-wait disabled:opacity-60">Tüm aktif firma üyelerini pasife al</button>
      <button type="button" disabled={busy !== null} onClick={() => void save("members", "ACTIVE")} className="cursor-pointer rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/75 transition hover:-translate-y-0.5 hover:bg-white/[.06] disabled:cursor-wait disabled:opacity-60">Çıkarılmış firma üyelerini etkinleştir</button>
    </div>
    {message ? <p role="status" className="mt-3 text-sm text-emerald-100">{message}</p> : null}
  </section>;
}
