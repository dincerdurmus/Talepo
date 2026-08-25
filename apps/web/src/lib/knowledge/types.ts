/**
 * Universal Catalog & Request Knowledge Engine — shared types.
 * Does not replace understandRequest() / Single Brain authority.
 */

export type KnowledgeCapability =
  | "ENTITY_CATALOG"
  | "ENTITY_SPEC"
  /**
   * Düğümün kendisi bir PARÇADIR ve bir üst varlıkla uyumluluk taşır.
   * Yönü parçadan üst ürüne doğrudur — "bu ürün parça taşıyabilir" DEMEZ.
   */
  | "ENTITY_COMPATIBILITY"
  /**
   * Düğüm, servis edilebilir bütün bir üründür: kataloğunda o parça
   * bulunmasa bile "… için <parça>" talebinin geçerli üst ürünü olabilir.
   * `ENTITY_COMPATIBILITY`in KARŞI yönüdür ve onun yerine geçmez.
   */
  | "PART_BEARING"
  | "ATTRIBUTE_SCHEMA"
  | "SERVICE_SCHEMA"
  | "COMMODITY_SCHEMA";

export type ExternalIngestionPolicy =
  | "REQUIRED"
  | "SELECTIVE"
  | "DISCOVERY_ONLY"
  | "DISABLED";

export type BrowseNodeKind =
  | "category"
  | "subcategory"
  | "brand"
  | "product_family"
  | "model"
  | "series"
  | "generation"
  | "variant"
  | "part_system"
  | "part"
  | "position"
  | "attribute_bucket"
  | "service_type"
  | "commodity_type"
  /** Master taxonomy GROUP (non-entity domains). */
  | "group"
  /** Master taxonomy PRODUCT_TYPE / leaf product. */
  | "product_type";

export type KnowledgeFieldType =
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "ENUM"
  | "MULTI_SELECT"
  | "RANGE"
  | "DATE"
  | "MEASUREMENT"
  | "ENTITY_REFERENCE";

export type KnowledgeFieldPriority = "required" | "optional" | "conditional";

export type KnowledgeSourceType =
  | "OFFICIAL_MANUFACTURER"
  | "OFFICIAL_EPC"
  | "LICENSED_CATALOG"
  | "OFFICIAL_DISTRIBUTOR"
  | "TRUSTED_DATASET"
  | "STANDARDS_BODY"
  | "MARKETPLACE"
  | "AI_INFERRED"
  | "USER_DISCOVERED"
  | "TALEP_O_ENGINE"
  | "INTERNAL_AUDIT";

export type IngestClassification = "SAFE" | "REVIEW" | "REJECT";

export type IngestRejectReason =
  | "DUPLICATE"
  | "ORPHAN"
  | "AMBIGUOUS"
  | "AMBIGUOUS_MODEL"
  | "LOW_CONFIDENCE"
  | "SOURCE_CONFLICT"
  | "INVALID_RELATION"
  | "INVALID_RANGE"
  | "MISSING_PROVENANCE"
  | "UNSUPPORTED_CATEGORY"
  | "POLICY_DISABLED"
  | "AI_INFERRED_NOT_SAFE"
  | "USER_DISCOVERED_NOT_SAFE"
  | "MARKETPLACE_INSUFFICIENT_AUTHORITY"
  | "OUT_OF_SCOPE"
  | "VARIANT_EXPLOSION"
  | "CATEGORY_SCOPE_UNCLEAR"
  | "SOURCE_UNAVAILABLE"
  | "POSSIBLE_DUPLICATE"
  | "MISSING_REQUIRED_SPEC";

export type BrowseNode = {
  id: string;
  kind: BrowseNodeKind;
  label: string;
  categoryId: string;
  parentId?: string | null;
  /** Stable catalog entity id when available (brand_*, model_*, …). */
  entityId?: string;
  hasChildren: boolean;
  meta?: Record<string, string | number | boolean | null>;
};

export type BrowseContext = {
  categoryId: string;
  subcategorySlug?: string | null;
  brandId?: string | null;
  modelId?: string | null;
  generationId?: string | null;
  partSystemId?: string | null;
  /** Explicit user browse selections (never overwritten by enrichment). */
  selections?: Record<string, string>;
};

