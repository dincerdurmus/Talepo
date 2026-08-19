"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";

export function SuperAdminMfaReset({ user, onClose }: { user: { id: string; label: string }; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reset() {
    if (reason.trim().length < 5) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset", targetUserId: user.id, reason: reason.trim() }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) { setMessage(data.message ?? "MFA sıfırlanamadı."); return; }
      onClose();
    } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="mfa-reset-title" className="w-full max-w-lg rounded-[26px] border border-amber-300/20 bg-[#0b1d19] p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-300/70">Süper Admin kurtarma</p><h3 id="mfa-reset-title" className="mt-2 text-xl font-semibold">MFA&apos;yı sıfırla</h3><p className="mt-2 text-sm leading-6 text-white/50">{user.label} bir sonraki yönetici girişinde authenticator&apos;ını yeniden kurar. Bu işlem geri alınamaz ve denetim kaydına yazılır.</p></div><button type="button" onClick={onClose} className="rounded-xl border border-white/10 p-2"><X className="h-4 w-4" /></button></div>
      <textarea autoFocus value={reason} onChange={event => setReason(event.target.value)} rows={4} placeholder="Kurtarma gerekçesi" className="mt-5 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm outline-none placeholder:text-white/25 focus:border-amber-300/45" />
      {message ? <p className="mt-3 text-sm text-rose-200">{message}</p> : null}
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/65">Vazgeç</button><button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void reset()} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-bold text-[#241a02] disabled:opacity-45">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}MFA&apos;yı sıfırla</button></div>
    </div>
  </div>;
}
