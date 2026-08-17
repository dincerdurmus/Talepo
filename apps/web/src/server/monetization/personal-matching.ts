import { parseDiscoveryProjection } from "@/lib/discovery";
import { criteriaFromAlertRule, normalizePreferenceCriteria } from "@/lib/monetization/preference-criteria";
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
 * Shared by final matching and preference-driven candidate retrieval.
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
    out.push({
      kind: "saved_search",
      name: search.name,
      criteria: normalized.ok ? normalized.filters : raw,
    });
  }

  for (const rule of alertRules) {
    out.push({
      kind: "alert_rule",
      name: rule.name,
      criteria: criteriaFromAlertRule({
        categorySlug: rule.category?.slug,
        city: rule.city,
        district: rule.district,
        minBudget: rule.minBudget,
        maxBudget: rule.maxBudget,
        keywords: rule.keywords,
        attributes: rule.attributes,
        discoveryFilter: rule.discoveryFilter,
      }),
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
