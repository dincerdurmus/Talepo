/**
 * View-layer Opportunity Center eligibility.
 * Does not score, match, or invent relevance — it only reads feed fields
 * already produced by matchPersonalToRequest / matchCompanyToRequest /
 * scoreOpportunity.
 *
 * Personal Önerilen requires a grounded Personal match:
 * matchScore != null AND at least one matchReason.
 * Today Personal matching sets score 100 when any USER-owned saved-search
 * or alert evaluateDiscoveryFilter matches; otherwise score is null and
 * reasons are empty. Urgency, competition, budget, and freshness alone
 * must not admit a request into Personal Önerilen.
 *
 * Workspace Önerilen stays operational (HOT/GOOD classification), which
 * already incorporates company match when present. Personal saved-search
 * is never mixed into workspace.
 */

export type OpportunityHubView = "suggested" | "browse" | "urgent";

export type OpportunityRecommendedSignal = {
  context: "PERSONAL" | "WORKSPACE";
  matchScore: number | null;
  matchReasons: readonly string[];
  opportunityClassification: "NORMAL" | "GOOD" | "HOT";
  isUrgent: boolean;
};

export function hasGroundedPersonalMatch(
  item: Pick<OpportunityRecommendedSignal, "matchScore" | "matchReasons">,
): boolean {
  return item.matchScore != null && item.matchReasons.length > 0;
}

export function isPersonalRecommendedEligible(
  item: OpportunityRecommendedSignal,
): boolean {
  return item.context === "PERSONAL" && hasGroundedPersonalMatch(item);
}

export function isWorkspaceRecommendedEligible(
  item: OpportunityRecommendedSignal,
): boolean {
  return (
    item.context === "WORKSPACE" &&
    (item.opportunityClassification === "HOT" ||
      item.opportunityClassification === "GOOD")
  );
}

export function isRecommendedEligible(
  item: OpportunityRecommendedSignal,
): boolean {
  return item.context === "PERSONAL"
    ? isPersonalRecommendedEligible(item)
    : isWorkspaceRecommendedEligible(item);
}

export function selectOpportunityHubItems<T extends OpportunityRecommendedSignal>(
  items: readonly T[],
  view: OpportunityHubView,
): T[] {
  if (view === "browse") return [...items];
  if (view === "urgent") return items.filter((item) => item.isUrgent);
  return items.filter(isRecommendedEligible);
}

const COMPETITION_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

/**
 * Among already-eligible Personal recommendations, prefer explainable
 * existing signals: match, urgency, lower competition, freshness, then
 * the existing opportunityScore. No new score is computed.
 */
export function sortPersonalRecommended<
  T extends OpportunityRecommendedSignal & {
    publishedAt: Date | string | null;
    createdAt: Date | string;
    opportunityScore: number;
    competition: "LOW" | "MEDIUM" | "HIGH";
  },
>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const matchDiff = (b.matchScore ?? -1) - (a.matchScore ?? -1);
    if (matchDiff !== 0) return matchDiff;
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    const competitionDiff =
      COMPETITION_RANK[a.competition] - COMPETITION_RANK[b.competition];
    if (competitionDiff !== 0) return competitionDiff;
    const aTime = new Date(a.publishedAt ?? a.createdAt).getTime();
    const bTime = new Date(b.publishedAt ?? b.createdAt).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return b.opportunityScore - a.opportunityScore;
  });
}
