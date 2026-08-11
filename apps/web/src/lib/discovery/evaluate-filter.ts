/**
 * Evaluate CanonicalDiscoveryFilter against a RequestDiscoveryProjection.
 * Preferred is NEVER a hard reject. Legacy requests → LEGACY_FALLBACK.
 */

import { getTaxonomyDescendantIds } from "@/lib/taxonomy";

import type {
  CanonicalDiscoveryFilter,
  DiscoveryMatchResult,
  RequestDiscoveryProjection,
} from "./types";
import { hasCanonicalFilterSignal } from "./validate-filter";

function norm(s: string): string {
  return s.toLocaleLowerCase("tr-TR").trim();
}

function valuesOverlap(a: string[], b: string[]): boolean {
  const set = new Set(a.map(norm));
  return b.some((x) => set.has(norm(x)));
}

function attrEquals(
  projection: RequestDiscoveryProjection,
  key: string,
  expected: string,
): boolean {
  const got =
    projection.attributes[key] ??
    projection.constraints[key]?.value ??
    projection.entityRefs?.[key];
  if (!got) return false;
  return (
    norm(got) === norm(expected) || norm(got).includes(norm(expected))
  );
}

/**
 * Taxonomy match:
 * - leafExact + primaryLeafId → exact leaf only
 * - taxonomyNodeIds → request path includes node OR request leaf under filter node
 */
