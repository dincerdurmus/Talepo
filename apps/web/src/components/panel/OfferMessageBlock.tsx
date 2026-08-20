"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export function OfferMessageBlock({
  label,
  message,
  emptyLabel,
  variant = "panel",
}: {
  label: string;
  message: string;
  emptyLabel: string;
  /** Editorial: plain document note without a bordered card. */
  variant?: "panel" | "editorial";
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const trimmed = message.trim();
  const long = trimmed.length > 180;

  const editorial = variant === "editorial";

  return (
    <section
      className={
        editorial
          ? "mt-2.5 border-l-2 border-teal-800/20 pl-3"
          : "mt-4 rounded-xl border border-teal-900/10 bg-white px-4 py-3.5"
      }
      aria-label={label}
    >
      <p
        className={`font-semibold uppercase tracking-[0.14em] text-teal-900/50 ${
          editorial ? "text-[10px]" : "text-[11px]"
        }`}
      >
        {label}
      </p>
      {trimmed ? (
        <>
          <p
            id={contentId}
            className={`mt-1.5 break-words text-[#0f1f1d]/80 ${
              editorial
                ? "text-[14px] leading-6"
                : "text-[15px] leading-7"
            } ${!expanded && long ? (editorial ? "line-clamp-3" : "line-clamp-4") : ""}`}
          >
            {trimmed}
          </p>
          {long ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls={contentId}
              className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-teal-900/70 hover:text-teal-900"
            >
              {expanded ? "Daha az göster" : "Devamını oku"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-1.5 text-sm leading-6 text-black/35">{emptyLabel}</p>
      )}
    </section>
  );
}
