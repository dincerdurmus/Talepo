import {
  type RequestDiscoveryProjection,
} from "@/lib/discovery";
import {
  evaluatePreferenceCriteria,
  hasPreferenceSignal,
  preferenceCriteriaFingerprint,
  type PreferenceRequestFacts,
  type PreferenceViewer,
} from "@/lib/monetization/preference-criteria";
import type { SavedSearchFilters } from "@/lib/monetization/types";

export const PERSONAL_FOLLOW_MATCH_REASON_PREFIX = "Takibinizle eşleşiyor:";

/** @deprecated Use PERSONAL_FOLLOW_MATCH_REASON_PREFIX — same user-facing copy. */
export const PERSONAL_SAVED_SEARCH_MATCH_REASON_PREFIX =
  PERSONAL_FOLLOW_MATCH_REASON_PREFIX;

export function formatPersonalFollowMatchReason(name: string): string {
  return `${PERSONAL_FOLLOW_MATCH_REASON_PREFIX} ${name}`;
}

export function formatPersonalSavedSearchMatchReason(name: string): string {
  return formatPersonalFollowMatchReason(name);
}

export function formatPersonalAlertRuleMatchReason(name: string): string {
  return formatPersonalFollowMatchReason(name);
}

export type PersonalMatchResult = {
  source: "PERSONAL";
  score: number | null;
  reasons: string[];
  missingInformation: string[];
  /** First grounded preference used for FOLLOW attribution (server-signed). */
  matchedPreference: {
    kind: "saved_search" | "alert_rule";
    id: string;
  } | null;
};

export type PersonalPreferenceFilter = {
  kind: "saved_search" | "alert_rule";
  /** SavedSearch.id or AlertRule.id — required for FOLLOW attribution in production. */
  id?: string;
  name: string;
  criteria: SavedSearchFilters;
  fingerprint?: string;
};

/**
 * Final personal match truth. Uses the shared preference-criteria evaluator
 * (taxonomy via evaluateDiscoveryFilter + location/budget/keyword/urgency).
 * Duplicate SavedSearch+AlertRule reasons for the same fingerprint collapse
 * to one follow reason.
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
      matchedPreference: null,
    };
  }

  const reasons: string[] = [];
  const seen = new Set<string>();
  let matchedPreference: PersonalMatchResult["matchedPreference"] = null;

  for (const preference of grounded) {
    const result = evaluatePreferenceCriteria({
      projection,
      facts,
      criteria: preference.criteria,
      viewer,
    });
    if (!result.match) continue;
    const key =
      preference.fingerprint ??
      preferenceCriteriaFingerprint(preference.criteria);
    if (seen.has(key)) continue;
    seen.add(key);
    reasons.push(formatPersonalFollowMatchReason(preference.name));
    if (!matchedPreference && preference.id) {
      matchedPreference = { kind: preference.kind, id: preference.id };
    }
  }

  if (reasons.length === 0) {
    return {
      source: "PERSONAL",
      score: null,
      reasons: [],
      missingInformation: ["Mevcut kişisel tercihlerle eşleşen sinyal bulunamadı."],
      matchedPreference: null,
    };
  }

  return {
    source: "PERSONAL",
    score: 100,
    reasons: reasons.slice(0, 3),
    missingInformation: [],
    matchedPreference,
  };
}
