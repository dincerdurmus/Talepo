/**
 * Inventory Intelligence V1 — alignment with Request.discoveryProjection.
 *
 * Integration:
 *   lib/inventory/build-projection.ts → buildInventoryDiscoveryProjection
 *   lib/inventory/evaluate-compatibility.ts → evaluateInventoryRequestCompatibility
 *   server/monetization/inventory-matching.ts → matchRequestToInventory
 *
 * Projection stored in CompanyInventoryItem.attributes.__discoveryProjection (no migration).
 */

export const INVENTORY_ALIGNMENT_INTEGRATION_POINT =
  "apps/web/src/server/monetization/inventory-matching.ts#matchRequestToInventory";

export const INVENTORY_ALIGNMENT_PHASE = "inventory-intelligence-v1" as const;

export type InventoryAlignmentPlan = {
  phase: typeof INVENTORY_ALIGNMENT_PHASE;
  integrationPoint: string;
  steps: string[];
};

export function getInventoryAlignmentPlan(): InventoryAlignmentPlan {
  return {
    phase: INVENTORY_ALIGNMENT_PHASE,
    integrationPoint: INVENTORY_ALIGNMENT_INTEGRATION_POINT,
    steps: [
      "Build inventory discovery projection at create/import (attributes.__discoveryProjection)",
      "Load Request.discoveryProjection — do not re-run understandRequest",
      "evaluateInventoryRequestCompatibility (subject → taxonomy → entity → MUST/EXCLUDED → preferred)",
      "Token overlap only as LEGACY_FALLBACK after hard gates",
      "Hunter scopes to CORPORATE companies; company-scoped match API unchanged",
    ],
  };
}

/** PII-safe metric names (no free text payloads). */
export const INVENTORY_METRICS = {
  projectionBuilt: "inventory.projection.built",
  matchEvaluated: "inventory.match.evaluated",
  matchCompatible: "inventory.match.compatible",
  matchRejected: "inventory.match.rejected",
  matchLegacyFallback: "inventory.match.legacy_fallback",
} as const;

export function inventoryMetricEvent(
  name: (typeof INVENTORY_METRICS)[keyof typeof INVENTORY_METRICS],
  tags?: Record<string, string | number | boolean>,
): { kind: "metric"; name: string; tags?: Record<string, string | number | boolean> } {
  return { kind: "metric", name, tags };
}
