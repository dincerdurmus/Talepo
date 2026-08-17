/**
 * Canonical user-facing Analiz calculations.
 * Admin health and BUSINESS_METRICS remain separate platform vocabularies.
 *
 * Win rate (Analiz):
 *   cohort = offers with submittedAt in [from, to], status !== DRAFT
 *   denominator = cohort size
 *   numerator = cohort rows whose current status is ACCEPTED
 * Mixed-window (acceptedAt in period / submittedAt in period) is forbidden.
 */

export const ANALIZ_MIN_WIN_RATE_SAMPLE = 3;
/** Percent / ranking insights require at least this many observations. */
export const ANALIZ_MIN_INSIGHT_SAMPLE = 3;
/** Category ranking copy requires a higher bar. */
export const ANALIZ_MIN_CATEGORY_RANK_SAMPLE = 5;
/** Max deterministic insights on the Pro surface. */
export const ANALIZ_MAX_INSIGHTS = 4;

export type WinRatePresentation = "empty" | "counts" | "percent";

export type CohortWinRate = {
  submitted: number;
  accepted: number;
  rate: number | null;
  presentation: WinRatePresentation;
};

export const PENDING_OFFER_STATUSES = ["SUBMITTED", "VIEWED"] as const;
export const UNSUCCESSFUL_OFFER_STATUSES = ["EXPIRED", "WITHDRAWN"] as const;

export type OfferStatusCountMap = Partial<Record<string, number>>;

export type OfferPerformanceBreakdown = {
  submitted: number;
  accepted: number;
  pending: number;
  rejected: number;
  unsuccessful: number;
  winRate: number | null;
  winRatePresentation: WinRatePresentation;
};

export function countByStatus(
  counts: OfferStatusCountMap,
  statuses: readonly string[],
): number {
  let total = 0;
  for (const status of statuses) {
    total += counts[status] ?? 0;
  }
  return total;
}

export function submittedCohortSize(counts: OfferStatusCountMap): number {
  let total = 0;
  for (const [status, n] of Object.entries(counts)) {
    if (status === "DRAFT") continue;
    total += n ?? 0;
  }
  return total;
}

/**
 * Cohort win rate: accepted-now / submitted-in-window.
 * Low-n keeps the numeric rate for tests but presentation is count-first.
 */
export function cohortWinRate(
  acceptedInCohort: number,
  submittedInCohort: number,
  minSample = ANALIZ_MIN_WIN_RATE_SAMPLE,
): CohortWinRate {
  const submitted = Math.max(0, submittedInCohort);
  const accepted = Math.max(0, acceptedInCohort);

  if (submitted <= 0) {
    return {
      submitted: 0,
      accepted: 0,
      rate: null,
      presentation: "empty",
    };
  }

  const rate = accepted / submitted;
  if (!Number.isFinite(rate)) {
    return {
      submitted,
      accepted,
      rate: null,
      presentation: "empty",
    };
  }

  return {
    submitted,
    accepted,
    rate,
    presentation: submitted < minSample ? "counts" : "percent",
  };
}

export function summarizeOfferCohort(
  counts: OfferStatusCountMap,
): OfferPerformanceBreakdown {
  const submitted = submittedCohortSize(counts);
  const accepted = counts.ACCEPTED ?? 0;
  const win = cohortWinRate(accepted, submitted);

  return {
    submitted,
    accepted,
    pending: countByStatus(counts, PENDING_OFFER_STATUSES),
    rejected: counts.REJECTED ?? 0,
    unsuccessful: countByStatus(counts, UNSUCCESSFUL_OFFER_STATUSES),
    winRate: win.rate,
    winRatePresentation: win.presentation,
  };
}

export function formatWinRateValue(metrics: Pick<
  OfferPerformanceBreakdown,
  "accepted" | "submitted" | "winRate" | "winRatePresentation"
>): string {
  if (metrics.winRatePresentation === "empty" || metrics.submitted <= 0) {
    return "—";
  }
  if (metrics.winRatePresentation === "counts") {
    return `${metrics.accepted} / ${metrics.submitted}`;
  }
  return `%${Math.round((metrics.winRate ?? 0) * 100)}`;
}

