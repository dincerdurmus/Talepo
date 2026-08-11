/**
 * Category browse contract — rooted in Talepo category IDs.
 * Entity children for automotive reuse CatalogRegistry indexes (no second authority).
 */

import { REQUEST_CATEGORIES, getCategoryById } from "@/lib/request-category-engine";
import {
  ensureAutomotiveCatalogRegistered,
  getAutomotiveIndexes,
} from "@/lib/catalog";

import { resolveKnowledgeProfile } from "./profile-registry";
import { subcategorySlug } from "./slug";
import type { BrowseContext, BrowseNode, BrowseNodeKind } from "./types";

function node(partial: BrowseNode): BrowseNode {
  return partial;
}

/** Root marketplace categories (canonical Talepo IDs). */
export function getRootCategories(): BrowseNode[] {
  return REQUEST_CATEGORIES.map((c) =>
    node({
      id: c.id,
      kind: "category",
      label: c.label,
      categoryId: c.id,
      parentId: null,
      hasChildren: c.subcategories.length > 0,
    }),
  );
}

export function getCategoryChildren(categoryId: string): BrowseNode[] {
  const cat = getCategoryById(categoryId);
  if (cat.id !== categoryId && !REQUEST_CATEGORIES.some((c) => c.id === categoryId)) {
    return [];
  }
  const real = REQUEST_CATEGORIES.find((c) => c.id === categoryId);
  if (!real) return [];

  return real.subcategories.map((label) => {
    const slug = subcategorySlug(label);
    return node({
      id: `${categoryId}/${slug}`,
      kind: "subcategory",
      label,
      categoryId,
      parentId: categoryId,
      hasChildren: true,
      meta: { subcategorySlug: slug },
    });
  });
}

function automotiveBrands(categoryId: string, parentId: string): BrowseNode[] {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  return [...idx.brands]
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map((b) =>
      node({
        id: `browse:${categoryId}:brand:${b.id}`,
        kind: "brand",
        label: b.name,
        categoryId,
        parentId,
        entityId: b.id,
        hasChildren: (idx.modelsByBrand.get(b.id) ?? []).length > 0,
      }),
    );
}

function automotiveModels(
  categoryId: string,
  parentId: string,
  brandId: string,
): BrowseNode[] {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  return (idx.modelsByBrand.get(brandId) ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map((m) =>
      node({
        id: `browse:${categoryId}:model:${m.id}`,
        kind: "model",
        label: m.name,
        categoryId,
        parentId,
        entityId: m.id,
        hasChildren: (idx.generationsByModel.get(m.id) ?? []).length > 0,
        meta: { brandId },
      }),
    );
}

function automotiveGenerations(
  categoryId: string,
  parentId: string,
  modelId: string,
): BrowseNode[] {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  return (idx.generationsByModel.get(modelId) ?? [])
    .slice()
    .sort((a, b) => a.yearFrom - b.yearFrom)
    .map((g) =>
      node({
        id: `browse:${categoryId}:generation:${g.id}`,
        kind: "generation",
        label: g.name,
        categoryId,
        parentId,
        entityId: g.id,
        hasChildren: (idx.enginesByGeneration.get(g.id) ?? []).length > 0,
        meta: {
          brandId: g.brandId,
          modelId: g.modelId,
          yearFrom: g.yearFrom,
          yearTo: g.yearTo ?? "",
        },
      }),
    );
}

function automotiveEngineVariants(
  categoryId: string,
  parentId: string,
  generationId: string,
): BrowseNode[] {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  return (idx.enginesByGeneration.get(generationId) ?? []).map((e) =>
    node({
      id: `browse:${categoryId}:variant:${e.id}`,
      kind: "variant",
      label: e.marketingName,
      categoryId,
      parentId,
      entityId: e.id,
      hasChildren: false,
      meta: {
        fuelType: e.fuelType,
        powerKw: e.powerKw ?? "",
        generationId,
      },
    }),
  );
}

function automotivePartSystems(categoryId: string, parentId: string): BrowseNode[] {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  const seen = new Map<string, string>();
  for (const p of idx.parts) {
    if (!seen.has(p.systemId)) seen.set(p.systemId, p.systemNameTr);
  }
  return [...seen.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "tr"))
    .map(([systemId, label]) =>
      node({
        id: `browse:${categoryId}:part_system:${systemId}`,
        kind: "part_system",
        label,
        categoryId,
        parentId,
        entityId: systemId,
        hasChildren: true,
      }),
    );
}

