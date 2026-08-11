/**
 * Build CanonicalRequestState from understandRequest() + optional browse bag.
 * Does not re-parse intent/category — maps RU output into hybrid field semantics.
 */

import {
  seedFieldValuesFromUnderstanding,
  resolveSchemaCategory,
} from "@/lib/request-understanding/activation-bridge";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
import { getTaxonomyNode } from "@/lib/taxonomy";

import {
  applyAnyBindingsToFields,
  extractFieldScopedAny,
} from "./any-language";
import {
  cleanBrandToken,
  cleanModelToken,
  extractProductTypeHint,
  extractResolution,
  extractScreenSize,
} from "./attribute-hints";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
  FieldProvenance,
  LastUserAction,
} from "./types";
import { FIELD_SENTINEL, isAnySentinel, isNotApplicableSentinel } from "./types";

function mapRuProvenance(
  provenance: "EXPLICIT" | "INFERRED" | undefined,
  source?: string,
): FieldProvenance {
  if (source === "FUTURE_KNOWLEDGE" || source === "PRODUCT_IDENTITY") {
    if (provenance === "INFERRED") return "CATALOG_ENRICHED";
  }
  if (provenance === "EXPLICIT") return "EXPLICIT_TEXT";
  return "INFERRED";
}

function valueField(
  value: string,
  provenance: FieldProvenance,
  confidence?: number,
  evidence?: string[],
): CanonicalFieldState {
  return {
    kind: "VALUE",
    value,
    provenance,
    confidence,
    evidence,
  };
}

function unknownField(): CanonicalFieldState {
  return {
    kind: "UNKNOWN",
    value: null,
    provenance: "INFERRED",
    confidence: 0,
  };
}

function flattenUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const obj = value as { value?: unknown; unit?: string };
    if (obj.value != null && obj.unit) return `${obj.value} ${obj.unit}`;
    if (obj.value != null) return String(obj.value);
  }
  return String(value);
}

/**
 * Convert understanding + raw text hints into hybrid field map.
 */
export function mapUnderstandingToFields(
  result: RequestUnderstandingResult,
): Record<string, CanonicalFieldState> {
  const fields: Record<string, CanonicalFieldState> = {};
  const raw = result.rawInput ?? "";

  const screenSize = extractScreenSize(raw);
  const resolution = extractResolution(raw);
  const productHint = extractProductTypeHint(raw);

  const brandRaw = cleanBrandToken(
    result.identity.brand?.value
      ? String(result.identity.brand.value)
      : result.requestSubject.parentEntity?.brand?.value
        ? String(result.requestSubject.parentEntity.brand.value)
        : null,
  );
  const modelRaw = cleanModelToken(
    result.identity.model?.value
      ? String(result.identity.model.value)
      : result.requestSubject.parentEntity?.model?.value
        ? String(result.requestSubject.parentEntity.model.value)
        : null,
    { screenSize },
  );

  if (brandRaw && result.identity.brand) {
    fields.brand = valueField(
      brandRaw,
      mapRuProvenance(
        result.identity.brand.provenance,
        result.identity.brand.source,
      ),
      result.identity.brand.confidence,
      result.identity.brand.evidence,
    );
  } else if (brandRaw) {
    fields.brand = valueField(brandRaw, "INFERRED", 0.6);
  } else {
    fields.brand = unknownField();
  }

  if (modelRaw && result.identity.model) {
    fields.model = valueField(
      modelRaw,
      mapRuProvenance(
        result.identity.model.provenance,
        result.identity.model.source,
      ),
      result.identity.model.confidence,
      result.identity.model.evidence,
    );
  } else if (modelRaw) {
    fields.model = valueField(modelRaw, "INFERRED", 0.5);
  } else {
    fields.model = unknownField();
  }

  if (result.condition?.value && result.condition.value !== "UNKNOWN") {
    const label =
      result.condition.value === "NEW"
        ? "Sıfır"
        : result.condition.value === "USED"
          ? "İkinci el"
          : result.condition.value === "REFURBISHED"
            ? "Yenilenmiş"
            : String(result.condition.value);
    fields.condition = valueField(
      label,
      mapRuProvenance(result.condition.provenance, result.condition.source),
      result.condition.confidence,
    );
  } else {
    fields.condition = unknownField();
  }

  if (result.subject.productType?.value) {
    fields.productType = valueField(
      String(result.subject.productType.value),
      mapRuProvenance(
        result.subject.productType.provenance,
        result.subject.productType.source,
      ),
    );
  } else if (productHint) {
    fields.productType = valueField(
      productHint.productType,
      "EXPLICIT_TEXT",
      0.9,
      ["product-hint"],
    );
  } else {
    fields.productType = unknownField();
  }

  if (screenSize) {
    fields.screenSize = valueField(screenSize, "EXPLICIT_TEXT", 0.95, [
      `${screenSize} ekran`,
    ]);
  } else {
    fields.screenSize = unknownField();
  }

  if (resolution) {
    fields.resolution = valueField(resolution, "EXPLICIT_TEXT", 0.9, [
      resolution,
    ]);
  } else {
    fields.resolution = unknownField();
  }

  // Seed remaining attributes from RU
  for (const [key, uv] of Object.entries(result.attributes)) {
    if (fields[key]?.kind === "VALUE" || fields[key]?.kind === "ANY") continue;
    const flat = flattenUnknown(uv.value);
    if (!flat.trim()) continue;
    fields[key] = valueField(
      flat,
      mapRuProvenance(uv.provenance, uv.source),
      uv.confidence,
      uv.evidence,
    );
  }

  if (result.requestSubject.displayPhrase?.value) {
    fields.part = valueField(
      String(result.requestSubject.displayPhrase.value),
      mapRuProvenance(
        result.requestSubject.displayPhrase.provenance,
        result.requestSubject.displayPhrase.source,
      ),
    );
  } else if (result.requestSubject.name?.value) {
    fields.part = valueField(
      String(result.requestSubject.name.value),
      mapRuProvenance(
        result.requestSubject.name.provenance,
        result.requestSubject.name.source,
      ),
    );
  }

  if (result.requestSubject.position?.value) {
    fields.partPosition = valueField(
      String(result.requestSubject.position.value),
      mapRuProvenance(
        result.requestSubject.position.provenance,
        result.requestSubject.position.source,
      ),
    );
  }

  if (result.quantity?.value?.value != null) {
    fields.quantity = valueField(
      String(result.quantity.value.value),
      mapRuProvenance(result.quantity.provenance, result.quantity.source),
    );
  } else {
    fields.quantity = fields.quantity ?? unknownField();
  }

  if (result.attributes.color) {
    fields.color = valueField(
      flattenUnknown(result.attributes.color.value),
      mapRuProvenance(
        result.attributes.color.provenance,
        result.attributes.color.source,
      ),
    );
  } else {
    fields.color = fields.color ?? unknownField();
  }

  // Field-scoped ANY post-process
  const bindings = extractFieldScopedAny(raw);
  const withAny = applyAnyBindingsToFields(fields, bindings);

  // If brand is ANY, drop conflicting concrete brand from weak identity
  if (withAny.brand?.kind === "ANY") {
    // keep ANY
  }

  return withAny;
}

