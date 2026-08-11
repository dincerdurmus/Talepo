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
  findTaxonomyTypeUnderSubcategory,
  resolveTaxonomyAlias,
  resolveSchemaIdForNode,
  listAllTaxonomyNodes,
  isTaxonomyLeaf,
  taxonomyNodeHasChildren,
  getTaxonomyAncestorIds,
  getTaxonomyDescendantIds,
} from "./registry";

export { getRequestSchemaForNode } from "./schema-bridge";
export { auditTaxonomyCoverage } from "./audit";
