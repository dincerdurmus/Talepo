/**
 * Inventory Intelligence V1 — canonical inventory read/search projection.
 * Derived from CompanyInventoryItem fields + Master Taxonomy helpers.
 * Not a second inventory truth; not a second brain.
 */

export const INVENTORY_DISCOVERY_PROJECTION_VERSION = 1 as const;

export type InventorySemanticSubject =
  | "WHOLE_PRODUCT"
  | "PART"
  | "ACCESSORY"
  | "CONSUMABLE"
  | "MACHINE"
  | "VEHICLE"
  | "SERVICE"
  | "UNKNOWN";

export type InventoryCompatibilityTargetKind =
  | "VEHICLE"
  | "MACHINE"
  | "PRODUCT"
  | "UNKNOWN";

export type InventoryCompatibilityTarget = {
  kind: InventoryCompatibilityTargetKind;
  brand?: string;
  model?: string;
  generation?: string;
};

export type InventoryDiscoveryProjection = {
  version: typeof INVENTORY_DISCOVERY_PROJECTION_VERSION;
  kind: "inventory_discovery_projection";
  semanticSubject: InventorySemanticSubject;
  taxonomyNodeIds: string[];
  primaryLeafId: string | null;
  categoryId: string | null;
  subcategorySlug: string | null;
  entityRefs?: Record<string, string>;
  compatibilityTarget?: InventoryCompatibilityTarget;
  attributes: Record<string, string>;
  /** Weak recall only — never authority over subject/taxonomy. */
  normalizedTextHints?: string[];
  provenance: "STRUCTURED" | "DERIVED_PARTIAL" | "LEGACY_EMPTY";
  builtAt: string;
};

export type InventoryMatchLevel = "EXACT" | "STRONG" | "PARTIAL" | "LEGACY";

export type InventoryHardRejectReason =
  | "SUBJECT_MISMATCH"
  | "TAXONOMY_CONFLICT"
  | "MUST_MISMATCH"
  | "EXCLUDED_VALUE"
  | "ENTITY_CONFLICT"
  | "ATTRIBUTE_CONFLICT"
  | "SERVICE_PHYSICAL_MISMATCH";

export type InventoryMatchReason =
  | "SUBJECT_MATCH"
  | "TAXONOMY_EXACT"
  | "TAXONOMY_ANCESTOR"
  | "ENTITY_BRAND_MATCH"
  | "ENTITY_MODEL_MATCH"
  | "ENTITY_GENERATION_MATCH"
  | "ATTRIBUTE_MATCH"
  | "RANGE_MATCH"
  | "PREFERENCE_MATCH"
  | "INVENTORY_RELEVANT"
  | "COMPATIBILITY_TARGET_MATCH"
  | "LEGACY_FALLBACK";

export type InventoryCompatibilityResult = {
  compatible: boolean;
  level?: InventoryMatchLevel;
  hardRejectReasons: InventoryHardRejectReason[];
  matchReasons: InventoryMatchReason[];
  preferenceMatches: string[];
  missingSignals: string[];
  /** Short Turkish labels for Opportunity Center (no raw JSON). */
  reasonLabels: string[];
  path: "CANONICAL" | "DERIVED" | "LEGACY_FALLBACK";
};

/** Structured fields available when building a projection. */
export type InventoryProjectionInput = {
  name: string;
  title?: string | null;
  brand?: string | null;
  model?: string | null;
  generation?: string | null;
  categoryLabel?: string | null;
  /** Taxonomy category id (automotive, appliances, …) when known */
  taxonomyCategoryId?: string | null;
  subcategorySlug?: string | null;
  needType?: string | null;
  part?: string | null;
  partPosition?: string | null;
  condition?: string | null;
  city?: string | null;
  notes?: string | null;
  sku?: string | null;
  quantity?: number | null;
};
