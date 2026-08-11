"use client";

import type { ReactNode } from "react";
import { ArrowDown, Check } from "lucide-react";

import { CatalogIdentityPreview } from "@/components/request/CatalogIdentityPreview";
import type { CatalogPreviewModel } from "@/lib/catalog/consumer";
import type { SummaryChip } from "@/lib/request-brain/request-summary";

type Props = {
  hasInput: boolean;
  understood: boolean;
  headline: string;
  chips: SummaryChip[];
  categoryLabel: string;
  enrichmentHints: string[];
  catalogPreview?: CatalogPreviewModel | null;
  /** When nested under a disclosure, skip outer chrome title */
  embedded?: boolean;
};

export function ConversationalStartPanel({
  hasInput,
  understood,
  headline,
  chips,
  categoryLabel,
  enrichmentHints,
  catalogPreview = null,
  embedded = false,
}: Props) {
  if (!hasInput) {
    return (
      <div
        className={
          embedded
            ? "px-3 pb-3 pt-1"
            : "rounded-[1.75rem] border border-teal-900/8 bg-white/90 p-5 shadow-[0_16px_48px_rgba(15,31,29,0.05)] sm:p-6"
        }
      >
        {embedded ? null : (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-800/40">
            Nasıl çalışıyor?
          </p>
        )}
        <div className={embedded ? "space-y-3" : "mt-5 space-y-4"}>
          <DemoBlock
            label="Siz yazarsınız"
            body={
              <p className="whitespace-pre-line text-sm leading-6 text-teal-950/70">
                {`“2022 üstü c200 amg lazım\n50 bin km altı”`}
              </p>
            }
          />
          <ArrowDown className="mx-auto h-4 w-4 text-teal-800/25" aria-hidden />
          <DemoBlock
            label="Talepo anlar"
            body={
              <div>
                <p className="text-sm font-semibold text-[#0f1f1d]">
                  Mercedes-Benz C200 AMG
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["2022+", "≤ 50.000 km", "Otomobil"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-teal-900/10 bg-[#f7faf9] px-2.5 py-1 text-[11px] text-teal-950/70"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            }
          />
          <ArrowDown className="mx-auto h-4 w-4 text-teal-800/25" aria-hidden />
          <DemoBlock
            label="Birlikte tamamlarsınız"
            body={
              <div className="flex flex-wrap gap-1.5">
                {["+ Bütçe", "+ Şehir"].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-dashed border-teal-900/15 px-2.5 py-1 text-[11px] text-teal-950/55"
                  >
                    {t}
                  </span>
                ))}
              </div>
            }
          />
          <ArrowDown className="mx-auto h-4 w-4 text-teal-800/25" aria-hidden />
          <DemoBlock
            label="Talebiniz hazır"
            body={
              <p className="text-sm text-teal-950/65">
                Kontrol edin, yayınlayın — teklifler gelsin.
              </p>
            }
          />
        </div>
        <p className="mt-5 text-[11px] leading-4 text-teal-950/35">
          Uygun veri varsa piyasa aralığını da gösteririz. Garanti değil;
          yardımcı bilgidir.
        </p>
      </div>
    );
  }

  if (!understood) {
    return (
      <div className="rounded-[1.75rem] border border-teal-900/8 bg-white/90 p-5 sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-800/40">
          Talepo dinliyor
        </p>
        <p className="mt-3 text-sm leading-6 text-teal-950/55">
          Yazmaya devam edin — anladığımız bilgileri burada göstereceğiz.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.75rem] border border-[#0f766e]/18 bg-white/95 p-5 shadow-[0_16px_48px_rgba(15,118,110,0.08)] sm:p-6">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0f766e]">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Sizi şöyle anladım
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#0f1f1d]">
        {headline}
      </h3>
      <p className="mt-1 text-sm text-teal-950/45">{categoryLabel}</p>
      {catalogPreview ? (
        <div className="mt-3">
          <CatalogIdentityPreview model={catalogPreview} compact />
        </div>
      ) : null}
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.fieldKey}
              className="rounded-full border border-teal-900/10 bg-[#f7faf9] px-2.5 py-1 text-xs text-[#0f1f1d]/80"
            >
              {chip.displayValue}
            </span>
          ))}
        </div>
      ) : null}
      {enrichmentHints.length > 0 ? (
        <div className="mt-4 border-t border-teal-900/6 pt-4">
          <p className="text-xs text-teal-950/45">Birlikte tamamlayabiliriz</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {enrichmentHints.map((hint) => (
              <span
                key={hint}
                className="rounded-full border border-dashed border-teal-900/15 px-2.5 py-1 text-[11px] text-teal-950/55"
              >
                + {hint}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DemoBlock({
  label,
  body,
}: {
  label: string;
  body: ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-800/40">
        {label}
      </p>
      <div className="mt-1.5">{body}</div>
    </div>
  );
}
