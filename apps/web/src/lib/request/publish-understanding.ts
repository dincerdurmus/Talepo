import type { RequestDiscoveryProjection } from "@/lib/discovery";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
import {
  buildUnderstandingSnapshot,
  deriveCategoryResolutionStatus,
  type CategoryUserChoice,
  type RequestUnderstandingSnapshot,
} from "@/lib/request/understanding-snapshot";

/**
 * Attach publish-time understanding audit block onto a discovery projection.
 * Does not invent missing values.
 */
export function withUnderstandingSnapshot(
  projection: RequestDiscoveryProjection | null | undefined,
  understanding: RequestUnderstandingSnapshot,
): RequestDiscoveryProjection | null {
  if (!projection) return null;
  return {
    ...projection,
    understanding,
  };
}

export function buildPublishUnderstandingSnapshot(input: {
  understanding: RequestUnderstandingResult;
  userSelected: boolean;
  userChoice?: CategoryUserChoice;
  confirmedFieldKeys?: string[];
  primarySlug: string | null;
}): RequestUnderstandingSnapshot {
  const cat = input.understanding.category;
  const primarySlug =
    input.primarySlug?.trim() ||
    (typeof cat.value === "string" ? cat.value : null);

  const candidates = [
    ...(primarySlug
      ? [
          {
            slug: primarySlug,
            confidence: cat.confidence,
            source: input.userSelected ? ("user" as const) : ("ai" as const),
          },
        ]
      : []),
    ...(cat.alternatives ?? []).map((alt) => ({
      slug: String(alt.value),
      confidence: alt.confidence,
      source: "ai" as const,
    })),
  ];

  const bySlug = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) {
    if (!c.slug) continue;
    const prev = bySlug.get(c.slug);
    if (!prev || c.confidence > prev.confidence) bySlug.set(c.slug, c);
  }
  const uniqueCandidates = [...bySlug.values()].sort(
    (a, b) => b.confidence - a.confidence,
  );

  const userChoice = input.userChoice ?? null;
  const status = deriveCategoryResolutionStatus({
    userSelected: input.userSelected,
    userChoice,
    primarySlug,
    primaryConfidence: cat.confidence,
    candidateCount: uniqueCandidates.length,
  });

  const entities: RequestUnderstandingSnapshot["entities"] = {};
  const brand = input.understanding.identity?.brand;
  const model = input.understanding.identity?.model;
  if (brand?.value) {
    entities.brand = {
      value: String(brand.value),
      confidence: brand.confidence,
    };
  }
  if (model?.value) {
    entities.model = {
      value: String(model.value),
      confidence: model.confidence,
    };
  }

  const attributes: RequestUnderstandingSnapshot["attributes"] = {};
  for (const [key, fact] of Object.entries(
    input.understanding.attributes ?? {},
  )) {
    if (fact?.value == null || fact.value === "") continue;
    attributes[key] = {
      value: String(fact.value),
      confidence: fact.confidence,
    };
  }

  const unresolvedExpressions = [
    ...(input.understanding.ambiguities ?? [])
      .map((a) => a.message?.trim() || a.kind)
      .filter(Boolean),
    ...(input.understanding.unknownFields ?? []).map(
      (k) => `unknown_field:${k}`,
    ),
  ];

  return buildUnderstandingSnapshot({
    categoryResolution: {
      status,
      userSelected: input.userSelected,
      userChoice,
      primary: uniqueCandidates[0]
        ? {
            slug: uniqueCandidates[0].slug,
            confidence: uniqueCandidates[0].confidence,
            source: uniqueCandidates[0].source,
          }
        : null,
      candidates: uniqueCandidates,
    },
    entities,
    attributes,
    unresolvedExpressions,
    confirmedFieldKeys: input.confirmedFieldKeys,
  });
}
