import {
  evaluateDiscoveryFilter,
  type CanonicalDiscoveryFilter,
  type RequestDiscoveryProjection,
} from "@/lib/discovery";

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
  filter: CanonicalDiscoveryFilter;
};

/**
 * Final personal match truth against already-loaded preference filters.
 * Same evaluateDiscoveryFilter rules as matchPersonalToRequest.
 * Pure — no Prisma (safe for verifiers / batch feed scoring).
 */
export function matchPersonalAgainstPreferences(
  projection: RequestDiscoveryProjection | null | undefined,
  preferences: readonly PersonalPreferenceFilter[],
): PersonalMatchResult {
  if (!projection) {
    return {
      source: "PERSONAL",
      score: null,
      reasons: [],
      missingInformation: ["Talep için canonical keşif verisi yok."],
    };
  }

  const reasons: string[] = [];
  for (const preference of preferences) {
    const result = evaluateDiscoveryFilter(projection, preference.filter);
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
      missingInformation:
        preferences.length === 0
          ? ["Bu kullanıcı için yeterli kişisel tercih sinyali yok."]
          : ["Mevcut kişisel tercihlerle eşleşen sinyal bulunamadı."],
    };
  }

  return {
    source: "PERSONAL",
    // Exact canonical preference matches are explicit relevance signals,
    // not a probabilistic confidence percentage.
    score: 100,
    reasons: [...new Set(reasons)].slice(0, 3),
    missingInformation: [],
  };
}
