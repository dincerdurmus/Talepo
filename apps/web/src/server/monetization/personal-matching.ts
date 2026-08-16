import {
  evaluateDiscoveryFilter,
  hasCanonicalFilterSignal,
  parseDiscoveryProjection,
  validateCanonicalDiscoveryFilter,
} from "@/lib/discovery";
import { canonicalFilterFromSavedSearchFilters } from "@/lib/monetization/saved-search-canonical";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import { prisma } from "@/lib/prisma";

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

  const projection = parseDiscoveryProjection(request.discoveryProjection);
  if (!projection) {
    return {
      source: "PERSONAL",
      score: null,
      reasons: [],
      missingInformation: ["Talep için canonical keşif verisi yok."],
    };
  }

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

  const reasons: string[] = [];
  for (const search of savedSearches) {
    const filters = search.filters as SavedSearchFilters;
    const resolved = canonicalFilterFromSavedSearchFilters(filters);
    const canonical = validateCanonicalDiscoveryFilter(resolved);
    if (!canonical.ok || !hasCanonicalFilterSignal(canonical.filter)) continue;
    const result = evaluateDiscoveryFilter(projection, canonical.filter);
    if (result.match) {
      reasons.push(formatPersonalSavedSearchMatchReason(search.name));
    }
  }

  for (const rule of alertRules) {
    const resolved = canonicalFilterFromSavedSearchFilters({
      categorySlug: rule.category?.slug,
      canonical: rule.discoveryFilter,
    });
    const canonical = validateCanonicalDiscoveryFilter(resolved);
    if (!canonical.ok || !hasCanonicalFilterSignal(canonical.filter)) continue;
    const result = evaluateDiscoveryFilter(projection, canonical.filter);
    if (result.match) {
      reasons.push(formatPersonalAlertRuleMatchReason(rule.name));
    }
  }

  if (reasons.length === 0) {
    return {
      source: "PERSONAL",
      score: null,
      reasons: [],
      missingInformation:
        savedSearches.length === 0 && alertRules.length === 0
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
