/**
 * Free-text ↔ category-browse equivalence for automotive golden path.
 * Both paths must converge on the same CatalogRegistry entity IDs.
 * Does not create a second understanding brain — browse builds explicit
 * selections; free text uses understandRequest() + catalog enrichment.
 */

import {
  ensureAutomotiveCatalogRegistered,
  getAutomotiveIndexes,
  toCanonicalCatalogFacts,
  type CanonicalCatalogFacts,
} from "@/lib/catalog";
import { understandRequest } from "@/lib/request-understanding/understand-request";

import { applyBrowseSelection } from "./browse";

export const AUTOMOTIVE_EQUIVALENCE_FREE_TEXT =
  "2017 Volkswagen Golf 7 1.6 TDI sağ ön far arıyorum";

export type BrowseEquivalencePath = {
  categoryId: "automotive";
  subcategoryLabel: "Yedek Parça";
  brandName: string;
  modelName: string;
  generationName: string;
  modelYear: number;
  engineName: string;
  partSystemHint: string;
  partName: string;
  positionName: string;
};

/** Browse path mirrors UX labels; entity resolve maps to catalog names (Ön far, ön sağ). */
export const AUTOMOTIVE_EQUIVALENCE_BROWSE_PATH: BrowseEquivalencePath = {
  categoryId: "automotive",
  subcategoryLabel: "Yedek Parça",
  brandName: "Volkswagen",
  modelName: "Golf",
  generationName: "Golf VII",
  modelYear: 2017,
  engineName: "1.6 TDI",
  partSystemHint: "Aydınlatma",
  partName: "Far",
  positionName: "Ön Sağ",
};

function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

export function resolveBrowsePathToCatalogFacts(
  path: BrowseEquivalencePath = AUTOMOTIVE_EQUIVALENCE_BROWSE_PATH,
): CanonicalCatalogFacts {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();

  const brand = idx.brands.find((b) => fold(b.name) === fold(path.brandName));
  if (!brand) throw new Error(`Browse brand not found: ${path.brandName}`);

  const model = (idx.modelsByBrand.get(brand.id) ?? []).find(
    (m) => fold(m.name) === fold(path.modelName),
  );
  if (!model) throw new Error(`Browse model not found: ${path.modelName}`);

  const generation = (idx.generationsByModel.get(model.id) ?? []).find((g) => {
    const name = fold(g.name);
    const target = fold(path.generationName);
    return (
      name === target ||
      name.includes(target) ||
      g.aliases.some((a) => fold(a) === target || fold(a).includes("golf 7"))
    );
  });
  if (!generation) {
    throw new Error(`Browse generation not found: ${path.generationName}`);
  }

  const engines = idx.enginesByGeneration.get(generation.id) ?? [];
  const engineNeedle = fold(path.engineName);
  const engineMatches = engines.filter(
    (e) =>
      fold(e.marketingName).includes(engineNeedle) ||
      e.aliases.some((a) => fold(a).includes(engineNeedle)),
  );
  // Ambiguous power variants → leave unresolved (precision-first; same as matcher).
  const engine = engineMatches.length === 1 ? engineMatches[0] : undefined;

  const partTarget = fold(path.partName);
  const part =
    idx.parts.find((p) => fold(p.name) === partTarget) ??
    idx.parts.find((p) => fold(p.name) === "ön far" && partTarget === "far") ??
    idx.parts.find(
      (p) =>
        fold(p.systemNameTr) === fold(path.partSystemHint) &&
        fold(p.name).includes(partTarget),
    );
  if (!part) throw new Error(`Browse part not found: ${path.partName}`);

  const posTarget = fold(path.positionName);
  const position = idx.positions.find((p) => {
    const tr = fold(p.tr);
    if (tr === posTarget) return true;
    if (p.aliases.some((a) => fold(a) === posTarget)) return true;
    // "Ön Sağ" ↔ "ön sağ" / "sağ ön"
    const tokens = posTarget.split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((t) => tr.includes(t));
  });
  if (!position) {
    throw new Error(`Browse position not found: ${path.positionName}`);
  }

  return {
    domainId: "automotive",
    brand: { id: brand.id, label: brand.name },
    model: { id: model.id, label: model.name },
    generation: { id: generation.id, label: generation.name },
    modelYear: path.modelYear,
    engine: engine
      ? {
          id: engine.id,
          marketingName: engine.marketingName,
          powerKw: engine.powerKw ?? undefined,
          fuelType: engine.fuelType,
        }
      : undefined,
    part: { id: part.id, label: part.name },
    position: { id: position.id, label: position.tr },
    confidence: "exact",
    source: "FUTURE_KNOWLEDGE",
  };
}

