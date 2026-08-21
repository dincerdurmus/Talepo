/**
 * Build RequestRoutingEnvelope from existing authorities only.
 * Does not invent a parallel request brain.
 * Category DB id, slug, and taxonomy ids stay distinct.
 */

import { parseDiscoveryProjection } from "@/lib/discovery/validate-filter";
import type { RequestDiscoveryProjection } from "@/lib/discovery/types";
import {
  parseUnderstandingSnapshot,
  type RequestUnderstandingSnapshot,
} from "@/lib/request/understanding-snapshot";
import type {
  BudgetBasis,
  BudgetStatus,
  LocationStatus,
  RequestRoutingEnvelope,
} from "./types";
import { foldText } from "./text";
import { isLikelyCategoryDbId, isLikelyCategorySlug, isTaxonomyId } from "./identity";

export type RoutingEnvelopeInput = {
  requestId: string;
  rawInput?: string | null;
  professionalDescription?: string | null;
  title?: string | null;
  description?: string | null;
  /** Prisma Category.id */
  categoryDbId?: string | null;
  /** Category.slug */
  categorySlug?: string | null;
  /** @deprecated prefer categoryDbId — kept for transitional callers */
  categoryId?: string | null;
  city?: string | null;
  district?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  isUrgent?: boolean;
  deadlineAt?: string | null;
  discoveryProjection?: unknown;
  understandingSnapshot?: unknown;
  locationMode?: "city" | "nationwide" | "remote" | "no_preference" | null;
  budgetBasis?: BudgetBasis | null;
  quantity?: number | null;
  quantityUnit?: string | null;
  candidateCategorySlugs?: string[];
  taxonomyNodeIds?: string[];
  primaryLeafId?: string | null;
};

function entityValue(
  snap: RequestUnderstandingSnapshot | null,
  key: string,
): string | null {
  const v = snap?.entities?.[key]?.value?.trim();
  return v || null;
}

function attrValue(
  snap: RequestUnderstandingSnapshot | null,
  projection: RequestDiscoveryProjection | null,
  key: string,
): string | null {
  const fromSnap = snap?.attributes?.[key]?.value?.trim();
  if (fromSnap) return fromSnap;
  const fromProj = projection?.attributes?.[key]?.trim();
  return fromProj || null;
}

function resolveLocation(input: RoutingEnvelopeInput): RequestRoutingEnvelope["location"] {
  const mode = input.locationMode ?? null;
  const city = input.city?.trim() || null;
  const district = input.district?.trim() || null;

  if (mode === "nationwide") {
    return {
      status: "nationwide",
      city: null,
      district: null,
      nationwide: true,
      remote: false,
    };
  }
  if (mode === "remote") {
    return {
      status: "remote",
      city: null,
      district: null,
      nationwide: false,
      remote: true,
    };
  }
  if (mode === "no_preference") {
    return {
      status: "unknown",
      city: null,
      district: null,
      nationwide: false,
      remote: false,
    };
  }
  if (city && district) {
    return {
      status: "city_district",
      city,
      district,
      nationwide: false,
      remote: false,
    };
  }
  if (city) {
    return {
      status: "city_only",
      city,
      district: null,
      nationwide: false,
      remote: false,
    };
  }
  return {
    status: "unknown" satisfies LocationStatus,
    city: null,
    district: null,
    nationwide: false,
    remote: false,
  };
}

function resolveBudget(input: RoutingEnvelopeInput): RequestRoutingEnvelope["budget"] {
  const min =
    typeof input.budgetMin === "number" && Number.isFinite(input.budgetMin)
      ? input.budgetMin
      : null;
  const max =
    typeof input.budgetMax === "number" && Number.isFinite(input.budgetMax)
      ? input.budgetMax
      : null;
  let status: BudgetStatus = "unknown";
  if (min != null || max != null) status = "range";

  return {
    status,
    min,
    max,
    currency: input.currency?.trim() || null,
    basis: input.budgetBasis ?? "unknown",
  };
}

function resolvePrimaryDbId(input: {
  categoryDbId?: string | null;
  categoryId?: string | null;
  projectionCategoryId?: string | null;
}): string | null {
  const candidates = [
    input.categoryDbId,
    input.categoryId,
    input.projectionCategoryId,
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (!v) continue;
    // Refuse to treat slug or taxonomy as DB id.
    if (isTaxonomyId(v) || isLikelyCategorySlug(v)) continue;
    if (isLikelyCategoryDbId(v) || v.startsWith("cat_")) return v;
    // Unknown opaque id (real cuid) — accept if not a known slug/tax form.
    if (!isLikelyCategorySlug(v)) return v;
  }
  return null;
}

