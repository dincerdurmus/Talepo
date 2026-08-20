"use client";

import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Sparkles } from "lucide-react";

import { splitEditorialRequestDescription } from "@/lib/panel/editorial-request-description";

type FieldItem = {
  id: string;
  label: string;
  value: string;
};

type OfferRequestPreviewProps = {
  categoryName: string;
  title: string;
  city: string | null;
  description: string;
  aiSummary: string | null;
  budgetLabel?: string | null;
  fields: FieldItem[];
};

export function OfferRequestPreview({
  categoryName,
  title,
  city,
  description,
  aiSummary,
  budgetLabel = null,
  fields,
}: OfferRequestPreviewProps) {
  const [open, setOpen] = useState(false);
  const editorial = useMemo(
    () => splitEditorialRequestDescription(description),
    [description],
  );

  return (
    <section className="overflow-hidden rounded-[20px] border border-teal-900/[0.08] bg-[#fcfdfc] shadow-[0_10px_28px_rgba(15,31,29,0.035)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5 lg:cursor-default lg:pointer-events-none"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-teal-900/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-900/75">
              {categoryName}
            </span>
            {city ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-[#536b68]">
                <MapPin className="h-3.5 w-3.5" />
                {city}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3d5c58]/90">
            Talep özeti
          </p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-tight text-[#0f1f1d] sm:text-lg">
            {title}
          </h2>
          <p className="mt-1 line-clamp-2 text-[13px] text-[#0f1f1d]/52 lg:hidden">
            {open ? "Detayları gizle" : "Talebi görmek için açın"}
          </p>
        </div>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-[#0f1f1d]/35 transition lg:hidden ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`space-y-5 border-t border-teal-900/[0.06] px-4 pb-5 sm:px-5 ${
          open ? "block" : "hidden lg:block"
        }`}
      >
        <div className="pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3d5c58]/90">
            Talep açıklaması
          </p>
          <div className="mt-2 h-px w-10 bg-teal-900/15" aria-hidden />
          {editorial.lead ? (
            <p className="mt-3 text-[14px] font-semibold leading-6 text-[#0f1f1d]">
              {editorial.lead}
            </p>
          ) : null}
          {editorial.body ? (
            <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-[#0f1f1d]/72">
              {editorial.body}
            </p>
          ) : null}
          {editorial.textCriteria.length > 0 && fields.length === 0 ? (
            <ul className="mt-3 space-y-1.5 text-[13px] leading-6 text-[#0f1f1d]/72">
              {editorial.textCriteria.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal-800/45" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {editorial.expectations ? (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3d5c58]/85">
                Teklifte beklenenler
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[#0f1f1d]/58">
                {editorial.expectations}
              </p>
            </div>
          ) : null}
        </div>

        {aiSummary ? (
          <div className="rounded-[14px] border border-white/10 bg-[linear-gradient(155deg,#151d1b_0%,#111716_55%,#19302d_100%)] px-3.5 py-3 text-[#f5f7f6]">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#aebbb7]">
              <Sparkles className="h-3.5 w-3.5 text-teal-200/80" />
              AI özet
            </p>
            <p className="mt-1.5 text-[13px] leading-5 text-[#e8eeec]/90">
              {aiSummary}
            </p>
          </div>
        ) : null}

        {budgetLabel || fields.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3d5c58]/90">
              Önemli kriterler
            </p>
            <dl className="mt-2.5 space-y-2">
              {budgetLabel ? (
                <div className="flex items-baseline justify-between gap-3 border-b border-teal-900/[0.06] pb-2">
                  <dt className="text-[12px] font-medium text-[#536b68]">
                    Bütçe
                  </dt>
                  <dd className="text-right text-[13px] font-semibold text-[#0f1f1d]">
                    {budgetLabel}
                  </dd>
                </div>
              ) : null}
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-baseline justify-between gap-3 border-b border-teal-900/[0.06] pb-2 last:border-b-0 last:pb-0"
                >
                  <dt className="text-[12px] font-medium text-[#536b68]">
                    {field.label}
                  </dt>
                  <dd className="text-right text-[13px] font-semibold text-[#0f1f1d]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}
