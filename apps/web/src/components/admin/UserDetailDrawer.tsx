"use client";

import Link from "next/link";
import { useState } from "react";

type User = { id: string; name: string | null; email: string | null; membershipNumber: string };

export function UserDetailDrawer({ user, children }: { user: User; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="cursor-pointer font-semibold text-emerald-200 underline-offset-4 hover:text-emerald-100 hover:underline">{children}</button>
    {open ? <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Firma sahibi detayları">
      <button type="button" aria-label="Paneli kapat" onClick={() => setOpen(false)} className="absolute inset-0 cursor-pointer bg-black/60" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0b1c18] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-emerald-200/60">Firma sahibi</p><h2 className="mt-2 text-2xl font-semibold">Kullanıcı detayları</h2></div><button type="button" onClick={() => setOpen(false)} className="cursor-pointer rounded-lg px-3 py-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Kapat">✕</button></div>
        <div className="mt-6 grid gap-3"><div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><p className="text-xs uppercase tracking-[.12em] text-white/35">Ad soyad</p><p className="mt-2 text-white/85">{user.name ?? "—"}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><p className="text-xs uppercase tracking-[.12em] text-white/35">E-posta</p><p className="mt-2 break-words text-white/85">{user.email ?? "—"}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><p className="text-xs uppercase tracking-[.12em] text-white/35">Üyelik no</p><p className="mt-2 text-white/85">{user.membershipNumber}</p></div><Link href={`/admin/users/${user.id}`} className="mt-2 rounded-xl bg-emerald-300 px-4 py-3 text-center text-sm font-bold text-[#071310] hover:bg-emerald-200">Kullanıcı detay sayfasını aç</Link></div>
      </aside>
    </div> : null}
  </>;
}
