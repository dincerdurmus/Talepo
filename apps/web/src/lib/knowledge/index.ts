/**
 * Universal Catalog & Request Knowledge Engine V1
 *
 * Responsibilities:
 * - WHAT EXISTS (browse)
 * - WHAT MATTERS (request schema)
 * - WHAT TO ASK NEXT (question resolver)
 * - Safe ingestion foundation (dry-run / apply guard)
 *
 * Non-goals: second request-understanding brain, parallel category tree,
 * auto-apply production catalog mutations, large crawls.
 */

export type {
  KnowledgeCapability,
  ExternalIngestionPolicy,
  BrowseNode,
  BrowseContext,
  BrowseNodeKind,
  KnowledgeField,
  KnowledgeProfile,
  ProvenanceRecord,
  CatalogGap,
  IngestRecord,
  ClassifiedIngestRecord,
  IngestionRunReport,
  KnowledgeSourceType,
  IngestClassification,
  IngestRejectReason,
} from "./types";

export { foldLabel, subcategorySlug, profileId } from "./slug";
export {
  DOMAIN_KNOWLEDGE_PROFILES,
  SUBCATEGORY_KNOWLEDGE_PROFILES,
  ALL_KNOWLEDGE_PROFILES,
} from "./profiles";
export {
  resolveKnowledgeProfile,
  listDomainKnowledgeProfiles,
  listSubcategoryKnowledgeProfiles,
  getKnowledgeProfileById,
  profileHasCapability,
  profilesForExternalPolicy,
  auditCategoryTreeCoverage,
} from "./profile-registry";

export {
  getRootCategories,
  getCategoryChildren,
  getBrowseChildren,
  getBrands,
  getModels,
  getGenerations,
  getVariants,
  getParts,
  applyBrowseSelection,
  isExplicitBrowseField,
} from "./browse";

export {
  resolveRequestSchema,
  getRequiredFields,
  getOptionalFields,
  getConditionalFields,
  getMissingRequiredFields,
  getNextMissingFields,
} from "./request-schema";

export { resolveNextQuestions } from "./question-resolver";

export {
  runCatalogIngestion,
  categoriesEligibleForExternalIngest,
  classifyIngestRecord,
  canAutoSafeSource,
  createStubSourceAdapter,
  EMPTY_ADAPTERS,
} from "./ingestion";

export {
  AUTOMOTIVE_EQUIVALENCE_FREE_TEXT,
  AUTOMOTIVE_EQUIVALENCE_BROWSE_PATH,
  compareFreeTextAndBrowseEquivalence,
  resolveBrowsePathToCatalogFacts,
  resolveFreeTextToCatalogFacts,
  browsePathToExplicitFields,
} from "./automotive-equivalence";

export { createCatalogGap, canPromoteGapToProduction } from "./gap";
