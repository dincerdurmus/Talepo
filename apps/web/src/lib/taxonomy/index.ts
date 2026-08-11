/**
 * Talepo Universal Master Taxonomy V1
 *
 * Feeds WHAT EXISTS / browse children / schema hints.
 * Does not replace REQUEST_CATEGORIES or CatalogRegistry vehicle graph.
 */

export type {
  TaxonomyNode,
  TaxonomyNodeType,
  TaxonomyNodeStatus,
  TaxonomyProvenance,
  TaxonomyFile,
  TaxonomyManifest,
  AliasHit,
  TaxonomyCoverageReport,
} from "./types";

export { loadAllTaxonomyNodes, loadTaxonomyManifest, resolveTaxonomyRoot } from "./loader";

export {
  ensureTaxonomyLoaded,
  resetTaxonomyRegistry,
  getTaxonomyNode,
  getRootTaxonomyNodes,
  getTaxonomyChildren,
  getTaxonomyNodesByCategory,
  getSubcategoryTaxonomyNode,
  resolveTaxonomyAlias,
  resolveSchemaIdForNode,
  listAllTaxonomyNodes,
  isTaxonomyLeaf,
  taxonomyNodeHasChildren,
} from "./registry";

export { getRequestSchemaForNode } from "./schema-bridge";
export { auditTaxonomyCoverage } from "./audit";
