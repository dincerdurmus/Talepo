/**
 * Preference-driven candidate retrieval for Personal Opportunity Center.
 * Expands recall beyond the global newest-open window. Does NOT decide
 * recommendation eligibility — final truth remains matchPersonalAgainstPreferences
 * / matchPersonalToRequest plus the hub eligibility helpers.
 */

import { parseDiscoveryProjection } from "@/lib/discovery";
import {
  evaluatePreferenceCriteria,
  hasPreferenceSignal,
} from "@/lib/monetization/preference-criteria";
import { prisma } from "@/lib/prisma";

import type { PersonalPreferenceFilter } from "./personal-matching-core";

/** Max open requests scanned for preference evaluation (bounded). */
export const PERSONAL_PREFERENCE_SCAN_LIMIT = 120;

/** Max preference-sourced candidate ids merged into the feed universe. */
export const PERSONAL_PREFERENCE_CANDIDATE_CAP = 60;

function categorySlugsFromCriteria(criteria: PersonalPreferenceFilter["criteria"]): string[] {
  const slugs = new Set<string>();
  const nodeIds = [
    ...(criteria.canonical?.taxonomyNodeIds ?? []),
    ...(criteria.canonical?.primaryLeafId ? [criteria.canonical.primaryLeafId] : []),
  ];
  for (const id of nodeIds) {
    const match = /^tax:([^:]+)/.exec(id);
    if (match?.[1]) slugs.add(match[1]);
  }
  const raw = (criteria.categorySlug ?? criteria.categoryId ?? "").trim();
  if (raw) {
    slugs.add(raw.replace(/^tax:/, "").split(":")[0]!);
  }
  return [...slugs];
}

function collectCategorySlugs(
  preferences: readonly PersonalPreferenceFilter[],
): string[] {
  const slugs = new Set<string>();
  for (const preference of preferences) {
    for (const slug of categorySlugsFromCriteria(preference.criteria)) {
      slugs.add(slug);
    }
  }
  return [...slugs];
}

type OpenRequestWhere = {
  deletedAt: null;
  status: { in: ("PUBLISHED" | "RECEIVING_OFFERS")[] };
  createdById?: { not: string };
};

/**
 * Find open request ids that pass the shared preference-criteria evaluator
 * against any of the caller's grounded preferences. Coarse Prisma narrowing
 * by category slug when available; otherwise a bounded global scan.
 */
export async function collectPersonalPreferenceCandidateIds(input: {
  preferences: readonly PersonalPreferenceFilter[];
  openWhere: OpenRequestWhere;
  scanLimit?: number;
  candidateCap?: number;
}): Promise<string[]> {
  const preferences = input.preferences.filter((preference) =>
    hasPreferenceSignal(preference.criteria),
  );
  if (preferences.length === 0) return [];

  const scanLimit = input.scanLimit ?? PERSONAL_PREFERENCE_SCAN_LIMIT;
  const candidateCap = input.candidateCap ?? PERSONAL_PREFERENCE_CANDIDATE_CAP;
  const categorySlugs = collectCategorySlugs(preferences);

  const rows = await prisma.request.findMany({
    where: {
      ...input.openWhere,
      ...(categorySlugs.length > 0
        ? { category: { slug: { in: categorySlugs } } }
        : {}),
    },
    orderBy: [{ isUrgent: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: scanLimit,
    select: {
      id: true,
      title: true,
      description: true,
      city: true,
      district: true,
      budgetMin: true,
      budgetMax: true,
      isUrgent: true,
      createdById: true,
      companyId: true,
      discoveryProjection: true,
    },
  });

  const matchedIds: string[] = [];
  for (const row of rows) {
    const projection = parseDiscoveryProjection(row.discoveryProjection);
    const facts = {
      title: row.title,
      description: row.description,
      city: row.city,
      district: row.district,
      budgetMin: row.budgetMin?.toNumber() ?? null,
      budgetMax: row.budgetMax?.toNumber() ?? null,
      isUrgent: row.isUrgent,
      createdById: row.createdById,
      companyId: row.companyId,
    };
    const hits = preferences.some(
      (preference) =>
        evaluatePreferenceCriteria({
          projection,
          facts,
          criteria: preference.criteria,
        }).match,
    );
    if (!hits) continue;
    matchedIds.push(row.id);
    if (matchedIds.length >= candidateCap) break;
  }

  return matchedIds;
}