export function buildRequestRoutingEnvelope(
  input: RoutingEnvelopeInput,
): RequestRoutingEnvelope {
  const projection = parseDiscoveryProjection(input.discoveryProjection);
  const snapFromProjection = projection?.understanding
    ? parseUnderstandingSnapshot(projection.understanding)
    : null;
  const snap =
    parseUnderstandingSnapshot(input.understandingSnapshot) ?? snapFromProjection;

  const primarySlug =
    snap?.categoryResolution.primary?.slug?.trim() ||
    input.categorySlug?.trim() ||
    null;

  const primaryCategoryDbId = resolvePrimaryDbId({
    categoryDbId: input.categoryDbId,
    categoryId: input.categoryId,
    projectionCategoryId: projection?.categoryId,
  });

  const candidateSlugs = Array.from(
    new Set(
      [
        ...(input.candidateCategorySlugs ?? []),
        ...(snap?.categoryResolution.candidates ?? []).map((c) => c.slug.trim()),
      ].filter(Boolean),
    ),
  );

  const taxonomyNodeIds = Array.from(
    new Set(
      [
        ...(input.taxonomyNodeIds ?? []),
        ...(projection?.taxonomyNodeIds ?? []),
      ].filter((id) => isTaxonomyId(id) || id.startsWith("tax:")),
    ),
  );

  // If projection used non-tax ids historically, keep only tax: prefixed.
  const primaryLeafId =
    input.primaryLeafId?.trim() ||
    (projection?.primaryLeafId && isTaxonomyId(projection.primaryLeafId)
      ? projection.primaryLeafId
      : null) ||
    null;

  const ancestors =
    primaryLeafId && taxonomyNodeIds.length
      ? taxonomyNodeIds.filter((id) => id !== primaryLeafId)
      : taxonomyNodeIds.slice(0, -1);

  const rawInput =
    input.rawInput?.trim() ||
    input.description?.trim() ||
    input.title?.trim() ||
    "";

  const product =
    entityValue(snap, "product") ||
    attrValue(snap, projection, "productType") ||
    attrValue(snap, projection, "product") ||
    null;

  const brand =
    entityValue(snap, "brand") ||
    attrValue(snap, projection, "brand") ||
    null;

  const model =
    entityValue(snap, "model") ||
    attrValue(snap, projection, "model") ||
    null;

  const family =
    entityValue(snap, "family") ||
    attrValue(snap, projection, "family") ||
    null;

  const series =
    entityValue(snap, "series") ||
    attrValue(snap, projection, "series") ||
    null;

  const variant =
    entityValue(snap, "variant") ||
    attrValue(snap, projection, "variant") ||
    null;

  const attributes: Record<string, string> = {
    ...(projection?.attributes ?? {}),
  };
  if (snap?.attributes) {
    for (const [k, v] of Object.entries(snap.attributes)) {
      if (v.value?.trim()) attributes[k] = v.value.trim();
    }
  }

  const categoryConfidence =
    snap?.categoryResolution.primary?.confidence ?? null;

  return {
    requestId: input.requestId,
    rawInput,
    professionalDescription: input.professionalDescription?.trim() || null,
    categoryResolution: {
      status:
        snap?.categoryResolution.status ??
        (primaryCategoryDbId || primarySlug ? "resolved" : "unresolved"),
      userSelected: snap?.categoryResolution.userSelected ?? false,
      userChoice: snap?.categoryResolution.userChoice ?? null,
      primaryCategoryDbId,
      primaryCategorySlug: primarySlug,
      candidateCategorySlugs: candidateSlugs.length
        ? candidateSlugs
        : primarySlug
          ? [primarySlug]
          : [],
      taxonomyNodeIds,
      primaryLeafId,
      ancestors,
    },
    product,
    brand,
    family,
    series,
    model,
    variant,
    attributes,
    unresolvedExpressions: snap?.unresolvedExpressions ?? [],
    location: resolveLocation(input),
    budget: resolveBudget(input),
    quantity: {
      value:
        typeof input.quantity === "number" && Number.isFinite(input.quantity)
          ? input.quantity
          : null,
      unit: input.quantityUnit?.trim() || null,
    },
    timing: {
      urgency: Boolean(input.isUrgent),
      deadlineAt: input.deadlineAt ?? null,
    },
    confidence: {
      category: categoryConfidence,
      overall: categoryConfidence,
    },
    evidence: [
      rawInput
        ? { signal: "rawInput", detail: foldText(rawInput).slice(0, 120) }
        : { signal: "rawInput", detail: "empty" },
      {
        signal: "categoryDbId",
        detail: primaryCategoryDbId ?? "absent",
      },
      {
        signal: "categorySlug",
        detail: primarySlug ?? "absent",
      },
      projection
        ? { signal: "discoveryProjection", detail: "present" }
        : { signal: "discoveryProjection", detail: "absent" },
      snap
        ? {
            signal: "understandingSnapshot",
            detail: snap.categoryResolution.status,
          }
        : { signal: "understandingSnapshot", detail: "absent" },
    ],
    understandingVersion: snap ? String(snap.version) : null,
    profileVersion: snap?.profileVersion ?? null,
    discoveryProjectionPresent: Boolean(projection),
  };
}
