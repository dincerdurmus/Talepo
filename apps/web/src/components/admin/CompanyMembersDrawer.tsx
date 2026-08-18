"use client";

import Link from "next/link";
import { useState } from "react";

type Member = { id: string; name: string | null; email: string | null; membershipNumber: string; role: string; status: string };

export function CompanyMembersDrawer({ members, children }: { members: Member[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="cursor-pointer font-semibold text-emerald-200 underline-offset-4 hover:text-emerald-100 hover:underline">{children}</button>
    {open ? <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Firma kullanıcıları">
      <button type="button" aria-label="Paneli kapat" onClick={() => setOpen(false)} className="absolute inset-0 cursor-pointer bg-black/60" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0b1c18] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-emerald-200/60">Firma kullanıcıları</p><h2 className="mt-2 text-2xl font-semibold">Koltuklandırılmış kullanıcılar</h2></div><button type="button" onClick={() => setOpen(false)} className="cursor-pointer rounded-lg px-3 py-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Kapat">✕</button></div>
        <div className="mt-6 grid gap-3">{members.length ? members.map((member) => <div key={member.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><Link href={`/admin/users/${member.id}`} className="font-semibold text-emerald-100 underline-offset-4 hover:text-white hover:underline">{member.name ?? member.email ?? "İsimsiz kullanıcı"}</Link><p className="mt-1 text-xs text-white/45">{member.membershipNumber}</p><p className="mt-2 text-xs text-white/55">{member.role === "OWNER" ? "Sahip" : member.role === "ADMIN" ? "Yönetici" : member.role === "MANAGER" ? "Müdür" : member.role === "VIEWER" ? "Görüntüleyici" : "Üye"} · {member.status === "ACTIVE" ? "Aktif" : member.status === "INVITED" ? "Davetli" : member.status === "REMOVED" ? "Çıkarıldı" : "Reddedildi"}</p></div>) : <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/55">Bu firmada koltuklandırılmış kullanıcı yok.</p>}</div>
      </aside>
    </div> : null}
  </>;
}
