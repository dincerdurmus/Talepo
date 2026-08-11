/**
 * Pure UI helpers for Hybrid Request Composer wiring.
 * No React — unit-testable without a browser.
 */

import {
  getBrowseAnyOption,
  getBrowseChildren,
  withBrowseAnyOption,
} from "@/lib/knowledge/browse";
import { resolveRequestSchema } from "@/lib/knowledge/request-schema";
import type { BrowseNode, KnowledgeField } from "@/lib/knowledge/types";

import type { BrowseSelectionInput } from "./apply-browse";
import { resolveHybridQuestions } from "./questions";
import { resolveBrowsePath } from "./resolve-browse-path";
import {
  createBrowseOnlyState,
  createTextOnlyState,
  syncFromBrowse,
  syncFromText,
} from "./sync";
import type { BrowsePathStep, CanonicalRequestState } from "./types";
import { FIELD_SENTINEL, isAnySentinel } from "./types";

export type UnderstoodFact = {
  key: string;
  label: string;
  displayValue: string;
};

export type QuickSelectOption = {
  label: string;
  value: string;
  isAny?: boolean;
};

export type QuickSelectGroup = {
  fieldKey: string;
  label: string;
  options: QuickSelectOption[];
};

const FIELD_LABELS: Record<string, string> = {
  brand: "Marka",
  model: "Model",
  generation: "Nesil",
  productType: "Ürün",
  screenSize: "Ekran",
  resolution: "Çözünürlük",
  condition: "Durum",
  part: "Parça",
  partPosition: "Konum",
  partSystem: "Sistem",
  color: "Renk",
  engine: "Motor",
  transmission: "Şanzıman",
};

const KIND_TO_FIELD: Record<string, string> = {
  brand: "brand",
  model: "model",
  generation: "generation",
  series: "generation",
  part: "part",
  position: "partPosition",
  part_system: "partSystem",
  product_type: "productType",
  service_type: "productType",
  commodity_type: "productType",
};

const DISPLAY_PRIORITY = [
  "productType",
  "brand",
  "model",
  "generation",
  "screenSize",
  "resolution",
  "condition",
  "partSystem",
  "part",
  "partPosition",
  "color",
] as const;

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

export function browseKindToFieldKey(kind: string): string | null {
  return KIND_TO_FIELD[kind] ?? null;
}

/** Map a browse node click → composer selection (null = navigation-only). */
export function browseNodeToSelection(
  node: BrowseNode,
): BrowseSelectionInput | null {
  if (node.meta?.any && node.meta.fieldKey) {
    return {
      key: String(node.meta.fieldKey),
      value: FIELD_SENTINEL.ANY,
      isAny: true,
    };
  }

  if (node.kind === "category" || node.kind === "subcategory") {
    return null;
  }

  if (node.kind === "group") {
    return null;
  }

  const attrMatch = /^attr:([a-zA-Z]+):(.+)$/.exec(node.id);
  if (attrMatch) {
    const key = attrMatch[1]!;
    const value = attrMatch[2]!;
    if (isAnySentinel(value)) {
      return { key, value: FIELD_SENTINEL.ANY, isAny: true };
    }
    return { key, value: node.label.includes("ekran") ? value : node.label || value };
  }

  const fieldKey = browseKindToFieldKey(node.kind);
  if (!fieldKey) return null;

  const value =
    fieldKey === "productType"
      ? node.label.toLocaleLowerCase("tr-TR")
      : node.label;

  return {
    key: fieldKey,
    value,
    entityId: node.entityId,
  };
}

/** Production-safe facts for “Talepo ne anladı?” — no IDs/confidence/provenance. */
export function buildUnderstoodFacts(
  state: CanonicalRequestState | null | undefined,
): UnderstoodFact[] {
  if (!state) return [];
  const facts: UnderstoodFact[] = [];
  const seen = new Set<string>();

  for (const key of DISPLAY_PRIORITY) {
    const field = state.fields[key];
    if (!field || seen.has(key)) continue;
    if (field.kind === "UNKNOWN" || field.kind === "NOT_APPLICABLE") continue;

    let displayValue: string | null = null;
    if (field.kind === "ANY") {
      displayValue = "Farketmez";
    } else if (field.kind === "VALUE" && field.value?.trim()) {
      displayValue =
        key === "screenSize" ? `${field.value.trim()} ekran` : field.value.trim();
    }
    if (!displayValue) continue;

    seen.add(key);
    facts.push({
      key,
      label: fieldLabel(key),
      displayValue,
    });
  }

  return facts;
}

/** Soft-fill publish/form bags from composer — ANY → “Farketmez”. */
export function softFillFromComposerState(
  state: CanonicalRequestState | null | undefined,
): Record<string, string> {
  if (!state) return {};
  const out: Record<string, string> = {};
  for (const [key, field] of Object.entries(state.fields)) {
    if (field.kind === "ANY") {
      out[key] = "Farketmez";
    } else if (field.kind === "VALUE" && field.value?.trim()) {
      out[key] = field.value.trim();
    }
  }
  return out;
}

