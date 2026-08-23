/**
 * Category browse contract — rooted in Talepo category IDs.
 * Entity children for automotive reuse CatalogRegistry indexes (no second authority).
 */

import { REQUEST_CATEGORIES, getCategoryById } from "@/lib/request-category-engine";
import {
  ensureAutomotiveCatalogRegistered,
  getAutomotiveIndexes,
} from "@/lib/catalog";
import {
  ensureTaxonomyLoaded,
  getSubcategoryTaxonomyNode,
  getTaxonomyChildren,
  getTaxonomyNode,
  taxonomyNodeHasChildren,
  type TaxonomyNode,
} from "@/lib/taxonomy";

import {
  babyBrandsForProductName,
  CURATED_BRAND_SOURCE,
  furnitureBrandsForProduct,
  inferMachineryBrandFamily,
  kitchenBrandsForProductName,
  machineryBrandsForFamily,
} from "./harvest-brands";
import { brandsForProductName, MARKET_BRAND_SOURCE } from "./product-brands";
import { resolveKnowledgeProfile } from "./profile-registry";
import { subcategorySlug } from "./slug";
import type { BrowseContext, BrowseNode, BrowseNodeKind } from "./types";

function taxonomyKind(node: TaxonomyNode): BrowseNodeKind {
  switch (node.nodeType) {
    case "GROUP":
      return "group";
    case "PRODUCT_TYPE":
      return "product_type";
    case "SERVICE_TYPE":
      return "service_type";
    case "COMMODITY_TYPE":
      return "commodity_type";
    case "PART_TYPE":
      return "part";
    case "TECHNICAL_TYPE":
      return "attribute_bucket";
    case "SUBCATEGORY":
      return "subcategory";
    case "CATEGORY":
      return "category";
    default:
      return "product_type";
  }
}

function technologyDisplayLabel(n: TaxonomyNode): string {
  // Stable ids; display matches sahibinden-style TR marketplace labels
  if (n.id.endsWith(":telefon-ve-tablet")) return "Cep Telefonu & Aksesuar";
  if (n.id.endsWith(":akilli-telefon")) return "Cep Telefonu";
  return n.canonicalName;
}

/**
 * Bu yaprak marka kolonu açacak mı? (Tüm kategoriler — kurucu, 2026-08-23.)
 * Kaskadın oku ve bir sonraki kolonu buna bakarak açılır.
 */
function productTypeHasBrands(n: TaxonomyNode): boolean {
  if (n.nodeType !== "PRODUCT_TYPE") return false;
  if (n.categoryId === "automotive") return false;
  if (brandsForProductName(n.canonicalName, n.categoryId)) return true;
  if (n.categoryId === "machinery") {
    return (
      inferMachineryBrandFamily({ id: n.id, name: n.canonicalName }) != null
    );
  }
  if (n.categoryId === "furniture") {
    return (
      furnitureBrandsForProduct({
        name: n.canonicalName,
        parentId: n.parentId,
        subcategoryId: n.subcategoryId,
      }) != null
    );
  }
  if (n.categoryId === "home-kitchen") {
    return kitchenBrandsForProductName(n.canonicalName) != null;
  }
  if (n.categoryId === "baby") {
    return babyBrandsForProductName(n.canonicalName) != null;
  }
  return false;
}

