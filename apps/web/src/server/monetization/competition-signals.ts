import type { CompetitionSignalResult } from "@/lib/monetization/types";

/**
 * Anonymous competition signals — never expose competitor prices or names.
 */
export function getCompetitionSignals(input: {
  offerCount: number;
  viewCount?: number | null;
}): CompetitionSignalResult {
  const offerCount = Math.max(0, input.offerCount);
  let estimatedCompetition: CompetitionSignalResult["estimatedCompetition"] =
    "LOW";

  if (offerCount >= 6) estimatedCompetition = "HIGH";
  else if (offerCount >= 3) estimatedCompetition = "MEDIUM";

  return {
    offerCount,
    viewCount: input.viewCount ?? null,
    estimatedCompetition,
  };
}
