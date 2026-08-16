import {
  hasCanonicalFilterSignal,
  parseDiscoveryProjection,
  validateCanonicalDiscoveryFilter,
} from "@/lib/discovery";
import { canonicalFilterFromSavedSearchFilters } from "@/lib/monetization/saved-search-canonical";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import { prisma } from "@/lib/prisma";

import {
  matchPersonalAgainstPreferences,
  type PersonalMatchResult,
  type PersonalPreferenceFilter,
} from "./personal-matching-core";

export {
  formatPersonalAlertRuleMatchReason,
  formatPersonalSavedSearchMatchReason,
  matchPersonalAgainstPreferences,
  PERSONAL_SAVED_SEARCH_MATCH_REASON_PREFIX,
  type PersonalMatchResult,
  type PersonalPreferenceFilter,
} from "./personal-matching-core";

/**
 * Load USER-owned active preference filters once.
 * Shared by final matching and preference-driven candidate retrieval —
 * does not invent a second match rule set.
 */
export async function loadPersonalPreferenceFilters(
  userId: string,
): Promise<PersonalPreferenceFilter[]> {
  const [savedSearches, alertRules] = await Promise.all([
    prisma.savedSearch.findMany({
      where: { ownerType: "USER", userId, isActive: true },
      select: { name: true, filters: true },
      take: 100,
    }),
    prisma.alertRule.findMany({
      where: { ownerType: "USER", userId, isActive: true },
      select: {
        name: true,
        discoveryFilter: true,
        category: { select: { slug: true } },
      },
      take: 100,
    }),
  ]);

  const out: PersonalPreferenceFilter[] = [];

  for (const search of savedSearches) {
    const filters = search.filters as SavedSearchFilters;
    const resolved = canonicalFilterFromSavedSearchFilters(filters);
    const canonical = validateCanonicalDiscoveryFilter(resolved);
    if (!canonical.ok || !hasCanonicalFilterSignal(canonical.filter)) continue;
    out.push({
      kind: "saved_search",
      name: search.name,
      filter: canonical.filter,
    });
  }

  for (const rule of alertRules) {
    const resolved = canonicalFilterFromSavedSearchFilters({
      categorySlug: rule.category?.slug,
      canonical: rule.discoveryFilter,
    });
    const canonical = validateCanonicalDiscoveryFilter(resolved);
    if (!canonical.ok || !hasCanonicalFilterSignal(canonical.filter)) continue;
    out.push({
      kind: "alert_rule",
      name: rule.name,
      filter: canonical.filter,
    });
  }

  return out;
}

/**
 * Personal relevance authority. It only consumes explicit USER-owned
 * saved-search and alert filters; workspace/company data never enters here.
 */
export async function matchPersonalToRequest(
  userId: string,
  requestId: string,
): Promise<PersonalMatchResult> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { discoveryProjection: true },
  });

  if (!request) {
    return {
      source: "PERSONAL",
      score: null,
      reasons: [],
      missingInformation: ["Talep eşleşme görünümü için bulunamadı."],
    };
  }

  const preferences = await loadPersonalPreferenceFilters(userId);
  const projection = parseDiscoveryProjection(request.discoveryProjection);
  return matchPersonalAgainstPreferences(projection, preferences);
}
