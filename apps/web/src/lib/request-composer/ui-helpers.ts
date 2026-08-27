/**
 * Pure UI helpers for Hybrid Request Composer wiring.
 * No React — unit-testable without a browser.
 */

import {
  formatScreenSizeDisplay,
  resolveFieldOptionLabel,
} from "@/lib/field-display";
import {
  getBrowseAnyOption,
  getBrowseChildren,
  withBrowseAnyOption,
} from "@/lib/knowledge/browse";
import { resolveRequestSchema } from "@/lib/knowledge/request-schema";
import { TURKEY_IL_NAMES, TURKEY_PROVINCES } from "@/lib/geo/turkey-districts";
import { budgetPlaceholderForStrategy } from "@/lib/request-brain/budget-actions";
import type { QuestionCandidate } from "@/lib/request-brain/types";
import {
  COMMON_FIELD_DEFAULTS,
  type DynamicField,
} from "@/lib/request-category-engine";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import type { BrowseNode, KnowledgeField } from "@/lib/knowledge/types";

import {
  isDeliberateNonValueAnswer,
  isInferenceOnlyAnswer,
} from "./answer-authority";
import type { BrowseSelectionInput } from "./apply-browse";
import { toResolverFieldBag } from "./build-state";
import {
  resolveHybridQuestions,
  type HybridQuestionResult,
} from "./questions";
import { resolveBrowsePath } from "./resolve-browse-path";
import {
  createBrowseOnlyState,
  createTextOnlyState,
  syncFromBrowse,
  syncFromText,
} from "./sync";
import type {
  BrowsePathStep,
  CanonicalFieldState,
  CanonicalRequestState,
  FieldValueKind,
} from "./types";
import { FIELD_SENTINEL, isAnySentinel } from "./types";
import { isFieldCompatibleWithCategory } from "./request-transition";
import { sanitizeFactRoles } from "./v2/entity-roles";

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
  screenSize: "Ekran boyutu",
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
  roomCount: "Oda",
  budget: "Bütçe",
  quantity: "Adet",
  delivery: "Zaman",
  /**
   * KB-15: soruyu bastıran her değer kullanıcıya GÖRÜNMEK zorundadır.
   * Görünmeyen bir değer düzeltilemez; görünmeden soruyu kapatmak, tekrar
   * sormaktan daha kötüdür çünkü kullanıcı yanlışı fark edemez.
   */
  dimensions: "Ölçü",
  material: "Malzeme",
  usageArea: "Kullanım alanı",
  seatingCapacity: "Kişi sayısı",
  capacityBtu: "Kapasite (BTU)",
  babyProductType: "Ürün",
};

