import {
  isRecommendedEligible,
  type OpportunityRecommendedSignal,
} from "@/lib/panel/opportunity-recommended-eligibility";

const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export type OpportunityHubSummaryItem = OpportunityRecommendedSignal & {
  publishedAt: Date | string | null;
  createdAt: Date | string;
  intelligence: {
    opportunityScore: number;
    confidence: number;
  };
};

export type OpportunityHubSummary = {
  recommendedCount: number;
  /** Last-24h freshness on the full feed. null = no usable publish dates. */
  newCount: number | null;
  urgentCount: number;
  /** Strongest opportunityScore among recommended items. null = none. */
  strongestSignalScore: number | null;
  strongestSignalConfidence: number | null;
};

function publishedTimeMs(
  item: Pick<OpportunityHubSummaryItem, "publishedAt" | "createdAt">,
): number | null {
  const raw = item.publishedAt ?? item.createdAt;
  if (raw == null || raw === "") return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : time;
}

export function isFreshOpportunity(
  item: Pick<OpportunityHubSummaryItem, "publishedAt" | "createdAt">,
  nowMs = Date.now(),
): boolean {
  const time = publishedTimeMs(item);
  if (time == null) return false;
  const age = nowMs - time;
  return age >= 0 && age <= FRESH_WINDOW_MS;
}

/**
 * Page-level Opportunity Center summary from the full feed / view-universe.
 * Do not compute this from the selected-tab slice.
 */
export function buildOpportunityHubSummary(
  items: readonly OpportunityHubSummaryItem[],
  nowMs = Date.now(),
): OpportunityHubSummary {
  const recommended = items.filter(isRecommendedEligible);
  let strongest: OpportunityHubSummaryItem | null = null;
  for (const item of recommended) {
    if (
      !strongest ||
      item.intelligence.opportunityScore > strongest.intelligence.opportunityScore
    ) {
      strongest = item;
    }
  }

  const dated = items.filter((item) => publishedTimeMs(item) != null);
  const newCount =
    items.length > 0 && dated.length === 0
      ? null
      : dated.filter((item) => isFreshOpportunity(item, nowMs)).length;

  return {
    recommendedCount: recommended.length,
    newCount,
    urgentCount: items.filter((item) => item.isUrgent).length,
    strongestSignalScore: strongest?.intelligence.opportunityScore ?? null,
    strongestSignalConfidence: strongest?.intelligence.confidence ?? null,
  };
}
