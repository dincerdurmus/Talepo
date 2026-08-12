/**
 * Browse semantic role — maps taxonomy path context to commercial subject.
 *
 * Deep brand/model leaves must NOT erase the parent subcategory subject.
 * Example: Otomotiv → Yedek Parça → Alfa Romeo → 156
 *   role = PART (compatibility target = vehicle brand/model)
 * Example: Otomotiv → Araç Satın Alma → Alfa Romeo → 156
 *   role = VEHICLE (requested product = vehicle)
 *
 * Not category-name regexes: structured subcategorySlug → role.
 */

export type BrowseCompositionMode =
  | "whole_product"
  | "compatibility_part"
  | "service"
  | "accessory"
  | "generic";

export type BrowseSemanticRole = {
  /** Form/schema needType when known */
  needType: string | null;
  /** Semantic request subject kind */
  subjectKind:
    | "VEHICLE"
    | "PART"
    | "SERVICE"
    | "ACCESSORY"
    | "PRODUCT"
    | "INDUSTRIAL_EQUIPMENT"
    | null;
  compositionMode: BrowseCompositionMode;
  /** Turkish noun for generic subject when leaf part unknown */
  subjectNounTr: string | null;
};

const AUTOMOTIVE_BY_SUB: Record<string, BrowseSemanticRole> = {
  "arac-satin-alma": {
    needType: "vehicle",
    subjectKind: "VEHICLE",
    compositionMode: "whole_product",
    subjectNounTr: "araç",
  },
  "yedek-parca": {
    needType: "part",
    subjectKind: "PART",
    compositionMode: "compatibility_part",
    subjectNounTr: "yedek parça",
  },
  "arac-bakim": {
    needType: "service",
    subjectKind: "SERVICE",
    compositionMode: "service",
    subjectNounTr: "bakım",
  },
  "lastik-ve-jant": {
    needType: "tire",
    subjectKind: "PART",
    compositionMode: "compatibility_part",
    subjectNounTr: "lastik",
  },
  diger: {
    needType: null,
    subjectKind: null,
    compositionMode: "generic",
    subjectNounTr: null,
  },
};

/** Machinery / industrial spare vs whole — when taxonomy uses these slugs */
const MACHINERY_BY_SUB: Record<string, BrowseSemanticRole> = {
  "makine-satin-alma": {
    needType: "machine",
    subjectKind: "INDUSTRIAL_EQUIPMENT",
    compositionMode: "whole_product",
    subjectNounTr: "makine",
  },
  "uretim-makinesi": {
    needType: "machine",
    subjectKind: "INDUSTRIAL_EQUIPMENT",
    compositionMode: "whole_product",
    subjectNounTr: "makine",
  },
  "kesim-makinesi": {
    needType: "machine",
    subjectKind: "INDUSTRIAL_EQUIPMENT",
    compositionMode: "whole_product",
    subjectNounTr: "makine",
  },
  "paketleme-makinesi": {
    needType: "machine",
    subjectKind: "INDUSTRIAL_EQUIPMENT",
    compositionMode: "whole_product",
    subjectNounTr: "makine",
  },
  "ikinci-el-makine": {
    needType: "machine",
    subjectKind: "INDUSTRIAL_EQUIPMENT",
    compositionMode: "whole_product",
    subjectNounTr: "makine",
  },
  "yedek-parca": {
    needType: "part",
    subjectKind: "PART",
    compositionMode: "compatibility_part",
    subjectNounTr: "yedek parça",
  },
  bakim: {
    needType: "service",
    subjectKind: "SERVICE",
    compositionMode: "service",
    subjectNounTr: "bakım",
  },
};

const APPLIANCE_PART_SLUGS = new Set([
  "yedek-parca",
  "parca",
  "yedek-parcalar",
]);

const PART_ROLE: BrowseSemanticRole = {
  needType: "part",
  subjectKind: "PART",
  compositionMode: "compatibility_part",
  subjectNounTr: "yedek parça",
};

const EMPTY_ROLE: BrowseSemanticRole = {
  needType: null,
  subjectKind: null,
  compositionMode: "generic",
  subjectNounTr: null,
};

/**
 * Resolve browse semantic role from category + subcategory slug.
 * Optional taxonomyNodeId / productType catch part leaves under whole-product subs.
 * Returns null role when unknown (do not invent).
 */
export function resolveBrowseSemanticRole(input: {
  categoryId: string | null | undefined;
  subcategorySlug: string | null | undefined;
  taxonomyNodeId?: string | null | undefined;
  productType?: string | null | undefined;
}): BrowseSemanticRole {
  const categoryId = input.categoryId?.trim() || null;
  const slug = input.subcategorySlug?.trim() || null;
  const taxId = input.taxonomyNodeId?.toLocaleLowerCase("tr-TR") ?? "";
  const product =
    input.productType?.toLocaleLowerCase("tr-TR").replace(/ı/g, "i") ?? "";

  const looksLikePartLeaf =
    taxId.includes("yedek-parca") ||
    /yedek\s*par[cç]a/.test(product) ||
    product.includes("yedek-parca");

  if (!categoryId) return EMPTY_ROLE;

  if (categoryId === "automotive") {
    if (slug && AUTOMOTIVE_BY_SUB[slug]) return AUTOMOTIVE_BY_SUB[slug]!;
    return EMPTY_ROLE;
  }

  if (categoryId === "machinery" || categoryId === "industrial") {
    if (slug && MACHINERY_BY_SUB[slug]) return MACHINERY_BY_SUB[slug]!;
    if (looksLikePartLeaf) return PART_ROLE;
    return EMPTY_ROLE;
  }

  if (categoryId === "appliances") {
    if (slug && APPLIANCE_PART_SLUGS.has(slug)) return PART_ROLE;
    if (looksLikePartLeaf) return PART_ROLE;
    return EMPTY_ROLE;
  }

  if (looksLikePartLeaf) return PART_ROLE;

  if (!slug) return EMPTY_ROLE;
  return EMPTY_ROLE;
}

/** Whether browse path treats brand/model as compatibility parent, not product. */
export function isCompatibilityBrowseRole(role: BrowseSemanticRole): boolean {
  return role.compositionMode === "compatibility_part";
}