function technologyBrandNodes(
  productTypeId: string,
  parentId: string,
): BrowseNode[] {
  ensureTaxonomyLoaded();
  const tax = getTaxonomyNode(productTypeId);
  if (!tax) return [];
  if (tax.categoryId !== "technology") return [];
  if (tax.nodeType !== "PRODUCT_TYPE") return [];

  // Kurucu kararı (2026-08-23): marka kolonu YALNIZ gerçek pazar verisi
  // olduğunda açılır. Aile bazlı tahmin listesi megafona da, ses aksesuarına
  // da aynı markaları veriyordu; bilmediğimizde tahmin etmek yerine kolonu
  // hiç açmıyoruz — kullanıcı markasını serbestçe yazar.
  const marketBrands = brandsForProductName(tax.canonicalName, tax.categoryId);
  if (!marketBrands) return [];

  const tumu = node({
    id: "any:brand",
    kind: "attribute_bucket",
    label: "Tümü",
    categoryId: "technology",
    parentId,
    hasChildren: false,
    meta: {
      any: true,
      fieldKey: "brand",
      sentinel: "__ANY__",
      brandSource: MARKET_BRAND_SOURCE,
      productTypeId,
    },
  });

  const labels = marketBrands;
  const brands = labels.map((label) =>
    node({
      id: `browse:technology:brand:${subcategorySlug(label)}`,
      kind: "brand",
      label,
      categoryId: "technology",
      parentId,
      entityId: subcategorySlug(label),
      hasChildren: false,
      meta: {
        brandSource: MARKET_BRAND_SOURCE,
        productTypeId,
        subcategorySlug: tax.subcategoryId ?? "donanim",
      },
    }),
  );

  return [tumu, ...brands];
}

/**
 * TÜM kategoriler için marka kolonu (kurucu, 2026-08-23: "tüm kategorileri
 * bağla"). Sıra:
 *   1) Gerçek pazar verisi — MediaMarkt dağılımı (teknoloji, beyaz eşya,
 *      ev & mutfak ürünlerini kapsar),
 *   2) Kategori kürasyonu — makine ürün ailesi, mobilya, anne & çocuk grubu,
 *   3) Eşleşme yoksa kolon açılmaz; kullanıcı markasını kendi yazar.
 * Otomotiv kendi CatalogRegistry yolunu kullanır, buraya girmez.
 */
function harvestBrandNodes(
  productTypeId: string,
  parentId: string,
): BrowseNode[] {
  ensureTaxonomyLoaded();
  const tax = getTaxonomyNode(productTypeId);
  if (!tax || tax.nodeType !== "PRODUCT_TYPE") return [];
  if (tax.categoryId === "automotive" || tax.categoryId === "technology") {
    return [];
  }

  // Gerçek pazar dağılımı önce denenir; kolonun kaynağı kolonla birlikte
  // taşınır, çünkü küratörlü liste MediaMarkt verisiyle aynı statüde değildir.
  let labels: string[] = brandsForProductName(tax.canonicalName, tax.categoryId) ?? [];
  let brandSource: string = MARKET_BRAND_SOURCE;
  if (labels.length === 0) {
    brandSource = CURATED_BRAND_SOURCE;
    if (tax.categoryId === "machinery") {
      const family = inferMachineryBrandFamily({
        id: tax.id,
        name: tax.canonicalName,
      });
      labels = family ? machineryBrandsForFamily(family) : [];
    } else if (tax.categoryId === "furniture") {
      labels =
        furnitureBrandsForProduct({
          name: tax.canonicalName,
          parentId: tax.parentId,
          subcategoryId: tax.subcategoryId,
        }) ?? [];
    } else if (tax.categoryId === "home-kitchen") {
      labels = kitchenBrandsForProductName(tax.canonicalName) ?? [];
    } else if (tax.categoryId === "baby") {
      labels = babyBrandsForProductName(tax.canonicalName) ?? [];
    }
  }
  if (labels.length === 0) return [];

  const tumu = node({
    id: "any:brand",
    kind: "attribute_bucket",
    label: "Tümü",
    categoryId: tax.categoryId,
    parentId,
    hasChildren: false,
    meta: {
      any: true,
      fieldKey: "brand",
      sentinel: "__ANY__",
      brandSource,
      productTypeId,
    },
  });
  const brands = labels.map((label) =>
    node({
      id: `browse:${tax.categoryId}:brand:${subcategorySlug(label)}`,
      kind: "brand",
      label,
      categoryId: tax.categoryId,
      parentId,
      entityId: subcategorySlug(label),
      hasChildren: false,
      meta: {
        brandSource,
        productTypeId,
        subcategorySlug: tax.subcategoryId ?? "",
      },
    }),
  );
  return [tumu, ...brands];
}

