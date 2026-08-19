"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  MY_REQUEST_FILTER_LABEL,
  MY_REQUEST_PRIMARY_FILTERS,
  MY_REQUEST_SECONDARY_FILTERS,
  buildMyRequestsPath,
  type MyRequestFilter,
} from "@/lib/panel/my-requests-surface";

export function MyRequestsFilterBar({
  active,
  counts,
}: {
  active: MyRequestFilter;
  counts: Record<MyRequestFilter, number>;
}) {
  const secondaryActive = MY_REQUEST_SECONDARY_FILTERS.includes(active);
  const [moreOpenUser, setMoreOpenUser] = useState(false);
  const moreOpen = secondaryActive || moreOpenUser;
  const moreId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMoreOpenUser(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpenUser(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="min-w-0">
      <div className="flex min-w-0 items-start gap-2">
        <div
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Taleplerim filtreleri"
        >
          {MY_REQUEST_PRIMARY_FILTERS.map((filter) => (
            <FilterChip
              key={filter}
              filter={filter}
              active={active === filter}
              count={counts[filter]}
            />
          ))}
        </div>
        <button
          type="button"
          className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30 ${
            moreOpen || secondaryActive
              ? "bg-[#0f1f1d] text-white"
              : "border border-[#0f1f1d]/10 bg-white text-[#0f1f1d]/70 hover:bg-white"
          }`}
          aria-expanded={moreOpen}
          aria-controls={moreId}
          onClick={() => {
            if (secondaryActive) return;
            setMoreOpenUser((current) => !current);
          }}
        >
          Daha fazla
          <ChevronDown
            className={`h-4 w-4 transition ${moreOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {moreOpen ? (
        <div
          id={moreId}
          className="mt-2 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {MY_REQUEST_SECONDARY_FILTERS.map((filter) => (
            <FilterChip
              key={filter}
              filter={filter}
              active={active === filter}
              count={counts[filter]}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  filter,
  active,
  count,
}: {
  filter: MyRequestFilter;
  active: boolean;
  count: number;
}) {
  return (
    <Link
      href={buildMyRequestsPath(filter)}
      role="tab"
      aria-selected={active}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30 ${
        active
          ? "bg-[#0f1f1d] text-white"
          : "border border-[#0f1f1d]/10 bg-white text-[#0f1f1d]/70 hover:bg-[#f4f7f6]"
      }`}
    >
      <span>{MY_REQUEST_FILTER_LABEL[filter]}</span>
      <span className={active ? "text-white/75" : "text-[#0f1f1d]/40"}>
        {count}
      </span>
    </Link>
  );
}
