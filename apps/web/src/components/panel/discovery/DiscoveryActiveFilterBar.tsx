"use client";

import { X } from "lucide-react";

import {
  summarizeCanonicalFilter,
  taxonomyPathForNode,
  type CanonicalDiscoveryFilter,
} from "@/lib/discovery";

type DiscoveryActiveFilterBarProps = {
  filter: CanonicalDiscoveryFilter | null;
  city?: string | null;
  urgent?: boolean;
  onClearNode: () => void;
  onClearCity: () => void;
  onClearUrgent: () => void;
  onToggleLeafExact?: () => void;
};

export function DiscoveryActiveFilterBar({
  filter,
  city,
  urgent,
  onClearNode,
  onClearCity,
  onClearUrgent,
  onToggleLeafExact,
}: DiscoveryActiveFilterBarProps) {
  const nodeId = filter?.primaryLeafId || filter?.taxonomyNodeIds?.[0] || null;
  const path = nodeId ? taxonomyPathForNode(nodeId) : [];
  const hasAnything = Boolean(nodeId || city || urgent);

  if (!hasAnything) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-teal-900/8 bg-teal-50/40 px-3 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-teal-800/55">
        Aktif filtre
      </span>
      {path.length > 0 ? (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-teal-950 ring-1 ring-teal-900/10">
          <span className="truncate">{path.join(" › ")}</span>
          {filter?.leafExact ? (
            <button
              type="button"
              onClick={onToggleLeafExact}
              className="rounded-full bg-teal-900/8 px-1.5 py-0.5 text-[10px] font-semibold text-teal-900"
              title="Yalnız bu ürün (exact leaf). Tıklayınca üst grubu da kapsar."
            >
              Exact
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Kategori filtresini kaldır"
            onClick={onClearNode}
            className="rounded-full p-0.5 hover:bg-teal-900/10"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}
      {city ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-teal-950 ring-1 ring-teal-900/10">
          {city}
          <button
            type="button"
            aria-label="Şehir filtresini kaldır"
            onClick={onClearCity}
            className="rounded-full p-0.5 hover:bg-teal-900/10"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}
      {urgent ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
          Acil
          <button
            type="button"
            aria-label="Acil filtresini kaldır"
            onClick={onClearUrgent}
            className="rounded-full p-0.5 hover:bg-amber-200"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}
      <span className="sr-only">{summarizeCanonicalFilter(filter)}</span>
    </div>
  );
}