export function buildQuickSelectGroups(
  state: CanonicalRequestState | null | undefined,
  maxGroups = 2,
): QuickSelectGroup[] {
  if (!state) return [];
  const q = resolveHybridQuestions(state);
  const schema = resolveRequestSchema({
    categoryId:
      state.categoryId ??
      state.understanding.category.value ??
      "appliances",
    subcategorySlug: state.subcategorySlug,
  });

  const candidates = [...q.next, ...q.optionalUseful].filter((f) => {
    const kind = state.fields[f.key]?.kind;
    return kind !== "ANY" && kind !== "VALUE" && kind !== "NOT_APPLICABLE";
  });

  const groups: QuickSelectGroup[] = [];
  for (const field of candidates) {
    if (groups.length >= maxGroups) break;
    const schemaField =
      schema.fields.find((f) => f.key === field.key) ?? field;
    const options = quickOptionsForField(schemaField);
    if (options.length === 0) continue;
    groups.push({
      fieldKey: field.key,
      label: field.canonicalLabel || fieldLabel(field.key),
      options,
    });
  }
  return groups;
}

function quickOptionsForField(field: KnowledgeField): QuickSelectOption[] {
  const fromSchema = (field.options ?? []).map((o) => ({
    label: o.label,
    value: o.value,
    isAny: isAnySentinel(o.value),
  }));
  if (fromSchema.length > 0) {
    return fromSchema.slice(0, 5);
  }

  // High-value defaults when schema has no enum
  if (field.key === "condition") {
    return [
      { label: "Sıfır", value: "Sıfır" },
      { label: "İkinci el", value: "İkinci el" },
      { label: "Farketmez", value: FIELD_SENTINEL.ANY, isAny: true },
    ];
  }
  if (field.key === "resolution") {
    return [
      { label: "4K", value: "4K" },
      { label: "Full HD", value: "Full HD" },
      { label: "Farketmez", value: FIELD_SENTINEL.ANY, isAny: true },
    ];
  }
  if (field.key === "brand" && field.allowAny) {
    return [{ label: "Farketmez", value: FIELD_SENTINEL.ANY, isAny: true }];
  }
  return [];
}

export type BrowseWalkState = {
  parentId: string | null;
  stack: BrowseNode[];
  categoryId: string;
  subcategorySlug: string | null;
};

export function createBrowseWalkState(): BrowseWalkState {
  return {
    parentId: null,
    stack: [],
    categoryId: "appliances",
    subcategorySlug: null,
  };
}

export function listBrowseOptions(walk: BrowseWalkState): BrowseNode[] {
  const context = {
    categoryId: walk.categoryId,
    subcategorySlug: walk.subcategorySlug,
  };
  let children = getBrowseChildren(walk.parentId, context);

  // Prepend Farketmez for brand steps
  const looksLikeBrand =
    children.length > 0 && children.every((c) => c.kind === "brand");
  if (looksLikeBrand) {
    children = withBrowseAnyOption(children, {
      fieldKey: "brand",
      categoryId: walk.categoryId,
      parentId: walk.parentId,
      allowAny: true,
    });
  } else if (
    walk.parentId &&
    (walk.parentId.includes("/donanim") ||
      walk.parentId.includes("televizyon") ||
      walk.parentId.includes("supurge"))
  ) {
    // After product type, offer brand ANY quickly for TV/vacuum
    const brands = children.filter((c) => c.kind === "brand");
    if (brands.length === 0 && children.length === 0) {
      children = [
        getBrowseAnyOption("brand", walk.categoryId, walk.parentId),
      ];
    }
  }

  return children;
}

export function advanceBrowseWalk(
  walk: BrowseWalkState,
  node: BrowseNode,
): BrowseWalkState {
  const next: BrowseWalkState = {
    ...walk,
    stack: [...walk.stack, node],
    parentId: node.id,
  };
  if (node.kind === "category") {
    next.categoryId = node.categoryId || node.id;
    next.subcategorySlug = null;
  } else if (node.kind === "subcategory") {
    next.categoryId = node.categoryId;
    next.subcategorySlug =
      (node.meta?.subcategorySlug as string | undefined) ??
      node.id.split("/")[1] ??
      null;
  }
  return next;
}

/** Simulate the page hook’s text→browse→text path for acceptance tests. */
export function runHybridUiAcceptancePath(input: {
  text?: string;
  browse?: BrowseSelectionInput[];
}): {
  state: CanonicalRequestState;
  text: string;
  path: BrowsePathStep[];
  facts: UnderstoodFact[];
  quick: QuickSelectGroup[];
  brandAsked: boolean;
} {
  let state: CanonicalRequestState;
  let text: string;

  if (input.text && (!input.browse || input.browse.length === 0)) {
    state = createTextOnlyState(input.text);
    text = input.text;
  } else if (!input.text && input.browse?.length) {
    state = createBrowseOnlyState(input.browse);
    text = state.lastComposedText ?? "";
  } else {
    state = createTextOnlyState(input.text ?? " ");
    text = input.text ?? "";
    for (const sel of input.browse ?? []) {
      const r = syncFromBrowse(state, sel);
      state = r.state;
      text = r.composedText;
    }
  }

  // Echo guard: composed text should skip re-parse
  if (state.lastComposedText) {
    const echo = syncFromText(state, state.lastComposedText);
    if (!echo.skipped) {
      // keep state; echo may rebuild if compose differed — still ok
    }
  }

  const questions = resolveHybridQuestions(state);
  return {
    state,
    text,
    path: resolveBrowsePath(state),
    facts: buildUnderstoodFacts(state),
    quick: buildQuickSelectGroups(state),
    brandAsked: questions.next.some((f) => f.key === "brand"),
  };
}

export function applyTextThenBrowse(
  text: string,
  selections: BrowseSelectionInput[],
): { state: CanonicalRequestState; composedText: string } {
  let { state } = syncFromText(null, text);
  let composedText = text;
  for (const sel of selections) {
    const r = syncFromBrowse(state, sel);
    state = r.state;
    composedText = r.composedText;
  }
  return { state, composedText };
}
