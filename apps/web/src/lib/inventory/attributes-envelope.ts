/**
 * Persist inventory discovery projection inside existing CompanyInventoryItem.attributes Json?
 * No migration — additive nested key.
 */

import type { InventoryDiscoveryProjection } from "./types";
import { INVENTORY_DISCOVERY_PROJECTION_VERSION } from "./types";

export const INVENTORY_PROJECTION_ATTR_KEY = "__discoveryProjection" as const;

export type InventoryAttributesEnvelope = {
  [INVENTORY_PROJECTION_ATTR_KEY]?: InventoryDiscoveryProjection;
  [key: string]: unknown;
};

export function readInventoryProjection(
  attributes: unknown,
): InventoryDiscoveryProjection | null {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }
  const bag = attributes as InventoryAttributesEnvelope;
  const proj = bag[INVENTORY_PROJECTION_ATTR_KEY];
  if (!proj || typeof proj !== "object") return null;
  if (
    (proj as InventoryDiscoveryProjection).kind !==
      "inventory_discovery_projection" ||
    (proj as InventoryDiscoveryProjection).version !==
      INVENTORY_DISCOVERY_PROJECTION_VERSION
  ) {
    return null;
  }
  return proj as InventoryDiscoveryProjection;
}

/**
 * Merge projection into attributes bag without dropping other field attrs.
 * Returns a plain JSON-serializable object for Prisma Json columns.
 */
export function writeInventoryProjectionAttributes(
  projection: InventoryDiscoveryProjection,
  existing?: unknown,
): Record<string, unknown> {
  const base: InventoryAttributesEnvelope =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as InventoryAttributesEnvelope) }
      : {};
  base[INVENTORY_PROJECTION_ATTR_KEY] = projection;
  return JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
}

/** Flatten projection attributes for candidate constraint checks. */
export function inventoryCandidateBag(
  projection: InventoryDiscoveryProjection,
): Record<string, string> {
  const out: Record<string, string> = { ...projection.attributes };
  const ct = projection.compatibilityTarget;
  if (ct?.brand) out.brand = ct.brand;
  if (ct?.model) out.model = ct.model;
  if (ct?.generation) out.generation = ct.generation;
  if (projection.entityRefs) {
    for (const [k, v] of Object.entries(projection.entityRefs)) {
      if (v && !out[k]) out[k] = v;
    }
  }
  return out;
}
