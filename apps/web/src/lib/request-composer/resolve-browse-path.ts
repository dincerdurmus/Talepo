/**
 * resolveBrowsePath(state) → UI-ready stable browse path IDs.
 */

import {
  ensureAutomotiveCatalogRegistered,
  getAutomotiveIndexes,
} from "@/lib/catalog";
import { subcategorySlug as toSlug } from "@/lib/knowledge/slug";
import {
  ensureTaxonomyLoaded,
  getTaxonomyNode,
  getSubcategoryTaxonomyNode,
} from "@/lib/taxonomy";

import type { BrowsePathStep, CanonicalRequestState } from "./types";

function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

function step(
  id: string,
  kind: string,
  label: string,
  entityId?: string,
): BrowsePathStep {
  return { id, kind, label, entityId };
}

const AUTOMOTIVE_SUB_LABELS: Record<string, string> = {
  "arac-satin-alma": "Araç Satın Alma",
  "yedek-parca": "Yedek Parça",
  "arac-bakim": "Araç Bakım",
  "lastik-ve-jant": "Lastik ve Jant",
  diger: "Diğer",
};

function automotiveNeedType(state: CanonicalRequestState): string {
  if (state.fields.needType?.kind === "VALUE" && state.fields.needType.value) {
    return state.fields.needType.value;
  }
  const subject = state.understanding.requestSubject.kind.value;
  if (subject === "PART" || subject === "ACCESSORY") return "part";
  if (subject === "SERVICE") return "service";
  if (subject === "VEHICLE") return "vehicle";
  const intent = state.understanding.intent.value;
  if (intent === "PART") return "part";
  if (intent === "SERVICE") return "service";
  return "vehicle";
}

function automotiveSubSlug(state: CanonicalRequestState): string {
  if (state.subcategorySlug) return state.subcategorySlug;
  const need = automotiveNeedType(state);
  if (need === "part") return "yedek-parca";
  if (need === "service") return "arac-bakim";
  if (need === "tire") return "lastik-ve-jant";
  return "arac-satin-alma";
}

