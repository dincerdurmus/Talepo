/**
 * Shared write-path helper — one builder for create / import / update.
 */

import {
  buildInventoryDiscoveryProjection,
  writeInventoryProjectionAttributes,
  type InventoryProjectionInput,
} from "@/lib/inventory";

export function buildInventoryAttributesForWrite(
  input: InventoryProjectionInput,
  existingAttributes?: unknown,
) {
  const projection = buildInventoryDiscoveryProjection(input);
  const attributes = writeInventoryProjectionAttributes(
    projection,
    existingAttributes,
  );
  return { projection, attributes };
}