function taxonomyFromUnderstanding(
  result: RequestUnderstandingResult,
  fields: Record<string, CanonicalFieldState>,
): { categoryId: string | null; subcategorySlug: string | null; taxonomyNodeId: string | null } {
  const schema = resolveSchemaCategory(result);
  let categoryId =
    result.category.status !== "UNKNOWN" && result.category.value
      ? result.category.value
      : schema.provisional
        ? schema.categoryId
        : result.category.value;

  const productHint = extractProductTypeHint(result.rawInput);
  let taxonomyNodeId = productHint?.taxonomyNodeId ?? null;
  let subcategorySlug: string | null = null;

  if (taxonomyNodeId) {
    const node = getTaxonomyNode(taxonomyNodeId);
    if (node) {
      categoryId = node.categoryId;
      subcategorySlug = node.subcategoryId ?? null;
    }
  } else if (fields.productType?.kind === "VALUE" && fields.productType.value) {
    // leave as-is
  }

  // Automotive spare defaults
  if (categoryId === "automotive" && result.requestSubject.kind.value === "PART") {
    subcategorySlug = subcategorySlug ?? "yedek-parca";
  }

  // Appliances vacuum → home path stays appliances
  if (!taxonomyNodeId && productHint?.productType === "supurge") {
    categoryId = "appliances";
  }

  return {
    categoryId: categoryId ?? null,
    subcategorySlug,
    taxonomyNodeId,
  };
}

/**
 * Merge optional browse field bag (__explicit__* markers) into hybrid fields.
 */
export function mergeBrowseFieldBag(
  fields: Record<string, CanonicalFieldState>,
  browseFields: Record<string, string> | undefined,
  lastUserAction: LastUserAction | undefined,
): Record<string, CanonicalFieldState> {
  if (!browseFields) return fields;
  const next = { ...fields };

  for (const [key, raw] of Object.entries(browseFields)) {
    if (key.startsWith("__explicit__")) continue;
    if (key.endsWith("Id")) continue;
    const explicit = (browseFields[`__explicit__${key}`] ?? "").trim();
    if (!raw?.trim() && !explicit) continue;

    if (isAnySentinel(raw) || raw === FIELD_SENTINEL.ANY) {
      next[key] = {
        kind: "ANY",
        value: null,
        provenance: "EXPLICIT_BROWSE",
        confidence: 1,
        evidence: ["browse:ANY"],
      };
      continue;
    }
    if (isNotApplicableSentinel(raw)) {
      next[key] = {
        kind: "NOT_APPLICABLE",
        value: null,
        provenance: "EXPLICIT_BROWSE",
        confidence: 1,
      };
      continue;
    }

    const incoming: CanonicalFieldState = {
      kind: "VALUE",
      value: raw.trim(),
      provenance: explicit ? "EXPLICIT_BROWSE" : "INFERRED",
      confidence: explicit ? 1 : 0.6,
      evidence: explicit ? ["browse"] : undefined,
    };

    const existing = next[key];
    if (!canApplyField(existing, incoming, lastUserAction ?? "browse")) {
      continue;
    }
    next[key] = incoming;
  }

  return next;
}