function automotiveBrowsePath(state: CanonicalRequestState): BrowsePathStep[] {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  const path: BrowsePathStep[] = [];
  const need = automotiveNeedType(state);
  const isPartNeed = need === "part";

  path.push(step("automotive", "category", "Otomotiv"));
  const subSlug = automotiveSubSlug(state);
  path.push(
    step(
      `automotive/${subSlug}`,
      "subcategory",
      AUTOMOTIVE_SUB_LABELS[subSlug] ?? subSlug,
    ),
  );

  const brandLabel = state.fields.brand?.kind === "VALUE" ? state.fields.brand.value : null;
  const modelLabel = state.fields.model?.kind === "VALUE" ? state.fields.model.value : null;
  const generationLabel =
    state.fields.generation?.kind === "VALUE" ? state.fields.generation.value : null;

  // Golf often lands as model in RU; brand may be wrong — resolve via catalog
  const brandToken = brandLabel ? fold(brandLabel) : "";
  let brand = brandToken
    ? idx.brands.find((b) => {
        const name = fold(b.name);
        return (
          name === brandToken ||
          name.startsWith(brandToken) ||
          brandToken.startsWith(name.split(/[\s-]/)[0] ?? name)
        );
      })
    : undefined;
  let model = brand
    ? (idx.modelsByBrand.get(brand.id) ?? []).find(
        (m) => fold(m.name) === fold(modelLabel ?? ""),
      )
    : undefined;

  if (!model && modelLabel) {
    for (const b of idx.brands) {
      const hit = (idx.modelsByBrand.get(b.id) ?? []).find(
        (m) => fold(m.name) === fold(modelLabel),
      );
      if (hit) {
        brand = b;
        model = hit;
        break;
      }
    }
  }

  // "Golf" as brand token → Volkswagen Golf
  if (!model && brandLabel && fold(brandLabel) === "golf") {
    const vw = idx.brands.find((b) => fold(b.name) === "volkswagen");
    if (vw) {
      brand = vw;
      model = (idx.modelsByBrand.get(vw.id) ?? []).find(
        (m) => fold(m.name) === "golf",
      );
    }
  }

  if (brand) {
    path.push(
      step(`browse:automotive:brand:${brand.id}`, "brand", brand.name, brand.id),
    );
  } else if (state.fields.brand?.kind === "ANY") {
    path.push(step("any:brand", "brand", "Farketmez"));
  }

  if (model) {
    path.push(
      step(`browse:automotive:model:${model.id}`, "model", model.name, model.id),
    );
  }

  if (model) {
    const gens = idx.generationsByModel.get(model.id) ?? [];
    const gen =
      (generationLabel
        ? gens.find(
            (g) =>
              fold(g.name) === fold(generationLabel) ||
              fold(g.name).includes(fold(generationLabel)) ||
              g.aliases.some((a) => fold(a).includes(fold(generationLabel))),
          )
        : undefined) ??
      gens.find(
        (g) =>
          g.aliases.some((a) => fold(a).includes("golf 7") || fold(a).includes("golf vii")) ||
          fold(g.name).includes("vii") ||
          fold(g.name).includes("7"),
      );
    if (gen) {
      path.push(
        step(
          `browse:automotive:generation:${gen.id}`,
          "generation",
          gen.name,
          gen.id,
        ),
      );
    }
  }

  // Part drill-down only for spare-part need — never invent lighting/far from vehicle text
  if (isPartNeed) {
    const partSystem =
      state.fields.partSystem?.kind === "VALUE"
        ? String(state.fields.partSystem.value)
        : null;
    const partLabel =
      state.fields.part?.kind === "VALUE"
        ? String(state.fields.part.value)
        : null;

    if (partSystem || partLabel) {
      const labelFold = partLabel ? fold(partLabel) : "";
      const systemHit = idx.parts.find((p) => {
        if (partSystem && fold(p.systemNameTr) === fold(partSystem)) return true;
        if (!labelFold) return false;
        const nameFold = fold(p.name);
        return (
          nameFold === labelFold ||
          labelFold.includes(nameFold) ||
          nameFold.includes(labelFold)
        );
      });
      if (systemHit) {
        path.push(
          step(
            `browse:automotive:part_system:${systemHit.systemId}`,
            "part_system",
            systemHit.systemNameTr,
            systemHit.systemId,
          ),
        );
        const part =
          idx.parts.find((p) => {
            if (p.systemId !== systemHit.systemId) return false;
            if (!labelFold) return false;
            const nameFold = fold(p.name);
            return (
              nameFold === labelFold ||
              labelFold.includes(nameFold) ||
              nameFold.includes(labelFold)
            );
          }) ?? systemHit;
        path.push(
          step(
            `browse:automotive:part:${part.id}`,
            "part",
            part.name,
            part.id,
          ),
        );
      }
    }

    const posLabel =
      state.fields.partPosition?.kind === "VALUE"
        ? String(state.fields.partPosition.value)
        : null;
    if (posLabel) {
      const pos = idx.positions.find((p) => {
        const tr = fold(p.tr);
        const target = fold(posLabel);
        if (tr === target) return true;
        if (p.aliases.some((a) => fold(a) === target)) return true;
        const tokens = target.split(/\s+/).filter(Boolean);
        return tokens.length > 0 && tokens.every((t) => tr.includes(t));
      });
      if (pos) {
        path.push(
          step(
            `browse:automotive:position:${pos.id}`,
            "position",
            pos.tr,
            pos.id,
          ),
        );
      }
    }
  }

  return path;
}

function techProductDisplayLabel(canonicalName: string, id: string): string {
  if (id.endsWith(":telefon-ve-tablet")) return "Cep Telefonu & Aksesuar";
  if (id.endsWith(":akilli-telefon")) return "Cep Telefonu";
  return canonicalName;
}

