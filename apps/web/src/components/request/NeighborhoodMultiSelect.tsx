"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";

type NeighborhoodMultiSelectProps = {
  il: string;
  ilce: string;
  value: string[];
  onChange: (mahalleler: string[]) => void;
  disabled?: boolean;
  labelClassName?: string;
  badgeClassName?: string;
  controlClassName?: string;
  required?: boolean;
};

export function NeighborhoodMultiSelect({
  il,
  ilce,
  value,
  onChange,
  disabled = false,
  labelClassName = "text-xs font-medium text-black/40",
  badgeClassName = "rounded-full bg-[#ffe8e3] px-2 py-0.5 text-[10px] font-semibold text-[#a44b3d]",
  controlClassName = "min-h-12 w-full rounded-2xl border border-black/[0.08] bg-[#fafaf8] px-3 py-2 text-sm outline-none transition focus-within:border-[#0f766e]/40 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.1)]",
  required = false,
}: NeighborhoodMultiSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canLoad = Boolean(il.trim() && ilce.trim()) && !disabled;

  useEffect(() => {
    if (!canLoad) {
      setOptions([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    const params = new URLSearchParams({ il, ilce });
    void fetch(`/api/geo/neighborhoods?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          mahalleler?: string[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || "Mahalleler yüklenemedi.");
        }
        setOptions(payload.mahalleler ?? []);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setOptions([]);
        setLoadError(
          error instanceof Error ? error.message : "Mahalleler yüklenemedi.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [canLoad, il, ilce]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return options;
    return options.filter((name) =>
      name.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [options, query]);

  function toggle(name: string) {
    if (selectedSet.has(name)) {
      onChange(value.filter((item) => item !== name));
      return;
    }
    onChange([...value, name]);
  }

  function remove(name: string) {
    onChange(value.filter((item) => item !== name));
  }

  const helper = !il
    ? "Önce il seçiniz"
    : !ilce
      ? "Önce ilçe seçiniz"
      : loading
        ? "Mahalleler yükleniyor…"
        : loadError
          ? loadError
          : options.length
            ? `${options.length} mahalle · arayın veya seçin`
            : "Bu ilçe için mahalle bulunamadı";

  return (
    <div ref={rootRef} className="col-span-full sm:col-span-2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={labelClassName}>Mahalle{required ? " *" : ""}</span>
        {required ? (
          <span className={badgeClassName}>Zorunlu</span>
        ) : (
          <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold text-black/45">
            İsteğe bağlı
          </span>
        )}
        {value.length > 0 && (
          <span className="rounded-full bg-[#e8f3ea] px-2 py-0.5 text-[10px] font-semibold text-[#2f6b34]">
            {value.length} seçili
          </span>
        )}
      </div>

      <div
        className={`${controlClassName} ${
          disabled || !canLoad ? "cursor-not-allowed opacity-50" : ""
        }`}
      >
        {value.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {value.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => remove(name)}
                disabled={disabled}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-black/[0.06] bg-white px-2.5 py-1 text-xs font-medium text-black/70 transition hover:border-black/15 hover:text-black"
              >
                <span className="truncate">{name}</span>
                <X className="h-3 w-3 shrink-0 opacity-50" />
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={disabled || !canLoad}
          onClick={() => {
            setOpen((current) => !current);
            queueMicrotask(() => inputRef.current?.focus());
          }}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={open}
          aria-controls={listId}
        >
          <Search className="h-4 w-4 shrink-0 text-black/35" />
          <span className="min-w-0 flex-1 truncate text-sm text-black/45">
            {helper}
          </span>
          {loading ? (
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-black/35" />
          ) : (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-black/35 transition ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </button>
      </div>

      {open && canLoad && !loading && (
        <div
          id={listId}
          className="relative z-20 mt-2 overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_16px_40px_rgba(15,23,22,0.08)]"
        >
          <div className="border-b border-black/[0.06] p-2">
            <div className="flex items-center gap-2 rounded-xl bg-[#fafaf8] px-3 py-2">
              <Search className="h-4 w-4 text-black/35" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Mahalle ara…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-black/35"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-black/35 transition hover:text-black/60"
                  aria-label="Aramayı temizle"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-black/45">
                Eşleşen mahalle yok.
              </li>
            ) : (
              filtered.map((name) => {
                const selected = selectedSet.has(name);
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition ${
                        selected
                          ? "bg-[#0f766e]/[0.07] font-medium text-[#0f3d3a]"
                          : "text-black/75 hover:bg-black/[0.03]"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          selected
                            ? "border-[#0f766e] bg-[#0f766e] text-white"
                            : "border-black/20 bg-white"
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {value.length > 0 && (
            <div className="flex items-center justify-between border-t border-black/[0.06] px-3 py-2">
              <span className="text-[11px] text-black/40">
                {value.length} mahalle seçildi
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] font-medium text-black/50 transition hover:text-black/80"
              >
                Tümünü temizle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