function taxonomyMatches(
  projection: RequestDiscoveryProjection,
  filter: CanonicalDiscoveryFilter,
): boolean {
  if (filter.leafExact && filter.primaryLeafId) {
    return projection.primaryLeafId === filter.primaryLeafId;
  }

  if (filter.primaryLeafId && !filter.taxonomyNodeIds?.length) {
    if (filter.leafExact) {
      return projection.primaryLeafId === filter.primaryLeafId;
    }
    // ancestor semantics for a single selected node
    return (
      projection.taxonomyNodeIds.includes(filter.primaryLeafId) ||
      (projection.primaryLeafId != null &&
        getTaxonomyDescendantIds(filter.primaryLeafId).includes(
          projection.primaryLeafId,
        ))
    );
  }

  if (!filter.taxonomyNodeIds?.length) return true;

  for (const filterNode of filter.taxonomyNodeIds) {
    // Request path includes this ancestor/leaf
    if (projection.taxonomyNodeIds.includes(filterNode)) return true;
    // Request leaf is under filter node
    if (
      projection.primaryLeafId &&
      getTaxonomyDescendantIds(filterNode).includes(projection.primaryLeafId)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Hard compatibility / filter evaluation for canonical projections.
 */
export function evaluateDiscoveryFilter(
  projection: RequestDiscoveryProjection | null | undefined,
  filter: CanonicalDiscoveryFilter | null | undefined,
): DiscoveryMatchResult {
  if (!hasCanonicalFilterSignal(filter)) {
    return {
      match: true,
      path: projection ? "CANONICAL_MATCH" : "LEGACY_FALLBACK",
      reasons: ["no-canonical-filter"],
    };
  }

  if (!projection) {
    return {
      match: true,
      path: "LEGACY_FALLBACK",
      reasons: ["legacy-request-no-projection"],
    };
  }

  const reasons: string[] = [];
  const f = filter!;

  if (!taxonomyMatches(projection, f)) {
    return {
      match: false,
      path: "CANONICAL_MATCH",
      reasons: ["taxonomy-mismatch"],
    };
  }
  reasons.push("taxonomy-ok");

  // Entity refs (soft includes — must all present when specified)
  if (f.entityRefs) {
    for (const [key, expected] of Object.entries(f.entityRefs)) {
      const got = projection.entityRefs?.[key];
      if (!got || norm(got) !== norm(expected)) {
        // Also allow attribute bag
        if (!attrEquals(projection, key, expected)) {
          return {
            match: false,
            path: "CANONICAL_MATCH",
            reasons: [`entity-mismatch:${key}`],
          };
        }
      }
    }
    reasons.push("entity-ok");
  }

  // Attribute includes (positive)
  if (f.attributes) {
    for (const [key, expected] of Object.entries(f.attributes)) {
      if (!attrEquals(projection, key, expected)) {
        return {
          match: false,
          path: "CANONICAL_MATCH",
          reasons: [`attr-mismatch:${key}`],
        };
      }
    }
    reasons.push("attributes-ok");
  }

  // MUST / include — hard
  if (f.mustIncludes) {
    for (const [key, required] of Object.entries(f.mustIncludes)) {
      const field = projection.constraints[key];
      // ANY on request means any value OK for that field
      if (field?.mode === "ANY") continue;
      const candidates = [
        ...(field?.include ?? []),
        ...(field?.value ? [field.value] : []),
        ...(projection.attributes[key] ? [projection.attributes[key]!] : []),
      ];
      if (!valuesOverlap(candidates, required)) {
        // Prefer check: if request has preferred set overlapping required OK
        if (
          field?.preferred?.length &&
          valuesOverlap(field.preferred, required)
        ) {
          continue;
        }
        return {
          match: false,
          path: "CANONICAL_MATCH",
          reasons: [`must-mismatch:${key}`],
        };
      }
    }
    reasons.push("must-ok");
  }

  // EXCLUDED — hard reject when request positively has excluded value
  // OR when seller filter excludes a value that the request requires
  if (f.excluded) {
    for (const [key, banned] of Object.entries(f.excluded)) {
      const field = projection.constraints[key];
      const positive = [
        ...(field?.value ? [field.value] : []),
        ...(field?.include ?? []),
        ...(field?.preferred ?? []),
        ...(projection.attributes[key] ? [projection.attributes[key]!] : []),
      ];
      if (valuesOverlap(positive, banned)) {
        return {
          match: false,
          path: "CANONICAL_MATCH",
          reasons: [`excluded-hit:${key}`],
        };
      }
    }
    reasons.push("excluded-ok");
  }

  // Request-side exclusions vs seller include filter (attributes)
  // If seller filters brand=Samsung and request excludes Samsung → reject
  if (f.attributes) {
    for (const [key, expected] of Object.entries(f.attributes)) {
      const excl = projection.constraints[key]?.excluded ?? [];
      if (excl.some((e) => norm(e) === norm(expected))) {
        return {
          match: false,
          path: "CANONICAL_MATCH",
          reasons: [`request-excludes-filter:${key}`],
        };
      }
    }
  }

  // Ranges — seller min means request quantity/value must be >= min
  if (f.ranges) {
    for (const [key, range] of Object.entries(f.ranges)) {
      const pr = projection.constraints[key]?.range;
      const attrNum = Number(projection.attributes[key]);
      const requestValue =
        pr?.min ??
        (Number.isFinite(attrNum) ? attrNum : undefined) ??
        pr?.max;
      if (requestValue == null) continue;
      if (range.min != null && requestValue < range.min) {
        return {
          match: false,
          path: "CANONICAL_MATCH",
          reasons: [`range-below:${key}`],
        };
      }
      if (range.max != null && requestValue > range.max) {
        return {
          match: false,
          path: "CANONICAL_MATCH",
          reasons: [`range-above:${key}`],
        };
      }
    }
    reasons.push("range-ok");
  }

  // PREFERRED — never hard reject (documented intentionally unused here)
  void f.preferred;

  return { match: true, path: "CANONICAL_MATCH", reasons };
}

/**
 * Candidate-side hard reject helper (seller catalog vs request constraints).
 * Not a ranking brain.
 */
export function isCandidateCompatibleWithProjection(
  projection: RequestDiscoveryProjection,
  candidate: Record<string, string | null | undefined>,
): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  for (const [key, field] of Object.entries(projection.constraints)) {
    const cand = candidate[key];
    if (cand == null || !String(cand).trim()) continue;
    const c = String(cand);

    if (field.excluded?.some((e) => norm(e) === norm(c))) {
      return { compatible: false, reasons: [`excluded:${key}`] };
    }

    if (field.mode === "ANY") continue;

    if (field.strength === "MUST" && field.value) {
      if (norm(field.value) !== norm(c)) {
        return { compatible: false, reasons: [`must:${key}`] };
      }
    }

    if (field.include?.length && !field.include.some((v) => norm(v) === norm(c))) {
      return { compatible: false, reasons: [`include:${key}`] };
    }

    // PREFERRED mismatch → still compatible
    if (
      field.strength === "PREFERRED" &&
      field.value &&
      norm(field.value) !== norm(c)
    ) {
      reasons.push(`preferred-miss:${key}`);
    }
  }

  return { compatible: true, reasons };
}
