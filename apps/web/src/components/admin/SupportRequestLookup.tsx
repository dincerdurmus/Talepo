"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SupportRequestLookup() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function lookup() {
    setMessage(null);
    const response = await fetch(`/api/admin/complaints/request-lookup?number=${encodeURIComponent(number)}`);
    const data = await response.json();
    if (!response.ok) { setMessage(data.message ?? "Talep bulunamadı."); return; }
    router.push(data.href);
  }
  return <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void lookup(); }}><input inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Talep numarası" className="w-40 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs" /><button type="submit" className="rounded-xl border border-emerald-300/25 px-3 py-2 text-xs text-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-300/10 active:translate-y-0">Talebe Git</button>{message ? <p className="self-center text-xs text-rose-200">{message}</p> : null}</form>;
}
