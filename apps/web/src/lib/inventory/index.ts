/**
 * Inventory Intelligence V1 — canonical projection + request compatibility.
 * Speaks the same language as Request.discoveryProjection.
 */

export type {
  InventorySemanticSubject,
  InventoryCompatibilityTarget,
  InventoryCompatibilityTargetKind,
  InventoryDiscoveryProjection,
  InventoryMatchLevel,
  InventoryHardRejectReason,
  InventoryMatchReason,
  InventoryCompatibilityResult,
  InventoryProjectionInput,
} from "./types";

export { INVENTORY_DISCOVERY_PROJECTION_VERSION } from "./types";

export { buildInventoryDiscoveryProjection } from "./build-projection";

export {
  INVENTORY_PROJECTION_ATTR_KEY,
  readInventoryProjection,
  writeInventoryProjectionAttributes,
  inventoryCandidateBag,
} from "./attributes-envelope";

export {
  evaluateInventoryRequestCompatibility,
  inventoryMatchScore,
} from "./evaluate-compatibility";