const NEED_TYPE_DISPLAY: Record<string, string> = {
  vehicle: "Araç",
  part: "Yedek parça",
  service: "Bakım / servis",
  tire: "Lastik",
  machine: "Makine",
  hardware: "Donanım",
  software: "Yazılım",
  accessory: "Aksesuar",
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
  "roomCount",
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
  // KB-15: kullanıcının yazdığı ve soruyu bastıran değerler burada görünür,
  // böylece Signal facts alanından düzeltilebilirler.
  "dimensions",
  "material",
  "usageArea",
  "seatingCapacity",
  "capacityBtu",
  "babyProductType",
  "quantity",
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

  const brandValue =
    state.fields.brand?.kind === "VALUE"
      ? String(state.fields.brand.value ?? "").trim()
      : "";
  const productValue =
    state.fields.productType?.kind === "VALUE"
      ? String(state.fields.productType.value ?? "").trim()
      : state.fields.applianceType?.kind === "VALUE"
        ? String(state.fields.applianceType.value ?? "").trim()
        : "";

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
      displayValue = "Fark etmez";
    } else if (field.kind === "VALUE" && field.value?.trim()) {
      const rawValue = field.value.trim();
      if (key === "brand" || key === "model") {
        const cleaned = sanitizeFactRoles({
          brand: key === "brand" ? rawValue : brandValue,
          model: key === "model" ? rawValue : null,
          productType: productValue,
          rawInput: state.understanding.rawInput,
          categoryId:
            state.categoryId ?? state.understanding.category.value,
        });
        if (key === "brand" && !cleaned.brand) continue;
        if (key === "model" && !cleaned.model) continue;
      }
      if (key === "needType") {
        displayValue =
          NEED_TYPE_DISPLAY[rawValue.toLowerCase()] ??
          resolveFieldOptionLabel({
            value: rawValue,
            fieldKey: key,
            categoryId: state.categoryId ?? state.understanding.category.value,
          });
      } else if (key === "screenSize") {
        displayValue = formatScreenSizeDisplay(
          rawValue,
          state.understanding.rawInput,
        );
      } else if (key === "yearMin") {
        displayValue = `${rawValue} ve üstü`;
      } else if (key === "yearMax") {
        displayValue = `${rawValue} ve altı`;
      } else {
        displayValue = resolveFieldOptionLabel({
          value: rawValue,
          fieldKey: key,
          categoryId: state.categoryId ?? state.understanding.category.value,
        });
        if (
          (key === "productType" ||
            key === "applianceType" ||
            key === "furnitureType") &&
          displayValue === displayValue.toLocaleLowerCase("tr-TR")
        ) {
          displayValue =
            displayValue.charAt(0).toLocaleUpperCase("tr-TR") +
            displayValue.slice(1);
        }
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

  // Surface understanding location when city field is empty (common for RE free-text)
  const locCity = state.understanding.location?.city?.value?.trim();
  if (locCity && !seen.has("city")) {
    seen.add("city");
    facts.push({
      key: "city",
      label: "Konum",
      displayValue: locCity,
    });
  }

  // Budget may arrive as range-only (UNKNOWN kind with range evidence)
  const budgetField = state.fields.budget;
  if (!seen.has("budget") && budgetField?.range) {
    const { min, max, unit } = budgetField.range;
    const unitLabel = unit === "TRY" || !unit ? "TL" : unit;
    let display: string | null = null;
    if (min != null && max != null && min !== max) {
      display = `${new Intl.NumberFormat("tr-TR").format(min)}–${new Intl.NumberFormat("tr-TR").format(max)} ${unitLabel}`;
    } else {
      const amount = max ?? min;
      if (amount != null) {
        display = `${new Intl.NumberFormat("tr-TR").format(amount)} ${unitLabel}`;
      }
    }
    if (display) {
      seen.add("budget");
      facts.push({ key: "budget", label: "Bütçe", displayValue: display });
    }
  }

  return collapseEquivalentFacts(facts, state);
}

/**
 * UYUMLULUK ALANI İKİNCİ BİR SATIR ÜRETEMEZ (KB-15).
 *
 * `furnitureType` / `applianceType` gibi alanlar kalıcılık ve Pro filtresi
 * için doldurulur; ama kanonik `productType` ile AYNI değeri taşıdıklarında
 * kullanıcı aynı bilgiyi iki kez görür ("Ürün: Toplantı Masası" ×2).
 *
 * Birleştirme YALNIZ sunumdadır — `state.fields` ve yayınlanan veri
 * dokunulmaz. Ve yalnız aynı kaynak kanıtı varken yapılır: etiket ve
 * NORMALİZE EDİLMİŞ DEĞER birebir aynı olmalıdır. Etiketleri tesadüfen aynı
 * olan iki farklı bilgi (farklı değerler) birleştirilmez; marka/model gibi
 * ayrı etiketli alanlar zaten etkilenmez.
 */
function collapseEquivalentFacts(
  facts: UnderstoodFact[],
  state: CanonicalRequestState,
): UnderstoodFact[] {
  /** Aynı bilgiyi taşıyan alanlarda kanonik olan gösterilir. */
  const CANONICAL_PREFERENCE = ["productType", "furnitureType", "applianceType"];
  const rank = (key: string) => {
    const i = CANONICAL_PREFERENCE.indexOf(key);
    return i < 0 ? CANONICAL_PREFERENCE.length : i;
  };
  const norm = (v: unknown) =>
    String(v ?? "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ");

  const byIdentity = new Map<string, UnderstoodFact>();
  const order: string[] = [];
  for (const f of facts) {
    const identity = `${norm(f.label)}|${norm(f.displayValue)}`;
    const existing = byIdentity.get(identity);
    if (!existing) {
      byIdentity.set(identity, f);
      order.push(identity);
      continue;
    }
    // Aynı bilgi: kanonik alanı tut, uyumluluk alanını sunumdan düşür.
    if (rank(f.key) < rank(existing.key)) byIdentity.set(identity, f);
  }
  void state;
  return order.map((id) => byIdentity.get(id)!);
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
    } else if (key === "budget" && field.range) {
      const { min, max, unit } = field.range;
      const unitLabel = unit === "TRY" || !unit ? "TL" : unit;
      if (min != null && max != null && min !== max) {
        out[key] = `${new Intl.NumberFormat("tr-TR").format(min)}–${new Intl.NumberFormat("tr-TR").format(max)} ${unitLabel}`;
      } else {
        const amount = max ?? min;
        if (amount != null) {
          out[key] = `${new Intl.NumberFormat("tr-TR").format(amount)} ${unitLabel}`;
        }
      }
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
      } else if (
        step.kind === "group" &&
        typeof step.meta?.subcategorySlug === "string" &&
        step.meta.subcategorySlug
      ) {
        // Donanım hoist: kategori altına alınmış gruplar slug'u kendisi taşır
        base.categoryId = step.categoryId || base.categoryId;
        base.subcategorySlug = step.meta.subcategorySlug;
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

/* ---- NİHAİ RENDER YÜZEYİNİN SEÇENEK LİSTELERİ (D3b taşıması) ---- */

const TURKEY_CITY_OPTIONS = [
  { label: "Tüm Türkiye", value: "Tüm Türkiye" },
  ...TURKEY_IL_NAMES.map((city) => ({ label: city, value: city })),
];

const TURKEY_REAL_ESTATE_LOCATION_OPTIONS = TURKEY_PROVINCES.flatMap(
  (province) =>
    province.ilceler.map((district) => ({
      label: `${province.il} / ${district}`,
      value: `${province.il} / ${district}`,
    })),
);

const COLOR_PREFERENCE_OPTIONS = [
  { label: "Fark Etmez", value: "Fark Etmez" },
  { label: "Siyah", value: "Siyah" },
  { label: "Beyaz", value: "Beyaz" },
  { label: "Gri", value: "Gri" },
  { label: "Kırmızı", value: "Kırmızı" },
  { label: "Mavi", value: "Mavi" },
  { label: "Lacivert", value: "Lacivert" },
  { label: "Yeşil", value: "Yeşil" },
  { label: "Sarı", value: "Sarı" },
  { label: "Turuncu", value: "Turuncu" },
  { label: "Kahverengi", value: "Kahverengi" },
  { label: "Bej", value: "Bej" },
  { label: "Bordo", value: "Bordo" },
];

/**
 * SORU AÇILDIĞINDA NE TASLAK, NE ÖNERİ (D3b, 2026-08-26).
 *
 * `/talep` ekranı aktif soruyu açarken taslağı doğrudan mevcut değerle
 * dolduruyordu. Bu, Talepo'nun KENDİ tahminini seçili bir kullanıcı cevabı
 * gibi gösteriyordu: seçenek `aria-checked="true"` geliyor, mavi seçili
 * stille boyanıyor ve kullanıcı hiçbir şeye dokunmadan "onaylamış" görünüyordu.
 * Tarayıcıda ölçüldü — "İkinci el" ve "Ev" ikisi de böyleydi.
 *
 * Öneri ile cevap ayrı rollerdir. Tahmin faydalıdır ve GÖSTERİLMELİDİR; ama
 * seçim durumunu kullanıcı üretir. Bu yüzden karar tek ölçüte bağlanır:
 * kanonik cevap otoritesi. Alan, kategori ya da senaryo dalı YOKTUR.
 *
 *   INFERRED (yalnız çıkarım) → taslak BOŞ, değer ayrı bir ÖNERİ olarak taşınır
 *   USER_EXPLICIT / kapatmaya yetkili VERIFIED → mevcut davranış aynen korunur
 *   ANY / NOT_APPLICABLE → bilinçli kullanıcı cevaplarıdır, taslakta kalır
 *   UNKNOWN → kanonik değer yoktur; taslak yalnız kullanıcının kendi form
 *             girdisini taşır (varsa), öneri üretilmez
 *
 * Öneri asla seçili durum hesabına girmez: seçim yalnız taslaktan türetilir.
 */
export type QuestionDraftPresentation = {
  /** Seçim durumunu üreten tek kaynak. Çıkarım buraya YAZILMAZ. */
  draftValue: string;
  /** Gösterilecek Talepo tahmini — cevap değildir, seçim üretmez. */
  suggestedValue: string | null;
};

export function resolveQuestionDraftPresentation(
  field: CanonicalFieldState | null | undefined,
  currentValue: string,
): QuestionDraftPresentation {
  if (!isInferenceOnlyAnswer(field)) {
    return { draftValue: currentValue, suggestedValue: null };
  }
  const inferred =
    field?.kind === "VALUE" && field.value != null ? String(field.value) : "";
  /**
   * KULLANICININ KENDİ DEĞERİ SİLİNMEZ.
   *
   * Kanonik alan hâlâ `INFERRED` etiketli olsa bile, o an ekranda duran değer
   * tahminden FARKLIYSA o değer tahminden gelmiş olamaz — kullanıcı bir başka
   * yoldan (ör. "Bilgileri düzenle" paneli) yazmıştır. Taslağı boşaltmak onun
   * girdisini gözden kaybettirir ve reddettiği tahmini geri önerir. Bu yüzden
   * boşaltma YALNIZ ekrandaki değer tahminin kendisi (ya da boş) olduğunda
   * yapılır. Kural yine alan/kategori bağımsızdır: karşılaştırılan tek şey
   * kanonik tahmin ile o anki değerdir.
   */
  const current = currentValue.trim();
  const userOverrode =
    current !== "" && !isUnconfirmedInferredValue(field, currentValue);
  if (userOverrode) {
    return { draftValue: currentValue, suggestedValue: null };
  }
  return {
    draftValue: "",
    suggestedValue: inferred.trim() === "" ? null : inferred,
  };
}

/**
 * "BU DEĞER HÂLÂ ONAYSIZ TAHMİN Mİ?" — TEK KARŞILAŞTIRMA KURALI.
 *
 * İki tüketici aynı soruyu sorar: soru açılırken taslak boşaltılacak mı
 * (`resolveQuestionDraftPresentation`) ve yayın torbasından değer düşülecek mi
 * (`buildPublishFieldValues`). Karşılaştırma kuralı ikisinde ayrı yazılırsa
 * zamanla sessizce ayrışırlar; bu yüzden tek yerde durur.
 *
 * Kural alan/kategori bağımsızdır: değerin kaynağı kanonik cevap
 * otoritesinden okunur; ekrandaki değer tahminin KENDİSİYSE tahmindir,
 * FARKLIYSA kullanıcıya aittir (kullanıcının girdisi tahmine indirgenemez).
 */
export function isUnconfirmedInferredValue(
  field: CanonicalFieldState | null | undefined,
  currentValue: string,
): boolean {
  if (!isInferenceOnlyAnswer(field)) return false;
  const inferred =
    field?.kind === "VALUE" && field.value != null
      ? String(field.value).trim()
      : "";
  const current = currentValue.trim();
  return current !== "" && current === inferred;
}

/**
 * YAYIN DEĞER TORBASI — KULLANICI CEVABI KANALININ TEK KURUCUSU (D3c-a).
 *
 * `/talep` sayfası yayın payload'ının `fields[]` değerlerini bu torbadan
 * okur; sunucu bu değerleri `fieldValues` olarak kalıcılaştırır ve firmalar
 * onları TALEBİN CEVAPLARI olarak görür. Bu yüzden buraya giren her değer
 * "kullanıcının cevabı" iddiasını taşır.
 *
 * `userTouchedKeys`, kullanıcının bu oturumda gerçekten dokunduğu alanların
 * kanonik listesidir — sayfa bunu understanding snapshot'ının
 * `confirmedFieldKeys` girdisiyle AYNI kaynaktan kurar; ikinci bir dokunuş
 * kaydı tutulmaz.
 */
export type PublishFieldValuesInput = {
  /** Kanonik alan durumu — cevap otoritesinin tek kaynağı. */
  canonicalFields: CanonicalRequestState["fields"] | null | undefined;
  /** Form/soft-fill birleşimi değer torbası (`dynamicValues`). */
  values: Record<string, string>;
  /** Kullanıcının dokunduğu anahtarlar (form paneli + onaylanan öneriler). */
  userTouchedKeys: Iterable<string>;
};

/**
 * BİR YAYIN CEVABI — DEĞER VE MOD BİRLİKTE (D3e, 2026-08-27).
 *
 * Torba eskiden yalnız `string` taşıyordu ve bu, DEĞER TAŞIMAYAN cevapları
 * ifade edemiyordu: kullanıcı "Fark etmez" seçtiğinde kanonik durumda
 * `kind:"ANY", value:null` oluşuyor, ama kanala yalnız yerelleştirilmiş
 * `"Fark etmez"` ETİKETİ giriyordu. Sunucu tarafında bu etiket bir DEĞER gibi
 * görünüyor, kullanıcının gerçek tercihi ise ölçülemiyordu.
 *
 * `mode` kanonik `FieldValueKind`tir — yeni bir enum DEĞİL. `value` insanın
 * gördüğü etikettir ve `mode !== "VALUE"` olduğunda otorite kararında
 * KULLANILMAZ; sunucu kararını yalnız `mode` üzerinden verir.
 */
export type PublishFieldAnswer = {
  mode: FieldValueKind;
  value: string;
};

/**
 * Cevabın modu KANONİK ALAN DURUMUNDAN okunur — çağıranın taşıdığı ikinci bir
 * mod listesinden değil.
 *
 * `UNKNOWN` ARTIK TANINIR, AMA YALNIZ BİLİNÇLİYSE (D3f Dilim 1, 2026-08-27).
 * Kanonik modelde `UNKNOWN` aynı zamanda cevaplanmamış her alanın VARSAYILAN
 * durumudur — 108 senaryoluk kapsam tabanında 988 alan böyledir. O yüzden
 * ayrım kaynağa bağlanır: yalnız açık kullanıcı kaynaklı `UNKNOWN` bir mod
 * üretir, varsayılan `UNKNOWN` hiçbir yeni kayıt üretmez ve eskisi gibi
 * `VALUE` davranışını korur (kullanıcının kendi yazdığı metin kaybolmasın).
 *
 * SENTINEL HİÇBİR ZAMAN DEĞER DEĞİLDİR. Değer torbasına kanonik sentinel
 * dizesi düştüğünde (`__ANY__` / `__NOT_APPLICABLE__`) mod o sentinel'den
 * okunur. Eskiden bu durum `VALUE` sayılıyor ve `"__NOT_APPLICABLE__"`
 * metni kullanıcının cevabı olarak kalıcılaşıyordu. Karşılaştırma TAM
 * SABİTLEDİR — yerelleştirilmiş etiket ayrıştırması değildir.
 */
function publishModeOf(
  field: CanonicalFieldState | null | undefined,
  rawValue: string,
): FieldValueKind {
  const value = rawValue.trim();
  if (value === FIELD_SENTINEL.NOT_APPLICABLE) return "NOT_APPLICABLE";
  if (value === FIELD_SENTINEL.ANY) return "ANY";
  if (field?.kind === "ANY") return "ANY";
  if (field?.kind === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  if (field?.kind === "UNKNOWN" && isDeliberateNonValueAnswer(field)) {
    return "UNKNOWN";
  }
  return "VALUE";
}

export function buildPublishFieldValues(
  input: PublishFieldValuesInput,
): Record<string, PublishFieldAnswer> {
  const touched = new Set<string>();
  for (const key of input.userTouchedKeys) touched.add(key);

  const out: Record<string, PublishFieldAnswer> = {};
  for (const [key, value] of Object.entries(input.values)) {
    /**
     * Tek süzme ölçütü kanonik cevap otoritesidir: değer YALNIZ çıkarımdan
     * geliyorsa ve kullanıcı o alana dokunmadıysa kanala yazılmaz — tahmin
     * kanonik durumda ve `inferredSuggestion` önerisinde yaşamaya devam eder.
     * Kullanıcının dokunduğu alan (tahminle AYNI değeri yazmış olsa bile)
     * ve tahminden farklı her değer aynen gider; `VERIFIED` / `USER_EXPLICIT`
     * değerlerin yayın yetkisi `answer-authority` merdiveninden gelir ve
     * burada ikinci bir merdiven kurulmaz.
     */
    if (
      !touched.has(key) &&
      isUnconfirmedInferredValue(input.canonicalFields?.[key], value)
    ) {
      continue;
    }
    out[key] = carriedAnswer(input.canonicalFields?.[key], value);
  }

  /**
   * BİLİNÇLİ CEVAP DEĞER TORBASINA BAĞLI DEĞİLDİR (D3f Dilim 1).
   *
   * Değer taşımayan bir cevabın kanaldaki varlığı, arayüzün o alana bir
   * ETİKET yazmış olmasına bağlı olamazdı: taslak torbası boşsa kullanıcının
   * "Bilmiyorum" cevabı sessizce kaybolurdu. Cevabın kaynağı kanonik
   * durumdur; torba yalnız gösterilen metni taşır.
   */
  for (const [key, field] of Object.entries(input.canonicalFields ?? {})) {
    if (out[key]) continue;
    if (!isDeliberateNonValueAnswer(field)) continue;
    out[key] = carriedAnswer(field, "");
  }
  return out;
}

/** Yayın payload'ının `fields[]` listesindeki bir satırın cevap kısmı. */
export type PublishAnswerField = {
  key: string;
  value: string;
  mode: FieldValueKind;
  /**
   * Kanonik registry'den gelen insan etiketi. Yalnız bu kurucunun KENDİ
   * eklediği ortak alan satırlarında bulunur; görünür dinamik alanların
   * etiketi çağıranın kendi alan tanımından gelir ve burada tekrarlanmaz.
   */
  label?: string;
};

export type PublishAnswerFieldsInput = PublishFieldValuesInput & {
  /**
   * O anda görünür olan dinamik alan anahtarları. Mevcut davranış birebir
   * korunur: bu alanlar cevapları boş olsa da listeye girer.
   */
  dynamicFieldKeys: Iterable<string>;
};

/**
 * YAYIN CEVAP SATIRLARININ TEK KURUCUSU (D3f Dilim 2b, 2026-08-27).
 *
 * SORUN. Sunucunun değer taşımayan cevaplar için tek güvenilir girdisi
 * süzülmüş cevap kanalıdır (`fields[]` → kanonik `mode`). `/talep` o listeyi
 * YALNIZ görünür dinamik alanlardan kuruyordu; ölçüldü (2026-08-27):
 * `commonFields` ile `category.fields` kesişimi 11 kategorinin HEPSİNDE 0.
 * Sonuç: kullanıcı bütçe, şehir, teslim, adet ya da başlık sorusuna bilinçli
 * olarak "Bilmiyorum" / "Fark etmez" dediğinde cevap istemci projection'ında
 * doğru kuruluyor ama sunucuya HİÇ ulaşmıyor ve güven sınırında fail-closed
 * düşüyordu.
 *
 * ELLE BEŞLİ LİSTE YOKTUR. Ortak alan evreni kanonik registry'den türer
 * (`COMMON_FIELD_DEFAULTS`); registry büyürse bu kurucu kendiliğinden büyür
 * ve `if (key === "budget" || ...)` gibi bir zincir hiçbir yerde yazılmaz.
 *
 * YENİ KANAL YOKTUR. Aynı `fields[] + mode` sözleşmesi kullanılır; sunucu
 * tarafı değişmeden ortak alanları da kabul eder.
 *
 * NE EKLENMEZ. Dokunulmamış ya da çıkarımdan gelen ortak alan eklenmez —
 * kanonik modelde `UNKNOWN` cevaplanmamış her alanın varsayılan durumudur ve
 * onu göndermek "ölçülmemişi ölçülmüş göstermek" olurdu. Değer TAŞIYAN ortak
 * alan da eklenmez: onun kendi kalıcı kolonu vardır ve mevcut davranışı bu
 * dilimde değişmez.
 *
 * TEKİLLİK. Bir anahtar iki kez girmez; görünür dinamik alanlar önce yazılır
 * ve ortak alan turu yalnız BOŞTA kalan anahtarları doldurur.
 */
export function buildPublishAnswerFields(
  input: PublishAnswerFieldsInput,
): PublishAnswerField[] {
  const answers = buildPublishFieldValues(input);
  const rows: PublishAnswerField[] = [];
  const seen = new Set<string>();

  for (const key of input.dynamicFieldKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      key,
      value: answers[key]?.value ?? "",
      mode: answers[key]?.mode ?? "VALUE",
    });
  }

  for (const [key, defaults] of Object.entries(COMMON_FIELD_DEFAULTS)) {
    if (seen.has(key)) continue;
    const field = input.canonicalFields?.[key];
    if (!isDeliberateNonValueAnswer(field)) continue;
    const answer = answers[key];
    if (!answer) continue;
    seen.add(key);
    rows.push({
      key,
      value: answer.value,
      mode: answer.mode,
      label: defaults.label,
    });
  }

  return rows;
}

/**
 * DEĞER TAŞIMAYAN CEVABIN ETİKETİ DEĞER OLARAK TAŞINMAZ (D3f Dilim 1).
 *
 * `UNKNOWN` / `NOT_APPLICABLE` bir ürün özelliği DEĞİLDİR; kullanıcının
 * ekranda gördüğü metin ("Henüz bilmiyorum") bu kanalda bir cevap değeri
 * olamaz — sunucu kararını zaten yalnız `mode` üzerinden verir.
 *
 * Kanonik SENTINEL dizesi de hiçbir modda değer olarak taşınmaz: `__ANY__`
 * ve `__NOT_APPLICABLE__` iç kayıt işaretleridir, kullanıcının cevabı
 * değildir. `ANY`nin İNSAN ETİKETİ ("Fark etmez") bilinçli olarak korunur —
 * düzenleme ekranının bugünkü geri yükleme kanalı odur ve kalıcılık ayrı
 * bir dilimin konusudur.
 */
function carriedAnswer(
  field: CanonicalFieldState | null | undefined,
  value: string,
): PublishFieldAnswer {
  const mode = publishModeOf(field, value);
  const trimmed = value.trim();
  const isSentinel =
    trimmed === FIELD_SENTINEL.ANY ||
    trimmed === FIELD_SENTINEL.NOT_APPLICABLE;
  if (mode === "UNKNOWN" || mode === "NOT_APPLICABLE" || isSentinel) {
    return { mode, value: "" };
  }
  return { mode, value };
}

/**
 * SÜZÜLMÜŞ CEVAPLARI KANONİK DURUMA UYGULAR (D3e).
 *
 * Düzenleme ekranının projection'ı bugüne kadar YALNIZ metinden kuruluyordu
 * (`createTextOnlyState`), bu yüzden kullanıcının form/seçim cevapları — ve
 * onlarla birlikte `mode:"ANY"` constraint'in KENDİSİ — kaydedildiği anda
 * projection'dan düşüyordu. Burada aynı süzülmüş torba kanonik duruma
 * uygulanır; uygulama üretimin kendi yolundan (`syncFromBrowse`) geçer,
 * kategoriye ya da alana özel hiçbir dal eklenmez.
 *
 * `rawInput` DEĞİŞMEZ: bu fonksiyon yalnız kanonik durumu zenginleştirir,
 * metne hiçbir sentetik ifade yazmaz.
 */
export function applyPublishAnswersToState(
  state: CanonicalRequestState,
  answers: Record<string, PublishFieldAnswer>,
): CanonicalRequestState {
  let next = state;
  for (const [key, answer] of Object.entries(answers)) {
    const isAny = answer.mode === "ANY";
    if (!isAny && !answer.value.trim()) continue;
    next = syncFromBrowse(next, {
      key,
      value: answer.value,
      isAny,
    }).state;
  }
  return next;
}

/**
 * NİHAİ RENDER YÜZEYİ — TEK OTORİTE (D3b, 2026-08-26).
 *
 * Bu liste, /talep ekranında kullanıcının GERÇEKTEN gördüğü soru listesidir.
 * Daha önce `app/talep/page.tsx` içinde `enrichmentCandidates` adlı bir
 * `useMemo` gövdesi olarak duruyordu ve hiçbir doğrulayıcı tarafından
 * ölçülemiyordu: motor kuyruğu (`next`) ve aday listesi (`candidates`)
 * doğruyken bu son süzgeç bir soruyu sessizce kaldırabiliyordu.
 *
 * Buraya taşınmasının tek amacı ölçülebilirlik ve tek sahiplik: aynı süzgeç
 * mantığı sayfada ve testte İKİNCİ KEZ yazılmaz. Taşıma sırasında davranış
 * değiştirilmemiştir; sonraki düzeltmeler bu dosyada, ölçülerek yapılır.
 *
 * KAPSAM DÜRÜSTLÜĞÜ — SABİT ELEME BLOĞU (D3b, 2026-08-26).
 * Aşağıdaki süzgeçte `budget` / `engine` / `specs` / `technicalSpecs` için
 * ALAN ADINA ÖZEL, taşımadan önce de var olan bir eleme durur ve bu eleme
 * doğrulama kontrolünden ÖNCE çalışır. Yani bu dört alandan biri yalnız
 * çıkarımdan gelen bir değer taşırsa doğrulama sorusu üretilmez. Ölçüldü:
 * 108 senaryoluk kapsam tabanında bu durum HİÇ oluşmuyor (0 kayıt), ama
 * kural evrensel DEĞİLDİR ve burada öyle gösterilmez — kapatılması ayrı bir
 * karar ve ayrı bir dilimdir.
 */
export type RenderableCandidateInput = {
  /** `resolveHybridQuestions(...).candidates` — sıralanmış aday listesi. */
  hybridQuestionResult: HybridQuestionResult | null;
  /** Kategorinin o anki görünür dinamik alanları. */
  visibleDynamicFields: DynamicField[];
  /** Yayın için zorunlu olup hâlâ boş olan dinamik alanlar. */
  missingFields: DynamicField[];
  dynamicValues: Record<string, string>;
  requestText: string;
  activeCategoryId: string;
  isRealEstate: boolean;
  realEstateLocationMissing: boolean;
  visibleCommonFieldKeys: Set<string>;
  mergedCommonDraft: { city: string };
  understandingCity: string;
  budgetRequired: boolean;
  hasBudget: boolean;
  /** Fiyat stratejisi — yalnız yer tutucu metinlerini seçmek için. */
  strategy: PriceStrategyKey | null | undefined;
  /**
   * Kanonik alan durumu — "değer var" ile "kullanıcı cevapladı" ayrımının
   * TEK kaynağı. Burada ikinci bir cevap sınıflandırması kurulmaz;
   * `answer-authority` okunur.
   */
  canonicalFields: CanonicalRequestState["fields"] | null;
};

function featureExamplePlaceholder(
  strategy: string | null | undefined,
  requestText: string,
  fallback?: string,
): string {
  const text = requestText.toLocaleLowerCase("tr-TR");

  if (/dyson|süpürge|supurge/.test(text)) {
    return "Örn. aparatları tam, garantili, kutulu, yedek bataryalı";
  }
  if (strategy === "VEHICLE" || /araç|araba|otomobil/.test(text)) {
    return "Örn. hasarsız, belirli renk, servis bakımlı, donanım paketi";
  }
  if (strategy === "REAL_ESTATE_RENT" || strategy === "REAL_ESTATE_SALE") {
    return "Örn. balkonlu, otoparklı, eşyalı, site içinde";
  }
  if (strategy === "SERVICE_SCOPE") {
    return "Örn. kullanılacak malzeme, teslim tarihi, garanti, özel istekler";
  }
  if (strategy === "CUSTOM_MANUFACTURING") {
    return "Örn. renk, yüzey, baskı, paketleme, kalite standardı";
  }
  if (/makine|cnc|pres|ekipman/.test(text)) {
    return "Örn. kapasite, güç, çalışma saati, garanti, ekipmanlar";
  }
  if (/mobilya|koltuk|masa|sandalye|dolap/.test(text)) {
    return "Örn. renk, malzeme, ölçü, kurulum, özel tasarım";
  }

  return fallback ?? "Örn. renk, ölçü, garanti, aksesuar veya diğer tercihler";
}

export function filterRenderableCandidates(
  input: RenderableCandidateInput,
): QuestionCandidate[] {
  const {
    hybridQuestionResult,
    visibleDynamicFields,
    missingFields,
    dynamicValues,
    requestText,
    activeCategoryId,
    isRealEstate,
    realEstateLocationMissing,
    visibleCommonFieldKeys,
    mergedCommonDraft,
    understandingCity,
    budgetRequired,
    hasBudget,
    strategy,
    canonicalFields,
  } = input;
  const visibleKeys = new Set(visibleDynamicFields.map((f) => f.key));
  const foldedRequestText = requestText
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0131/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const textAlreadyAnswers = (fieldKey: string, label = "") => {
    if (fieldKey === "condition" || /araç durumu/iu.test(label)) {
      const statedYear = requestText.match(/\b((?:19|20)\d{2})\b/u)?.[1];
      return (
        /\b(sıfır|sifir|ikinci\s*el|2\.?\s*el|kullanılmış|kullanilmis)\b/iu.test(requestText) ||
        (activeCategoryId === "automotive" &&
          statedYear != null &&
          Number(statedYear) < new Date().getFullYear())
      );
    }
    if (fieldKey.toLowerCase().includes("color") || /renk/iu.test(label)) {
      return /\b(kirmizi|siyah|beyaz|gri|mavi|lacivert|yesil|sari|turuncu|kahverengi|bej|bordo)\b/u.test(foldedRequestText);
    }
    if (fieldKey === "bodyCondition" || /hasar|kasa/iu.test(label)) {
      return /\b(hasarsiz|hatasiz|boyasiz|degisensiz|kazali)\b/u.test(foldedRequestText);
    }
    return false;
  };
  const list = hybridQuestionResult?.candidates ?? [];
  /**
   * DEĞER VAR ≠ KULLANICI CEVAPLADI — SON EKRANDA DA (D3b, 2026-08-26).
   *
   * Bu süzgeç, değeri dolu görünen alanı eliyordu ve `textAlreadyAnswers`
   * ile metinden İKİNCİ KEZ "bu zaten cevaplanmış" kararı üretiyordu. Oysa o
   * karar tek yerde verilir: anlama katmanı alana bir değer ve bir kaynak
   * (`provenance`) yazar. Kaynak YALNIZ çıkarımsa değer bir cevap değil, bir
   * öneridir — kullanıcı onaylayana kadar soru açık kalmalıdır.
   *
   * Sonuç, tam olarak kaçırdığımız hataydı: "2020 model ... Passat" metninde
   * Talepo `condition = İkinci el` diye TAHMİN ediyor, soru motoru bunu ilk
   * ekrana koyuyor, sonra bu süzgeç aynı metinden aynı tahmini yeniden
   * üretip soruyu kaldırıyordu. Kullanıcı sıfır kilometre arıyor olsa bile
   * bunu hiç göremiyordu.
   *
   * Kural kategoriye, alana ya da senaryoya özel DEĞİLDİR: tek ölçüt kanonik
   * cevap otoritesidir. `USER_EXPLICIT` ya da soruyu kapatmaya yetkili
   * `VERIFIED` cevaplar eskisi gibi elenmeye devam eder.
   */
  const needsUserConfirmation = (fieldKey: string): boolean =>
    isInferenceOnlyAnswer(canonicalFields?.[fieldKey]);
  const filtered = list.filter((q) => {
    const awaitingConfirmation = needsUserConfirmation(q.fieldKey);
    if (
      !awaitingConfirmation &&
      (dynamicValues[q.fieldKey]?.trim() ||
        textAlreadyAnswers(q.fieldKey, q.label))
    ) {
      return false;
    }
    if (
      q.fieldKey === "budget" ||
      q.fieldKey === "engine" ||
      q.fieldKey === "specs" ||
      q.fieldKey === "technicalSpecs"
    ) {
      return false;
    }
    /**
     * Görünür alan kesişimi bir DOĞRULAMAYI eleyemez. Soru motoru o alanı
     * ilk ekrana koyduysa, kategori form şeması onu göstermiyor olsa bile
     * uydurulmuş değerin kullanıcıya sorulması gerekir.
     */
    if (awaitingConfirmation) return true;
    if (
      q.fieldKey === "brand" ||
      q.fieldKey === "city" ||
      q.fieldKey === "condition" ||
      q.fieldKey === "screenSize" ||
      q.fieldKey === "resolution" ||
      q.fieldKey === "model"
    ) {
      return true;
    }
    return visibleKeys.size === 0 || visibleKeys.has(q.fieldKey);
  }).map((q) =>
    q.fieldKey === "city"
      ? {
          ...q,
          inputType: "select" as const,
          options: isRealEstate
            ? TURKEY_REAL_ESTATE_LOCATION_OPTIONS
            : TURKEY_CITY_OPTIONS,
          quickChoices: undefined,
          multiSelect: true,
          label: isRealEstate ? "İl ve ilçe" : q.label,
          placeholder: isRealEstate ? "İl ve ilçe seçin" : "Şehir seçin",
        }
      : q.fieldKey === "location"
        ? {
            ...q,
            placeholder: "Mahalle, cadde veya sokak bilgisi girin",
          }
      : q.fieldKey === "color"
        ? {
            ...q,
            inputType: "select" as const,
            options: COLOR_PREFERENCE_OPTIONS,
            quickChoices: undefined,
            multiSelect: true,
            placeholder: "Renk seçin",
          }
      : q.fieldKey === "features"
      ? {
          ...q,
          placeholder: featureExamplePlaceholder(
            strategy,
            requestText,
            q.placeholder,
          ),
        }
      : q.inputType === "select"
        ? {
            ...q,
            quickChoices: undefined,
            multiSelect: true,
          }
        : q,
  );

  // Show every still-empty field that is relevant to the active category,
  // including optional preferences that did not enter the ranked shortlist.
  for (const field of visibleDynamicFields) {
    if (
      field.key === "engine" ||
      field.key === "specs" ||
      field.key === "technicalSpecs" ||
      dynamicValues[field.key]?.trim() ||
      textAlreadyAnswers(field.key, field.label) ||
      filtered.some((candidate) => candidate.fieldKey === field.key)
    ) {
      continue;
    }
    filtered.push({
      fieldKey: field.key,
      label: field.label,
      reason: field.required
        ? "Talebi yayınlamak için gerekli"
        : "İsteğe bağlı tercih",
      publishImpact: field.required ? 1 : 0.2,
      matchingImpact: field.required ? 0.7 : 0.45,
      priceImpact: 0.25,
      confidenceImpact: 0.25,
      priorityScore: field.required ? 1 : 0.3,
      inputType:
        field.key === "color" || field.type === "select"
          ? "select"
          : field.type === "number"
            ? "number"
            : "text",
      options:
        field.key === "color" ? COLOR_PREFERENCE_OPTIONS : field.options,
      quickChoices:
        field.key === "color" || field.type === "select"
          ? undefined
          : field.options,
      multiSelect: field.key === "color" || field.type === "select",
      placeholder: field.key === "color" ? "Renk seçin" : field.placeholder,
    });
  }

  for (const field of [...missingFields].reverse()) {
    if (filtered.some((candidate) => candidate.fieldKey === field.key)) continue;
    filtered.unshift({
      fieldKey: field.key,
      label: field.label,
      reason: "Talebi yayınlamak için gerekli",
      publishImpact: 1,
      matchingImpact: 0.7,
      priceImpact: 0.5,
      confidenceImpact: 0.5,
      priorityScore: 1,
      inputType:
        field.type === "select"
          ? "select"
          : field.type === "number"
            ? "number"
            : "text",
      options: field.options,
      quickChoices: field.type === "select" ? undefined : field.options,
      multiSelect: field.type === "select",
      placeholder: field.placeholder,
    });
  }

  if (
    visibleCommonFieldKeys.has("city") &&
    ((!mergedCommonDraft.city.trim() && !understandingCity.trim()) ||
      (isRealEstate && realEstateLocationMissing))
  ) {
    filtered.unshift({
      fieldKey: "city",
      label: isRealEstate ? "İl ve ilçe" : "Şehir",
      reason: isRealEstate
        ? "Talebi yayınlamak için geçerli il ve ilçe gerekli"
        : "Tekliflerin doğru bölgeden gelmesine yardımcı olur",
      publishImpact: 0.8,
      matchingImpact: 0.95,
      priceImpact: 0.4,
      confidenceImpact: 0.3,
      priorityScore: 0.9,
      inputType: "select",
      options: isRealEstate
        ? TURKEY_REAL_ESTATE_LOCATION_OPTIONS
        : TURKEY_CITY_OPTIONS,
      multiSelect: true,
      placeholder: isRealEstate ? "İl ve ilçe seçin" : "Şehir seçin",
    });
  }

  if (budgetRequired && !hasBudget) {
    filtered.unshift({
      fieldKey: "budget",
      label: "Bütçe",
      reason: "Talebi yayınlamak için gerekli",
      publishImpact: 1,
      matchingImpact: 0.5,
      priceImpact: 0.9,
      confidenceImpact: 0.5,
      priorityScore: 1,
      inputType: "text",
      placeholder: budgetPlaceholderForStrategy(strategy),
    });
  }

  /**
   * ÖNERİ ADAYIN ÜZERİNDE TAŞINIR (D3b, 2026-08-26).
   *
   * Tahmin, arayüz kabuğunun prop zincirinden değil sorunun KENDİ
   * sözleşmesinden gider: bugünkü panel ile onun yerini alacak arayüz aynı
   * adayı tüketir. Cevap alanı (`draftValue`) bilerek boş bırakılır —
   * öneri seçim durumu üretmez ve soruyu kapatmaz.
   */
  return filtered.map((candidate): QuestionCandidate => {
    const presentation = resolveQuestionDraftPresentation(
      canonicalFields?.[candidate.fieldKey],
      dynamicValues[candidate.fieldKey] ?? "",
    );
    if (presentation.suggestedValue == null) return candidate;
    return {
      ...candidate,
      inferredSuggestion: {
        value: presentation.suggestedValue,
        // Öneri üretildiyse sınıflandırma zaten INFERRED'dir; tip bunu zorlar.
        authority: "INFERRED",
        confirmed: false,
      },
    };
  });
}
