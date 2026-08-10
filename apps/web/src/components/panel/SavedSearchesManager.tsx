"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  Bookmark,
  LoaderCircle,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";

import type { SavedSearchFilters } from "@/lib/monetization/types";
import { savedSearchToExploreUrl } from "@/lib/monetization/saved-search-url";

type SavedSearchRow = {
  id: string;
  name: string;
  isActive: boolean;
  filters: SavedSearchFilters;
  createdAt: string;
  updatedAt: string;
};

export function SavedSearchesManager({
  initialSearches,
}: {
  initialSearches: SavedSearchRow[];
}) {
  const [searches, setSearches] = useState(initialSearches);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/monetization/saved-searches");
      const data = (await response.json()) as {
        ok?: boolean;
        searches?: SavedSearchRow[];
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "Yüklenemedi.");
      setSearches(data.searches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function toggleActive(id: string, isActive: boolean) {
    setSearches((current) =>
      current.map((s) => (s.id === id ? { ...s, isActive } : s)),
    );
    const response = await fetch("/api/monetization/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, isActive }),
    });
    if (!response.ok) void reload();
  }

  async function deleteSearch(id: string) {
    setSearches((current) => current.filter((s) => s.id !== id));
    const response = await fetch("/api/monetization/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (!response.ok) void reload();
  }

  async function saveRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    setRenamingId(null);
    const response = await fetch("/api/monetization/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, name }),
    });
    if (response.ok) {
      setSearches((current) =>
        current.map((s) => (s.id === id ? { ...s, name } : s)),
      );
    } else {
      void reload();
    }
  }

  function filterSummary(filters: SavedSearchFilters) {
    const parts: string[] = [];
    if (filters.categorySlug) parts.push(filters.categorySlug);
    if (filters.city) parts.push(filters.city);
    if (filters.keyword) parts.push(`"${filters.keyword}"`);
    if (filters.urgent) parts.push("Acil");
    if (filters.budgetMin != null || filters.budgetMax != null) {
      parts.push(`₺${filters.budgetMin ?? "—"}–${filters.budgetMax ?? "—"}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "Genel filtre";
  }

  return (
    <section className="rounded-[28px] border border-teal-900/8 bg-white p-6 shadow-[0_16px_55px_rgba(15,60,50,0.04)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-900/8 text-teal-800">
          <Bookmark className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-teal-950">Kayıtlı aramalar</h2>
          <p className="mt-1 text-sm text-teal-950/50">
            Keşif sayfasından filtre kaydedin; buradan tek tıkla çalıştırın.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-teal-950/45">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Yükleniyor...
        </div>
      ) : searches.length === 0 ? (
        <div className="mt-6 rounded-xl bg-teal-50/60 p-5 text-sm text-teal-950/50">
          Henüz kayıtlı arama yok.{" "}
          <Link href="/panel/talepler" className="font-semibold text-teal-800 underline">
            Keşfet
          </Link>
          {" "}sayfasında filtreleri kaydedin.
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {searches.map((search) => (
            <li
              key={search.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-900/8 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                {renamingId === search.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveRename(search.id);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="h-9 flex-1 rounded-lg border border-teal-900/10 px-3 text-sm"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-teal-900 px-3 text-xs font-semibold text-white"
                    >
                      Kaydet
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="font-semibold text-teal-950">{search.name}</p>
                    <p className="mt-1 text-xs text-teal-950/45">
                      {filterSummary(search.filters)}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-teal-950/60">
                  <input
                    type="checkbox"
                    checked={search.isActive}
                    onChange={(e) =>
                      void toggleActive(search.id, e.target.checked)
                    }
                    className="h-4 w-4 rounded border-teal-300 text-teal-700"
                  />
                  Aktif
                </label>
                <Link
                  href={savedSearchToExploreUrl(search.filters)}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Play className="h-3 w-3" />
                  Çalıştır
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(search.id);
                    setRenameValue(search.name);
                  }}
                  className="rounded-full p-2 text-teal-800 hover:bg-teal-50"
                  aria-label="Yeniden adlandır"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSearch(search.id)}
                  className="rounded-full p-2 text-rose-700 hover:bg-rose-50"
                  aria-label="Sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
