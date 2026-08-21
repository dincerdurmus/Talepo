"use client";

import { getCategoryById } from "@/lib/request-category-engine";
import type { CategoryUserChoice } from "@/lib/request/understanding-snapshot";

type Props = {
  userChoice: CategoryUserChoice;
  selectedSlugs: string[];
  otherDomainNote?: string;
  onChange?: () => void;
};

/** Compact summary after a category guidance choice (no raw enums). */
export function CategoryGuidanceSummary({
  userChoice,
  selectedSlugs,
  otherDomainNote,
  onChange,
}: Props) {
  if (!userChoice) return null;

  let message = "";
  if (userChoice === "picked_candidate" || userChoice === "multi_candidates") {
    const labels = selectedSlugs
      .map((slug) => getCategoryById(slug)?.label)
      .filter(Boolean) as string[];
    if (labels.length === 0) return null;
    message =
      labels.length === 1
        ? `Talebiniz ${labels[0]} alanında değerlendirilecek.`
        : `Talebiniz ${labels.join(", ")} alanlarında değerlendirilecek.`;
  } else if (userChoice === "none_of_these") {
    message = "Önerilen alanlar uygun görülmedi.";
  } else if (userChoice === "other_domain") {
    message = otherDomainNote?.trim()
      ? `Başka alan: ${otherDomainNote.trim()}`
      : "Başka bir alan seçildi.";
  } else if (userChoice === "defer_to_talepo") {
    message = "Alanı Talepo belirleyecek.";
  }

  if (!message) return null;

  return (
    <div
      role="status"
      className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0f766e]/15 bg-[#f0fdfa]/80 px-3.5 py-2.5"
    >
      <p className="text-sm leading-6 text-[#0f1f1d]">{message}</p>
      {onChange ? (
        <button
          type="button"
          className="min-h-10 shrink-0 text-xs font-medium text-[#0f766e]"
          onClick={onChange}
        >
          Değiştir
        </button>
      ) : null}
    </div>
  );
}
