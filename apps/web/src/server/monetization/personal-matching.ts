import { parseDiscoveryProjection } from "@/lib/discovery";
import { criteriaFromAlertRule, normalizePreferenceCriteria, preferenceCriteriaFingerprint } from "@/lib/monetization/preference-criteria";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import { prisma } from "@/lib/prisma";

import {
  matchPersonalAgainstPreferences,
  type PersonalMatchResult,
  type PersonalPreferenceFilter,
} from "./personal-matching-core";

export {
  formatPersonalAlertRuleMatchReason,
  formatPersonalFollowMatchReason,
  formatPersonalSavedSearchMatchReason,
  matchPersonalAgainstPreferences,
  PERSONAL_FOLLOW_MATCH_REASON_PREFIX,
  PERSONAL_SAVED_SEARCH_MATCH_REASON_PREFIX,
  type PersonalMatchResult,
  type PersonalPreferenceFilter,
} from "./personal-matching-core";

/**
 * Load USER-owned active preference filters once.
 * Shared by final matching and preference-driven candidate retrieval.
 */
export async function loadPersonalPreferenceFilters(
  userId: string,
): Promise<PersonalPreferenceFilter[]> {
  const [savedSearches, alertRules] = await Promise.all([
    prisma.savedSearch.findMany({
      where: { ownerType: "USER", userId, isActive: true },
      select: { id: true, name: true, filters: true },
      take: 100,
    }),
    prisma.alertRule.findMany({
      where: { ownerType: "USER", userId, isActive: true },
      select: {
        id: true,
        name: true,
        discoveryFilter: true,
        city: true,
        district: true,
        minBudget: true,
        maxBudget: true,
        keywords: true,
        attributes: true,
        category: { select: { slug: true } },
      },
      take: 100,
    }),
  ]);

  const out: PersonalPreferenceFilter[] = [];

  for (const search of savedSearches) {
    const raw = search.filters as SavedSearchFilters;
    const normalized = normalizePreferenceCriteria(raw);
    const criteria = normalized.ok ? normalized.filters : raw;
    out.push({
      kind: "saved_search",
      id: search.id,
      name: search.name,
      criteria,
      fingerprint: preferenceCriteriaFingerprint(criteria),
    });
  }

  for (const rule of alertRules) {
    const criteria = criteriaFromAlertRule({
      categorySlug: rule.category?.slug,
      city: rule.city,
      district: rule.district,
      minBudget: rule.minBudget,
      maxBudget: rule.maxBudget,
      keywords: rule.keywords,
      attributes: rule.attributes,
      discoveryFilter: rule.discoveryFilter,
    });
    out.push({
      kind: "alert_rule",
      id: rule.id,
      name: rule.name,
      criteria,
      fingerprint: preferenceCriteriaFingerprint(criteria),
    });
  }

  return out;
}

export async function matchPersonalToRequest(
  userId: string,
  requestId: string,
): Promise<PersonalMatchResult> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      discoveryProjection: true,
      title: true,
      description: true,
      city: true,
      district: true,
      budgetMin: true,
      budgetMax: true,
      isUrgent: true,
      createdById: true,
      companyId: true,
    },
  });

  if (!request) {
    return {
      source: "PERSONAL",
      score: null,
      reasons: [],
      missingInformation: ["Talep eşleşme görünümü için bulunamadı."],
      matchedPreference: null,
    };
  }

  const preferences = await loadPersonalPreferenceFilters(userId);
  const projection = parseDiscoveryProjection(request.discoveryProjection);
  return matchPersonalAgainstPreferences(
    projection,
    preferences,
    {
      title: request.title,
      description: request.description,
      city: request.city,
      district: request.district,
      budgetMin: request.budgetMin?.toNumber() ?? null,
      budgetMax: request.budgetMax?.toNumber() ?? null,
      isUrgent: request.isUrgent,
      createdById: request.createdById,
      companyId: request.companyId,
    },
    { userId },
  );
}
