"use client";

import { useState } from "react";
import { BookmarkPlus, LoaderCircle } from "lucide-react";

import type { ParsedExploreFilters } from "@/lib/explore/category-filters";
import { exploreFiltersToSavedSearch } from "@/lib/monetization/saved-search-url";

type SaveExploreSearchButtonProps = {
  filters: ParsedExploreFilters;
  categorySlug?: string;
  city?: string;
  taxonomyLeaf?: string;
  taxonomyNode?: string;
  leafExact?: boolean;
  enabled?: boolean;
};

function stopParentForm(event: { preventDefault: () => void; stopPropagation: () => void }) {
  event.preventDefault();
  event.stopPropagation();
}

export function SaveExploreSearchButton({
  filters,
  categorySlug,
  city,
  taxonomyLeaf,
  taxonomyNode,
  leafExact,
  enabled = true,
}: SaveExploreSearchButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!enabled) return null;

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setMessage(null);

    const fieldParams: Record<string, string> = {};
    for (const { def, value } of filters.fields) {
      fieldParams[def.param] = value;
    }

    const payload = exploreFiltersToSavedSearch({
      categorySlug: categorySlug ?? (filters.focus || undefined),
      city: (city ?? filters.city) || undefined,
      district: filters.district || undefined,
      keyword: filters.q || undefined,
      budgetMin: filters.advanced.budgetMin,
      budgetMax: filters.advanced.budgetMax,
      urgentOnly: filters.advanced.urgentOnly,
      sinceDays: filters.advanced.sinceDays,
      fieldParams,
      taxonomyLeaf,
      taxonomyNode,
      leafExact,
    });

    try {
      const response = await fetch("/api/monetization/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: trimmed,
          filters: payload,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok) {
        setMessage(data.message ?? "Kaydedilemedi.");
        return;
      }
      setMessage("Arama kaydedildi.");
      setName("");
      setOpen(false);
    } catch {
      setMessage("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  function handleNameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      stopParentForm(event);
      void handleSave();
      return;
    }
    if (event.key === "Escape") {
      stopParentForm(event);
      setOpen(false);
    }
  }

  function handlePanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      stopParentForm(event);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-teal-900/10 bg-white px-3 text-xs font-semibold text-teal-900/70 transition hover:bg-teal-50"
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        Aramayı kaydet
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Aramayı kaydet"
          className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-teal-900/10 bg-white p-3 shadow-lg"
          onKeyDown={handlePanelKeyDown}
        >
          <label
            htmlFor="save-explore-search-name"
            className="block text-xs font-semibold text-teal-950/55"
          >
            Arama adı
          </label>
          <input
            id="save-explore-search-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            placeholder="Örn. Acil mobilya İstanbul"
            className="mt-1 h-10 w-full rounded-lg border border-teal-900/10 px-3 text-sm"
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || !name.trim()}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-teal-900 py-2 text-xs font-semibold text-white disabled:opacity-45"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-teal-900/10 px-3 text-xs font-semibold text-teal-900/60"
            >
              İptal
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-lg bg-teal-900 px-3 py-1.5 text-xs font-medium text-white">
          {message}
        </p>
      ) : null}
    </div>
  );
}
