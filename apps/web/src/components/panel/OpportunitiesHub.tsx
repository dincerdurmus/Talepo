"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  Flame,
  Gauge,
  LoaderCircle,
  Shield,
  Star,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import { buildOpportunityHubSummary } from "@/lib/panel/opportunity-hub-summary";
import { opportunityRequestDetailHref } from "@/lib/panel/opportunity-request-detail-href";
import {
  selectOpportunityHubItems,
  sortPersonalRecommended,
  type OpportunityHubView,
} from "@/lib/panel/opportunity-recommended-eligibility";
import { isOpportunitySaveSupported } from "@/lib/panel/opportunity-save-support";
import type { OpportunityFeedItem } from "@/server/monetization/opportunities-feed";
import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";

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

const ACTION_LABELS = {
  PREPARE_OFFER: "Teklif hazırlamaya değer",
  REVIEW_REQUEST: "Talebi ayrıntılı incele",
  CHECK_INVENTORY: "Envanteri kontrol et",
  WAIT_FOR_MORE_INFO: "Eksik bilgiler netleşince tekrar bak",
  SKIP: "Şimdilik bekle",
} as const;

const MATCH_DATA_MISSING = /eşleşme verisi bulunamadı/i;
const DETAIL_GAP = /talep detay/i;

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function matchReasonList(item: OpportunityFeedItem): string[] {
  return uniqueNonEmpty(item.matchReasons).slice(0, 2);
}

function fitBadgeLabel(
  level: OpportunityFeedItem["intelligence"]["fitLevel"],
): string | null {
  return level === "STRONG"
    ? "Yüksek eşleşme"
    : level === "PROMISING"
      ? "Uygun"
      : level === "LIMITED"
        ? "Kısmen uygun"
        : null;
}

function dataConfidenceLabel(confidence: number): string {
  return confidence >= 0.7 ? "Yeterli" : confidence >= 0.4 ? "Orta" : "Sınırlı";
}

function freshnessLabel(item: OpportunityFeedItem): string {
  if (item.intelligence.urgencyReason === "Talep yeni yayınlandı.") {
    return "Yeni yayınlandı";
  }
  const raw = item.publishedAt ?? item.createdAt;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return item.intelligence.urgencyReason;
  const hours = (Date.now() - date.getTime()) / 3600000;
  if (hours < 1) return "Az önce";
  if (hours <= 24) return "Yeni yayınlandı";
  const days = Math.max(1, Math.floor(hours / 24));
  return `${days} gün önce`;
}

function compactRiskLabel(item: OpportunityFeedItem): string | null {
  const risks = item.intelligence.risks.filter(
    (risk) => !MATCH_DATA_MISSING.test(risk),
  );
  if (risks.some((risk) => DETAIL_GAP.test(risk))) {
    return "Talep detayları sınırlı";
  }
  return risks[0] ? "Eksik bilgi" : null;
}

function OpportunityBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "match" | "urgent" | "neutral" | "limited";
}) {
  const className =
    tone === "match"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "urgent"
        ? "bg-amber-100 text-amber-900"
        : tone === "limited"
          ? "bg-teal-50 text-teal-800"
          : "bg-teal-950/[0.04] text-teal-900/65";
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

function OpportunitySignal({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string | null;
}) {
  return (
    <div className="inline-flex min-w-0 max-w-full items-start gap-1.5">
      <span className="mt-0.5 text-teal-800/70">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold leading-4 text-teal-950">
          {title}
        </p>
        {detail ? (
          <p className="text-[10px] leading-4 text-teal-950/45">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function OpportunitySummaryMetric({
  value,
  label,
  icon,
  toneClass,
}: {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  toneClass: string;
}) {
  return (
    <div className="min-w-[6.5rem] flex-1 rounded-xl border border-teal-900/8 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5">
        <p className={`text-xl font-bold leading-none ${toneClass}`}>{value}</p>
        {icon}
      </div>
      <p className="mt-1 text-[11px] leading-4 text-teal-950/50">{label}</p>
    </div>
  );
}

function OpportunityCard({
  item,
  onWatchlistToggle,
  busy,
  canSave,
  saveError,
  view,
}: {
  item: OpportunityFeedItem;
  onWatchlistToggle: (requestId: string, add: boolean) => void;
  busy: string | null;
  canSave: boolean;
  saveError: string | null;
  view: OpportunityHubView;
}) {
  const fitReasons = matchReasonList(item);
  const detailHref = opportunityRequestDetailHref(item.requestId);
  const hasGroundedMatch =
    item.matchScore != null && item.matchReasons.length > 0;
  const fitLabel = fitBadgeLabel(item.intelligence.fitLevel);
  const showFitBadge = Boolean(fitLabel);
  const showGeneralBadge =
    !showFitBadge && (view === "browse" || !hasGroundedMatch);
  const confidenceLabel = dataConfidenceLabel(item.intelligence.confidence);
  const signalScore = item.intelligence.opportunityScore;
  const riskLabel = compactRiskLabel(item);
  const actionHint =
    item.intelligence.recommendedAction === "REVIEW_REQUEST"
      ? null
      : ACTION_LABELS[item.intelligence.recommendedAction];

  return (
    <article className="rounded-2xl border border-teal-900/10 bg-white p-3 shadow-[0_1px_2px_rgba(15,47,40,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <CategoryVisualThumb
          categorySlug={item.categorySlug}
          categoryName={item.categoryName}
          coverImageUrl={item.coverImageUrl}
          requestTitle={item.title}
          size="sm"
          allowCategoryStockImage
          className="self-start"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {showFitBadge ? (
              <OpportunityBadge
                tone={
                  item.intelligence.fitLevel === "LIMITED" ? "limited" : "match"
                }
              >
                {fitLabel}
              </OpportunityBadge>
            ) : showGeneralBadge ? (
              <OpportunityBadge tone="neutral">Genel fırsat</OpportunityBadge>
            ) : null}
            {item.isUrgent ? (
              <OpportunityBadge tone="urgent">Acil</OpportunityBadge>
            ) : null}
          </div>

          {detailHref ? (
            <Link
              href={detailHref}
              className="mt-1.5 block truncate rounded-sm text-sm font-semibold text-teal-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            >
              {item.title}
            </Link>
          ) : (
            <p className="mt-1.5 truncate text-sm font-semibold text-teal-950">
              {item.title}
            </p>
          )}

          <p className="mt-0.5 truncate text-xs text-teal-950/45">
            {item.categoryName}
            {item.city ? ` · ${item.city}` : ""}
          </p>

          {item.budgetLabel ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-bold text-teal-950">
                {item.budgetLabel}
              </p>
              <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
                Bütçe belirtilmiş
              </span>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            <OpportunitySignal
              icon={<Gauge className="h-3.5 w-3.5" aria-hidden />}
              title={`${COMPETITION_LABELS[item.competition]} · ${item.offerCount} teklif`}
            />
            <OpportunitySignal
              icon={<Shield className="h-3.5 w-3.5" aria-hidden />}
              title={`Veri güveni ${confidenceLabel}`}
              detail={`Sinyal ${signalScore}/100`}
            />
            <OpportunitySignal
              icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
              title={freshnessLabel(item)}
            />
          </div>

          {fitReasons.length > 0 ? (
            <ul className="mt-2 space-y-0.5">
              {fitReasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-1.5 text-[11px] leading-4 text-teal-950/70"
                >
                  <Check
                    className="mt-0.5 h-3 w-3 shrink-0 text-teal-700"
                    aria-hidden
                  />
                  <span className="line-clamp-1">{reason}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {riskLabel || actionHint ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-teal-950/45">
              {riskLabel ? (
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-700" aria-hidden />
                  {riskLabel}
                </span>
              ) : null}
              <span>{actionHint}</span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-[9.75rem] md:items-end">
          {detailHref ? (
            <Link
              href={detailHref}
              className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-teal-900 px-3 text-xs font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 md:w-auto"
            >
              Talebi incele →
            </Link>
          ) : null}
          {canSave ? (
            <div className="md:w-full">
              <button
                type="button"
                disabled={busy === item.requestId}
                onClick={() =>
                  onWatchlistToggle(item.requestId, !item.isWatchlisted)
                }
                title="Talebi kaydet (watchlist) — kayıtlı aramalardan ayrıdır"
                className={`inline-flex h-8 w-full items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold transition ${
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
                <p className="mt-1 text-[11px] font-medium text-rose-700">
                  {saveError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
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
  chrome = "full",
  metrics,
}: {
  title: string;
  icon: React.ReactNode;
  items: OpportunityFeedItem[];
  empty: React.ReactNode;
  showEmpty?: boolean;
  renderItem: (item: OpportunityFeedItem) => React.ReactNode;
  chrome?: "full" | "plain";
  metrics?: React.ReactNode;
}) {
  if (items.length === 0 && !showEmpty) return null;
  return (
    <section
      className={
        chrome === "full"
          ? "rounded-[28px] border border-teal-900/8 bg-white p-5 sm:p-6"
          : "space-y-3"
      }
    >
      {chrome === "full" ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-lg font-semibold text-teal-950">{title}</h2>
          </div>
        </div>
      ) : null}
      {metrics}
      <div className={chrome === "full" ? "mt-4 space-y-2.5" : "space-y-2.5"}>
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
        geniş liste için Diğer Fırsatlar veya Acil sekmelerine bakabilirsiniz.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/panel/firsatlar?view=browse"
          className="inline-flex h-10 items-center rounded-xl bg-teal-900 px-4 text-xs font-semibold text-white transition hover:bg-teal-800"
        >
          Diğer Fırsatlar →
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

function FeedSummaryStrip({ items }: { items: OpportunityFeedItem[] }) {
  if (items.length === 0) return null;
  const summary = buildOpportunityHubSummary(items);
  const confidenceLabel =
    summary.strongestSignalConfidence != null
      ? dataConfidenceLabel(summary.strongestSignalConfidence)
      : null;

  return (
    <div className="flex flex-wrap gap-2">
      <OpportunitySummaryMetric
        value={summary.recommendedCount}
        label="Önerilen fırsat"
        toneClass="text-teal-800"
      />
      <OpportunitySummaryMetric
        value={summary.newCount == null ? "—" : summary.newCount}
        label="Yeni"
        icon={<TrendingUp className="h-3.5 w-3.5 text-sky-600" aria-hidden />}
        toneClass="text-sky-700"
      />
      <OpportunitySummaryMetric
        value={summary.urgentCount}
        label="Acil"
        icon={<Zap className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
        toneClass="text-amber-700"
      />
      <OpportunitySummaryMetric
        value={
          summary.strongestSignalScore != null
            ? `${summary.strongestSignalScore}/100`
            : "—"
        }
        label={
          confidenceLabel
            ? `En güçlü sinyal · Veri güveni ${confidenceLabel}`
            : "En güçlü sinyal"
        }
        icon={<Shield className="h-3.5 w-3.5 text-teal-700" aria-hidden />}
        toneClass="text-teal-800"
      />
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
      ? surface === "PERSONAL"
        ? "Diğer fırsatlar"
        : "Keşif"
      : view === "urgent"
        ? "Acil talepler"
        : "Sana önerilen fırsatlar";

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
        view={view}
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
            "Şu an gösterilecek başka açık fırsat yok."
          )
        }
        showEmpty
        chrome="plain"
        metrics={<FeedSummaryStrip items={feed} />}
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
