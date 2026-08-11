import type {
  BrowseNodeKind,
  ClassifiedIngestRecord,
  ExternalIngestionPolicy,
  IngestClassification,
  IngestRecord,
  IngestRejectReason,
  IngestionRunReport,
  KnowledgeSourceType,
  ProvenanceRecord,
} from "../types";

export type SourceAdapterId = string;

export type AccessStatus =
  | "AVAILABLE"
  | "SOURCE_UNAVAILABLE"
  | "ACCESS_BLOCKED"
  | "MANUAL_REVIEW_REQUIRED"
  | "RATE_LIMITED"
  | "FAILED";

export type IngestSourceMode = "LIVE" | "OFFLINE_FIXTURE" | "CACHE";

export type DiscoveryMode =
  | "FULL_DISCOVERY"
  | "INCREMENTAL"
  | "DETAIL_REFRESH";

export type AuthorityLevel =
  | "OFFICIAL"
  | "TRUSTED_DATASET"
  | "MARKETPLACE"
  | "DISCOVERY_ONLY"
  | "INTERNAL_AUDIT";

export type DiscoveryCapability =
  | "NONE"
  | "COVERAGE_AUDIT"
  | "BRAND"
  | "MODEL"
  | "FAMILY"
  | "FULL_GRAPH";

export type StructuredDataCapability =
  | "NONE"
  | "PARTIAL"
  | "STRUCTURED_API"
  | "CURATED_FIXTURE";

export type RateLimitPolicy = {
  maxRequestsPerMinute?: number;
  minIntervalMs?: number;
  timeoutMs?: number;
};

export type SourceAdapterContext = {
  categoryId: string;
  subcategorySlug?: string | null;
  policy: ExternalIngestionPolicy;
  dryRun: boolean;
  /** Optional CLI --limit */
  limit?: number;
  /** Optional CLI --source filter already applied by registry/CLI. */
  sourceFilter?: string | null;
  /** Optional CLI --entity=transmission|engine filter. */
  entityFilter?: "transmission" | "engine" | null;
  /** Disable live network for offline/CI. */
  allowNetwork?: boolean;
  /** FULL_DISCOVERY | INCREMENTAL | DETAIL_REFRESH */
  discoveryMode?: DiscoveryMode;
};

export type AdapterDiscoverResult = {
  records: IngestRecord[];
  accessStatus: AccessStatus;
  fetchAttempts: number;
  notes?: string[];
  sourceFingerprint?: string;
  errorMessage?: string;
};

export type SourceAdapter = {
  /** Stable adapter id (same as adapterId). */
  id: SourceAdapterId;
  adapterId: SourceAdapterId;
  sourceType: KnowledgeSourceType;
  supportedDomains: string[];
  supportedCategories: string[];
  /** Backward-compatible alias of supportedCategories. */
  supportedCategoryIds: string[];
  supportedEntityTypes: Array<BrowseNodeKind | "entity" | "spec" | "relation">;
  authorityLevel: AuthorityLevel;
  discoveryCapability: DiscoveryCapability;
  structuredDataCapability: StructuredDataCapability;
  rateLimitPolicy: RateLimitPolicy;
  licenseOrUsageNotes: string;
  supportsIncremental: boolean;
  supportsDetailFetch: boolean;
  discover(
    ctx: SourceAdapterContext,
  ): Promise<AdapterDiscoverResult | IngestRecord[]> | AdapterDiscoverResult | IngestRecord[];
};

export type NormalizeResult = {
  record: IngestRecord;
  normalized: Record<string, unknown>;
  stage: "RAW" | "NORMALIZED" | "CANONICAL_CANDIDATE";
};

export type CanonicalMatchStatus =
  | "EXISTING"
  | "NEW_CANDIDATE"
  | "AMBIGUOUS"
  | "OUT_OF_SCOPE";

export type CanonicalMapResult = {
  record: IngestRecord;
  status: CanonicalMatchStatus;
  canonicalId?: string;
  relations?: Array<{ type: string; targetId: string }>;
  matchMode?: "exact_id" | "alias" | "scoped_normalized";
  reasons?: IngestRejectReason[];
};

export type ValidationResult = {
  ok: boolean;
  reasons: IngestRejectReason[];
};

export type ConflictResult = {
  hasConflict: boolean;
  reasons: IngestRejectReason[];
  conflictingIds?: string[];
};

export type IngestionEngineOptions = {
  runId?: string;
  categoryIds: string[];
  /** When true (default), never writes production catalog. */
  dryRun?: boolean;
  /** Requires dryRun === false. Explicit production apply. */
  apply?: boolean;
  adapters: SourceAdapter[];
  /** Optional filesystem root for run artifacts (default data/catalog-ingestion/runs). */
  runsRoot?: string;
  /** Optional state root for incremental fingerprints. */
  stateRoot?: string;
  writeArtifacts?: boolean;
  limit?: number;
  sourceFilter?: string | null;
  /** Optional --entity=transmission|engine */
  entityFilter?: "transmission" | "engine" | null;
  allowNetwork?: boolean;
  subcategorySlug?: string | null;
  discoveryMode?: DiscoveryMode;
};

export type AdapterRunStats = {
  adapterId: string;
  categoryId: string;
  accessStatus: AccessStatus;
  fetchAttempts: number;
  discovered: number;
  errorMessage?: string;
  notes?: string[];
  sourceFingerprint?: string;
};

export type IngestionEngineResult = {
  report: IngestionRunReport;
  safe: ClassifiedIngestRecord[];
  review: ClassifiedIngestRecord[];
  rejected: ClassifiedIngestRecord[];
  conflicts: ClassifiedIngestRecord[];
  skippedCategoryIds: string[];
  artifactDir?: string;
  adapterStats: AdapterRunStats[];
  coverageBefore: Record<string, unknown>;
  discoveredRaw: IngestRecord[];
  normalized: NormalizeResult[];
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
};

export type {
  ClassifiedIngestRecord,
  IngestClassification,
  IngestRecord,
  IngestRejectReason,
  IngestionRunReport,
  ProvenanceRecord,
};
