/**
 * Generic Catalog / Knowledge Registry types.
 * Domain-agnostic — automotive is the first provider, not the architecture.
 */

export type CatalogDomainId =
  | "automotive"
  | "appliances"
  | "technology"
  | "machinery"
  | "printing"
  | "home-kitchen"
  | "furniture";

export type CatalogMatchMode = "exact" | "normalized" | "alias";

export type CatalogConfidence =
  | "exact"
  | "high"
  | "medium"
  | "low"
  | "unverified";

export type CatalogEntityHit<T = unknown> = {
  id: string;
  label: string;
  confidence: CatalogConfidence;
  matchMode: CatalogMatchMode;
  entity: T;
};

export type CatalogDomainProvider = {
  domainId: CatalogDomainId;
  version: string;
  ready: boolean;
  /** Build indexes once; subsequent calls return the cached instance. */
  ensureReady(): void;
};

export type CatalogOemLookup = {
  number: string;
  status: "resolved" | "unresolved";
  confidence: CatalogConfidence;
  partId?: string;
  brandId?: string;
  modelId?: string;
};

export type CatalogCompatibilityLookup = {
  status: "ready_empty" | "resolved" | "unresolved";
  pairs: Array<{ leftId: string; rightId: string }>;
};
