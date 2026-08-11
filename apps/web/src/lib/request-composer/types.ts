/**
 * Hybrid Request Composer — canonical state contract.
 * Wraps understandRequest() output; does not re-parse intent/category.
 */

import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";

/** Field value semantics — UNKNOWN ≠ ANY. */
export type FieldValueKind = "VALUE" | "UNKNOWN" | "ANY" | "NOT_APPLICABLE";

export type FieldProvenance =
  | "EXPLICIT_TEXT"
  | "EXPLICIT_BROWSE"
  | "INFERRED"
  | "CATALOG_ENRICHED";

export type LastUserAction = "text" | "browse";

export type CanonicalFieldState = {
  kind: FieldValueKind;
  /** Concrete value when kind === VALUE; optional label for ANY/NA. */
  value?: string | null;
  provenance: FieldProvenance;
  confidence?: number;
  evidence?: string[];
};

export type BrowsePathStep = {
  id: string;
  kind: string;
  label: string;
  entityId?: string;
};

export type CanonicalRequestState = {
  version: "hybrid-v1";
  /** Sole understanding authority snapshot (from understandRequest). */
  understanding: RequestUnderstandingResult;
  fields: Record<string, CanonicalFieldState>;
  categoryId: string | null;
  subcategorySlug: string | null;
  taxonomyNodeId: string | null;
  lastUserAction?: LastUserAction;
  /** When true, UI should refresh composed natural text. */
  naturalTextDirty: boolean;
  /** Last text produced by composeNaturalRequestText — used for loop prevention. */
  lastComposedText?: string;
  syncGeneration: number;
};

export const FIELD_SENTINEL = {
  ANY: "__ANY__",
  NOT_APPLICABLE: "__NOT_APPLICABLE__",
} as const;

export function isAnySentinel(value: string | null | undefined): boolean {
  if (value == null) return false;
  const v = value.trim();
  return (
    v === FIELD_SENTINEL.ANY ||
    v === "ANY" ||
    v.toLocaleLowerCase("tr-TR") === "farketmez" ||
    v.toLocaleLowerCase("tr-TR") === "fark etmez"
  );
}

export function isNotApplicableSentinel(
  value: string | null | undefined,
): boolean {
  if (value == null) return false;
  const v = value.trim();
  return v === FIELD_SENTINEL.NOT_APPLICABLE || v === "NOT_APPLICABLE";
}
