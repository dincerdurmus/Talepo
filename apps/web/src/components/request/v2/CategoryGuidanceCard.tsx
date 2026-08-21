"use client";

import { useId, useState } from "react";

import {
  signalSurface,
} from "@/components/panel/profile/ProfileSignal";
import {
  CATEGORY_GUIDANCE_ACTIONS,
  type CategoryGuidanceActionId,
  type CategoryGuidanceModel,
  type CategoryGuidanceSelection,
} from "@/lib/request-composer/v2/category-guidance";

type Props = {
  model: CategoryGuidanceModel;
  selectedSlugs?: string[];
  selectedAction?: CategoryGuidanceActionId | null;
  onSelect: (selection: CategoryGuidanceSelection) => void;
  otherDomainNote?: string;
  onOtherDomainNoteChange?: (value: string) => void;
  showOtherDomainInput?: boolean;
};

export function CategoryGuidanceCard({
  model,
  selectedSlugs = [],
  selectedAction = null,
  onSelect,
  otherDomainNote = "",
  onOtherDomainNoteChange,
  showOtherDomainInput = false,
}: Props) {
  const baseId = useId();
  const [multiMode, setMultiMode] = useState(false);
  const [pendingMulti, setPendingMulti] = useState<string[]>(selectedSlugs);

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className={`mt-3 ${signalSurface} px-4 py-4`}
    >
      <h2
        id={`${baseId}-title`}
        className="text-base font-semibold tracking-[-0.02em] text-[#0f1f1d]"
      >
        {model.title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-teal-950/55">{model.helper}</p>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {model.candidates.map((candidate) => {
          const selected = multiMode
            ? pendingMulti.includes(candidate.slug)
            : selectedSlugs.includes(candidate.slug);
          return (
            <li key={candidate.id}>
              <button
                type="button"
                aria-pressed={selected}
                className={`flex min-h-[72px] w-full flex-col items-start rounded-xl border px-3.5 py-3 text-left transition ${
                  selected
                    ? "border-[#0f766e]/45 bg-[#f0fdfa] shadow-[0_0_0_1px_rgba(15,118,110,0.12)]"
                    : "border-teal-900/10 bg-[#fbfdfe] hover:border-[#0f766e]/25 hover:bg-[#f7fdfb]"
                }`}
                onClick={() => {
                  if (multiMode) {
                    setPendingMulti((current) =>
                      current.includes(candidate.slug)
                        ? current.filter((s) => s !== candidate.slug)
                        : [...current, candidate.slug].slice(0, 3),
                    );
                    return;
                  }
                  onSelect({ kind: "candidate", slug: candidate.slug });
                }}
              >
                <span className="text-sm font-semibold text-[#0f1f1d]">
                  {candidate.label}
                </span>
                <span className="mt-1 line-clamp-2 text-xs leading-5 text-teal-950/50">
                  {candidate.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {model.allowMultiSelect ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="min-h-10 rounded-full border border-teal-900/10 bg-white px-3.5 text-xs font-medium text-teal-950/70 hover:border-[#0f766e]/25"
            onClick={() => {
              setMultiMode((v) => !v);
              setPendingMulti(selectedSlugs);
            }}
          >
            {multiMode
              ? "Tek seçime dön"
              : "Birden fazla alanla ilgili"}
          </button>
          {multiMode ? (
            <button
              type="button"
              disabled={pendingMulti.length === 0}
              className="min-h-10 rounded-full bg-[#0f766e] px-3.5 text-xs font-semibold text-white disabled:opacity-40"
              onClick={() =>
                onSelect({ kind: "multi", slugs: pendingMulti.slice(0, 3) })
              }
            >
              Seçimleri kaydet
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-2 border-t border-teal-900/8 pt-3">
        {CATEGORY_GUIDANCE_ACTIONS.map((action) => (
          <ActionRow
            key={action.id}
            id={`${baseId}-${action.id}`}
            actionId={action.id}
            label={action.label}
            helper={action.helper}
            selected={selectedAction === action.id}
            onSelect={() =>
              onSelect({ kind: "action", action: action.id })
            }
          />
        ))}
      </div>

      {showOtherDomainInput ? (
        <div className="mt-3 rounded-xl border border-teal-900/10 bg-[#f7faf9] px-3.5 py-3">
          <label
            htmlFor={`${baseId}-other-note`}
            className="block text-sm font-medium text-[#0f1f1d]"
          >
            Bu ürün veya parça nerede kullanılıyor?
          </label>
          <p className="mt-1 text-xs text-teal-950/50">
            Kısa bir açıklama yazın. İsterseniz ardından kategori aramasını da
            açabilirsiniz.
          </p>
          <textarea
            id={`${baseId}-other-note`}
            value={otherDomainNote}
            onChange={(e) => onOtherDomainNoteChange?.(e.target.value)}
            rows={3}
            className="mt-2 w-full resize-y rounded-lg border border-teal-900/12 bg-white px-3 py-2 text-sm text-[#0f1f1d] outline-none focus:border-[#0f766e]/35"
            placeholder="Örn. Matbaa makinesinde nemlendirme için kullanılıyor"
          />
        </div>
      ) : null}
    </section>
  );
}

function ActionRow(props: {
  id: string;
  actionId: CategoryGuidanceActionId;
  label: string;
  helper: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      id={props.id}
      aria-pressed={props.selected === true}
      onClick={props.onSelect}
      className={`flex min-h-12 w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
        props.selected
          ? "border-[#0f766e]/35 bg-[#f0fdfa]"
          : "border-teal-900/8 bg-[#fbfdfe] hover:border-[#0f766e]/20 hover:bg-[#f0fdfa]"
      }`}
    >
      <span className="mt-0.5 text-sm font-semibold text-[#0f1f1d]">
        {props.label}
      </span>
      <span className="text-xs leading-5 text-teal-950/50">{props.helper}</span>
    </button>
  );
}
