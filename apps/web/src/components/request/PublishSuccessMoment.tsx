"use client";

import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";

type Props = {
  title: string;
  requestId?: string | null;
  viewHref: string;
  onNewRequest: () => void;
};

export function PublishSuccessMoment({
  title,
  requestId,
  viewHref,
  onNewRequest,
}: Props) {
  return (
    <div className="mx-auto max-w-xl py-10 text-center sm:py-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-[0_16px_40px_rgba(15,118,110,0.28)]">
        <Check className="h-8 w-8" aria-hidden />
      </div>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f766e]">
        Tamamlandı
      </p>
      <h1 className="mt-2 text-[1.85rem] font-semibold tracking-[-0.04em] text-[#0f1f1d] sm:text-[2.25rem]">
        Talebiniz yayınlandı
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-teal-950/55">
        Talebiniz başarıyla yayınlandı. Uygun satıcılar talebinizi
        görüntüleyebilir ve teklif gönderebilir.
      </p>
      {title ? (
        <p className="mx-auto mt-4 max-w-md rounded-2xl border border-teal-900/8 bg-white/90 px-4 py-3 text-sm font-medium text-[#0f1f1d]">
          {title}
        </p>
      ) : null}
      {requestId ? (
        <p className="mt-2 text-xs text-teal-950/40">Talep no: {requestId}</p>
      ) : null}

      <div className="mx-auto mt-8 max-w-md rounded-[1.5rem] border border-teal-900/8 bg-white/90 p-5 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800/45">
          Şimdi ne olacak?
        </p>
        <ol className="mt-3 space-y-3 text-sm leading-6 text-teal-950/65">
          <li>
            <span className="font-semibold text-[#0f1f1d]">1.</span> Talebiniz
            uygun satıcılara ulaşır
          </li>
          <li>
            <span className="font-semibold text-[#0f1f1d]">2.</span> Teklifler
            geldikçe Talepo&apos;da toplanır
          </li>
          <li>
            <span className="font-semibold text-[#0f1f1d]">3.</span> Teklifleri ve
            fiyatları karşılaştırabilirsiniz
          </li>
        </ol>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={viewHref}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-5 text-sm font-semibold text-white"
        >
          Talebimi görüntüle
          <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onNewRequest}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-teal-900/10 bg-white px-5 text-sm font-semibold text-[#0f1f1d]"
        >
          <Plus className="h-4 w-4" />
          Yeni talep oluştur
        </button>
      </div>
    </div>
  );
}
