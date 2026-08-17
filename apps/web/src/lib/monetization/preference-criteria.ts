/**
 * Single criteria authority for SavedSearch, AlertRule, and Personal
 * Opportunity matching. Does not invent a second schema — envelope is
 * SavedSearchFilters + CanonicalDiscoveryFilter.
 *
 * evaluateDiscoveryFilter remains the taxonomy/attribute brain.
 * Location, budget, keyword, and urgency are envelope fields with one
 * shared semantics used by Explore-run, alerts, and OC.
 */

import {
  evaluateDiscoveryFilter,
  hasCanonicalFilterSignal,
  parseDiscoveryProjection,
  validateCanonicalDiscoveryFilter,
  type RequestDiscoveryProjection,
} from "@/lib/discovery";

import { canonicalFilterFromSavedSearchFilters } from "./saved-search-canonical";
import type { SavedSearchFilters } from "./types";

export type PreferenceRequestFacts = {
  title?: string | null;
  description?: string | null;
  city?: string | null;
  district?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  isUrgent?: boolean;
  createdById?: string | null;
  companyId?: string | null;
};

export type PreferenceViewer = {
  userId?: string | null;
  companyId?: string | null;
};

export type PreferenceEvalResult = {
  match: boolean;
  reasons: string[];
};

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function locNorm(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

/** Free-text city/district: needle must be contained in haystack. Empty filter passes. */
export function locationMatches(
  requestCity: string | null | undefined,
  requestDistrict: string | null | undefined,
  filterCity: string | null | undefined,
  filterDistrict: string | null | undefined,
): boolean {
  const fc = trimOrNull(filterCity);
  if (fc) {
    const rc = locNorm(requestCity ?? "");
    if (!rc.includes(locNorm(fc))) return false;
  }
  const fd = trimOrNull(filterDistrict);
  if (fd) {
    const rd = locNorm(requestDistrict ?? "");
    if (!rd.includes(locNorm(fd))) return false;
  }
  return true;
}

/**
 * Explore range-overlap. If the filter has any budget bound and the request
 * has no budget at all → no match (do not treat missing budget as wildcard).
 */
export function budgetOverlaps(input: {
  requestMin: number | null | undefined;
  requestMax: number | null | undefined;
  filterMin: number | null | undefined;
  filterMax: number | null | undefined;
}): boolean {
  const filterMin = toFiniteNumber(input.filterMin);
  const filterMax = toFiniteNumber(input.filterMax);
  if (filterMin == null && filterMax == null) return true;

  const requestMin = toFiniteNumber(input.requestMin);
  const requestMax = toFiniteNumber(input.requestMax);
  if (requestMin == null && requestMax == null) return false;

  if (filterMin != null) {
    const hitsMin =
      (requestMax != null && requestMax >= filterMin) ||
      (requestMin != null && requestMin >= filterMin);
    if (!hitsMin) return false;
  }
  if (filterMax != null) {
    const hitsMax =
      (requestMin != null && requestMin <= filterMax) ||
      (requestMax != null && requestMax <= filterMax);
    if (!hitsMax) return false;
  }
  return true;
}

export function validateBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
): { ok: true } | { ok: false; message: string } {
  const filterMin = toFiniteNumber(min);
  const filterMax = toFiniteNumber(max);
  if (filterMin != null && filterMax != null && filterMin > filterMax) {
    return { ok: false, message: "Minimum bütçe maksimum bütçeden büyük olamaz." };
  }
  return { ok: true };
}

/**
 * One keyword helper for Explore `q`, SavedSearch.keyword, and AlertRule.keywords.
 * Delimiters (, ; |) split OR-of-phrases; a single phrase is contains-match
 * (same as Explore `q`). Turkish locale, no second parser/subject engine.
 */
export function keywordMatches(
  haystack: string,
  keyword: string | null | undefined,
): boolean {
  const raw = trimOrNull(keyword);
  if (!raw) return true;
  const hay = locNorm(haystack);
  const parts = raw
    .split(/[,;|]+/)
    .map((part) => locNorm(part))
    .filter(Boolean);
  if (parts.length === 0) return true;
  return parts.some((part) => hay.includes(part));
}

export function hasPreferenceSignal(
  filters: SavedSearchFilters | null | undefined,
): boolean {
  if (!filters) return false;
  if (hasCanonicalFilterSignal(filters.canonical)) return true;
  if (trimOrNull(filters.categorySlug) || trimOrNull(filters.categoryId)) {
    return true;
  }
  if (trimOrNull(filters.city) || trimOrNull(filters.district)) return true;
  if (toFiniteNumber(filters.budgetMin) != null || toFiniteNumber(filters.budgetMax) != null) {
    return true;
  }
  if (trimOrNull(filters.keyword)) return true;
  if (filters.urgent) return true;
  if (filters.attributes && Object.keys(filters.attributes).length > 0) return true;
  return false;
}