function resolveTechHardwareLeafId(state: CanonicalRequestState): string | null {
  if (state.taxonomyNodeId?.startsWith("tax:technology:donanim:")) {
    return state.taxonomyNodeId;
  }
  const pt = fold(
    state.fields.productType?.kind === "VALUE"
      ? String(state.fields.productType.value)
      : "",
  );
  const raw = fold(state.understanding.rawInput ?? "");
  if (pt.includes("televizyon") || pt === "tv" || raw.includes("televizyon") || /\btv\b/.test(raw)) {
    return "tax:technology:donanim:tv-ve-goruntu:televizyon";
  }
  if (
    pt.includes("dizüstü") ||
    pt.includes("dizustu") ||
    pt.includes("laptop") ||
    pt.includes("notebook") ||
    raw.includes("dizüstü") ||
    raw.includes("dizustu") ||
    raw.includes("laptop") ||
    raw.includes("notebook")
  ) {
    return "tax:technology:donanim:bilgisayar:dizustu-bilgisayar";
  }
  if (
    pt.includes("masaüstü") ||
    pt.includes("masaustu") ||
    raw.includes("masaüstü") ||
    raw.includes("masaustu")
  ) {
    return "tax:technology:donanim:bilgisayar:masaustu-bilgisayar";
  }
  if (
    pt.includes("cep telefon") ||
    pt.includes("akıllı telefon") ||
    pt.includes("akilli telefon") ||
    raw.includes("cep telefon") ||
    raw.includes("akıllı telefon") ||
    raw.includes("akilli telefon") ||
    raw.includes("iphone") ||
    raw.includes("smartphone")
  ) {
    return "tax:technology:donanim:telefon-ve-tablet:akilli-telefon";
  }
  if (pt.includes("tablet") || raw.includes("tablet") || raw.includes("ipad")) {
    return "tax:technology:donanim:telefon-ve-tablet:tablet";
  }
  return null;
}

/** Donanım path: Teknoloji → Donanım → group → product type → brand */
function technologyDonanimPath(state: CanonicalRequestState): BrowsePathStep[] {
  ensureTaxonomyLoaded();
  const path: BrowsePathStep[] = [];
  path.push(step("technology", "category", "Teknoloji"));
  path.push(step("technology/donanim", "subcategory", "Donanım"));

  const leafId = resolveTechHardwareLeafId(state);
  const leaf = leafId ? getTaxonomyNode(leafId) : null;
  const group = leaf?.parentId ? getTaxonomyNode(leaf.parentId) : null;

  if (group) {
    path.push(
      step(
        group.id,
        "group",
        techProductDisplayLabel(group.canonicalName, group.id),
      ),
    );
  }
  if (leaf) {
    path.push(
      step(
        leaf.id,
        "product_type",
        techProductDisplayLabel(leaf.canonicalName, leaf.id),
      ),
    );
  }

  if (state.fields.brand?.kind === "ANY") {
    path.push(step("any:brand", "brand", "Tümü"));
  } else if (state.fields.brand?.kind === "VALUE" && state.fields.brand.value) {
    const b = state.fields.brand.value;
    path.push(step(`browse:technology:brand:${toSlug(b)}`, "brand", b));
  }

  // TV-only attrs on path
  const isTv = leafId?.includes("televizyon");
  if (
    isTv &&
    state.fields.screenSize?.kind === "VALUE" &&
    state.fields.screenSize.value
  ) {
    const s = state.fields.screenSize.value;
    path.push(
      step(`attr:screenSize:${s}`, "attribute_bucket", `${s} ekran`),
    );
  }

  if (
    isTv &&
    state.fields.resolution?.kind === "VALUE" &&
    state.fields.resolution.value
  ) {
    const r = state.fields.resolution.value;
    path.push(step(`attr:resolution:${r}`, "attribute_bucket", r));
  }

  if (state.fields.condition?.kind === "VALUE" && state.fields.condition.value) {
    path.push(
      step(
        `attr:condition:${toSlug(state.fields.condition.value)}`,
        "attribute_bucket",
        state.fields.condition.value,
      ),
    );
  }

  if (state.fields.model?.kind === "VALUE" && state.fields.model.value) {
    path.push(
      step(
        `browse:technology:model:${toSlug(state.fields.model.value)}`,
        "model",
        state.fields.model.value,
      ),
    );
  }

  return path;
}