function taxonomyToBrowse(n: TaxonomyNode, parentId: string): BrowseNode {
  const hasBrandKids = productTypeHasBrands(n);
  return node({
    id: n.id,
    kind: taxonomyKind(n),
    label: technologyDisplayLabel(n),
    categoryId: n.categoryId,
    parentId,
    entityId: n.catalogSystemId ?? n.id,
    hasChildren: hasBrandKids || taxonomyNodeHasChildren(n.id),
    meta: {
      taxonomyNodeType: n.nodeType,
      subcategoryId: n.subcategoryId ?? "",
      // Hoist edilen gruplar da (Donanım gizliyken) şema slug'unu taşısın
      subcategorySlug: n.subcategoryId ?? "",
      catalogSystemId: n.catalogSystemId ?? "",
      catalogSubsystemId: n.catalogSubsystemId ?? "",
      requestSchemaId: n.requestSchemaId ?? "",
    },
  });
}

function taxonomyChildrenForSubcategory(
  categoryId: string,
  slug: string,
  parentId: string,
): BrowseNode[] {
  ensureTaxonomyLoaded();
  const sub = getSubcategoryTaxonomyNode(categoryId, slug);
  if (!sub) return [];
  let kids = getTaxonomyChildren(sub.id).map((n) => taxonomyToBrowse(n, parentId));
  if (
    categoryId === "furniture" &&
    (slug === "ev-mobilyasi" || slug === "ofis-mobilyalari")
  ) {
    kids = withFurnitureTumuOption(kids, parentId, slug);
  }
  if (
    categoryId === "appliances" &&
    (slug === "kucuk-ev-aletleri" ||
      slug === "beyaz-esya" ||
      slug === "isitma-sogutma-ve-havalandirma")
  ) {
    kids = withAppliancesTumuOption(kids, parentId, slug);
  }
  return kids;
}

/** Sahibinden-style Tümü at Ev / Ofis Mobilyası group & product columns. */
function withFurnitureTumuOption(
  kids: BrowseNode[],
  parentId: string,
  subcategorySlug?: string,
): BrowseNode[] {
  if (kids.length === 0) return kids;
  if (kids.some((k) => k.meta?.any && k.meta?.fieldKey === "furnitureType")) {
    return kids;
  }
  const slug =
    subcategorySlug ??
    (parentId.includes("ofis-mobilyalari")
      ? "ofis-mobilyalari"
      : "ev-mobilyasi");
  const tumu = node({
    id: `furn:any:furnitureType:${parentId}`,
    kind: "attribute_bucket",
    label: "Tümü",
    categoryId: "furniture",
    parentId,
    hasChildren: false,
    meta: {
      any: true,
      fieldKey: "furnitureType",
      subcategorySlug: slug,
    },
  });
  return [tumu, ...kids];
}

/** Sahibinden-style Tümü under appliance pillars. */
function withAppliancesTumuOption(
  kids: BrowseNode[],
  parentId: string,
  subcategorySlug?: string,
): BrowseNode[] {
  if (kids.length === 0) return kids;
  if (kids.some((k) => k.meta?.any && k.meta?.fieldKey === "applianceType")) {
    return kids;
  }
  let slug = subcategorySlug;
  if (!slug) {
    if (parentId.includes("kucuk-ev-aletleri")) slug = "kucuk-ev-aletleri";
    else if (parentId.includes("isitma-sogutma")) {
      slug = "isitma-sogutma-ve-havalandirma";
    } else slug = "beyaz-esya";
  }
  const tumu = node({
    id: `appl:any:applianceType:${parentId}`,
    kind: "attribute_bucket",
    label: "Tümü",
    categoryId: "appliances",
    parentId,
    hasChildren: false,
    meta: {
      any: true,
      fieldKey: "applianceType",
      subcategorySlug: slug,
    },
  });
  return [tumu, ...kids];
}

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

function cleanRealEstateTypeLabel(label: string): string {
  return label
    .replace(/^(satılık|kiralık)\s+/iu, "")
    .replace(/^Satılık\s+/u, "")
    .replace(/^Kiralık\s+/u, "")
    .trim() || label;
}

