/**
 * Phase 4B design pointer — inventory ↔ canonical discovery projection.
 * Phase 4A does not implement a second matcher.
 *
 * Exact integration point today:
 *   server/monetization/inventory-matching.ts → matchRequestToInventory()
 *   called from opportunity-hunter.ts (token overlap on title/description).
 *
 * Target path (4B):
 *   CompanyInventoryItem
 *     → taxonomy/entity/attribute projection (same vocabulary as discovery)
 *     → compare against Request.discoveryProjection via evaluateDiscoveryFilter /
 *       isCandidateCompatibleWithProjection
 *     → deterministic compatibility (no re-parse of request text)
 */

export const INVENTORY_ALIGNMENT_INTEGRATION_POINT =
  "apps/web/src/server/monetization/inventory-matching.ts#matchRequestToInventory";

export const INVENTORY_ALIGNMENT_PHASE = "4B" as const;

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
      "Persist or derive inventory item taxonomyNodeIds + attribute constraints at import/create time",
      "Load Request.discoveryProjection (authoritative) — do not re-run understandRequest for match",
      "Evaluate compatibility with discovery evaluate-filter / projection helpers",
      "Replace tokenOverlap scoring as primary signal; keep text only as weak fallback if needed",
      "Emit opportunity.match.created with matchReason=inventory_projection",
    ],
  };
}
