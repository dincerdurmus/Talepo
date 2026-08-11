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

function automotiveBrowsePath(state: CanonicalRequestState): BrowsePathStep[] {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  const path: BrowsePathStep[] = [];

  path.push(step("automotive", "category", "Otomotiv"));
  const subSlug = state.subcategorySlug ?? "yedek-parca";
  path.push(
    step(`automotive/${subSlug}`, "subcategory", "Yedek Parça"),
  );

  const brandLabel = state.fields.brand?.kind === "VALUE" ? state.fields.brand.value : null;
  const modelLabel = state.fields.model?.kind === "VALUE" ? state.fields.model.value : null;
  const generationLabel =
    state.fields.generation?.kind === "VALUE" ? state.fields.generation.value : null;

  // Golf often lands as model in RU; brand may be wrong — resolve via catalog
  let brand = brandLabel
    ? idx.brands.find((b) => fold(b.name) === fold(brandLabel))
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

  const partSystem =
    state.fields.partSystem?.kind === "VALUE"
      ? String(state.fields.partSystem.value)
      : null;
  const partLabel =
    state.fields.part?.kind === "VALUE" ? String(state.fields.part.value) : null;

  if (partSystem || partLabel) {
    const systemHit = idx.parts.find(
      (p) =>
        (partSystem && fold(p.systemNameTr) === fold(partSystem)) ||
        (partLabel &&
          (fold(p.name) === fold(partLabel) ||
            fold(partLabel).includes(fold(p.name)) ||
            fold(p.name).includes("far"))),
    );
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
        idx.parts.find(
          (p) =>
            p.systemId === systemHit.systemId &&
            (fold(p.name) === fold(partLabel ?? "") ||
              fold(partLabel ?? "").includes(fold(p.name)) ||
              fold(p.name).includes("far")),
        ) ?? systemHit;
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

  return path;
}

function technologyTvPath(state: CanonicalRequestState): BrowsePathStep[] {
  ensureTaxonomyLoaded();
  const path: BrowsePathStep[] = [];
  path.push(step("technology", "category", "Teknoloji"));

  const sub = getSubcategoryTaxonomyNode("technology", "donanim");
  if (sub) {
    path.push(step(`technology/donanim`, "subcategory", "Donanım"));
  } else {
    path.push(step("technology/donanim", "subcategory", "Donanım"));
  }

  const tvId =
    state.taxonomyNodeId ?? "tax:technology:donanim:tv-ve-goruntu:televizyon";
  const tvNode = getTaxonomyNode(tvId);
  const group = tvNode?.parentId ? getTaxonomyNode(tvNode.parentId) : null;
  if (group) {
    path.push(step(group.id, "group", group.canonicalName));
  }
  if (tvNode) {
    path.push(step(tvNode.id, "product_type", tvNode.canonicalName));
  } else {
    path.push(
      step(
        "tax:technology:donanim:tv-ve-goruntu:televizyon",
        "product_type",
        "Televizyon",
      ),
    );
  }

  if (state.fields.brand?.kind === "ANY") {
    path.push(step("any:brand", "brand", "Farketmez"));
  } else if (state.fields.brand?.kind === "VALUE" && state.fields.brand.value) {
    const b = state.fields.brand.value;
    path.push(
      step(`browse:technology:brand:${toSlug(b)}`, "brand", b),
    );
  }

  if (state.fields.screenSize?.kind === "VALUE" && state.fields.screenSize.value) {
    const s = state.fields.screenSize.value;
    path.push(
      step(`attr:screenSize:${s}`, "attribute_bucket", `${s} ekran`),
    );
  }

  if (state.fields.resolution?.kind === "VALUE" && state.fields.resolution.value) {
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

function appliancesVacuumPath(state: CanonicalRequestState): BrowsePathStep[] {
  ensureTaxonomyLoaded();
  const path: BrowsePathStep[] = [];
  path.push(step("appliances", "category", "Beyaz Eşya"));
  path.push(step("appliances/supurge", "subcategory", "Süpürge"));

  if (state.fields.brand?.kind === "VALUE" && state.fields.brand.value) {
    const b = state.fields.brand.value;
    path.push(step(`browse:appliances:brand:${toSlug(b)}`, "brand", b));
  } else if (state.fields.brand?.kind === "ANY") {
    path.push(step("any:brand", "brand", "Farketmez"));
  }

  if (state.fields.model?.kind === "VALUE" && state.fields.model.value) {
    path.push(
      step(
        `browse:appliances:model:${toSlug(state.fields.model.value)}`,
        "model",
        state.fields.model.value,
      ),
    );
  }

  return path;
}

function genericPath(state: CanonicalRequestState): BrowsePathStep[] {
  const path: BrowsePathStep[] = [];
  if (state.categoryId) {
    path.push(step(state.categoryId, "category", state.categoryId));
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
  const raw = fold(state.understanding.rawInput ?? "");

  if (
    state.categoryId === "automotive" ||
    state.understanding.requestSubject.kind.value === "PART" ||
    state.understanding.category.value === "automotive"
  ) {
    return automotiveBrowsePath(state);
  }

  if (
    pt.includes("televizyon") ||
    pt === "television" ||
    raw.includes("televizyon") ||
    /\btv\b/.test(raw) ||
    state.taxonomyNodeId?.includes("televizyon")
  ) {
    return technologyTvPath(state);
  }

  if (
    pt.includes("supurge") ||
    pt.includes("süpürge") ||
    raw.includes("süpürge") ||
    raw.includes("supurge") ||
    fold(state.fields.brand?.value ?? "") === "dyson"
  ) {
    return appliancesVacuumPath(state);
  }

  return genericPath(state);
}
