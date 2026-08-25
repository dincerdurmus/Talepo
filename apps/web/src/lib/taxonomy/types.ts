/**
 * Talepo Universal Master Taxonomy V1 — node model.
 * Authority for category roots remains REQUEST_CATEGORIES (11 / 59).
 * CatalogRegistry remains automotive brand/model/generation entity authority.
 */

export type TaxonomyNodeType =
  | "CATEGORY"
  | "SUBCATEGORY"
  | "GROUP"
  | "PRODUCT_TYPE"
  | "PART_TYPE"
  | "SERVICE_TYPE"
  | "COMMODITY_TYPE"
  | "TECHNICAL_TYPE";

export type TaxonomyNodeStatus = "active" | "draft" | "deprecated";

export type TaxonomyProvenance = {
  source: string;
  note?: string;
  reviewedAt?: string;
};

export type TaxonomyNode = {
  id: string;
  parentId: string | null;
  canonicalName: string;
  aliases: string[];
  /** Aliases that are common but ambiguous (precision-first flag). */
  ambiguousAliases?: string[];
  nodeType: TaxonomyNodeType;
  categoryId: string;
  subcategoryId?: string;
  depth: number;
  searchTerms: string[];
  applicableCapabilities: string[];
  requestSchemaId?: string;
  status: TaxonomyNodeStatus;
  provenance?: TaxonomyProvenance;
  /** Align with CatalogRegistry part system / subsystem ids when present. */
  catalogSystemId?: string;
  catalogSubsystemId?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type TaxonomyFile = {
  domain: string;
  version: string;
  nodes: TaxonomyNode[];
};

export type TaxonomyManifest = {
  version: string;
  generatedAt?: string;
  domains: Array<{
    id: string;
    files: string[];
  }>;
  notes?: string[];
};

export type AliasHit = {
  node: TaxonomyNode;
  matchedAlias: string;
  ambiguous: boolean;
  /**
   * DÜĞÜM BELİRSİZ AMA AD BELİRSİZ DEĞİL (KB-15).
   *
   * Bir ifade birden çok düğüme çözülebilir ve o düğümlerin HEPSİ aynı
   * kanonik adı taşıyabilir. Ölçülen vaka: "Toplantı Masası" taksonomide iki
   * kez tanımlı; `ambiguous` doğru olduğu için ipucu çözücüsü ifadeyi
   * tamamen atıyor ve kullanıcıya "ne tür mobilya?" diye tekrar soruluyordu.
   *
   * Hangi DÜĞÜM olduğu gerçekten belirsizdir ve uydurulmaz (`taxonomyNodeId`
   * boş kalır); ama ÜRÜN TÜRÜ adı belirsiz değildir ve alana yazılabilir.
   */
  canonicalNameUnambiguous: boolean;
};

export type TaxonomyCoverageReport = {
  nodeCount: number;
  leafCount: number;
  maxDepth: number;
  avgDepth: number;
  aliasCount: number;
  requestSchemaCoverage: number;
  emptyParents: string[];
  orphans: string[];
  cycles: string[];
  duplicateCanonical: Array<{ key: string; ids: string[] }>;
  aliasCollisions: Array<{ alias: string; ids: string[] }>;
  shallowBranches: Array<{ id: string; depth: number; childCount: number }>;
  otherDependency: Array<{ categoryId: string; subcategoryId: string; leafCount: number }>;
  perDomain: Record<
    string,
    {
      nodeCount: number;
      leafCount: number;
      maxDepth: number;
      subcategoryCoverage: number;
    }
  >;
  scores: {
    structural: number;
    leaf: number;
    alias: number;
    schema: number;
  };
};
