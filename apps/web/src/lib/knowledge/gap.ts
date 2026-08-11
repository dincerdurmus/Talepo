/**
 * Catalog gap discovery contract (telemetry/DB not required this phase).
 * USER_DISCOVERED gaps must never auto-promote to production SAFE catalog.
 */

import type { CatalogGap } from "./types";

export type { CatalogGap };

export function createCatalogGap(input: {
  categoryId: string;
  rawValue: string;
  normalizedValue?: string;
  confidence?: CatalogGap["confidence"];
}): CatalogGap {
  return {
    categoryId: input.categoryId,
    rawValue: input.rawValue,
    normalizedValue: input.normalizedValue ?? input.rawValue.trim(),
    seenCount: 1,
    status: "OPEN",
    confidence: input.confidence ?? "LOW",
  };
}

export function canPromoteGapToProduction(_gap: CatalogGap): boolean {
  return false;
}
