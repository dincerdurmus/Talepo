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

const ACTION_LABELS = {
  PREPARE_OFFER: "Teklif hazırlamaya değer",
  REVIEW_REQUEST: "Talebi ayrıntılı incele",
  CHECK_INVENTORY: "Envanteri kontrol et",
  WAIT_FOR_MORE_INFO: "Daha fazla bilgi bekle",
  SKIP: "Şimdilik bekle",
} as const;

function fitLabel(level: OpportunityFeedItem["intelligence"]["fitLevel"]) {
  return level === "STRONG" ? "Çok uygun" : level === "PROMISING" ? "Uygun" : level === "LIMITED" ? "Kısmen uygun" : "Uygunluk için yeterli veri yok";
}

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
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">
              <TrendingUp className="h-3 w-3" />
              {fitLabel(item.intelligence.fitLevel)}
            </span>
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

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-teal-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-800/65">Sana uygunluk</p>
          <p className="mt-1 text-sm font-semibold text-teal-950">{fitLabel(item.intelligence.fitLevel)}</p>
        </div>
        <div className="rounded-xl bg-blue-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/65">Rekabet</p>
          <p className="mt-1 text-sm font-semibold text-blue-950">{COMPETITION_LABELS[item.competition]}</p>
          <p className="mt-0.5 text-[11px] text-blue-950/55">{item.offerCount} teklif · anonim sinyal</p>
        </div>
        <div className="rounded-xl bg-violet-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-800/65">Fırsat değerlendirmesi</p>
          <p className="mt-1 text-sm font-semibold text-violet-950">{item.intelligence.opportunityScore}% · {item.intelligence.confidence >= 0.7 ? "güvenilir sinyal" : "sınırlı veri"}</p>
          <p className="mt-0.5 text-[11px] text-violet-950/55">{BUDGET_LABELS[item.budgetStatus]}</p>
        </div>
      </div>

      {item.opportunityReasons.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-teal-950/55">
          {item.opportunityReasons.slice(0, 3).map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 rounded-xl border border-amber-900/10 bg-amber-50/60 px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-amber-900/70">Risk / eksik bilgi</p>
        <p className="mt-1 text-xs text-amber-950/75">{item.intelligence.risks[0] ?? "Belirgin bir risk sinyali yok."}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-teal-950/[0.04] px-3 py-2.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-teal-900/55">Önerilen aksiyon</p>
          <p className="mt-0.5 text-sm font-semibold text-teal-950">{ACTION_LABELS[item.intelligence.recommendedAction]}</p>
        </div>
        <Link href={`/panel/talepler/${item.requestId}`} className="inline-flex h-9 items-center rounded-xl bg-teal-900 px-3 text-xs font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">Fırsatı incele →</Link>
      </div>

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
  showEmpty = false,
  renderItem,
}: {
  title: string;
  icon: React.ReactNode;
  items: OpportunityFeedItem[];
  empty: React.ReactNode;
  showEmpty?: boolean;
  renderItem: (item: OpportunityFeedItem) => React.ReactNode;
}) {
  if (items.length === 0 && !showEmpty) return null;
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

function OpportunityEmptyState() {
  const stages = ["Talepleri değerlendir", "Uygunluğu kontrol et", "Rekabeti analiz et", "Fırsatı öne çıkar"];
  return (
    <div className="rounded-[24px] border border-teal-900/10 bg-gradient-to-br from-white via-[#f7fcfb] to-[#f2f7ff] p-6 shadow-[0_16px_42px_rgba(15,47,43,0.06)] sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-700/10">
        <Flame className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[#172c48]">Henüz sana uygun güçlü bir fırsat yok.</h3>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-950/62">Talepo mevcut talepleri uygunluk ve fırsat sinyalleriyle değerlendirir. Güçlü bir eşleşme oluştuğunda burada görürsün.</p>
      <div className="mt-6 grid gap-2 sm:grid-cols-4">
        {stages.map((stage, index) => (
          <div key={stage} className="relative rounded-xl border border-teal-900/10 bg-white/80 px-3 py-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700/70">0{index + 1}</span>
            <p className="mt-1 text-xs font-semibold text-teal-950">{stage}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/panel/talepler?tab=newest" className="inline-flex h-10 items-center rounded-xl bg-teal-900 px-4 text-xs font-semibold text-white transition hover:bg-teal-800">Tüm talepleri keşfet →</Link>
        <Link href="/panel/uyarilar" className="inline-flex h-10 items-center rounded-xl border border-teal-900/12 bg-white px-4 text-xs font-semibold text-teal-900">Akıllı alarm oluştur →</Link>
      </div>
    </div>
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
        title="Sana önerilen fırsatlar"
        icon={<Flame className="h-5 w-5 text-orange-600" />}
        items={hot}
        empty={<OpportunityEmptyState />}
        showEmpty
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
      ) : null}

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
