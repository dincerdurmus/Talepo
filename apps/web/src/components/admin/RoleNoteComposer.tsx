"use client";

import { Loader2, StickyNote } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type NoteRole = "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
const labels: Record<NoteRole, string> = { SUPPORT: "Support", MODERATOR: "Moderatör", ANALYST: "Analist", ADMIN: "Admin", SUPER_ADMIN: "Süper Admin" };

export function RoleNoteComposer({ userId, role }: { userId: string; role: NoteRole }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibleToRoles, setVisibleToRoles] = useState<NoteRole[]>(["SUPER_ADMIN"]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canChooseVisibility = role === "SUPER_ADMIN";

  function toggle(roleToToggle: NoteRole) { setVisibleToRoles((current) => current.includes(roleToToggle) ? current.filter((item) => item !== roleToToggle) : [...current, roleToToggle]); }
  async function save() {
    if (body.trim().length < 3) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/role-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, body: body.trim(), ...(canChooseVisibility ? { visibleToRoles } : {}) }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) { setMessage(data.message ?? "İç not kaydedilemedi."); return; }
      setBody(""); setMessage("İç not kaydedildi."); router.refresh();
    } finally { setBusy(false); }
  }

  const automaticAudience = role === "ADMIN" ? "Süper Admin" : "Admin ve Süper Admin";
  return <section className="mt-7 rounded-2xl border border-sky-200 bg-sky-50 p-5"><div className="flex items-start gap-3"><StickyNote className="mt-0.5 h-5 w-5 text-sky-700" /><div><h2 className="font-semibold text-sky-700">Yeni iç not</h2><p className="mt-1 text-sm text-muted-foreground">Not kendi rol kaydınıza eklenir. Görüntüleme kuralı sunucuda uygulanır.</p></div></div><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={2000} placeholder="İç notunuzu yazın" className="mt-4 w-full resize-none rounded-xl border border-border bg-muted p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-sky-200" />{canChooseVisibility ? <fieldset className="mt-4"><legend className="text-xs font-semibold text-sky-700">Kimler görebilir?</legend><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(labels) as NoteRole[]).map((audience) => <label key={audience} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-foreground"><input type="checkbox" checked={visibleToRoles.includes(audience)} onChange={() => toggle(audience)} />{labels[audience]}</label>)}</div></fieldset> : <p className="mt-3 text-xs text-muted-foreground">Bu not otomatik olarak: <span className="font-semibold text-sky-700">{automaticAudience}</span> tarafından görülebilir.</p>}<div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{body.length}/2000</p><button type="button" disabled={busy || body.trim().length < 3} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-sky-200 px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}Notu kaydet</button></div>{message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}</section>;
}
