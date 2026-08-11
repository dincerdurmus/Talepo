export { runCatalogIngestion, categoriesEligibleForExternalIngest } from "./engine";
export { classifyIngestRecord } from "./classifier";
export {
  canAutoSafeSource,
  provenanceReasons,
  assertProvenancePresent,
  CRITICAL_COMPATIBILITY_AUTHORITIES,
} from "./provenance";
export {
  createStubSourceAdapter,
  EMPTY_ADAPTERS,
  REAL_SOURCE_ADAPTERS,
  getRegisteredAdapters,
  adaptersForDomain,
  automotiveCoverageGapAdapter,
  automotiveWikidataAdapter,
  automotiveTransmissionDiscoveryAdapter,
  automotiveEngineExpansionAdapter,
  automotiveEpaFuelEconomyAdapter,
  appliancesDiscoveryAdapter,
  technologyDiscoveryAdapter,
  machinerySelectivePilotAdapter,
  genericStructuredDiscoveryAdapter,
} from "./adapters";
export {
  normalizeIngestRecord,
  toCanonicalCandidate,
  normalizeStorageGb,
  normalizeRamGb,
  scopedNormalizedKey,
  foldCatalogKey,
  normalizeCatalogKey,
  catalogSlug,
} from "./normalize";
export {
  matchExistingAutomotive,
  matchExistingGeneric,
  mapIngestRecord,
  createEmptyGenericIndex,
  registerGenericEntity,
} from "./canonical-mapper";
export {
  automotiveCoverageBefore,
  coverageBeforeForCategory,
  buildCoverageBefore,
} from "./coverage";
export {
  loadSourceRegistry,
  getSourceById,
  sourcesForCategory,
  enabledLiveSources,
  markSourceStatus,
  BUILTIN_SOURCE_REGISTRY,
} from "./source-registry";
export {
  fingerprintRequest,
  contentHash,
  readCacheEntry,
  writeCacheEntry,
  lookupFreshCache,
  isCacheFresh,
  listCacheEntries,
  resolveCacheRoot,
} from "./source-cache";
export { fetchPublicUrl } from "./fetch-policy";
export {
  parseJsonLdProducts,
  extractSitemapLocs,
  extractSpecTablePairs,
  extractEmbeddedJsonBlobs,
  specsFromJsonLdProduct,
} from "./structured-parse";
export { scoreSourceQuality } from "./source-quality";
export {
  mergeMultiSourceRecords,
  resolveRegionalAlias,
  DEFAULT_REGIONAL_ALIASES,
} from "./multi-source-merge";
export {
  buildCoverageMatrix,
  emptyCoverageMatrix,
  mergeCoverageMatrices,
} from "./coverage-matrix";
export {
  buildTransmissionCandidate,
  sanitizeTransmissionCode,
  inferTransmissionFamily,
  normalizeTransmissionMention,
  familyToType,
  candidateToTransmissionRecord,
  EMPTY_TRANSMISSION_SEED,
} from "./automotive-transmission";
export type {
  SourceAdapter,
  SourceAdapterContext,
  AdapterDiscoverResult,
  AccessStatus,
  IngestionEngineOptions,
  IngestionEngineResult,
  NormalizeResult,
  CanonicalMapResult,
  CanonicalMatchStatus,
  ValidationResult,
  ConflictResult,
  AdapterRunStats,
  DiscoveryMode,
  IngestSourceMode,
} from "./types";
export type { SourceRegistryEntry } from "./source-registry";
export type { SourceQualityScore, QualityDimension } from "./source-quality";
export type { RegionalAliasMap, MergeResult } from "./multi-source-merge";
export type { CoverageMatrix, CoverageMatrixRow } from "./coverage-matrix";
export type {
  AutomotiveTransmissionCandidate,
  TransmissionFamily,
  TransmissionType,
} from "./automotive-transmission";