function appliancesBrowsePath(state: CanonicalRequestState): BrowsePathStep[] {
  ensureTaxonomyLoaded();
  const path: BrowsePathStep[] = [];
  path.push(step("appliances", "category", "Beyaz Eşya"));

  const leafId = state.taxonomyNodeId;
  const leaf =
    leafId?.startsWith("tax:appliances:") ? getTaxonomyNode(leafId) : null;

  let sub =
    state.subcategorySlug ??
    leaf?.subcategoryId ??
    (leafId?.includes(":kucuk-ev-aletleri:")
      ? "kucuk-ev-aletleri"
      : leafId?.includes(":isitma-sogutma-ve-havalandirma:")
        ? "isitma-sogutma-ve-havalandirma"
        : leafId?.includes(":beyaz-esya:")
          ? "beyaz-esya"
          : null);

  // Vacuum / small-appliance free-text without resolved slug
  if (!sub) {
    const pt =
      state.fields.applianceType?.kind === "VALUE"
        ? fold(String(state.fields.applianceType.value))
        : state.fields.productType?.kind === "VALUE"
          ? fold(String(state.fields.productType.value))
          : "";
    const raw = fold(state.understanding.rawInput ?? "");
    if (
      pt.includes("supurge") ||
      pt.includes("süpürge") ||
      raw.includes("süpürge") ||
      raw.includes("supurge") ||
      pt.includes("airfryer") ||
      pt.includes("ütü") ||
      pt.includes("blender")
    ) {
      sub = "kucuk-ev-aletleri";
    } else if (
      pt.includes("klima") ||
      pt.includes("kombi") ||
      pt.includes("vantilatör") ||
      raw.includes("klima") ||
      raw.includes("kombi")
    ) {
      sub = "isitma-sogutma-ve-havalandirma";
    } else {
      sub = "beyaz-esya";
    }
  }

  const subLabel =
    sub === "kucuk-ev-aletleri"
      ? "Küçük Ev Aletleri"
      : sub === "isitma-sogutma-ve-havalandirma"
        ? "Isıtma, Soğutma ve Havalandırma"
        : sub === "beyaz-esya"
          ? "Beyaz Eşya"
          : sub === "diger"
            ? "Diğer"
            : sub;

  path.push(step(`appliances/${sub}`, "subcategory", subLabel));

  if (leaf && leaf.nodeType !== "SUBCATEGORY" && leaf.nodeType !== "CATEGORY") {
    path.push(
      step(
        leaf.id,
        String(leaf.nodeType).toLowerCase(),
        leaf.canonicalName,
        leaf.id,
      ),
    );
  } else if (
    state.fields.applianceType?.kind === "VALUE" &&
    state.fields.applianceType.value
  ) {
    const label = String(state.fields.applianceType.value);
    path.push(
      step(`appliances:type:${toSlug(label)}`, "product_type", label),
    );
  }

  return path;
}

function cleanRePathLabel(label: string): string {
  return label.replace(/^(satılık|kiralık)\s+/iu, "").trim() || label;
}