function automotiveParts(
  categoryId: string,
  parentId: string,
  systemId: string,
): BrowseNode[] {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  const names = new Map<string, (typeof idx.parts)[0]>();
  for (const p of idx.parts) {
    if (p.systemId !== systemId) continue;
    if (!names.has(p.name)) names.set(p.name, p);
  }
  return [...names.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map((p) =>
      node({
        id: `browse:${categoryId}:part:${p.id}`,
        kind: "part",
        label: p.name,
        categoryId,
        parentId,
        entityId: p.id,
        hasChildren: idx.positions.length > 0,
        meta: { systemId: p.systemId, subsystemId: p.subsystemId },
      }),
    );
}

function automotivePositions(categoryId: string, parentId: string): BrowseNode[] {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  return idx.positions.map((p) =>
    node({
      id: `browse:${categoryId}:position:${p.id}`,
      kind: "position",
      label: p.tr,
      categoryId,
      parentId,
      entityId: p.id,
      hasChildren: false,
    }),
  );
}

/**
 * Generic browse children resolver.
 * parentId may be categoryId, categoryId/subslug, or browse:* entity node.
 */
export function getBrowseChildren(
  parentId: string | null | undefined,
  context: BrowseContext,
): BrowseNode[] {
  if (!parentId) return getRootCategories();

  if (REQUEST_CATEGORIES.some((c) => c.id === parentId)) {
    return getCategoryChildren(parentId);
  }

  const profile = resolveKnowledgeProfile({
    categoryId: context.categoryId,
    subcategorySlug: context.subcategorySlug,
  });

  // Subcategory node → next hierarchy step
  if (parentId.includes("/") && !parentId.startsWith("browse:")) {
    const [categoryId, slug] = parentId.split("/");
    const resolved = resolveKnowledgeProfile({
      categoryId,
      subcategorySlug: slug,
    });
    const hierarchy = resolved.browseHierarchy;
    const next = nextKindAfter(hierarchy, "subcategory");
    return childrenForKind(next, {
      ...context,
      categoryId,
      subcategorySlug: slug,
    }, parentId, resolved);
  }

  if (parentId.startsWith("browse:")) {
    return childrenFromBrowseNode(parentId, context, profile.browseHierarchy);
  }

  return [];
}

function nextKindAfter(
  hierarchy: BrowseNodeKind[],
  current: BrowseNodeKind,
): BrowseNodeKind | null {
  const i = hierarchy.indexOf(current);
  if (i < 0 || i >= hierarchy.length - 1) return null;
  return hierarchy[i + 1]!;
}

function childrenForKind(
  kind: BrowseNodeKind | null,
  context: BrowseContext,
  parentId: string,
  profile: ReturnType<typeof resolveKnowledgeProfile>,
): BrowseNode[] {
  if (!kind) return [];

  if (kind === "brand" && profile.capabilities.includes("ENTITY_CATALOG")) {
    if (context.categoryId === "automotive") {
      return automotiveBrands(context.categoryId, parentId);
    }
    // Placeholder empty until domain adapters land — contract stable
    return [];
  }

  if (kind === "attribute_bucket") {
    return [
      node({
        id: `browse:${context.categoryId}:attribute_bucket:specs`,
        kind: "attribute_bucket",
        label: "Teknik özellikler",
        categoryId: context.categoryId,
        parentId,
        hasChildren: false,
        meta: { profileId: profile.id },
      }),
    ];
  }

  if (kind === "service_type") {
    return [
      node({
        id: `browse:${context.categoryId}:service_type:scope`,
        kind: "service_type",
        label: "Hizmet kapsamı",
        categoryId: context.categoryId,
        parentId,
        hasChildren: false,
      }),
    ];
  }

  if (kind === "commodity_type") {
    return [
      node({
        id: `browse:${context.categoryId}:commodity_type:spec`,
        kind: "commodity_type",
        label: "Malzeme / spesifikasyon",
        categoryId: context.categoryId,
        parentId,
        hasChildren: false,
      }),
    ];
  }

  if (kind === "part_system" && context.categoryId === "automotive") {
    return automotivePartSystems(context.categoryId, parentId);
  }

  return [];
}

function childrenFromBrowseNode(
  parentId: string,
  context: BrowseContext,
  hierarchy: BrowseNodeKind[],
): BrowseNode[] {
  const parts = parentId.split(":");
  // browse:category:kind:entityId... (entityId may contain :)
  if (parts[0] !== "browse" || parts.length < 4) return [];
  const categoryId = parts[1]!;
  const kind = parts[2] as BrowseNodeKind;
  const entityId = parts.slice(3).join(":");

  const next = nextKindAfter(hierarchy, kind);

  if (kind === "brand" && next === "model") {
    return automotiveModels(categoryId, parentId, entityId);
  }
  if (kind === "model" && (next === "generation" || next === "series")) {
    return automotiveGenerations(categoryId, parentId, entityId);
  }
  if (kind === "generation" && (next === "variant" || next === "part_system")) {
    if (next === "variant") {
      const engines = automotiveEngineVariants(categoryId, parentId, entityId);
      // spare-parts path continues to part_system after variant or when no engines
      if (engines.length > 0) return engines;
      if (hierarchy.includes("part_system")) {
        return automotivePartSystems(categoryId, parentId);
      }
      return [];
    }
    return automotivePartSystems(categoryId, parentId);
  }
  if (kind === "variant" && hierarchy.includes("part_system")) {
    return automotivePartSystems(categoryId, parentId);
  }
  if (kind === "part_system" && next === "part") {
    return automotiveParts(categoryId, parentId, entityId);
  }
  if (kind === "part" && (next === "position" || hierarchy.includes("position"))) {
    return automotivePositions(categoryId, parentId);
  }

  return [];
}

export function getBrands(categoryId: string, subcategorySlug?: string | null): BrowseNode[] {
  const profile = resolveKnowledgeProfile({ categoryId, subcategorySlug });
  if (!profile.capabilities.includes("ENTITY_CATALOG")) return [];
  if (categoryId === "automotive") {
    const parent = subcategorySlug
      ? `${categoryId}/${subcategorySlug}`
      : categoryId;
    return automotiveBrands(categoryId, parent);
  }
  return [];
}

export function getModels(categoryId: string, brandId: string): BrowseNode[] {
  if (categoryId !== "automotive") return [];
  return automotiveModels(categoryId, `browse:${categoryId}:brand:${brandId}`, brandId);
}

export function getGenerations(categoryId: string, modelId: string): BrowseNode[] {
  if (categoryId !== "automotive") return [];
  return automotiveGenerations(
    categoryId,
    `browse:${categoryId}:model:${modelId}`,
    modelId,
  );
}

export function getVariants(categoryId: string, generationId: string): BrowseNode[] {
  if (categoryId !== "automotive") return [];
  return automotiveEngineVariants(
    categoryId,
    `browse:${categoryId}:generation:${generationId}`,
    generationId,
  );
}

export function getParts(categoryId: string, partSystemId?: string | null): BrowseNode[] {
  if (categoryId !== "automotive") return [];
  if (partSystemId) {
    return automotiveParts(
      categoryId,
      `browse:${categoryId}:part_system:${partSystemId}`,
      partSystemId,
    );
  }
  return automotivePartSystems(categoryId, categoryId);
}

/**
 * Apply a browse selection as EXPLICIT user choice into field bag.
 * Catalog enrichment must not overwrite these keys.
 */
export function applyBrowseSelection(
  fields: Record<string, string>,
  selection: {
    key: string;
    value: string;
    entityId?: string;
  },
): Record<string, string> {
  const next = { ...fields, [selection.key]: selection.value };
  if (selection.entityId) {
    next[`${selection.key}Id`] = selection.entityId;
    next[`__explicit__${selection.key}`] = "browse";
  } else {
    next[`__explicit__${selection.key}`] = "browse";
  }
  return next;
}

export function isExplicitBrowseField(
  fields: Record<string, string | undefined>,
  key: string,
): boolean {
  return (fields[`__explicit__${key}`] ?? "").trim().length > 0;
}
