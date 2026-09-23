"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isPendingReviewCase } from "@/lib/request/review-hold";

type ReviewCase = {
  id: string; subjectId: string; subjectType: string; status: string; summary: string;
  createdAt: string; priority: string;
  contentModeration: { title?: string; status?: string; moderationHiddenById?: string | null } | null;
  sla: { dueAt: string; breached: boolean };
};

export function ReviewHoldQueue({ items, canDecide, onUpdated }: { items: ReviewCase[]; canDecide: boolean; onUpdated: () => void }) {
  const pendingItems = items.filter(isPendingReviewCase);
  const [decision, setDecision] = useState<{ item: ReviewCase; kind: "APPROVE" | "REJECT" } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const saved = useRef(false);
  const rejecting = decision?.kind === "REJECT";
  const reasonTooShort = (rejecting || reason.trim().length > 0) && reason.trim().length < 5;
  const title = decision?.item.contentModeration?.title ?? decision?.item.summary;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision || busy || reasonTooShort) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/moderation", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: decision.item.id, reviewDecision: decision.kind, resolutionNote: reason.trim() }),
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok || value.ok === false) throw new Error(value.message ?? "Karar kaydedilemedi. Lütfen tekrar deneyin.");
      saved.current = true;
      setDecision(null);
      setReason("");
      onUpdated();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Karar kaydedilemedi. Lütfen tekrar deneyin.");
    } finally { setBusy(false); }
  }

  return <section className="mb-8 rounded-xl border border-primary/20 bg-accent/40 p-4 sm:p-5" aria-labelledby="review-queue-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 id="review-queue-title" ref={heading} tabIndex={-1} className="text-xl font-semibold">İnceleme bekleyen talepler</h3><p className="mt-1 text-sm text-muted-foreground">Bu talepler onaylanana kadar tedarikçilere görünmez.</p></div>
      <Badge variant="secondary">{pendingItems.length} bekleyen</Badge>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Listelenen kayıtlarda {pendingItems.filter(item => item.sla.breached).length} SLA aşımı var.</p>
    <div className="mt-4 space-y-3">
      {pendingItems.length ? pendingItems.map(item => <Card key={item.id}><CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/admin/requests/${encodeURIComponent(item.subjectId)}`} className="break-words font-semibold text-foreground hover:text-primary hover:underline">{item.contentModeration?.title ?? item.summary}</Link>
            <p className="mt-2 break-words text-sm text-muted-foreground">{item.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">Kuyruğa giriş: {new Date(item.createdAt).toLocaleString("tr-TR")}</p>
            <p className={`mt-1 text-xs ${item.sla.breached ? "font-medium text-rose-700" : "text-muted-foreground"}`}>İnceleme hedefi: {new Date(item.sla.dueAt).toLocaleString("tr-TR")}{item.sla.breached ? " · Süre aşıldı" : ""}</p>
          </div>
          <Badge variant="outline">Yayın bekliyor</Badge>
        </div>
        {canDecide ? <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={event => { trigger.current = event.currentTarget; setDecision({ item, kind: "APPROVE" }); setReason(""); setError(""); }}><Check className="h-4 w-4" />Onayla</Button>
          <Button size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={event => { trigger.current = event.currentTarget; setDecision({ item, kind: "REJECT" }); setReason(""); setError(""); }}><X className="h-4 w-4" />Reddet</Button>
        </div> : <p className="mt-3 text-xs text-muted-foreground">Yayın kararını yetkili yönetici verir.</p>}
      </CardContent></Card>) : <p className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">Listelenen kayıtlarda yayın kararı bekleyen talep yok.</p>}
    </div>
    <Sheet open={decision !== null} onOpenChange={open => { if (!open && !busy) setDecision(null); }}>
      <SheetContent className="admin-signature w-full overflow-y-auto sm:max-w-lg" showCloseButton={!busy} onCloseAutoFocus={event => { event.preventDefault(); (saved.current ? heading.current : trigger.current?.isConnected ? trigger.current : heading.current)?.focus(); saved.current = false; }}>
        <SheetHeader>
          <SheetTitle>{rejecting ? "Talebi reddet" : "Talebi yayınla"}</SheetTitle>
          <SheetDescription>{rejecting ? "Talep yayınlanmayacak. Yazdığın gerekçe talep sahibine bildirilecek." : "Talep yayına alınacak ve uygun tedarikçilere dağıtılacak."}</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex flex-1 flex-col gap-4 px-4 pb-5">
          <p className="break-words rounded-lg bg-muted p-3 text-sm font-medium">{title}</p>
          <label htmlFor="review-decision-reason" className="text-sm font-medium">{rejecting ? "Ret gerekçesi" : "Karar notu (isteğe bağlı)"}</label>
          <textarea id="review-decision-reason" value={reason} onChange={event => setReason(event.target.value)} required={rejecting} minLength={5} maxLength={2000} rows={5} disabled={busy} className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <p className="text-xs text-muted-foreground">{rejecting ? "En az 5 karakter. Gerekçeyi kullanıcıya açıklayıcı olacak şekilde yaz." : "Not eklersen en az 5 karakter yaz."}</p>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="mt-auto flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || reasonTooShort}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{rejecting ? "Reddet ve bildir" : "Onayla ve yayınla"}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDecision(null)}>Vazgeç</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  </section>;
}
