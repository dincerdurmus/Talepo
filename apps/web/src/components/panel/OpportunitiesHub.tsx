"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Eye,
  Flame,
  LoaderCircle,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";

import { opportunityRequestDetailHref } from "@/lib/panel/opportunity-request-detail-href";
import {
  selectOpportunityHubItems,
  sortPersonalRecommended,
  type OpportunityHubView,
} from "@/lib/panel/opportunity-recommended-eligibility";
import { isOpportunitySaveSupported } from "@/lib/panel/opportunity-save-support";
import type { OpportunityFeedItem } from "@/server/monetization/opportunities-feed";

type OpportunityContext = "PERSONAL" | "WORKSPACE";

type OpportunitiesHubProps = {
  initialFeed: OpportunityFeedItem[];
  canWatchlist: boolean;
  view?: OpportunityHubView;
  opportunityContext?: OpportunityContext;
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
  WAIT_FOR_MORE_INFO: "Eksik bilgiler netleşince tekrar bak",
  SKIP: "Şimdilik bekle",
} as const;

const MATERIAL_RISK_PATTERNS = [
  /piyasa sinyalinin üzerinde/i,
  /envanterinde uygun ürün bulunamadı/i,
  /eşleşme sinyali henüz yeterince güçlü değil/i,
];

function fitLabel(level: OpportunityFeedItem["intelligence"]["fitLevel"]) {
  return level === "STRONG"
    ? "Çok uygun"
    : level === "PROMISING"
      ? "Uygun"
      : level === "LIMITED"
        ? "Kısmen uygun"
        : "Uygunluk için yeterli veri yok";
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/** Match reasons first; opportunity signals without duplicating the same line. */
function opportunityCardReasons(item: OpportunityFeedItem): {
  fitReasons: string[];
  extraReasons: string[];
} {
  const fitReasons = uniqueNonEmpty(item.matchReasons);
  const seen = new Set(fitReasons);
  const extraReasons = uniqueNonEmpty(item.opportunityReasons).filter(
    (reason) => !seen.has(reason),
  );
  return { fitReasons, extraReasons };
}

function groundedStatement(item: OpportunityFeedItem): string | null {
  const { fitReasons, extraReasons } = opportunityCardReasons(item);
  return fitReasons[0] ?? extraReasons[0] ?? item.intelligence.reasons[0] ?? null;
}

function isMaterialRiskText(text: string): boolean {
  return MATERIAL_RISK_PATTERNS.some((pattern) => pattern.test(text));
}

function dataConfidenceLabel(confidence: number): string {
  return confidence >= 0.7 ? "Yeterli" : "Sınırlı";
}

function OpportunityCard({
  item,
  onWatchlistToggle,
  busy,
  canSave,
  saveError,
}: {
  item: OpportunityFeedItem;
  onWatchlistToggle: (requestId: string, add: boolean) => void;
  busy: string | null;
  canSave: boolean;
  saveError: string | null;
}) {
  const { fitReasons, extraReasons } = opportunityCardReasons(item);
  const detailHref = opportunityRequestDetailHref(item.requestId);
  const statement = groundedStatement(item);
  const hasPersonalMatch =
    item.context === "PERSONAL" &&
    item.matchScore != null &&
    item.matchReasons.length > 0;
  const materialRisks = item.intelligence.risks.filter(isMaterialRiskText);
  const ordinaryGaps = item.intelligence.risks.filter(
    (risk) => !isMaterialRiskText(risk),
  );
  const ordinaryGap = ordinaryGaps[0] ?? null;
  const confidenceLabel = dataConfidenceLabel(item.intelligence.confidence);

  return (
    <article className="rounded-2xl border border-teal-900/8 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {hasPersonalMatch || item.context === "WORKSPACE" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                <TrendingUp className="h-3 w-3" aria-hidden />
                {fitLabel(item.intelligence.fitLevel)}
              </span>
            ) : null}
            {item.isUrgent ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                Acil
              </span>
            ) : null}
          </div>
          {detailHref ? (
            <Link
              href={detailHref}
              className="mt-2 block rounded-sm text-base font-semibold text-teal-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            >
              {item.title}
            </Link>
          ) : (
            <p className="mt-2 text-base font-semibold text-teal-950">
              {item.title}
            </p>
          )}
          <p className="mt-1 text-xs text-teal-950/50">
            {item.categoryName}
            {item.city ? ` · ${item.city}` : ""}
            {item.budgetLabel ? ` · ${item.budgetLabel}` : ""}
          </p>
          {statement ? (
            <p className="mt-2 text-sm leading-6 text-teal-950/70">{statement}</p>
          ) : null}
        </div>
        {canSave ? (
          <div className="shrink-0">
            <button
              type="button"
              disabled={busy === item.requestId}
              onClick={() =>
                onWatchlistToggle(item.requestId, !item.isWatchlisted)
              }
              title="Talebi kaydet (watchlist) — kayıtlı aramalardan ayrıdır"
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
            {saveError ? (
              <p className="mt-1 max-w-[11rem] text-[11px] font-medium text-rose-700">
                {saveError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {fitReasons.length > 0 || extraReasons.length > 0 ? (
          <div className="rounded-xl bg-teal-50/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-800/65">
              Neden önemli olabilir
            </p>
            {fitReasons.length > 0 ? (
              <div className="mt-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-800/65">
                  Neden sana uygun
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-teal-950/70">
                  {fitReasons.slice(0, 3).map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {extraReasons.length > 0 ? (
              <div className={fitReasons.length > 0 ? "mt-2" : "mt-1"}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-800/65">
                  Fırsat neden ilginç
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-teal-950/70">
                  {extraReasons.slice(0, 3).map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-teal-900/8 bg-[#f7fbfa] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-800/65">
            Fırsat görünümü
          </p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] text-teal-950/45">Uygunluk</dt>
              <dd className="mt-0.5 text-sm font-semibold text-teal-950">
                {fitLabel(item.intelligence.fitLevel)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-teal-950/45">Rekabet</dt>
              <dd className="mt-0.5 text-sm font-semibold text-teal-950">
                {COMPETITION_LABELS[item.competition]}
              </dd>
              <p className="mt-0.5 text-[11px] text-teal-950/45">
                {item.offerCount} teklif · anonim sinyal
              </p>
            </div>
            <div>
              <dt className="text-[11px] text-teal-950/45">Veri güveni</dt>
              <dd className="mt-0.5 text-sm font-semibold text-teal-950">
                Veri güveni: {confidenceLabel}
              </dd>
              <p className="mt-0.5 text-[11px] text-teal-950/45">
                Sinyal gücü {item.intelligence.opportunityScore}/100 ·{" "}
                {BUDGET_LABELS[item.budgetStatus]}
              </p>
            </div>
          </dl>
        </div>

        <p className="text-[11px] leading-5 text-teal-950/45">
          Veri kalitesi: {confidenceLabel.toLocaleLowerCase()} güven. Bu sayı
          başarı olasılığı değildir.
        </p>

        {ordinaryGap ? (
          <p className="text-xs leading-5 text-teal-950/50">{ordinaryGap}</p>
        ) : null}

        {materialRisks.length > 0 ? (
          <div className="rounded-xl border border-amber-900/15 bg-amber-50/70 px-3 py-2">
            <p className="text-[11px] font-semibold text-amber-950">
              Dikkat edilmesi gerekenler
            </p>
            <p className="mt-1 text-xs text-amber-950/80">{materialRisks[0]}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-teal-950/[0.04] px-3 py-2.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-teal-900/55">
            Önerilen aksiyon
          </p>
          <p className="mt-0.5 text-sm font-semibold text-teal-950">
            {ACTION_LABELS[item.intelligence.recommendedAction]}
          </p>
        </div>
        {detailHref ? (
          <Link
            href={detailHref}
            className="inline-flex h-9 items-center rounded-xl bg-teal-900 px-3 text-xs font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            Talebi incele →
          </Link>
        ) : null}
      </div>

      {item.recentChanges.length > 0 ? (
        <div className="mt-3 rounded-xl bg-teal-50/80 px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-teal-900">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Son değişiklikler
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-teal-900/70">
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
  summary,
  renderItem,
}: {
  title: string;
  icon: React.ReactNode;
  items: OpportunityFeedItem[];
  empty: React.ReactNode;
  showEmpty?: boolean;
  summary?: string | null;
  renderItem: (item: OpportunityFeedItem) => React.ReactNode;
}) {
  if (items.length === 0 && !showEmpty) return null;
  return (
    <section className="rounded-[28px] border border-teal-900/8 bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-teal-950">{title}</h2>
        </div>
        {summary ? (
          <p className="text-xs font-medium text-teal-900/45">{summary}</p>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => renderItem(item))
        ) : (
          <div className="text-sm text-teal-950/45">{empty}</div>
        )}
      </div>
    </section>
  );
}

function OpportunityEmptyState() {
  return (
    <div className="rounded-[24px] border border-teal-900/10 bg-white p-6 sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-700/10">
        <Target className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[#172c48]">
        Henüz sana güçlü şekilde uyan bir fırsat yok.
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-950/62">
        Kayıtlı arama veya alarm ile eşleşen açık talepler burada görünür. Daha
        geniş liste için keşfet veya acil sekmelerine bakabilirsiniz.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/panel/firsatlar?view=browse"
          className="inline-flex h-10 items-center rounded-xl bg-teal-900 px-4 text-xs font-semibold text-white transition hover:bg-teal-800"
        >
          Talepleri keşfet →
        </Link>
        <Link
          href="/panel/kayitli-aramalar"
          className="inline-flex h-10 items-center rounded-xl border border-teal-900/12 bg-white px-4 text-xs font-semibold text-teal-900"
        >
          Kayıtlı arama
        </Link>
        <Link
          href="/panel/uyarilar"
          className="inline-flex h-10 items-center rounded-xl border border-teal-900/12 bg-white px-4 text-xs font-semibold text-teal-900"
        >
          Alarm
        </Link>
      </div>
    </div>
  );
}

export function OpportunitiesHub({
  initialFeed,
  canWatchlist,
  view = "suggested",
  opportunityContext,
}: OpportunitiesHubProps) {
  const [feed, setFeed] = useState(initialFeed);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{
    requestId: string;
    message: string;
  } | null>(null);

  const surface: OpportunityContext =
    opportunityContext ??
    feed[0]?.context ??
    (canWatchlist ? "WORKSPACE" : "PERSONAL");

  const visible = useMemo(() => {
    const selected = selectOpportunityHubItems(feed, view);
    if (view === "suggested" && surface === "PERSONAL") {
      return sortPersonalRecommended(selected);
    }
    return selected;
  }, [feed, view, surface]);

  const highBudget = feed.filter((i) => i.budgetStatus === "ABOVE_MARKET");
  const showHighBudget = surface === "WORKSPACE" && highBudget.length > 0;
  const watchlist = feed.filter((i) => i.isWatchlisted);
  const competitionHigh = feed.filter((i) => i.competition === "LOW");
  const showSavedSection = canWatchlist;
  const showWorkspaceExtras = surface === "WORKSPACE" && view === "suggested";

  const sectionTitle =
    view === "browse"
      ? "Keşif"
      : view === "urgent"
        ? "Acil talepler"
        : surface === "PERSONAL"
          ? "Sana önerilen fırsatlar"
          : "Sana önerilen fırsatlar";

  const compactSummary =
    visible.length > 0
      ? `${visible.length} ${view === "suggested" ? "eşleşme" : "talep"}`
      : null;

  function cardCanSave(item: OpportunityFeedItem) {
    return isOpportunitySaveSupported({
      context: item.context,
      canWatchlist,
    });
  }

  async function toggleWatchlist(requestId: string, add: boolean) {
    const item = feed.find((row) => row.requestId === requestId);
    if (
      !item ||
      !isOpportunitySaveSupported({
        context: item.context,
        canWatchlist,
      })
    ) {
      return;
    }
    setBusy(requestId);
    setSaveError(null);
    try {
      const response = await fetch("/api/monetization/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: add ? "add" : "remove",
          requestId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        setSaveError({
          requestId,
          message: data.message ?? "Kaydedilemedi.",
        });
        return;
      }
      setFeed((current) =>
        current.map((row) =>
          row.requestId === requestId
            ? { ...row, isWatchlisted: add }
            : row,
        ),
      );
    } catch {
      setSaveError({ requestId, message: "Bağlantı hatası." });
    } finally {
      setBusy(null);
    }
  }

  function renderCard(item: OpportunityFeedItem) {
    return (
      <OpportunityCard
        key={item.requestId}
        item={item}
        onWatchlistToggle={toggleWatchlist}
        busy={busy}
        canSave={cardCanSave(item)}
        saveError={
          saveError?.requestId === item.requestId ? saveError.message : null
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title={sectionTitle}
        icon={<Flame className="h-5 w-5 text-teal-700" />}
        items={visible}
        empty={
          view === "suggested" ? (
            <OpportunityEmptyState />
          ) : view === "urgent" ? (
            "Şu an acil işaretli açık talep yok."
          ) : (
            "Şu an gösterilecek açık talep yok."
          )
        }
        showEmpty
        summary={compactSummary}
        renderItem={renderCard}
      />

      {showHighBudget ? (
        <Section
          title="Yüksek bütçe"
          icon={<TrendingUp className="h-5 w-5 text-teal-700" />}
          items={highBudget}
          empty=""
          renderItem={renderCard}
        />
      ) : null}

      {showSavedSection ? (
        <Section
          title="Kaydettiklerim"
          icon={<Eye className="h-5 w-5 text-teal-700" />}
          items={watchlist}
          empty="Henüz kaydettiğiniz talep yok. Kategori takibi için Keşfet sekmesini kullanın."
          renderItem={renderCard}
        />
      ) : null}

      {showWorkspaceExtras ? (
        <Section
          title="Düşük rekabet sinyalleri"
          icon={<TrendingUp className="h-5 w-5 text-teal-700" />}
          items={competitionHigh}
          empty="Düşük rekabet sinyali olan talep yok."
          renderItem={renderCard}
        />
      ) : null}
    </div>
  );
}
