import type { CatalogCompatibilityLookup } from "../types";
import { getAutomotiveIndexes } from "./indexes";

/**
 * Many-to-many compatibility lookup.
 * Dataset is intentionally empty — never invent fitment.
 */
export function lookupAutomotiveCompatibility(_input: {
  partId?: string;
  modelId?: string;
  generationId?: string;
  engineId?: string;
}): CatalogCompatibilityLookup {
  const idx = getAutomotiveIndexes();
  if (!Array.isArray(idx.compatibility) || idx.compatibility.length === 0) {
    return { status: "ready_empty", pairs: [] };
  }
  return { status: "unresolved", pairs: [] };
}