/**
 * Last explicit user action wins between EXPLICIT_TEXT and EXPLICIT_BROWSE.
 * Catalog/inferred never overwrite conflicting EXPLICIT.
 */
export function canApplyField(
  existing: CanonicalFieldState | undefined,
  incoming: CanonicalFieldState,
  lastUserAction: LastUserAction,
): boolean {
  if (!existing || existing.kind === "UNKNOWN") return true;

  if (
    incoming.provenance === "INFERRED" ||
    incoming.provenance === "CATALOG_ENRICHED"
  ) {
    if (
      existing.provenance === "EXPLICIT_TEXT" ||
      existing.provenance === "EXPLICIT_BROWSE"
    ) {
      return false;
    }
    if (existing.kind === "ANY" || existing.kind === "NOT_APPLICABLE") {
      return false;
    }
    return true;
  }

  // Incoming is EXPLICIT_*
  if (existing.kind === "ANY" || existing.kind === "NOT_APPLICABLE") {
    // Explicit concrete value may replace ANY
    return incoming.kind === "VALUE" || incoming.kind === "ANY";
  }

  if (
    existing.provenance === "INFERRED" ||
    existing.provenance === "CATALOG_ENRICHED"
  ) {
    return true;
  }

  // Both explicit — last action wins
  if (
    existing.provenance === "EXPLICIT_TEXT" &&
    incoming.provenance === "EXPLICIT_BROWSE"
  ) {
    return lastUserAction === "browse";
  }
  if (
    existing.provenance === "EXPLICIT_BROWSE" &&
    incoming.provenance === "EXPLICIT_TEXT"
  ) {
    return lastUserAction === "text";
  }

  return true;
}

export function buildCanonicalRequestState(input: {
  understanding: RequestUnderstandingResult;
  browseFields?: Record<string, string>;
  lastUserAction?: LastUserAction;
  previous?: CanonicalRequestState | null;
  /** When rebuilding from new text, drop stale inferred by not merging previous fields. */
  progressiveReset?: boolean;
}): CanonicalRequestState {
  const mapped = mapUnderstandingToFields(input.understanding);
  const fields = mergeBrowseFieldBag(
    mapped,
    input.browseFields,
    input.lastUserAction ?? input.previous?.lastUserAction,
  );

  const tax = taxonomyFromUnderstanding(input.understanding, fields);

  return {
    version: "hybrid-v1",
    understanding: input.understanding,
    fields,
    categoryId: tax.categoryId,
    subcategorySlug: tax.subcategorySlug,
    taxonomyNodeId: tax.taxonomyNodeId,
    lastUserAction: input.lastUserAction ?? input.previous?.lastUserAction,
    naturalTextDirty: true,
    lastComposedText: input.previous?.lastComposedText,
    syncGeneration: (input.previous?.syncGeneration ?? 0) + 1,
  };
}

/** Field bag for question resolver / schema (sentinels for ANY/NA). */
export function toResolverFieldBag(
  state: CanonicalRequestState,
): Record<string, string> {
  const seeded = seedFieldValuesFromUnderstanding(state.understanding);
  const out: Record<string, string> = { ...seeded };

  for (const [key, field] of Object.entries(state.fields)) {
    if (field.kind === "ANY") {
      out[key] = FIELD_SENTINEL.ANY;
      out[`__explicit__${key}`] = state.lastUserAction === "browse" ? "browse" : "text";
    } else if (field.kind === "NOT_APPLICABLE") {
      out[key] = FIELD_SENTINEL.NOT_APPLICABLE;
      out[`__explicit__${key}`] = "text";
    } else if (field.kind === "VALUE" && field.value) {
      out[key] = field.value;
      if (
        field.provenance === "EXPLICIT_TEXT" ||
        field.provenance === "EXPLICIT_BROWSE"
      ) {
        out[`__explicit__${key}`] =
          field.provenance === "EXPLICIT_BROWSE" ? "browse" : "text";
      }
    }
  }

  if (state.categoryId === "automotive" && !out.needType) {
    if (state.understanding.requestSubject.kind.value === "PART") {
      out.needType = "part";
    }
  }

  return out;
}

export function getFieldKind(
  state: CanonicalRequestState,
  key: string,
): CanonicalFieldState["kind"] {
  return state.fields[key]?.kind ?? "UNKNOWN";
}
