/** Canonical product condition — global enum, not brand-specific */
export type ProductCondition = "NEW" | "USED" | "REFURBISHED" | "UNKNOWN";

export type ProductIdentifiers = {
  sku?: string | null;
  gtin?: string | null;
  ean?: string | null;
  upc?: string | null;
  mpn?: string | null;
};

export type SemanticFieldClass =
  | "brand-like"
  | "model-like"
  | "series-like"
  | "variant-like"
  | "sku-like"
  | "gtin-like"
  | "capacity-like"
  | "storage-like"
  | "size-like"
  | "year-like"
  | "condition-like"
  | "product-type-like"
  | "part-type-like"
  | "energy-like"
  | "other";

/** Talepo-side normalized product identity (provider-independent) */
export type ProductIdentity = {
  categoryId: string;
  brand: string | null;
  brandConfidence: number;
  productType: string | null;
  model: string | null;
  series: string | null;
  variant: string | null;
  condition: ProductCondition;
  identifiers: ProductIdentifiers;
  attributes: Record<string, string>;
  semanticFields: Record<string, SemanticFieldClass>;
  fingerprint: string | null;
  confidence: number;
  providerQuery: string;
};

/** External listing normalized to common shape — matcher never reads provider raw */
export type NormalizedExternalProduct = {
  provider: string;
  externalId: string;
  title: string;
  brand: string | null;
  productType: string | null;
  model: string | null;
  series: string | null;
  variant: string | null;
  identifiers: ProductIdentifiers;
  condition: ProductCondition;
  attributes: Record<string, string>;
  price: number;
  currency: string;
  seller: string | null;
  url: string | null;
  observedAt: Date;
};

export type MatchScoreLayers = {
  identityScore: number;
  attributeScore: number;
  titleScore: number;
  conditionScore: number;
  identifierScore: number;
};

export type MatchQualityResult = {
  score: number;
  passed: boolean;
  hardReject: boolean;
  reasons: string[];
  mismatches: string[];
  layers: MatchScoreLayers;
};

/** Optional future brand knowledge — not seeded in V1 */
export type BrandAliasEntry = {
  canonical: string;
  aliases: string[];
  confidence: number;
  source: "learned" | "manual";
};

export type BrandMemoryStore = {
  resolve(input: string): { canonical: string | null; confidence: number };
  remember(entry: BrandAliasEntry): void;
};
