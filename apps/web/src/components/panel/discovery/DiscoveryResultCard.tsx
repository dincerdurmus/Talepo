"use client";

import Link from "next/link";
import { LoaderCircle, Star } from "lucide-react";

import { matchBandLabel } from "@/lib/discovery";
import type { DiscoveryWorkspaceItem } from "@/server/monetization/discovery-workspace-query";

function relativeTime(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Az önce";
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  return `${days} g`;
}

export function DiscoveryResultCard({
  item,
  onBookmarkToggle,
  busy,
}: {
  item: DiscoveryWorkspaceItem;
  onBookmarkToggle?: (requestId: string, add: boolean) => void;
  busy?: string | null;
}) {
  const band = matchBandLabel(item.matchBand);
  const attrEntries = Object.entries(item.attributes).slice(0, 4);

  return (
    <article className="rounded-2xl border border-teal-900/8 bg-white p-4 shadow-[0_8px_30px_rgba(15,60,50,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.isUrgent ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                Acil
              </span>
            ) : null}
            {band ? (
              <span className="rounded-full bg-teal-900/8 px-2 py-0.5 text-[10px] font-semibold text-teal-900">
                {band}
              </span>
            ) : null}
            <span className="text-[10px] font-medium uppercase tracking-wide text-teal-900/40">
              {item.matchPath === "CANONICAL_MATCH" ? "Canonical" : "Legacy"}
            </span>
          </div>
          <Link
            href={`/panel/talepler/${item.requestId}`}
            className="mt-2 block text-base font-semibold text-teal-950 hover:underline"
          >
            {item.title}
          </Link>
          {item.taxonomyPathLabels.length > 0 ? (
            <p className="mt-1 text-xs text-teal-800/65">
              {item.taxonomyPathLabels.join(" › ")}
            </p>
          ) : (
            <p className="mt-1 text-xs text-teal-950/45">{item.categoryName}</p>
          )}
          <p className="mt-1 text-xs text-teal-950/45">
            {[item.city, item.budgetLabel, relativeTime(item.publishedAt ?? item.createdAt)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {onBookmarkToggle ? (
          <button
            type="button"
            disabled={busy === item.requestId}
            onClick={() =>
              onBookmarkToggle(item.requestId, !item.isWatchlisted)
            }
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              item.isWatchlisted
                ? "bg-teal-900 text-white"
                : "border border-teal-900/15 text-teal-900/70 hover:bg-teal-50"
            }`}
            title="Talebi kaydet (watchlist) — kategori takibinden ayrıdır"
          >
            {busy === item.requestId ? (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            ) : (
              <Star
                className={`h-3 w-3 ${item.isWatchlisted ? "fill-current" : ""}`}
              />
            )}
            {item.isWatchlisted ? "Kaydedildi" : "Kaydet"}
          </button>
        ) : null}
      </div>

      {attrEntries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {attrEntries.map(([k, v]) => (
            <span
              key={k}
              className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-900/70"
            >
              {k}: {v}
            </span>
          ))}
        </div>
      ) : null}

      {item.reasonLabels.length > 0 ? (
        <div className="mt-3 rounded-xl bg-teal-50/50 px-3 py-2">
          <p className="text-[11px] font-semibold text-teal-900/70">
            Neden uygun?
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-teal-950/55">
            {item.reasonLabels.map((label) => (
              <li key={label}>• {label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/panel/talepler/${item.requestId}`}
          className="inline-flex h-9 items-center rounded-xl border border-teal-900/12 px-3 text-xs font-semibold text-teal-900"
        >
          Talebi görüntüle
        </Link>
        <Link
          href={`/panel/talepler/${item.requestId}/teklif`}
          className="inline-flex h-9 items-center rounded-xl bg-teal-900 px-3 text-xs font-semibold text-white"
        >
          Teklif ver
        </Link>
      </div>
    </article>
  );
}
