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
import { toResolverFieldBag } from "./build-state";
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
import { isFieldCompatibleWithCategory } from "./request-transition";

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
  furnitureType: "Ürün",
  applianceType: "Ürün",
  propertyType: "Konut tipi",
  listingType: "İlan",
  screenSize: "Ekran",
  resolution: "Çözünürlük",
  condition: "Durum",
  part: "Parça",
  partPosition: "Konum",
  partSystem: "Sistem",
  color: "Renk",
  engine: "Motor",
  transmission: "Şanzıman",
  needType: "Talep türü",
  modelYear: "Model yılı",
  yearMin: "En düşük yıl",
  yearMax: "En yüksek yıl",
  city: "Şehir",
};

const NEED_TYPE_DISPLAY: Record<string, string> = {
  vehicle: "Araç",
  part: "Yedek parça",
  service: "Bakım / servis",
  tire: "Lastik",
  machine: "Makine",
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
  "needType",
  "furnitureType",
  "applianceType",
  "propertyType",
  "listingType",
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
  "modelYear",
  "yearMin",
  "yearMax",
  "city",
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

  // RE listing column: Satılık / Kiralık → listingType
  if (node.kind === "subcategory" && node.meta?.listingType) {
    return {
      key: "listingType",
      value: String(node.meta.listingType),
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

  // Real-estate property types → propertyType (not generic productType)
  if (
    node.categoryId === "real-estate" &&
    (node.kind === "product_type" || node.meta?.propertyType)
  ) {
    return {
      key: "propertyType",
      value: String(node.meta?.propertyType ?? node.label),
      entityId: node.entityId ?? node.id,
    };
  }

  // Ev Mobilyası product types → furnitureType
  if (node.categoryId === "furniture" && node.kind === "product_type") {
    return {
      key: "furnitureType",
      value: node.label,
      entityId: node.entityId ?? node.id,
    };
  }

  // Appliances product types → applianceType
  if (node.categoryId === "appliances" && node.kind === "product_type") {
    return {
      key: "applianceType",
      value: node.label,
      entityId: node.entityId ?? node.id,
    };
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

  const need =
    state.fields.needType?.kind === "VALUE"
      ? String(state.fields.needType.value ?? "").toLowerCase()
      : "";
  const isPartNeed =
    need === "part" ||
    need === "tire" ||
    state.understanding.requestSubject.kind.value === "PART" ||
    state.subcategorySlug === "yedek-parca";

  for (const key of DISPLAY_PRIORITY) {
    const field = state.fields[key];
    if (!field || seen.has(key)) continue;
    if (field.kind === "NOT_APPLICABLE") continue;
    if (
      field.kind === "UNKNOWN" &&
      !field.excludedValues?.length
    ) {
      continue;
    }
    if (
      !isFieldCompatibleWithCategory(
        key,
        state.categoryId ?? state.understanding.category.value,
      )
    ) {
      continue;
    }

    let displayValue: string | null = null;
    if (field.kind === "ANY") {
      displayValue = "Farketmez";
    } else if (field.kind === "VALUE" && field.value?.trim()) {
      if (key === "needType") {
        displayValue =
          NEED_TYPE_DISPLAY[field.value.trim().toLowerCase()] ??
          field.value.trim();
      } else if (key === "screenSize") {
        displayValue = `${field.value.trim()} ekran`;
      } else if (key === "yearMin") {
        displayValue = `${field.value.trim()} ve üstü`;
      } else if (key === "yearMax") {
        displayValue = `${field.value.trim()} ve altı`;
      } else {
        displayValue = field.value.trim();
      }
    }
    if (!displayValue && !(field.excludedValues?.length)) continue;

    if (displayValue) {
      seen.add(key);
      let label = fieldLabel(key);
      if (isPartNeed && key === "brand") label = "Uyumlu marka";
      if (isPartNeed && key === "model") label = "Uyumlu model";
      if (isPartNeed && key === "generation") label = "Uyumlu nesil";
      if (isPartNeed && key === "condition") label = "Parça durumu";

      facts.push({
        key,
        label,
        displayValue,
      });
    }

    if (field.excludedValues?.length) {
      const exclKey = `${key}:excluded`;
      if (!seen.has(exclKey)) {
        seen.add(exclKey);
        let label = fieldLabel(key);
        if (isPartNeed && key === "brand") label = "Uyumlu marka";
        if (isPartNeed && key === "model") label = "Uyumlu model";
        facts.push({
          key: exclKey,
          label: `${label} hariç`,
          displayValue: field.excludedValues.join(", "),
        });
      }
    }
  }

  return facts;
}

export function understoodFactsToSummaryChips(
  facts: UnderstoodFact[],
): Array<{ fieldKey: string; label: string; displayValue: string }> {
  return facts.map((f) => ({
    fieldKey: f.key.includes(":") ? f.key.split(":")[0]! : f.key,
    label: f.label,
    displayValue: f.displayValue,
  }));
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
  const values = toResolverFieldBag(state);
  const categoryId =
    state.categoryId ?? state.understanding.category.value ?? null;
  if (!categoryId) return [];
  const schema = resolveRequestSchema({
    categoryId,
    subcategorySlug: state.subcategorySlug,
    values,
  });

  const isAutoSpare =
    categoryId === "automotive" &&
    (values.needType === "part" ||
      state.understanding.requestSubject.kind.value === "PART");

  // next first, then optional — one row per fieldKey (next∪optional often overlaps)
  const seen = new Set<string>();
  const candidates: KnowledgeField[] = [];
  for (const field of [...q.next, ...q.optionalUseful]) {
    if (seen.has(field.key)) continue;
    seen.add(field.key);
    const kind = state.fields[field.key]?.kind;
    if (kind === "ANY" || kind === "VALUE" || kind === "NOT_APPLICABLE") {
      continue;
    }
    if (isAutoSpare && (field.key === "condition" || field.key === "bodyCondition")) {
      continue;
    }
    candidates.push(field);
  }

  const groups: QuickSelectGroup[] = [];
  for (const field of candidates) {
    if (groups.length >= maxGroups) break;
    // Prefer question field (correct visibility/options); schema is value-aware fallback
    const schemaField = schema.fields.find((f) => f.key === field.key);
    const options = quickOptionsForField(schemaField ?? field);
    if (options.length === 0) continue;
    groups.push({
      fieldKey: field.key,
      label:
        field.canonicalLabel ||
        schemaField?.canonicalLabel ||
        fieldLabel(field.key),
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
    categoryId: "",
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
  } else if (
    node.kind === "group" &&
    typeof node.meta?.subcategorySlug === "string"
  ) {
    next.categoryId = node.categoryId || next.categoryId;
    next.subcategorySlug = node.meta.subcategorySlug;
  }
  return next;
}

/** Truncate stack to columnIndex, then push node (sahibinden-style column click). */
export function selectBrowseWalkAtColumn(
  walk: BrowseWalkState,
  columnIndex: number,
  node: BrowseNode,
): BrowseWalkState {
  const baseStack = walk.stack.slice(0, Math.max(0, columnIndex));
  const parent = baseStack[baseStack.length - 1] ?? null;
  let base: BrowseWalkState = {
    parentId: parent?.id ?? null,
    stack: baseStack,
    categoryId: walk.categoryId,
    subcategorySlug: walk.subcategorySlug,
  };
  if (baseStack.length === 0) {
    base = createBrowseWalkState();
  } else {
    // Re-derive category/sub from truncated stack
    for (const step of baseStack) {
      if (step.kind === "category") {
        base.categoryId = step.categoryId || step.id;
        base.subcategorySlug = null;
      } else if (step.kind === "subcategory") {
        base.categoryId = step.categoryId;
        base.subcategorySlug =
          (step.meta?.subcategorySlug as string | undefined) ??
          step.id.split("/")[1] ??
          null;
      }
    }
  }
  return advanceBrowseWalk(base, node);
}

/**
 * Columns for cascade UI: [root options, children of stack[0], …, children of stack[n-1]].
 * Always includes one "next" column when the leaf has children (or stack empty → root only).
 */
export function listBrowseCascadeColumns(walk: BrowseWalkState): BrowseNode[][] {
  const columns: BrowseNode[][] = [];
  let cursor: BrowseWalkState = createBrowseWalkState();
  // Column 0 = roots (same category defaults as empty walk)
  columns.push(listBrowseOptions(cursor));

  for (const node of walk.stack) {
    cursor = advanceBrowseWalk(cursor, node);
    const children = listBrowseOptions(cursor);
    if (children.length === 0) break;
    columns.push(children);
  }
  return columns;
}

function matchBrowseNode(
  options: BrowseNode[],
  step: BrowsePathStep,
): BrowseNode | null {
  const byId = options.find((o) => o.id === step.id);
  if (byId) return byId;
  if (step.entityId) {
    const byEntity = options.find((o) => o.entityId === step.entityId);
    if (byEntity) return byEntity;
  }
  const fold = (s: string) => s.toLocaleLowerCase("tr-TR");
  const byLabel = options.find((o) => fold(o.label) === fold(step.label));
  return byLabel ?? null;
}

/**
 * Align local walk columns with resolveBrowsePath(state) after text sync.
 * Best-effort: skips steps that cannot be matched in the live browse tree.
 */
export function browseWalkFromPath(path: BrowsePathStep[]): BrowseWalkState {
  let walk = createBrowseWalkState();
  if (path.length === 0) return walk;

  for (const step of path) {
    const options = listBrowseOptions(walk);
    const node = matchBrowseNode(options, step);
    if (!node) {
      // Path step not in current children — stop; keep partial walk
      break;
    }
    walk = advanceBrowseWalk(walk, node);
  }
  return walk;
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
