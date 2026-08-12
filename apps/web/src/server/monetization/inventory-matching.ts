/**
 * Inventory ↔ request matching — canonical projection evaluator primary.
 * Token overlap is LEGACY_FALLBACK only (never beats subject/taxonomy conflict).
 */

import {
  buildInventoryDiscoveryProjection,
  evaluateInventoryRequestCompatibility,
  inventoryMatchScore,
  readInventoryProjection,
  type InventoryCompatibilityResult,
  type InventoryDiscoveryProjection,
} from "@/lib/inventory";
import { parseDiscoveryProjection } from "@/lib/discovery";
import type { RequestDiscoveryProjection } from "@/lib/discovery/types";
import type { MatchResult } from "@/lib/monetization/types";
import { prisma } from "@/lib/prisma";

export type InventoryMatch = MatchResult & {
  inventoryItemId: string;
  inventoryItemName: string;
  matchPath?: InventoryCompatibilityResult["path"];
  matchLevel?: InventoryCompatibilityResult["level"];
};

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(
    a
      .toLowerCase()
      .split(/[\s,./\-_]+/)
      .filter((t) => t.length >= 2),
  );
  const tb = b
    .toLowerCase()
    .split(/[\s,./\-_]+/)
    .filter((t) => t.length >= 2);
  let hits = 0;
  for (const t of tb) {
    if (ta.has(t)) hits += 1;
  }
  return hits;
}

function projectionFromItem(item: {
  name: string;
  title: string | null;
  brand: string | null;
  model: string | null;
  categoryLabel: string | null;
  city: string | null;
  notes: string | null;
  sku: string | null;
  quantity: number;
  attributes: unknown;
}): InventoryDiscoveryProjection {
  const stored = readInventoryProjection(item.attributes);
  if (stored) return stored;
  return buildInventoryDiscoveryProjection({
    name: item.name || item.title || "",
    title: item.title,
    brand: item.brand,
    model: item.model,
    categoryLabel: item.categoryLabel,
    city: item.city,
    notes: item.notes,
    sku: item.sku,
    quantity: item.quantity,
  });
}

function legacyTokenMatch(input: {
  request: {
    id: string;
    categoryId: string | null;
    title: string;
    description: string;
    city: string | null;
  };
  item: {
    id: string;
    companyId: string;
    name: string;
    title: string | null;
    brand: string | null;
    model: string | null;
    categoryId: string | null;
    city: string | null;
  };
  /** When set, hard-reject if ephemeral subject conflicts */
  derived: InventoryDiscoveryProjection;
  requestProjection: RequestDiscoveryProjection | null;
}): InventoryMatch | null {
  // Subject hard gate even on legacy path
  if (input.requestProjection) {
    const gate = evaluateInventoryRequestCompatibility(
      input.requestProjection,
      input.derived,
    );
    if (!gate.compatible && gate.hardRejectReasons.includes("SUBJECT_MISMATCH")) {
      return null;
    }
    if (
      !gate.compatible &&
      gate.hardRejectReasons.includes("SERVICE_PHYSICAL_MISMATCH")
    ) {
      return null;
    }
  }

  const haystack =
    `${input.request.title} ${input.request.description}`.toLowerCase();
  const label = input.item.name || input.item.title || "";
  let score = 0;
  const reasons: string[] = ["LEGACY_FALLBACK"];

  if (
    input.item.categoryId &&
    input.item.categoryId === input.request.categoryId
  ) {
    score += 20;
  }
  const overlap = tokenOverlap(haystack, label);
  if (overlap > 0) score += Math.min(25, overlap * 8);
  if (input.item.brand && haystack.includes(input.item.brand.toLowerCase())) {
    score += 10;
  }
  if (input.item.model && haystack.includes(input.item.model.toLowerCase())) {
    score += 8;
  }
  if (score < 30) return null;

  return {
    inventoryItemId: input.item.id,
    inventoryItemName: label,
    companyId: input.item.companyId,
    requestId: input.request.id,
    score: Math.min(40, score),
    reasons: ["LEGACY_FALLBACK", "Zayıf metin benzerliği (kanonik değil)"],
    matchPath: "LEGACY_FALLBACK",
    matchLevel: "LEGACY",
  };
}

/**
 * Match request against company hidden inventory (Corporate).
 * Primary: Request.discoveryProjection ↔ inventory projection.
 * Never exposes inventory publicly.
 */
export async function matchRequestToInventory(
  requestId: string,
  companyId?: string,
): Promise<InventoryMatch[]> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      categoryId: true,
      title: true,
      description: true,
      city: true,
      discoveryProjection: true,
    },
  });

  if (!request) return [];

  const requestProjection = parseDiscoveryProjection(
    request.discoveryProjection,
  );

  // Bound candidates: Corporate companies only when scanning globally
  let companyIds: string[] | undefined;
  if (companyId) {
    companyIds = [companyId];
  } else {
    const corporate = await prisma.company.findMany({
      where: {
        deletedAt: null,
        planTier: "CORPORATE",
        status: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
      },
      select: { id: true },
      take: 100,
    });
    companyIds = corporate.map((c) => c.id);
    if (!companyIds.length) return [];
  }

  // Bound by company + active; evaluate in-app (JSON projection not indexed in V1).
  const items = await prisma.companyInventoryItem.findMany({
    where: {
      isActive: true,
      companyId: { in: companyIds },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      title: true,
      brand: true,
      model: true,
      categoryId: true,
      categoryLabel: true,
      city: true,
      sku: true,
      notes: true,
      quantity: true,
      attributes: true,
    },
    take: companyId ? 200 : 400,
  });

  const results: InventoryMatch[] = [];

  for (const item of items) {
    const invProj = projectionFromItem(item);
    const label = item.name || item.title || "";

    if (requestProjection) {
      const evalResult = evaluateInventoryRequestCompatibility(
        requestProjection,
        invProj,
      );
      if (evalResult.compatible) {
        results.push({
          inventoryItemId: item.id,
          inventoryItemName: label,
          companyId: item.companyId,
          requestId: request.id,
          score: inventoryMatchScore(evalResult),
          reasons: [
            ...evalResult.matchReasons,
            ...evalResult.reasonLabels,
          ].slice(0, 8),
          matchPath: evalResult.path,
          matchLevel: evalResult.level,
        });
        continue;
      }
      // Subject/taxonomy hard reject — do not fall through to tokens
      if (
        evalResult.hardRejectReasons.includes("SUBJECT_MISMATCH") ||
        evalResult.hardRejectReasons.includes("TAXONOMY_CONFLICT") ||
        evalResult.hardRejectReasons.includes("ENTITY_CONFLICT") ||
        evalResult.hardRejectReasons.includes("MUST_MISMATCH") ||
        evalResult.hardRejectReasons.includes("EXCLUDED_VALUE") ||
        evalResult.hardRejectReasons.includes("SERVICE_PHYSICAL_MISMATCH")
      ) {
        continue;
      }
    }

    // No request projection or insufficient canonical signal → explicit legacy
    const legacy = legacyTokenMatch({
      request,
      item,
      derived: invProj,
      requestProjection,
    });
    if (legacy) results.push(legacy);
  }

  return results.sort((a, b) => b.score - a.score);
}
