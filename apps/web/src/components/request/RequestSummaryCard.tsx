"use client";

import { Check, X } from "lucide-react";

import { CatalogIdentityPreview } from "@/components/request/CatalogIdentityPreview";
import type { CatalogPreviewModel } from "@/lib/catalog/consumer";
import type { SummaryChip } from "@/lib/request-brain/request-summary";

type Props = {
  headline: string;
  chips: SummaryChip[];
  categoryLabel: string;
  catalogPreview?: CatalogPreviewModel | null;
  onEditChip?: (fieldKey: string) => void;
  onRemoveChip?: (fieldKey: string) => void;
};

export function RequestSummaryCard({
  headline,
  chips,
  categoryLabel,
  catalogPreview,
  onEditChip,
  onRemoveChip,
}: Props) {
  return (
    <div className="rounded-[1.5rem] border border-teal-900/8 bg-white/95 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0f766e]">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Talepo verdiğiniz bilgileri talebe dönüştürdü
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#0f1f1d] sm:text-2xl">
            {headline}
          </h2>
          <p className="mt-1 text-sm text-teal-950/45">{categoryLabel}</p>
        </div>
      </div>

      {catalogPreview ? (
        <div className="mt-4 border-t border-teal-900/6 pt-4">
          <CatalogIdentityPreview model={catalogPreview} />
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.fieldKey}
              type="button"
              onClick={() => onEditChip?.(chip.fieldKey)}
              className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-teal-900/10 bg-[#f7faf9] px-3 py-1.5 text-left text-sm text-[#0f1f1d]/85 transition hover:border-[#0f766e]/25 hover:bg-[#f0fdfa]"
              title={`${chip.label}: düzenlemek için tıklayın`}
            >
              <span className="truncate font-medium">{chip.displayValue}</span>
              {onRemoveChip ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`${chip.label} kaldır`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveChip(chip.fieldKey);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveChip(chip.fieldKey);
                    }
                  }}
                  className="rounded-full p-0.5 text-teal-900/30 opacity-0 transition group-hover:opacity-100 hover:bg-teal-900/10 hover:text-teal-900/60"
                >
                  <X className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
