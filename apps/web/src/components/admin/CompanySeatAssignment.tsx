"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

export function CompanySeatAssignment({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [membershipNumber, setMembershipNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function assign() {
    if (!membershipNumber.trim()) { setMessage("Kullanıcı üyelik numarası gerekli."); return; }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assignSeat", membershipNumber }),
      });
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "İşlem tamamlandı.");
      if (response.ok) { setMembershipNumber(""); router.refresh(); }
    } finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-[26px] border border-sky-200/15 bg-sky-200/[.035] p-5">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-200/70">Firma koltuğu</p>
    <h2 className="mt-2 text-lg font-semibold">Üyelik numarasıyla kullanıcı ata</h2>
    <p className="mt-2 text-sm text-white/55">Kullanıcı doğrudan bu firmanın aktif ekip koltuğuna eklenir. Mevcut koltuk limiti korunur.</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <input value={membershipNumber} onChange={(event) => setMembershipNumber(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void assign(); }} placeholder="Örn. TLP-100003 veya 100003" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#102421] px-3 py-2.5 text-sm text-white placeholder:text-white/25" />
      <button type="button" disabled={busy} onClick={() => void assign()} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-200 px-4 py-2.5 text-sm font-bold text-[#071310] transition hover:-translate-y-0.5 hover:bg-sky-100 disabled:cursor-wait disabled:opacity-60"><UserPlus className="h-4 w-4" />{busy ? "Atanıyor" : "Koltuk ata"}</button>
    </div>
    {message ? <p role="status" className="mt-3 text-sm text-sky-100">{message}</p> : null}
  </section>;
}
