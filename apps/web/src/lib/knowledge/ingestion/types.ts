import type {
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

export type SourceAdapterContext = {
  categoryId: string;
  subcategorySlug?: string | null;
  policy: ExternalIngestionPolicy;
  dryRun: boolean;
};

export type SourceAdapter = {
  id: SourceAdapterId;
  sourceType: KnowledgeSourceType;
  /** Categories this adapter may serve; empty = none. */
  supportedCategoryIds: string[];
  discover(ctx: SourceAdapterContext): Promise<IngestRecord[]> | IngestRecord[];
};

export type NormalizeResult = {
  record: IngestRecord;
  normalized: Record<string, unknown>;
};

export type CanonicalMapResult = {
  record: IngestRecord;
  canonicalId?: string;
  relations?: Array<{ type: string; targetId: string }>;
  ambiguous?: boolean;
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
  writeArtifacts?: boolean;
};

export type IngestionEngineResult = {
  report: IngestionRunReport;
  safe: ClassifiedIngestRecord[];
  review: ClassifiedIngestRecord[];
  rejected: ClassifiedIngestRecord[];
  conflicts: ClassifiedIngestRecord[];
  skippedCategoryIds: string[];
  artifactDir?: string;
};

export type {
  ClassifiedIngestRecord,
  IngestClassification,
  IngestRecord,
  IngestRejectReason,
  IngestionRunReport,
  ProvenanceRecord,
};
