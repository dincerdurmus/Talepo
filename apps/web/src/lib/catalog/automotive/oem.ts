import type { CatalogOemLookup } from "../types";
import { getAutomotiveIndexes } from "./indexes";

/**
 * OEM reverse lookup.
 * Dataset is intentionally empty — never fabricate a match.
 */
export function lookupAutomotiveOem(oemNumber: string): CatalogOemLookup {
  const number = oemNumber.replace(/[\s-]/g, "").toUpperCase();
  const idx = getAutomotiveIndexes();
  if (!Array.isArray(idx.oemCrossrefs) || idx.oemCrossrefs.length === 0) {
    return {
      number,
      status: "unresolved",
      confidence: "unverified",
    };
  }
  // Future: scan verified crossref records by normalized OEM key.
  return {
    number,
    status: "unresolved",
    confidence: "unverified",
  };
}
