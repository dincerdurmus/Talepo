export type {
  CatalogConfidence,
  CatalogDomainId,
  CatalogDomainProvider,
  CatalogEntityHit,
  CatalogMatchMode,
  CatalogOemLookup,
  CatalogCompatibilityLookup,
} from "./types";
export { CatalogRegistry, getCatalogRegistry } from "./registry";
export {
  normalizeCatalogKey,
  foldCatalogKey,
  catalogSlug,
} from "./normalize";
export { applyCatalogEnrichment } from "./apply-enrichment";
export { enrichAutomotiveSubject } from "./automotive/enrich";
export {
  getAutomotiveIndexes,
  findGenerationInText,
  findEnginesInText,
} from "./automotive/indexes";
export { normalizeCatalogFuelType } from "./normalize";
export { lookupAutomotiveOem } from "./automotive/oem";
export { lookupAutomotiveCompatibility } from "./automotive/compatibility";
export { ensureAutomotiveCatalogRegistered } from "./automotive/provider";
export type {
  AutomotiveEngineRecord,
  AutomotiveGenerationRecord,
  AutomotiveSubjectEnrichment,
} from "./automotive/types";
