"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export function OfferMessageBlock({
  label,
  message,
  emptyLabel,
}: {
  label: string;
  message: string;
  emptyLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const trimmed = message.trim();
  const long = trimmed.length > 220;

  return (
    <section
      className="mt-4 rounded-xl border border-teal-900/10 bg-white px-4 py-3.5"
      aria-label={label}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-900/55">
        {label}
      </p>
      {trimmed ? (
        <>
          <p
            id={contentId}
            className={`mt-2 text-[15px] leading-7 text-[#0f1f1d]/85 break-words ${
              !expanded && long ? "line-clamp-4" : ""
            }`}
          >
            {trimmed}
          </p>
          {long ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls={contentId}
              className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-teal-900/75 hover:text-teal-900"
            >
              {expanded ? "Daha az göster" : "Devamını oku"}
              <ChevronDown
                className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm leading-6 text-black/35">{emptyLabel}</p>
      )}
    </section>
  );
}
