"use client";

import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function AdminSecurityGate({ enabled, allowBypass }: { enabled: boolean; allowBypass: boolean }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function act(action: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, secret, code }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; secret?: string };
      if (action === "begin" && data.secret) setSecret(data.secret);
      else if (response.ok && data.ok) window.location.reload();
      else setMessage(data.message ?? "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-lg rounded-[30px] border border-white/10 bg-white/[.05] p-7 text-white shadow-2xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300 text-[#241a02]"><ShieldCheck className="h-6 w-6" /></div>
      <h2 className="mt-5 text-2xl font-semibold">Yönetici güvenlik doğrulaması</h2>
      <p className="mt-2 text-sm leading-6 text-white/50">Hassas verilere ve yönetim işlemlerine erişmek için authenticator uygulamanızdaki 6 haneli kodu doğrulayın.</p>
      {!enabled && !secret ? <button onClick={() => void act("begin")} className="mt-6 w-full rounded-2xl bg-emerald-300 px-4 py-3 font-bold text-[#071310]">İkinci doğrulamayı kur</button> : null}
      {secret ? <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4"><p className="text-xs text-white/45">Authenticator uygulamasına bu anahtarı ekleyin:</p><p className="mt-2 break-all font-mono text-sm tracking-wider text-amber-200">{secret}</p></div> : null}
      {enabled || secret ? <><div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4"><KeyRound className="h-5 w-5 text-white/35" /><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" className="w-full bg-transparent py-4 text-center text-xl tracking-[.35em] outline-none" /></div><button disabled={busy || code.length !== 6} onClick={() => void act(enabled ? "verify" : "enable")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 py-3 font-bold text-[#071310] disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Doğrula ve devam et</button></> : null}
      {allowBypass ? <><div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[.14em] text-white/25"><span className="h-px flex-1 bg-white/10" />Local geliştirme<span className="h-px flex-1 bg-white/10" /></div><button disabled={busy} onClick={() => void act("bypass")} className="w-full rounded-2xl border border-red-400/25 bg-red-400/[.07] px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-400/[.12] disabled:opacity-50">Şimdilik bypass et</button><p className="mt-2 text-center text-[11px] text-white/30">Yalnızca localhost için; production ortamında gösterilmez.</p></> : null}
      {message ? <p className="mt-3 text-sm text-red-300">{message}</p> : null}
    </div>
  );
}
