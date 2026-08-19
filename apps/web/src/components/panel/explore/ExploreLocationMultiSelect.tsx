"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

const ALL_VALUE = "";

type ExploreLocationMultiSelectProps = {
  label: string;
  name: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
  searchPlaceholder?: string;
  onChange: (next: string[]) => void;
};

export function ExploreLocationMultiSelect({
  label,
  name,
  values,
  options,
  allLabel = "Tümü",
  searchPlaceholder = "Ara",
  onChange,
}: ExploreLocationMultiSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(values), [values]);
  const allSelected = values.length === 0;

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return options;
    return options.filter((option) =>
      option.label.toLocaleLowerCase("tr-TR").includes(needle),
    );
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const summary = allSelected
    ? allLabel
    : values.length === 1
      ? (options.find((option) => option.value === values[0])?.label ?? values[0])
      : `${values.length} seçili`;

  function toggle(value: string) {
    if (value === ALL_VALUE) {
      onChange([]);
      return;
    }
    if (selected.has(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      {values.length > 0 ? (
        <input type="hidden" name={name} value={values.join(",")} />
      ) : null}
      <p className="text-xs font-semibold text-[#0f1f1d]/45">{label}</p>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => {
          setOpen((current) => !current);
          queueMicrotask(() => searchRef.current?.focus());
        }}
        className="mt-1 flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[#0f1f1d]/10 bg-white px-3 text-left text-sm text-[#0f1f1d] outline-none transition hover:border-[#0f1f1d]/18 focus-visible:border-[#0f1f1d]/30"
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#0f1f1d]/40 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[#0f1f1d]/10 bg-white shadow-[0_16px_40px_rgba(15,31,29,0.12)]"
        >
          <div className="flex items-center gap-2 border-b border-[#0f1f1d]/8 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-[#0f1f1d]/35" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-[#0f1f1d] outline-none placeholder:text-[#0f1f1d]/35"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            <li>
              <ChoiceRow
                label={allLabel}
                checked={allSelected}
                onToggle={() => toggle(ALL_VALUE)}
              />
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-[#0f1f1d]/45">
                Eşleşen yer yok.
              </li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <ChoiceRow
                    label={option.label}
                    checked={selected.has(option.value)}
                    onToggle={() => toggle(option.value)}
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ChoiceRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onToggle}
      className={`flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
        checked
          ? "bg-[#0f1f1d]/[0.05] font-medium text-[#0f1f1d]"
          : "text-[#0f1f1d]/80 hover:bg-[#0f1f1d]/[0.03]"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked
            ? "border-[#0f1f1d] bg-[#0f1f1d] text-white"
            : "border-[#0f1f1d]/25 bg-white"
        }`}
        aria-hidden
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
