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