function mergeAttributes(
  canonicalAttrs: Record<string, string> | undefined,
  envelopeAttrs: SavedSearchFilters["attributes"],
): Record<string, string> | undefined {
  const out: Record<string, string> = { ...(canonicalAttrs ?? {}) };
  if (envelopeAttrs) {
    for (const [key, value] of Object.entries(envelopeAttrs)) {
      if (value === "" || value == null) continue;
      out[key] = String(value);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizePreferenceCriteria(
  filters: SavedSearchFilters,
): { ok: true; filters: SavedSearchFilters } | { ok: false; message: string } {
  const budget = validateBudgetRange(filters.budgetMin, filters.budgetMax);
  if (!budget.ok) return budget;

  const city = trimOrNull(filters.city);
  const district = trimOrNull(filters.district);
  const keyword = trimOrNull(filters.keyword);

  let canonical = filters.canonical;
  if (canonical) {
    const validated = validateCanonicalDiscoveryFilter(canonical);
    if (!validated.ok) {
      return {
        ok: false,
        message: validated.errors[0] ?? "Geçersiz canonical filter.",
      };
    }
    canonical = validated.filter;
  }

  const lifted = canonicalFilterFromSavedSearchFilters({
    ...filters,
    canonical,
  });
  if (lifted) canonical = lifted;

  const mergedAttrs = mergeAttributes(canonical?.attributes, filters.attributes);
  if (canonical && mergedAttrs) {
    canonical = { ...canonical, attributes: mergedAttrs };
  }

  if (canonical && (city || district) && !canonical.location) {
    canonical = {
      ...canonical,
      location: {
        ...(city ? { city } : {}),
        ...(district ? { district } : {}),
      },
    };
  }
  if (canonical && filters.urgent && !canonical.urgency) {
    canonical = { ...canonical, urgency: true };
  }

  const envelopeAttrs = filters.attributes
    ? Object.fromEntries(
        Object.entries(filters.attributes).filter(
          ([, value]) => value !== "" && value != null,
        ),
      )
    : undefined;

  return {
    ok: true,
    filters: {
      ...filters,
      version: 1,
      city: city ?? undefined,
      district: district ?? undefined,
      keyword: keyword ?? undefined,
      budgetMin: toFiniteNumber(filters.budgetMin) ?? undefined,
      budgetMax: toFiniteNumber(filters.budgetMax) ?? undefined,
      urgent: filters.urgent || undefined,
      attributes:
        envelopeAttrs && Object.keys(envelopeAttrs).length > 0
          ? envelopeAttrs
          : undefined,
      ...(canonical ? { canonical } : {}),
    },
  };
}

export function criteriaFromAlertRule(rule: {
  categorySlug?: string | null;
  city?: string | null;
  district?: string | null;
  minBudget?: number | { toNumber(): number } | null;
  maxBudget?: number | { toNumber(): number } | null;
  keywords?: string | null;
  attributes?: unknown;
  discoveryFilter?: unknown;
}): SavedSearchFilters {
  const min =
    rule.minBudget == null
      ? undefined
      : typeof rule.minBudget === "number"
        ? rule.minBudget
        : rule.minBudget.toNumber();
  const max =
    rule.maxBudget == null
      ? undefined
      : typeof rule.maxBudget === "number"
        ? rule.maxBudget
        : rule.maxBudget.toNumber();
  const attrs =
    rule.attributes &&
    typeof rule.attributes === "object" &&
    !Array.isArray(rule.attributes)
      ? (rule.attributes as Record<string, string | number | boolean>)
      : undefined;

  const raw: SavedSearchFilters = {
    version: 1,
    categorySlug: rule.categorySlug ?? undefined,
    city: rule.city ?? undefined,
    district: rule.district ?? undefined,
    budgetMin: min,
    budgetMax: max,
    keyword: rule.keywords ?? undefined,
    attributes: attrs,
    canonical: rule.discoveryFilter as SavedSearchFilters["canonical"],
  };
  const normalized = normalizePreferenceCriteria(raw);
  return normalized.ok ? normalized.filters : raw;
}

export function preferenceCriteriaFingerprint(filters: SavedSearchFilters): string {
  const normalized = normalizePreferenceCriteria(filters);
  const f = normalized.ok ? normalized.filters : filters;
  return JSON.stringify({
    canonical: f.canonical ?? null,
    city: f.city ?? null,
    district: f.district ?? null,
    budgetMin: f.budgetMin ?? null,
    budgetMax: f.budgetMax ?? null,
    keyword: f.keyword ?? null,
    urgent: Boolean(f.urgent),
    attributes: f.attributes ?? null,
    categorySlug: f.categorySlug ?? f.categoryId ?? null,
  });
}

/** Legacy AlertRule columns written alongside canonical discoveryFilter. */
export function criteriaToAlertRuleColumns(filters: SavedSearchFilters): {
  city: string | null;
  district: string | null;
  minBudget: number | null;
  maxBudget: number | null;
  keywords: string | null;
  attributes: Record<string, string | number | boolean> | null;
  discoveryFilter: SavedSearchFilters["canonical"] | null;
  categorySlug: string | null;
} {
  const normalized = normalizePreferenceCriteria(filters);
  const f = normalized.ok ? normalized.filters : filters;
  return {
    city: f.city ?? null,
    district: f.district ?? null,
    minBudget: toFiniteNumber(f.budgetMin),
    maxBudget: toFiniteNumber(f.budgetMax),
    keywords: f.keyword ?? null,
    attributes: f.attributes ?? null,
    discoveryFilter: f.canonical ?? null,
    categorySlug: f.categorySlug ?? f.categoryId ?? null,
  };
}

export function alertNotificationActionUrl(
  requestId: string,
  alertRuleId: string,
): string {
  return `/panel/talepler/${requestId}?alertRule=${encodeURIComponent(alertRuleId)}`;
}

function envelopeCity(filters: SavedSearchFilters): string | null {
  return trimOrNull(filters.city) ?? trimOrNull(filters.canonical?.location?.city);
}

function envelopeDistrict(filters: SavedSearchFilters): string | null {
  return (
    trimOrNull(filters.district) ??
    trimOrNull(filters.canonical?.location?.district)
  );
}

/**
 * Full preference truth: taxonomy/attributes via evaluateDiscoveryFilter,
 * plus shared location / budget / keyword / urgency envelope checks.
 */
export function evaluatePreferenceCriteria(input: {
  projection: RequestDiscoveryProjection | null | undefined;
  facts: PreferenceRequestFacts;
  criteria: SavedSearchFilters;
  viewer?: PreferenceViewer;
}): PreferenceEvalResult {
  const { facts, viewer } = input;
  if (viewer?.userId && facts.createdById && viewer.userId === facts.createdById) {
    return { match: false, reasons: ["own-request"] };
  }
  if (
    viewer?.companyId &&
    facts.companyId &&
    viewer.companyId === facts.companyId
  ) {
    return { match: false, reasons: ["own-company-request"] };
  }

  const normalized = normalizePreferenceCriteria(input.criteria);
  if (!normalized.ok) return { match: false, reasons: ["invalid-criteria"] };
  const criteria = normalized.filters;
  if (!hasPreferenceSignal(criteria)) {
    return { match: false, reasons: ["no-signal"] };
  }

  const reasons: string[] = [];
  const canonical = criteria.canonical;
  if (canonical && hasCanonicalFilterSignal(canonical)) {
    const projection =
      input.projection ?? parseDiscoveryProjection(undefined);
    const evalResult = evaluateDiscoveryFilter(projection, canonical);
    if (!evalResult.match) {
      return { match: false, reasons: evalResult.reasons };
    }
    reasons.push(...evalResult.reasons.slice(0, 3));
  }

  if (
    !locationMatches(
      facts.city,
      facts.district,
      envelopeCity(criteria),
      envelopeDistrict(criteria),
    )
  ) {
    return { match: false, reasons: ["location-mismatch"] };
  }

  if (
    !budgetOverlaps({
      requestMin: facts.budgetMin,
      requestMax: facts.budgetMax,
      filterMin: criteria.budgetMin,
      filterMax: criteria.budgetMax,
    })
  ) {
    return { match: false, reasons: ["budget-mismatch"] };
  }

  const haystack = `${facts.title ?? ""} ${facts.description ?? ""}`;
  if (!keywordMatches(haystack, criteria.keyword)) {
    return { match: false, reasons: ["keyword-mismatch"] };
  }

  if ((criteria.urgent || canonical?.urgency) && !facts.isUrgent) {
    return { match: false, reasons: ["urgency-mismatch"] };
  }

  return { match: true, reasons: reasons.length ? reasons : ["envelope-ok"] };
}