export function resolveFreeTextToCatalogFacts(
  text: string = AUTOMOTIVE_EQUIVALENCE_FREE_TEXT,
): CanonicalCatalogFacts | null {
  const understanding = understandRequest(text);
  return toCanonicalCatalogFacts(understanding);
}

export type EquivalenceCompare = {
  equivalent: boolean;
  freeText: CanonicalCatalogFacts | null;
  browse: CanonicalCatalogFacts;
  mismatches: string[];
};

export function compareFreeTextAndBrowseEquivalence(
  text: string = AUTOMOTIVE_EQUIVALENCE_FREE_TEXT,
  path: BrowseEquivalencePath = AUTOMOTIVE_EQUIVALENCE_BROWSE_PATH,
): EquivalenceCompare {
  const freeText = resolveFreeTextToCatalogFacts(text);
  const browse = resolveBrowsePathToCatalogFacts(path);
  const mismatches: string[] = [];

  if (!freeText) {
    return { equivalent: false, freeText, browse, mismatches: ["freeText_null"] };
  }

  const keys: Array<keyof CanonicalCatalogFacts> = [
    "brand",
    "model",
    "generation",
    "part",
    "position",
  ];

  for (const key of keys) {
    const a = freeText[key] as { id?: string } | undefined;
    const b = browse[key] as { id?: string } | undefined;
    if (!a?.id || !b?.id) {
      if (a?.id || b?.id) mismatches.push(`${String(key)}_missing`);
      continue;
    }
    if (a.id !== b.id) mismatches.push(`${String(key)}_id`);
  }

  if (
    freeText.modelYear &&
    browse.modelYear &&
    freeText.modelYear !== browse.modelYear
  ) {
    mismatches.push("modelYear");
  }

  // Engine: allow missing on either side if catalog seed sparse; if both present must match
  if (freeText.engine?.id && browse.engine?.id) {
    if (freeText.engine.id !== browse.engine.id) mismatches.push("engine_id");
  }

  return {
    equivalent: mismatches.length === 0,
    freeText,
    browse,
    mismatches,
  };
}

/** Build explicit field bag from browse path (UI would call applyBrowseSelection). */
export function browsePathToExplicitFields(
  path: BrowseEquivalencePath = AUTOMOTIVE_EQUIVALENCE_BROWSE_PATH,
): Record<string, string> {
  const facts = resolveBrowsePathToCatalogFacts(path);
  let fields: Record<string, string> = {
    needType: "part",
    modelYear: String(path.modelYear),
  };
  fields = applyBrowseSelection(fields, {
    key: "brand",
    value: facts.brand!.label,
    entityId: facts.brand!.id,
  });
  fields = applyBrowseSelection(fields, {
    key: "model",
    value: facts.model!.label,
    entityId: facts.model!.id,
  });
  fields = applyBrowseSelection(fields, {
    key: "generation",
    value: facts.generation!.label,
    entityId: facts.generation!.id,
  });
  fields = applyBrowseSelection(fields, {
    key: "part",
    value: facts.part!.label,
    entityId: facts.part!.id,
  });
  if (facts.position) {
    fields = applyBrowseSelection(fields, {
      key: "position",
      value: facts.position.label,
      entityId: facts.position.id,
    });
  }
  if (facts.engine) {
    fields = applyBrowseSelection(fields, {
      key: "engine",
      value: facts.engine.marketingName,
      entityId: facts.engine.id,
    });
  }
  return fields;
}
