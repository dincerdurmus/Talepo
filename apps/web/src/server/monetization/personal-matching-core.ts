import {
  type RequestDiscoveryProjection,
} from "@/lib/discovery";
import {
  evaluatePreferenceCriteria,
  hasPreferenceSignal,
  type PreferenceRequestFacts,
  type PreferenceViewer,
} from "@/lib/monetization/preference-criteria";
import type { SavedSearchFilters } from "@/lib/monetization/types";

export const PERSONAL_SAVED_SEARCH_MATCH_REASON_PREFIX =
  "Kayıtlı aramanızla eşleşiyor:";

export function formatPersonalSavedSearchMatchReason(name: string): string {
  return `${PERSONAL_SAVED_SEARCH_MATCH_REASON_PREFIX} ${name}`;
}

export function formatPersonalAlertRuleMatchReason(name: string): string {
  return `Alarm tercihinizle eşleşiyor: ${name}`;
}

export type PersonalMatchResult = {
  source: "PERSONAL";
  score: number | null;
  reasons: string[];
  missingInformation: string[];
};

export type PersonalPreferenceFilter = {
  kind: "saved_search" | "alert_rule";
  name: string;
  criteria: SavedSearchFilters;
};

/**
 * Final personal match truth. Uses the shared preference-criteria evaluator
 * (taxonomy via evaluateDiscoveryFilter + location/budget/keyword/urgency).
 */
export function matchPersonalAgainstPreferences(
  projection: RequestDiscoveryProjection | null | undefined,
  preferences: readonly PersonalPreferenceFilter[],
  facts: PreferenceRequestFacts = {},
  viewer?: PreferenceViewer,
): PersonalMatchResult {
  const grounded = preferences.filter((preference) =>
    hasPreferenceSignal(preference.criteria),
  );

  if (grounded.length === 0) {
    return {
      source: "PERSONAL",
      score: null,
      reasons: [],
      missingInformation: ["Bu kullanıcı için yeterli kişisel tercih sinyali yok."],
    };
  }

  const reasons: string[] = [];
  for (const preference of grounded) {
    const result = evaluatePreferenceCriteria({
      projection,
      facts,
      criteria: preference.criteria,
      viewer,
    });
    if (!result.match) continue;
    reasons.push(
      preference.kind === "saved_search"
        ? formatPersonalSavedSearchMatchReason(preference.name)
        : formatPersonalAlertRuleMatchReason(preference.name),
    );
  }

  if (reasons.length === 0) {
    return {
      source: "PERSONAL",
      score: null,
      reasons: [],
      missingInformation: ["Mevcut kişisel tercihlerle eşleşen sinyal bulunamadı."],
    };
  }

  return {
    source: "PERSONAL",
    score: 100,
    reasons: [...new Set(reasons)].slice(0, 3),
    missingInformation: [],
  };
}
