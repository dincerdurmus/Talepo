export { runCatalogIngestion, categoriesEligibleForExternalIngest } from "./engine";
export { classifyIngestRecord } from "./classifier";
export {
  canAutoSafeSource,
  provenanceReasons,
  assertProvenancePresent,
  CRITICAL_COMPATIBILITY_AUTHORITIES,
} from "./provenance";
export { createStubSourceAdapter, EMPTY_ADAPTERS } from "./adapters/stub";
export type {
  SourceAdapter,
  SourceAdapterContext,
  IngestionEngineOptions,
  IngestionEngineResult,
  NormalizeResult,
  CanonicalMapResult,
  ValidationResult,
  ConflictResult,
} from "./types";
