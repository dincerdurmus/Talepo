"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Sparkles } from "lucide-react";

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
  fields: FieldItem[];
};

export function OfferRequestPreview({
  categoryName,
  title,
  city,
  description,
  aiSummary,
  fields,
}: OfferRequestPreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-teal-900/10 bg-white shadow-[0_12px_36px_rgba(15,31,29,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5 lg:cursor-default lg:pointer-events-none"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[#eef6f4] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-800/70">
              {categoryName}
            </span>
            {city && (
              <span className="inline-flex items-center gap-1 text-xs text-teal-950/45">
                <MapPin className="h-3.5 w-3.5" />
                {city}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/40">
            Talep önizleme
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0f1f1d] sm:text-xl">
            {title}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-teal-950/45 lg:hidden">
            {open ? "Detayları gizle" : "Talebi görmek için açın"}
          </p>
        </div>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-teal-950/35 transition lg:hidden ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`space-y-3 border-t border-teal-900/8 px-4 pb-4 sm:px-5 sm:pb-5 ${
          open ? "block" : "hidden lg:block"
        }`}
      >
        <div className="pt-3">
          <div className="rounded-xl border border-teal-900/8 bg-[#f7faf9] p-3.5">
            <p className="text-[11px] font-semibold text-teal-950/40">
              Talep açıklaması
            </p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-[#0f1f1d]/75">
              {description}
            </p>
          </div>
        </div>

        {aiSummary && (
          <div className="rounded-xl border border-teal-900/8 bg-[#eef6f4] p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-800/70">
              <Sparkles className="h-3.5 w-3.5" />
              AI özet
            </p>
            <p className="mt-1.5 text-sm leading-6 text-teal-950/70">
              {aiSummary}
            </p>
          </div>
        )}

        {fields.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.id}
                className="rounded-xl border border-teal-900/8 bg-[#f7faf9] px-3.5 py-3"
              >
                <p className="text-[11px] font-semibold text-teal-950/40">
                  {field.label}
                </p>
                <p className="mt-1 text-sm font-medium text-[#0f1f1d]">
                  {field.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
