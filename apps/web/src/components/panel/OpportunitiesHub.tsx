"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Eye,
  Flame,
  LoaderCircle,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";

import type { OpportunityFeedItem } from "@/server/monetization/opportunities-feed";

type OpportunitiesHubProps = {
  initialFeed: OpportunityFeedItem[];
};

const COMPETITION_LABELS = {
  LOW: "Düşük rekabet",
  MEDIUM: "Orta rekabet",
  HIGH: "Yüksek rekabet",
} as const;

const BUDGET_LABELS = {
  UNKNOWN: "Bütçe verisi yetersiz",
  BELOW_MARKET: "Piyasa altı",
  MARKET: "Piyasa bandında",
  ABOVE_MARKET: "Piyasa üstü",
} as const;

function OpportunityCard({
  item,
  onWatchlistToggle,
  busy,
}: {
  item: OpportunityFeedItem;
  onWatchlistToggle: (requestId: string, add: boolean) => void;
  busy: string | null;
}) {
  const classColors = {
    HOT: "border-orange-200 bg-orange-50/50",
    GOOD: "border-teal-200 bg-teal-50/40",
    NORMAL: "border-teal-900/8 bg-white",
  };

  return (
    <article
      className={`rounded-2xl border p-4 ${classColors[item.opportunityClassification]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.opportunityClassification === "HOT" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                <Flame className="h-3 w-3" />
                Sıcak
              </span>
            ) : item.opportunityClassification === "GOOD" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                <TrendingUp className="h-3 w-3" />
                İyi fırsat
              </span>
            ) : null}
            {item.isUrgent ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                Acil
              </span>
            ) : null}
          </div>
          <Link
            href={`/panel/talepler/${item.requestId}`}
            className="mt-2 block text-base font-semibold text-teal-950 hover:underline"
          >
            {item.title}
          </Link>
          <p className="mt-1 text-xs text-teal-950/50">
            {item.categoryName}
            {item.city ? ` · ${item.city}` : ""}
            {item.budgetLabel ? ` · ${item.budgetLabel}` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={busy === item.requestId}
          onClick={() =>
            onWatchlistToggle(item.requestId, !item.isWatchlisted)
          }
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            item.isWatchlisted
              ? "bg-teal-900 text-white"
              : "border border-teal-900/15 text-teal-900/70 hover:bg-teal-50"
          }`}
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
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-white/80 px-2 py-0.5 font-medium text-teal-900/70 ring-1 ring-teal-900/10">
          {item.opportunityClassification === "HOT"
            ? "Yüksek eşleşme"
            : item.opportunityClassification === "GOOD"
              ? "Orta eşleşme"
              : "Genel fırsat"}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 font-medium text-teal-900/70 ring-1 ring-teal-900/10">
          {COMPETITION_LABELS[item.competition]}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 font-medium text-teal-900/70 ring-1 ring-teal-900/10">
          {BUDGET_LABELS[item.budgetStatus]}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 font-medium text-teal-900/70 ring-1 ring-teal-900/10">
          {item.offerCount} teklif
        </span>
      </div>

      {item.opportunityReasons.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-teal-950/55">
          {item.opportunityReasons.slice(0, 3).map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      ) : null}

      {item.recentChanges.length > 0 ? (
        <div className="mt-3 rounded-xl bg-amber-50/80 px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-900">
            <AlertTriangle className="h-3 w-3" />
            Son değişiklikler
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-amber-900/80">
            {item.recentChanges.map((change) => (
              <li key={`${change.field}-${change.newValue}`}>
                {change.label}: {change.oldValue ?? "—"} → {change.newValue ?? "—"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function Section({
  title,
  icon,
  items,
  empty,
  renderItem,
}: {
  title: string;
  icon: React.ReactNode;
  items: OpportunityFeedItem[];
  empty: string;
  renderItem: (item: OpportunityFeedItem) => React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-teal-900/8 bg-white p-6">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold text-teal-950">{title}</h2>
      </div>
      <div className="mt-4 space-y-3">
        {items.length > 0
          ? items.map((item) => renderItem(item))
          : (
              <p className="text-sm text-teal-950/45">{empty}</p>
            )}
      </div>
    </section>
  );
}

export function OpportunitiesHub({ initialFeed }: OpportunitiesHubProps) {
  const [feed, setFeed] = useState(initialFeed);
  const [busy, setBusy] = useState<string | null>(null);

  const hot = feed.filter(
    (i) => i.opportunityClassification === "HOT" || i.opportunityClassification === "GOOD",
  );
  const highBudget = feed.filter((i) => i.budgetStatus === "ABOVE_MARKET");
  const showHighBudget = highBudget.length > 0;
  const watchlist = feed.filter((i) => i.isWatchlisted);
  const competitionHigh = feed.filter((i) => i.competition === "LOW");

  async function toggleWatchlist(requestId: string, add: boolean) {
    setBusy(requestId);
    try {
      const response = await fetch("/api/monetization/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: add ? "add" : "remove",
          requestId,
        }),
      });
      if (response.ok) {
        setFeed((current) =>
          current.map((item) =>
            item.requestId === requestId
              ? { ...item, isWatchlisted: add }
              : item,
          ),
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Section
        title="Sıcak fırsatlar"
        icon={<Flame className="h-5 w-5 text-orange-600" />}
        items={hot}
        empty="Şu an GOOD/HOT sınıflı açık talep yok."
        renderItem={(item) => (
          <OpportunityCard
            key={item.requestId}
            item={item}
            onWatchlistToggle={toggleWatchlist}
            busy={busy}
          />
        )}
      />

      {showHighBudget ? (
        <Section
          title="Yüksek bütçe"
          icon={<Wallet className="h-5 w-5 text-teal-700" />}
          items={highBudget}
          empty=""
          renderItem={(item) => (
            <OpportunityCard
              key={item.requestId}
              item={item}
              onWatchlistToggle={toggleWatchlist}
              busy={busy}
            />
          )}
        />
      ) : (
        <section className="rounded-[28px] border border-dashed border-teal-900/12 bg-teal-50/30 p-6">
          <div className="flex items-center gap-2 text-teal-800/70">
            <Wallet className="h-5 w-5" />
            <h2 className="text-base font-semibold text-teal-950">Yüksek bütçe fırsatları</h2>
          </div>
          <p className="mt-2 text-sm text-teal-950/55">
            Yeterli anonim piyasa verisi oluştuğunda piyasa üstü bütçeli talepler burada
            gösterilecek.
          </p>
        </section>
      )}

      <Section
        title="Kaydettiklerim"
        icon={<Eye className="h-5 w-5 text-teal-700" />}
        items={watchlist}
        empty="Henüz kaydettiğiniz talep yok. Kategori takibi için Keşfet sekmesini kullanın."
        renderItem={(item) => (
          <OpportunityCard
            key={item.requestId}
            item={item}
            onWatchlistToggle={toggleWatchlist}
            busy={busy}
          />
        )}
      />

      <Section
        title="Düşük rekabet sinyalleri"
        icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
        items={competitionHigh}
        empty="Düşük rekabet sinyali olan talep yok."
        renderItem={(item) => (
          <OpportunityCard
            key={item.requestId}
            item={item}
            onWatchlistToggle={toggleWatchlist}
            busy={busy}
          />
        )}
      />
    </div>
  );
}