/** Sahibinden-style RE segments under Emlak (not Satılık Konut / Kiralık Konut flat). */
function realEstateRootSegments(): BrowseNode[] {
  return [
    node({
      id: "re:group:konut",
      kind: "group",
      label: "Konut",
      categoryId: "real-estate",
      parentId: "real-estate",
      hasChildren: true,
      meta: { reSegment: "konut" },
    }),
    node({
      id: "re:group:isyeri",
      kind: "group",
      label: "İş Yeri",
      categoryId: "real-estate",
      parentId: "real-estate",
      hasChildren: true,
      meta: { reSegment: "isyeri", subcategorySlug: "ticari-gayrimenkul" },
    }),
    node({
      id: "real-estate/arsa",
      kind: "subcategory",
      label: "Arsa",
      categoryId: "real-estate",
      parentId: "real-estate",
      hasChildren: true,
      meta: { subcategorySlug: "arsa" },
    }),
    node({
      id: "real-estate/diger",
      kind: "subcategory",
      label: "Diğer",
      categoryId: "real-estate",
      parentId: "real-estate",
      hasChildren: true,
      meta: { subcategorySlug: "diger" },
    }),
  ];
}

function realEstateListingChildren(parentId: string): BrowseNode[] {
  return [
    node({
      id: "real-estate/satilik-konut",
      kind: "subcategory",
      label: "Satılık",
      categoryId: "real-estate",
      parentId,
      hasChildren: true,
      meta: { subcategorySlug: "satilik-konut", listingType: "Satılık" },
    }),
    node({
      id: "real-estate/kiralik-konut",
      kind: "subcategory",
      label: "Kiralık",
      categoryId: "real-estate",
      parentId,
      hasChildren: true,
      meta: { subcategorySlug: "kiralik-konut", listingType: "Kiralık" },
    }),
  ];
}

/** Canonical Konut types — same for Satılık and Kiralık (not condition/floor junk). */
const RE_KONUT_PROPERTY_TYPES = [
  "Daire",
  "Rezidans",
  "Müstakil Ev",
  "Villa",
  "Çiftlik Evi",
  "Köşk & Konak",
  "Yalı",
  "Yalı Dairesi",
] as const;

function realEstateKonutTypeLeaves(
  slug: "satilik-konut" | "kiralik-konut",
  parentId: string,
): BrowseNode[] {
  const tumu = node({
    id: `re:any:propertyType:${slug}`,
    kind: "attribute_bucket",
    label: "Tümü",
    categoryId: "real-estate",
    parentId,
    hasChildren: false,
    meta: {
      any: true,
      fieldKey: "propertyType",
      subcategorySlug: slug,
      listingType: slug === "satilik-konut" ? "Satılık" : "Kiralık",
    },
  });

  const types = RE_KONUT_PROPERTY_TYPES.map((label) =>
    node({
      id: `re:property:${slug}:${subcategorySlug(label)}`,
      kind: "product_type",
      label,
      categoryId: "real-estate",
      parentId,
      entityId: `re:property:${slug}:${subcategorySlug(label)}`,
      hasChildren: false,
      meta: {
        subcategorySlug: slug,
        propertyType: label,
        listingType: slug === "satilik-konut" ? "Satılık" : "Kiralık",
      },
    }),
  );

  return [tumu, ...types];
}

/** Flatten PRODUCT_TYPE leaves under a non-konut RE subcategory. */
function realEstatePropertyTypeLeaves(
  slug: string,
  parentId: string,
): BrowseNode[] {
  if (slug === "satilik-konut" || slug === "kiralik-konut") {
    return realEstateKonutTypeLeaves(slug, parentId);
  }

  ensureTaxonomyLoaded();
  const sub = getSubcategoryTaxonomyNode("real-estate", slug);
  if (!sub) return [];
  const out: BrowseNode[] = [];
  const walk = (id: string) => {
    for (const n of getTaxonomyChildren(id)) {
      if (n.nodeType === "PRODUCT_TYPE" || n.nodeType === "SERVICE_TYPE") {
        out.push(
          node({
            id: n.id,
            kind: taxonomyKind(n),
            label: cleanRealEstateTypeLabel(n.canonicalName),
            categoryId: "real-estate",
            parentId,
            entityId: n.id,
            hasChildren: false,
            meta: {
              subcategorySlug: slug,
              taxonomyNodeType: n.nodeType,
              propertyType: cleanRealEstateTypeLabel(n.canonicalName),
            },
          }),
        );
      } else if (n.nodeType === "GROUP") {
        walk(n.id);
      }
    }
  };
  walk(sub.id);
  return out;
}