function realEstateBrowsePath(state: CanonicalRequestState): BrowsePathStep[] {
  ensureTaxonomyLoaded();
  const path: BrowsePathStep[] = [];
  path.push(step("real-estate", "category", "Emlak"));

  const sub = state.subcategorySlug;
  const listing =
    state.fields.listingType?.kind === "VALUE"
      ? String(state.fields.listingType.value)
      : null;

  const isKonut =
    sub === "satilik-konut" ||
    sub === "kiralik-konut" ||
    (listing &&
      (listing.toLocaleLowerCase("tr-TR").includes("satılık") ||
        listing.toLocaleLowerCase("tr-TR").includes("kiralık")));

  if (isKonut || sub === "satilik-konut" || sub === "kiralik-konut") {
    path.push(step("re:group:konut", "group", "Konut"));
    if (sub === "satilik-konut" || listing?.toLocaleLowerCase("tr-TR").includes("satılık")) {
      path.push(
        step("real-estate/satilik-konut", "subcategory", "Satılık"),
      );
    } else if (
      sub === "kiralik-konut" ||
      listing?.toLocaleLowerCase("tr-TR").includes("kiralık")
    ) {
      path.push(
        step("real-estate/kiralik-konut", "subcategory", "Kiralık"),
      );
    }
  } else if (sub === "ticari-gayrimenkul") {
    path.push(step("re:group:isyeri", "group", "İş Yeri"));
  } else if (sub === "arsa") {
    path.push(step("real-estate/arsa", "subcategory", "Arsa"));
  } else if (sub === "diger") {
    path.push(step("real-estate/diger", "subcategory", "Diğer"));
  } else if (sub) {
    path.push(step(`real-estate/${sub}`, "subcategory", sub));
  }

  const propType =
    state.fields.propertyType?.kind === "VALUE" &&
    state.fields.propertyType.value
      ? String(state.fields.propertyType.value).trim()
      : null;
  const propGeneric =
    !!propType && /^(gayrimenkul|emlak|konut|ev)$/i.test(propType);

  if (state.taxonomyNodeId && !propGeneric) {
    const node = getTaxonomyNode(state.taxonomyNodeId);
    if (node) {
      const leaf = cleanRePathLabel(node.canonicalName);
      if (!/^(gayrimenkul|emlak|konut)$/i.test(leaf)) {
        path.push(
          step(
            node.id,
            String(node.nodeType).toLowerCase(),
            leaf,
            node.id,
          ),
        );
      }
    }
  } else if (propType && !propGeneric) {
    const listingSlug =
      sub === "satilik-konut" || sub === "kiralik-konut" ? sub : null;
    path.push(
      step(
        listingSlug
          ? `re:property:${listingSlug}:${toSlug(propType)}`
          : `re:property:${toSlug(propType)}`,
        "product_type",
        propType,
      ),
    );
  }

  return path;
}

function genericPath(state: CanonicalRequestState): BrowsePathStep[] {
  const path: BrowsePathStep[] = [];
  if (state.categoryId) {
    const label =
      state.categoryId === "real-estate"
        ? "Emlak"
        : state.categoryId === "automotive"
          ? "Otomotiv"
          : state.categoryId;
    path.push(step(state.categoryId, "category", label));
  }
  if (state.categoryId && state.subcategorySlug) {
    path.push(
      step(
        `${state.categoryId}/${state.subcategorySlug}`,
        "subcategory",
        state.subcategorySlug,
      ),
    );
  }
  if (state.taxonomyNodeId) {
    const node = getTaxonomyNode(state.taxonomyNodeId);
    if (node) {
      path.push(step(node.id, String(node.nodeType), node.canonicalName));
    }
  }
  if (state.fields.brand?.kind === "ANY") {
    path.push(step("any:brand", "brand", "Farketmez"));
  } else if (state.fields.brand?.kind === "VALUE" && state.fields.brand.value) {
    path.push(
      step(
        `browse:brand:${toSlug(state.fields.brand.value)}`,
        "brand",
        state.fields.brand.value,
      ),
    );
  }
  return path;
}