export function formatWinRateHint(metrics: Pick<
  OfferPerformanceBreakdown,
  "accepted" | "submitted" | "winRatePresentation"
>): string | null {
  if (metrics.winRatePresentation === "counts") {
    return `${metrics.accepted} / ${metrics.submitted} teklif kabul edildi`;
  }
  return null;
}

export type CommercialInsight = {
  id: string;
  text: string;
};

export function averageRelativePriceDelta(
  rows: Array<{ firstAmount: number; agreedAmount: number }>,
): number | null {
  const usable = rows.filter(
    (row) =>
      Number.isFinite(row.firstAmount) &&
      Number.isFinite(row.agreedAmount) &&
      row.firstAmount > 0,
  );
  if (usable.length === 0) return null;
  const sum = usable.reduce(
    (acc, row) => acc + (row.agreedAmount - row.firstAmount) / row.firstAmount,
    0,
  );
  const avg = sum / usable.length;
  if (!Number.isFinite(avg)) return null;
  return Math.round(avg * 1000) / 1000;
}

export function formatRelativePriceDelta(delta: number | null): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  const pct = Math.round(delta * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}%${pct}`;
}

export function formatMoneyAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString("tr-TR", {
    maximumFractionDigits: 0,
  });
  if (currency === "TRY") return `₺${formatted}`;
  return `${formatted} ${currency}`;
}

/**
 * Deterministic insights only. No LLM. Suppress percent language when n is low.
 */
export function buildCommercialInsights(input: {
  submitted: number;
  accepted: number;
  completedInWindow: number;
  completedFromSubmittedCohort: number;
  negotiatedCompleted: number;
  directCompleted: number;
  negotiationDelta: number | null;
  negotiationDeltaSample: number;
  primaryVolumeTotal: number | null;
  primaryVolumeCurrency: string | null;
  topCategory: { name: string; submitted: number; accepted: number } | null;
}): CommercialInsight[] {
  const insights: CommercialInsight[] = [];

  if (input.submitted >= ANALIZ_MIN_INSIGHT_SAMPLE) {
    if (input.submitted >= ANALIZ_MIN_WIN_RATE_SAMPLE) {
      insights.push({
        id: "win-rate",
        text: `Son dönemde ${input.submitted} teklifinizden ${input.accepted}’i kabul edildi.`,
      });
    }
  } else if (input.accepted > 0 && input.submitted > 0) {
    insights.push({
      id: "accepted-count",
      text: `${input.accepted} teklifiniz kabul edildi.`,
    });
  }

  if (
    input.completedInWindow > 0 &&
    input.primaryVolumeTotal != null &&
    input.primaryVolumeCurrency
  ) {
    insights.push({
      id: "volume",
      text: `Tamamlanan ${input.completedInWindow} işleminizin toplam anlaşma tutarı ${formatMoneyAmount(input.primaryVolumeTotal, input.primaryVolumeCurrency)}.`,
    });
  } else if (input.completedInWindow === 0 && input.accepted > 0) {
    insights.push({
      id: "no-completed",
      text: "Kabul edilen teklifleriniz var; tamamlanan işlemler oluştukça ticaret hacminiz burada görünür.",
    });
  }

  if (
    input.completedInWindow >= ANALIZ_MIN_INSIGHT_SAMPLE &&
    input.negotiatedCompleted > 0
  ) {
    insights.push({
      id: "negotiation-share",
      text: `Tamamlanan ${input.completedInWindow} işlemin ${input.negotiatedCompleted}’inde karşı teklif kullanıldı.`,
    });
  }

  if (
    input.negotiationDelta != null &&
    input.negotiationDeltaSample >= ANALIZ_MIN_INSIGHT_SAMPLE
  ) {
    const label = formatRelativePriceDelta(input.negotiationDelta);
    if (label) {
      insights.push({
        id: "negotiation-delta",
        text: `Pazarlıkla tamamlanan işlemlerde ilk teklif ile anlaşma fiyatı arasındaki ortalama fark: ${label}.`,
      });
    }
  }

  if (
    input.topCategory &&
    input.topCategory.submitted >= ANALIZ_MIN_CATEGORY_RANK_SAMPLE
  ) {
    insights.push({
      id: "category",
      text: `${input.topCategory.name} kategorisinde ${input.topCategory.submitted} teklifinizden ${input.topCategory.accepted}’i kabul edildi.`,
    });
  }

  return insights.slice(0, ANALIZ_MAX_INSIGHTS);
}