export type KnowledgeField = {
  key: string;
  canonicalLabel: string;
  aliases?: string[];
  type: KnowledgeFieldType;
  unit?: string;
  priority: KnowledgeFieldPriority;
  options?: Array<{ label: string; value: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  dependsOn?: string[];
  visibleWhen?: { field: string; in: string[] };
  /**
   * KOMPOZİT ÖLÇÜ KAPSAMASI (KB-15).
   *
   * Kullanıcı "20x15x10" yazdığında bu tek ifade birden çok eksen sorusunu
   * karşılar. Hangi sayının en, hangisinin boy olduğu şemada TANIMLI
   * DEĞİLDİR; bu yüzden eksen alanlarına tek tek değer yazmak uydurma olur.
   * Karşılama bunun yerine burada TİPLİ bir kapsama kararı olarak durur:
   * "şu toplu alan, en az şu kadar bileşen taşıyorsa bu alanı karşılar".
   *
   * Böylece iki bileşenli "20x15" en ve boy'u karşılar ama derinliği
   * KARŞILAMAZ — gerçekten eksik olan eksen sorulmaya devam eder.
   */
  coveredByAggregate?: {
    /** Toplu ölçüyü taşıyan alan (ör. `dimensions`). */
    key: string;
    /** Bu alanı karşılaması için toplu değerin taşıması gereken bileşen sayısı. */
    minComponents: number;
  };
  /**
   * Ürün-kapsamlı alan: yalnız algılanan ürün/makine/hizmet tipi (fold +
   * substring) bu listeden birine değince görünür; bağlam boşsa gizli kalır.
   */
  whenProductTypes?: string[];
  applicableCategories?: string[];
  source?: KnowledgeSourceType;
  /** Maps to existing request-category-engine DynamicField key when present. */
  engineFieldKey?: string;
  /**
   * When true, browse/UI may offer a non-entity "Farketmez" (ANY) option.
   * quantity / productType typically false.
   */
  allowAny?: boolean;
};

export type KnowledgeProfile = {
  /** categoryId or categoryId/subcategorySlug */
  id: string;
  categoryId: string;
  subcategorySlug?: string | null;
  subcategoryLabel?: string | null;
  label: string;
  capabilities: KnowledgeCapability[];
  externalPolicy: ExternalIngestionPolicy;
  browseHierarchy: BrowseNodeKind[];
  notes?: string;
};

export type ProvenanceRecord = {
  sourceType: KnowledgeSourceType;
  sourceName: string;
  sourceRef?: string;
  retrievedAt?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  verificationStatus: string;
};

export type CatalogGap = {
  categoryId: string;
  rawValue: string;
  normalizedValue: string;
  seenCount: number;
  status: "OPEN" | "REVIEWED" | "PROMOTED" | "REJECTED";
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

/** How the ingest row was obtained — fixtures never count as LIVE coverage. */
export type IngestSourceMode = "LIVE" | "OFFLINE_FIXTURE" | "CACHE";

export type IngestRecord = {
  id: string;
  categoryId: string;
  kind: BrowseNodeKind | "entity" | "spec" | "relation";
  payload: Record<string, unknown>;
  provenance: ProvenanceRecord;
  /** LIVE | OFFLINE_FIXTURE | CACHE — required for V2 accounting. */
  sourceMode?: IngestSourceMode;
};

export type ClassifiedIngestRecord = IngestRecord & {
  classification: IngestClassification;
  reasons: IngestRejectReason[];
};

export type IngestionRunReport = {
  runId: string;
  dryRun: boolean;
  applied: boolean;
  startedAt: string;
  finishedAt: string;
  categoryIds: string[];
  adapterIds: string[];
  status?: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
  counts: {
    discovered: number;
    safe: number;
    review: number;
    rejected: number;
    skippedPolicy: number;
    existingMapped?: number;
    newCandidates?: number;
    outOfScope?: number;
    fetchAttempts?: number;
    /** LIVE network/source rows only — fixtures never included. */
    LIVE_SOURCE_RECORDS?: number;
    /** Offline curated fixtures (CI / --offline). */
    FIXTURE_RECORDS?: number;
    /** Cache-served rows. */
    CACHE_RECORDS?: number;
    /** SAFE among LIVE rows only (production-candidate metric). */
    LIVE_SAFE?: number;
    /** REVIEW among LIVE rows only. */
    LIVE_REVIEW?: number;
    LIVE_TRANSMISSION_RECORDS?: number;
    LIVE_ENGINE_RECORDS?: number;
    FIXTURE_TRANSMISSION_RECORDS?: number;
    FIXTURE_ENGINE_RECORDS?: number;
    newTransmissionCandidates?: number;
    newEngineCandidates?: number;
  };
  notes: string[];
};
