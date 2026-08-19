"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";

type Complaint = {
  complaintNumber: number | null;
  summary: string;
  details: string | null;
  status: string;
  resolutionNote: string | null;
  updatedAt: string;
};

type Notice = {
  title: string;
  message: string;
  createdAt: string;
};

export function ComplaintNotificationDialog({ complaint, notice }: { complaint: Complaint | null; notice: Notice | null }) {
  const router = useRouter();
  const close = () => router.replace("/panel/bildirimler");
  const statusLabel = complaint?.status === "INVESTIGATING" ? "İncelemede" : complaint?.status === "RESOLVED" ? "Çözüldü" : complaint?.status === "DISMISSED" ? "Kapatıldı" : "Açık";

  return <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="complaint-notification-title" className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-800/55">Şikayet bildirimi</p>
          <h2 id="complaint-notification-title" className="mt-2 text-xl font-semibold tracking-tight text-[#0f1f1d]">{complaint ? `Şikayet #${complaint.complaintNumber ?? "—"}` : notice?.title}</h2>
        </div>
        <button type="button" onClick={close} aria-label="Pencereyi kapat" className="rounded-xl border border-teal-900/10 p-2 text-teal-950/55 transition hover:bg-[#eef8f5] hover:text-teal-950"><X className="h-5 w-5" /></button>
      </div>
      {complaint ? <>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#eef8f5] px-4 py-3"><span className="text-sm font-semibold text-[#0f1f1d]">{complaint.summary}</span><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal-800">{statusLabel}</span></div>
        <div className="mt-4 rounded-2xl border border-teal-900/10 p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-teal-800/55">Şikayet açıklaması</p><p className="mt-2 text-sm leading-6 text-teal-950/70">{complaint.details ?? "Açıklama kaydedilmemiş."}</p></div>
        {complaint.resolutionNote ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-emerald-800/60">Destek ekibi notu</p><p className="mt-2 text-sm leading-6 text-emerald-950/75">{complaint.resolutionNote}</p></div> : null}
        <p className="mt-4 text-xs text-teal-950/40">Son güncelleme: {new Date(complaint.updatedAt).toLocaleString("tr-TR")}</p>
      </> : notice ? <div className="mt-5 rounded-2xl bg-[#eef8f5] p-4"><p className="text-sm leading-6 text-teal-950/75">{notice.message}</p><p className="mt-3 text-xs text-teal-950/40">{new Date(notice.createdAt).toLocaleString("tr-TR")}</p></div> : null}
      <div className="mt-6 flex justify-end"><button type="button" onClick={close} className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-950">Tamam</button></div>
    </section>
  </div>;
}