function furnitureBrowsePath(state: CanonicalRequestState): BrowsePathStep[] {
  ensureTaxonomyLoaded();
  const path: BrowsePathStep[] = [];
  path.push(step("furniture", "category", "Mobilya ve Ofis"));

  const sub =
    state.subcategorySlug ??
    (state.taxonomyNodeId?.includes(":ofis-mobilyalari:")
      ? "ofis-mobilyalari"
      : state.taxonomyNodeId?.includes(":ev-mobilyasi:")
        ? "ev-mobilyasi"
        : null);

  if (sub === "ofis-mobilyalari") {
    path.push(
      step("furniture/ofis-mobilyalari", "subcategory", "Ofis Mobilyaları"),
    );
  } else if (sub === "ev-mobilyasi" || sub) {
    path.push(
      step(
        `furniture/${sub}`,
        "subcategory",
        sub === "ev-mobilyasi" ? "Ev Mobilyası" : sub,
      ),
    );
  } else {
    path.push(
      step("furniture/ev-mobilyasi", "subcategory", "Ev Mobilyası"),
    );
  }

  const leafId = state.taxonomyNodeId;
  if (leafId?.startsWith("tax:furniture:")) {
    const leaf = getTaxonomyNode(leafId);
    const group = leaf?.parentId ? getTaxonomyNode(leaf.parentId) : null;
    if (group && group.nodeType === "GROUP") {
      path.push(step(group.id, "group", group.canonicalName));
    }
    if (leaf && leaf.nodeType !== "SUBCATEGORY" && leaf.nodeType !== "CATEGORY") {
      path.push(
        step(
          leaf.id,
          String(leaf.nodeType).toLowerCase(),
          leaf.canonicalName,
          leaf.id,
        ),
      );
    }
  } else if (
    state.fields.furnitureType?.kind === "VALUE" &&
    state.fields.furnitureType.value
  ) {
    const label = String(state.fields.furnitureType.value);
    path.push(
      step(`furniture:type:${toSlug(label)}`, "product_type", label),
    );
  }

  return path;
}

/**
 * Map canonical hybrid state → stable browse path for UI.
 */
export function resolveBrowsePath(
  state: CanonicalRequestState,
): BrowsePathStep[] {
  const pt =
    state.fields.productType?.kind === "VALUE"
      ? fold(String(state.fields.productType.value))
      : "";
  const ft =
    state.fields.furnitureType?.kind === "VALUE"
      ? fold(String(state.fields.furnitureType.value))
      : "";
  const raw = fold(state.understanding.rawInput ?? "");

  if (
    state.categoryId === "automotive" ||
    state.understanding.requestSubject.kind.value === "PART" ||
    state.understanding.category.value === "automotive"
  ) {
    return automotiveBrowsePath(state);
  }

  if (
    state.categoryId === "real-estate" ||
    state.understanding.category.value === "real-estate"
  ) {
    return realEstateBrowsePath(state);
  }

  if (
    state.categoryId === "furniture" ||
    state.understanding.category.value === "furniture" ||
    state.taxonomyNodeId?.startsWith("tax:furniture:") ||
    Boolean(ft) ||
    state.subcategorySlug === "ev-mobilyasi" ||
    state.subcategorySlug === "ofis-mobilyalari"
  ) {
    return furnitureBrowsePath(state);
  }

  const at =
    state.fields.applianceType?.kind === "VALUE"
      ? fold(String(state.fields.applianceType.value))
      : "";

  if (
    state.categoryId === "appliances" ||
    state.understanding.category.value === "appliances" ||
    state.taxonomyNodeId?.startsWith("tax:appliances:") ||
    Boolean(at) ||
    state.subcategorySlug === "kucuk-ev-aletleri" ||
    state.subcategorySlug === "beyaz-esya" ||
    state.subcategorySlug === "isitma-sogutma-ve-havalandirma" ||
    pt.includes("supurge") ||
    pt.includes("süpürge") ||
    raw.includes("süpürge") ||
    raw.includes("supurge") ||
    raw.includes("buzdolabı") ||
    raw.includes("buzdolabi") ||
    fold(state.fields.brand?.value ?? "") === "dyson"
  ) {
    return appliancesBrowsePath(state);
  }

  if (
    state.categoryId === "technology" ||
    state.understanding.category.value === "technology" ||
    state.taxonomyNodeId?.startsWith("tax:technology:donanim:") ||
    pt.includes("televizyon") ||
    pt.includes("dizüstü") ||
    pt.includes("dizustu") ||
    pt.includes("laptop") ||
    pt.includes("cep telefon") ||
    raw.includes("televizyon") ||
    raw.includes("dizüstü") ||
    raw.includes("dizustu") ||
    raw.includes("laptop") ||
    /\btv\b/.test(raw)
  ) {
    const leaf = resolveTechHardwareLeafId(state);
    if (leaf || state.subcategorySlug === "donanim") {
      return technologyDonanimPath(state);
    }
  }

  return genericPath(state);
}