export function getCategoryChildren(categoryId: string): BrowseNode[] {
  const cat = getCategoryById(categoryId);
  if (
    !cat ||
    (cat.id !== categoryId &&
      !REQUEST_CATEGORIES.some((c) => c.id === categoryId))
  ) {
    return [];
  }
  const real = REQUEST_CATEGORIES.find((c) => c.id === categoryId);
  if (!real) return [];

  if (categoryId === "real-estate") {
    return realEstateRootSegments();
  }

  return real.subcategories.flatMap((label) => {
    const slug = subcategorySlug(label);
    // Kurucu (2026-08-23): "Donanım" ara katmanı ağaçta görünmez —
    // içindeki gruplar (TV ve görüntü, Bilgisayar, …) doğrudan Teknoloji
    // altında, Donanım'ın durduğu yerde listelenir. Şema/slug sözleşmesi
    // değişmez: grup düğümleri subcategorySlug=donanim taşımaya devam eder.
    if (categoryId === "technology" && slug === "donanim") {
      const hoisted = taxonomyChildrenForSubcategory(
        categoryId,
        slug,
        `${categoryId}/${slug}`,
      );
      if (hoisted.length > 0) return hoisted;
    }
    return [
      node({
        id: `${categoryId}/${slug}`,
        kind: "subcategory",
        label,
        categoryId,
        parentId: categoryId,
        hasChildren: true,
        meta: { subcategorySlug: slug },
      }),
    ];
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

  // Real-estate: Konut → Satılık | Kiralık
  if (parentId === "re:group:konut") {
    return realEstateListingChildren(parentId);
  }
  // Real-estate: İş Yeri → ticari types (flattened)
  if (parentId === "re:group:isyeri") {
    return realEstatePropertyTypeLeaves("ticari-gayrimenkul", parentId);
  }

  const profile = resolveKnowledgeProfile({
    categoryId: context.categoryId,
    subcategorySlug: context.subcategorySlug,
  });

  // Master taxonomy walk (tax:category:sub:...)
  if (parentId.startsWith("tax:")) {
    ensureTaxonomyLoaded();
    let kids = getTaxonomyChildren(parentId).map((n) =>
      taxonomyToBrowse(n, parentId),
    );
    // Ev / Ofis Mobilyası: groups & product leaves get sahibinden-style Tümü
    if (
      kids.length > 0 &&
      (parentId.startsWith("tax:furniture:ev-mobilyasi") ||
        parentId.startsWith("tax:furniture:ofis-mobilyalari"))
    ) {
      kids = withFurnitureTumuOption(kids, parentId);
    }
    // Appliances pillars: product leaves get Tümü
    if (
      kids.length > 0 &&
      (parentId.startsWith("tax:appliances:kucuk-ev-aletleri") ||
        parentId.startsWith("tax:appliances:beyaz-esya") ||
        parentId.startsWith("tax:appliances:isitma-sogutma-ve-havalandirma"))
    ) {
      kids = withAppliancesTumuOption(kids, parentId);
    }
    if (kids.length > 0) return kids;
    // Donanım product-type leaf → brand column (TV / laptop / phone…)
    const brandKids = technologyBrandNodes(parentId, parentId);
    if (brandKids.length > 0) return brandKids;
    // Makine / mobilya yaprakları → hasat markaları (Makinecim, Koçtaş…)
    const harvestKids = harvestBrandNodes(parentId, parentId);
    if (harvestKids.length > 0) return harvestKids;
    return [];
  }

  // Subcategory node → next hierarchy step
  if (parentId.includes("/") && !parentId.startsWith("browse:")) {
    const [categoryId, slug] = parentId.split("/");

    // RE listing leaf column: property types without "Satılık …" prefix
    if (
      categoryId === "real-estate" &&
      (slug === "satilik-konut" ||
        slug === "kiralik-konut" ||
        slug === "arsa" ||
        slug === "diger" ||
        slug === "ticari-gayrimenkul")
    ) {
      return realEstatePropertyTypeLeaves(slug!, parentId);
    }

    const resolved = resolveKnowledgeProfile({
      categoryId,
      subcategorySlug: slug,
    });
    const hierarchy = resolved.browseHierarchy;
    const next = nextKindAfter(hierarchy, "subcategory");

    // Prefer taxonomy groups/product types when ENTITY_CATALOG brand path is not next
    const taxKids = taxonomyChildrenForSubcategory(
      categoryId!,
      slug!,
      parentId,
    );
    if (
      taxKids.length > 0 &&
      next &&
      (next === "group" ||
        next === "product_type" ||
        next === "service_type" ||
        next === "commodity_type" ||
        next === "attribute_bucket" ||
        (next === "brand" && !resolved.capabilities.includes("ENTITY_CATALOG")))
    ) {
      return taxKids;
    }

    // Non-entity domains: always offer taxonomy when present
    if (
      taxKids.length > 0 &&
      !resolved.capabilities.includes("ENTITY_CATALOG")
    ) {
      return taxKids;
    }

    // Services / commodity: taxonomy over placeholders
    if (
      taxKids.length > 0 &&
      (next === "service_type" || next === "commodity_type")
    ) {
      return taxKids;
    }

    return childrenForKind(
      next,
      {
        ...context,
        categoryId: categoryId!,
        subcategorySlug: slug,
      },
      parentId,
      resolved,
    );
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
    if (
      context.categoryId === "technology" &&
      parentId.startsWith("tax:technology:donanim:")
    ) {
      return technologyBrandNodes(parentId, parentId);
    }
    // No brand catalog yet — expose master taxonomy product/machine groups
    if (context.subcategorySlug) {
      const taxKids = taxonomyChildrenForSubcategory(
        context.categoryId,
        context.subcategorySlug,
        parentId,
      );
      if (taxKids.length > 0) return taxKids;
    }
    return [];
  }

  if (
    kind === "group" ||
    kind === "product_type" ||
    kind === "service_type" ||
    kind === "commodity_type" ||
    kind === "attribute_bucket"
  ) {
    if (context.subcategorySlug) {
      const taxKids = taxonomyChildrenForSubcategory(
        context.categoryId,
        context.subcategorySlug,
        parentId,
      );
      if (taxKids.length > 0) return taxKids;
    }
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
  if (categoryId === "technology") {
    // Generic tech brand column (family = general) when no product leaf selected
    return technologyBrandNodes(
      "tax:technology:donanim:bilgisayar:dizustu-bilgisayar",
      subcategorySlug ? `${categoryId}/${subcategorySlug}` : categoryId,
    ).filter((n) => n.kind === "brand");
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

/**
 * Canonical browse "Farketmez" option for allowAny fields.
 * Not a catalog entity — sentinel only.
 */
export function getBrowseAnyOption(
  fieldKey: string,
  categoryId: string,
  parentId?: string | null,
): BrowseNode {
  return node({
    id: `any:${fieldKey}`,
    kind: "attribute_bucket",
    label: "Farketmez",
    categoryId,
    parentId: parentId ?? null,
    hasChildren: false,
    meta: {
      any: true,
      fieldKey,
      sentinel: "__ANY__",
    },
  });
}

/**
 * Prepend ANY option when the field allows it (no fake brand_* entities).
 */
export function withBrowseAnyOption(
  children: BrowseNode[],
  opts: {
    fieldKey: string;
    categoryId: string;
    parentId?: string | null;
    allowAny?: boolean;
  },
): BrowseNode[] {
  if (!opts.allowAny) return children;
  const anyNode = getBrowseAnyOption(
    opts.fieldKey,
    opts.categoryId,
    opts.parentId,
  );
  if (children.some((c) => c.id === anyNode.id)) return children;
  return [anyNode, ...children];
}
