"use client";

import { Loader2, Pencil, StickyNote, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

type Note = { id: string; body: string; visibleToRoles: string[]; createdAt: string; author: { name: string | null; email: string | null; platformRole: string } };
type Event = { id: string; noteId: string; action: string; beforeBody: string | null; afterBody: string | null; createdAt: string; actor: { name: string | null; email: string | null } };

export function RoleUserNotesPanel({ user, onClose }: { user: { id: string; label: string; role: string }; onClose: () => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [selectableVisibilityRoles, setSelectableVisibilityRoles] = useState<string[]>([]);
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>(["SUPER_ADMIN"]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/role-notes?userId=${encodeURIComponent(user.id)}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json() as { notes?: Note[]; events?: Event[]; selectableVisibilityRoles?: string[]; message?: string }; if (!response.ok) throw new Error(data.message ?? "İç notlar alınamadı."); setNotes(data.notes ?? []); setEvents(data.events ?? []); setSelectableVisibilityRoles(data.selectableVisibilityRoles ?? []); })
      .catch((reason: unknown) => { if ((reason as DOMException).name !== "AbortError") setError(reason instanceof Error ? reason.message : "İç notlar alınamadı."); })
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [user.id]);

  async function save() {
    if (body.trim().length < 3) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/role-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, body, ...(selectableVisibilityRoles.length ? { visibleToRoles } : {}) }) });
      const data = await response.json() as { note?: Note; message?: string };
      if (!response.ok || !data.note) throw new Error(data.message ?? "İç not kaydedilemedi.");
      setNotes((current) => [data.note!, ...current]);
      setBody("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "İç not kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function updateNote(noteId: string) { if (!editing || editing.body.trim().length < 3) return; setSaving(true); try { const response = await fetch("/api/admin/role-notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId, body: editing.body }) }); const data = await response.json() as { note?: Note; message?: string }; if (!response.ok || !data.note) throw new Error(data.message ?? "İç not güncellenemedi."); setNotes((current) => current.map((note) => note.id === noteId ? data.note! : note)); setEditing(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "İç not güncellenemedi."); } finally { setSaving(false); } }
  async function deleteNote(noteId: string) { if (!window.confirm("Bu iç not silinsin mi? Super Admin silme kaydını görmeye devam eder.")) return; setSaving(true); try { const response = await fetch(`/api/admin/role-notes?noteId=${encodeURIComponent(noteId)}`, { method: "DELETE" }); const data = await response.json() as { message?: string }; if (!response.ok) throw new Error(data.message ?? "İç not silinemedi."); setNotes((current) => current.filter((note) => note.id !== noteId)); } catch (reason) { setError(reason instanceof Error ? reason.message : "İç not silinemedi."); } finally { setSaving(false); } }

  return <div className="fixed inset-0 z-[220] flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="role-notes-title" className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#091915] p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-sky-200/65">Yalnız Admin ve Süper Admin</p><h2 id="role-notes-title" className="mt-2 text-2xl font-semibold">İç takip notları</h2><p className="mt-2 text-sm text-white/45">{user.label} · {user.role}</p></div><button type="button" onClick={onClose} aria-label="Pencereyi kapat" className="rounded-xl border border-white/10 p-2 text-white/65 transition hover:bg-white/[.07]"><X className="h-5 w-5" /></button></div>
      <div className="mt-6 rounded-2xl border border-sky-300/15 bg-sky-300/[.06] p-4"><label htmlFor="role-note" className="text-sm font-semibold text-sky-100">Yeni iç not</label><p className="mt-1 text-xs leading-5 text-white/40">Notun görünürlüğü rol hiyerarşisine göre sunucuda korunur.</p><textarea id="role-note" value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={2000} placeholder="Örn. Bu Support kullanıcısının kapattığı vakalar haftalık olarak takip edilecek." className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none placeholder:text-white/25 focus:border-sky-300/40"/>{selectableVisibilityRoles.length ? <fieldset className="mt-3"><legend className="text-xs font-semibold text-sky-100">Kimler görebilir?</legend><div className="mt-2 flex flex-wrap gap-2">{selectableVisibilityRoles.map((role) => <label key={role} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/75"><input type="checkbox" checked={visibleToRoles.includes(role)} onChange={() => setVisibleToRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role])} />{role === "SUPER_ADMIN" ? "Süper Admin" : role === "ADMIN" ? "Admin" : role === "MODERATOR" ? "Moderatör" : role === "ANALYST" ? "Analist" : "Support"}</label>)}</div></fieldset> : null}<div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-white/35">{body.length}/2000</span><button type="button" disabled={saving || body.trim().length < 3} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-sky-200 px-3.5 py-2 text-sm font-semibold text-[#08211d] disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}Notu kaydet</button></div></div>
      {error ? <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[.07] p-3 text-sm text-rose-100">{error}</p> : null}
      <div className="mt-6 space-y-3">{busy ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-sky-200" /></div> : notes.length ? notes.map((note) => <article key={note.id} className="rounded-2xl border border-white/[.07] bg-white/[.035] p-4">{editing?.id === note.id ? <><textarea value={editing.body} onChange={(event) => setEditing({ id: note.id, body: event.target.value })} rows={4} maxLength={2000} className="w-full resize-none rounded-xl border border-sky-300/25 bg-black/20 p-3 text-sm outline-none"/><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="text-xs text-white/50">Vazgeç</button><button type="button" disabled={saving || editing.body.trim().length < 3} onClick={() => void updateNote(note.id)} className="rounded-lg bg-sky-200 px-3 py-1.5 text-xs font-semibold text-[#08211d]">Kaydet</button></div></> : <><p className="whitespace-pre-wrap text-sm leading-6 text-white/80">{note.body}</p><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-white/40">{note.author.name ?? note.author.email ?? "Yönetici"} · {new Date(note.createdAt).toLocaleString("tr-TR")}</p><div className="flex gap-2"><button type="button" onClick={() => setEditing({ id: note.id, body: note.body })} className="text-xs text-sky-100"><Pencil className="mr-1 inline h-3.5 w-3.5"/>Düzenle</button><button type="button" disabled={saving} onClick={() => void deleteNote(note.id)} className="text-xs text-rose-200"><Trash2 className="mr-1 inline h-3.5 w-3.5"/>Sil</button></div></div></>}</article>) : <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">Henüz iç takip notu yok.</p>}</div>
      {events.length ? <section className="mt-8 border-t border-white/10 pt-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-amber-200/65">Süper Admin denetim geçmişi</p><div className="mt-3 space-y-2">{events.map((event) => <div key={event.id} className="rounded-xl bg-amber-300/[.06] p-3 text-xs text-white/65"><span className="font-semibold text-amber-100">{event.action === "DELETED" ? "Silindi" : event.action === "UPDATED" ? "Düzenlendi" : "Eklendi"}</span> · {event.actor.name ?? event.actor.email ?? "Yönetici"} · {new Date(event.createdAt).toLocaleString("tr-TR")}</div>)}</div></section> : null}
    </aside>
  </div>;
}
