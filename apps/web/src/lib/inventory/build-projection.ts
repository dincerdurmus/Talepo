/**
 * One builder for inventory discovery projection (create / import / match-time derive).
 * Uses Master Taxonomy + browse semantic role — no LLM, no request composer.
 */

import { searchTaxonomyNodes } from "@/lib/discovery/search-taxonomy";
import { resolveBrowseSemanticRole } from "@/lib/request-composer/browse-semantic-role";
import {
  ensureTaxonomyLoaded,
  getSubcategoryTaxonomyNode,
  getTaxonomyAncestorIds,
  getTaxonomyNode,
  resolveTaxonomyAlias,
} from "@/lib/taxonomy";

import type {
  InventoryCompatibilityTarget,
  InventoryDiscoveryProjection,
  InventoryProjectionInput,
  InventorySemanticSubject,
} from "./types";
import { INVENTORY_DISCOVERY_PROJECTION_VERSION } from "./types";

const PART_HINT =
  /\b(far|tampon|balata|filtre|ayna|radyatör|radyator|pomp[ae]|rulman|disk|kampana|amortisör|amortisor|rot|rotbaşı|rotbasi|debriyaj|şanzıman|sanziman|enjektör|enjektor|turbo|katalizör|katalizor|egzoz|egzoz|yedek\s*par[cç]a|par[cç]a)\b/i;

const ACCESSORY_HINT =
  /\b(kılıf|kilif|kılıfi|kilifi|stand|şarj|sarj|kılıfı|kılıflar|aksesuar)\b/i;

const SERVICE_HINT =
  /\b(bakım|bakim|servis|montaj|onarım|onarim|kurulum)\b/i;

const VEHICLE_HINT =
  /\b(araç|arac|otomobil|sedan|suv|hatchback|pickup)\b/i;

const MACHINE_HINT =
  /\b(cnc|makine|makina|pres|kompresör|kompresor|freze|torna)\b/i;

function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR").normalize("NFC").trim();
}

function uniqueIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function slugifyTr(label: string): string {
  return fold(label)
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferCategoryId(input: InventoryProjectionInput, text: string): string | null {
  if (input.taxonomyCategoryId?.trim()) return input.taxonomyCategoryId.trim();
  const label = fold(input.categoryLabel ?? "");
  if (/otomotiv|araç|arac|yedek\s*par/.test(label) || /alfa|golf|volkswagen|bmw|mercedes/.test(text)) {
    return "automotive";
  }
  if (/beyaz\s*eşya|beyaz\s*esya|appliance|buzdolabı|çamaşır|camasir|klima/.test(label + " " + text)) {
    return "appliances";
  }
  if (/makine|makina|cnc|endüstri|endustri/.test(label + " " + text)) {
    return "machinery";
  }
  if (/televizyon|\btv\b|telefon|laptop|tablet/.test(text)) {
    return "technology";
  }
  if (/karton|etiket|baskı|baski|matbaa/.test(label + " " + text)) {
    return "printing";
  }
  return null;
}

function inferSubcategorySlug(
  input: InventoryProjectionInput,
  categoryId: string | null,
  text: string,
): string | null {
  if (input.subcategorySlug?.trim()) return input.subcategorySlug.trim();
  const label = fold(input.categoryLabel ?? "");
  if (categoryId === "automotive") {
    if (/yedek|par[cç]a|lastik|jant/.test(label) || PART_HINT.test(text)) {
      if (/lastik|jant/.test(label + " " + text)) return "lastik-ve-jant";
      return "yedek-parca";
    }
    if (/bakım|bakim|servis/.test(label) || SERVICE_HINT.test(text)) {
      return "arac-bakim";
    }
    if (/satın|satin|araç|arac/.test(label) && !PART_HINT.test(text)) {
      return "arac-satin-alma";
    }
    if (PART_HINT.test(text)) return "yedek-parca";
  }
  if (categoryId === "machinery") {
    if (/yedek|par[cç]a/.test(label) || PART_HINT.test(text)) return "yedek-parca";
    return "uretim-makinesi";
  }
  if (categoryId === "appliances") {
    if (/yedek|par[cç]a|pomp/.test(label + " " + text)) return "beyaz-esya";
    return "beyaz-esya";
  }
  if (input.categoryLabel?.trim()) {
    return slugifyTr(input.categoryLabel);
  }
  return null;
}

function inferSubject(
  input: InventoryProjectionInput,
  categoryId: string | null,
  subcategorySlug: string | null,
  text: string,
): InventorySemanticSubject {
  const role = resolveBrowseSemanticRole({
    categoryId,
    subcategorySlug,
    productType: input.part ?? input.categoryLabel,
  });
  if (role.subjectKind === "PART") return "PART";
  if (role.subjectKind === "VEHICLE") return "VEHICLE";
  if (role.subjectKind === "SERVICE") return "SERVICE";
  if (role.subjectKind === "ACCESSORY") return "ACCESSORY";
  if (role.subjectKind === "INDUSTRIAL_EQUIPMENT") return "MACHINE";

  if (input.needType) {
    const n = fold(input.needType);
    if (n === "part" || n === "tire") return "PART";
    if (n === "vehicle") return "VEHICLE";
    if (n === "service") return "SERVICE";
    if (n === "machine") return "MACHINE";
  }

  if (ACCESSORY_HINT.test(text)) return "ACCESSORY";
  if (SERVICE_HINT.test(text) && !PART_HINT.test(text)) return "SERVICE";
  if (PART_HINT.test(text) || /yedek\s*par/.test(fold(input.categoryLabel ?? ""))) {
    return "PART";
  }
  if (categoryId === "automotive" && VEHICLE_HINT.test(text) && !PART_HINT.test(text)) {
    return "VEHICLE";
  }
  if (categoryId === "machinery" || MACHINE_HINT.test(text)) {
    if (PART_HINT.test(text)) return "PART";
    return "MACHINE";
  }
  if (text.trim()) return "WHOLE_PRODUCT";
  return "UNKNOWN";
}

function extractPartLabel(text: string, input: InventoryProjectionInput): string | null {
  if (input.part?.trim()) return input.part.trim();
  const m = text.match(PART_HINT);
  if (m?.[1]) return m[1]!;
  // strip brand/model tokens for leftover subject noun
  let rest = text;
  if (input.brand) {
    rest = rest.replace(new RegExp(input.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  }
  if (input.model) {
    rest = rest.replace(new RegExp(input.model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  }
  rest = rest.replace(/\s+/g, " ").trim();
  if (rest.length >= 2 && rest.length <= 40 && !/^(için|icin)$/i.test(rest)) {
    return rest;
  }
  return null;
}

function buildCompatibilityTarget(
  subject: InventorySemanticSubject,
  input: InventoryProjectionInput,
  categoryId: string | null,
): InventoryCompatibilityTarget | undefined {
  if (subject !== "PART" && subject !== "ACCESSORY" && subject !== "CONSUMABLE") {
    return undefined;
  }
  const brand = input.brand?.trim() || undefined;
  const model = input.model?.trim() || undefined;
  const generation = input.generation?.trim() || undefined;
  if (!brand && !model && !generation) return undefined;
  const kind: InventoryCompatibilityTarget["kind"] =
    categoryId === "machinery"
      ? "MACHINE"
      : categoryId === "automotive"
        ? "VEHICLE"
        : "PRODUCT";
  return { kind, brand, model, generation };
}

function resolveTaxonomy(
  input: InventoryProjectionInput,
  categoryId: string | null,
  subcategorySlug: string | null,
  subject: InventorySemanticSubject,
  partLabel: string | null,
  text: string,
): { taxonomyNodeIds: string[]; primaryLeafId: string | null } {
  ensureTaxonomyLoaded();
  const ids: string[] = [];
  let primaryLeafId: string | null = null;

  if (categoryId) {
    const root = getTaxonomyNode(`tax:${categoryId}`);
    if (root) ids.push(root.id);
  }
  if (categoryId && subcategorySlug) {
    const sub = getSubcategoryTaxonomyNode(categoryId, subcategorySlug);
    if (sub) ids.push(sub.id);
  }

  const query =
    partLabel ||
    (subject === "WHOLE_PRODUCT" || subject === "VEHICLE" || subject === "MACHINE"
      ? text
      : text);

  if (query.trim().length >= 2) {
    const hits = searchTaxonomyNodes(query, {
      limit: 6,
      categoryId: categoryId ?? undefined,
    });
    // Prefer leaf under matching subcategory when possible
    const preferred =
      hits.find(
        (h) =>
          subcategorySlug &&
          getTaxonomyNode(h.id)?.subcategoryId === subcategorySlug,
      ) ?? hits[0];
    if (preferred) {
      primaryLeafId = preferred.id;
      ids.push(...getTaxonomyAncestorIds(preferred.id).reverse(), preferred.id);
    } else {
      const alias = resolveTaxonomyAlias(query, categoryId ?? undefined);
      if (alias && !alias.ambiguous) {
        primaryLeafId = alias.node.id;
        ids.push(...getTaxonomyAncestorIds(alias.node.id).reverse(), alias.node.id);
      }
    }
  }

  // Appliance spare leaf marker
  if (
    categoryId === "appliances" &&
    subject === "PART" &&
    !primaryLeafId
  ) {
    const leaf = getTaxonomyNode("tax:appliances:beyaz-esya:yedek-parca-ekipman");
    if (leaf) {
      primaryLeafId = leaf.id;
      ids.push(...getTaxonomyAncestorIds(leaf.id).reverse(), leaf.id);
    }
  }

  return { taxonomyNodeIds: uniqueIds(ids), primaryLeafId };
}

/**
 * Build canonical inventory discovery projection from structured inventory fields.
 */
export function buildInventoryDiscoveryProjection(
  input: InventoryProjectionInput,
): InventoryDiscoveryProjection {
  const name = (input.name || input.title || "").trim();
  const text = fold(
    [name, input.notes, input.categoryLabel, input.brand, input.model, input.part]
      .filter(Boolean)
      .join(" "),
  );

  const categoryId = inferCategoryId(input, text);
  const subcategorySlug = inferSubcategorySlug(input, categoryId, text);
  const subject = inferSubject(input, categoryId, subcategorySlug, text);
  const partLabel = extractPartLabel(name + " " + (input.notes ?? ""), input);

  const tax = resolveTaxonomy(
    input,
    categoryId,
    subcategorySlug,
    subject,
    partLabel,
    name,
  );

  const compatibilityTarget = buildCompatibilityTarget(
    subject,
    input,
    categoryId,
  );

  const entityRefs: Record<string, string> = {};
  if (subject === "VEHICLE" || subject === "WHOLE_PRODUCT" || subject === "MACHINE") {
    if (input.brand?.trim()) entityRefs.brand = input.brand.trim();
    if (input.model?.trim()) entityRefs.model = input.model.trim();
    if (input.generation?.trim()) entityRefs.generation = input.generation.trim();
  } else if (compatibilityTarget) {
    if (compatibilityTarget.brand) entityRefs.brand = compatibilityTarget.brand;
    if (compatibilityTarget.model) entityRefs.model = compatibilityTarget.model;
    if (compatibilityTarget.generation) {
      entityRefs.generation = compatibilityTarget.generation;
    }
  }

  const attributes: Record<string, string> = {};
  if (partLabel && (subject === "PART" || subject === "ACCESSORY")) {
    attributes.part = partLabel;
  }
  if (input.partPosition?.trim()) {
    attributes.partPosition = input.partPosition.trim();
  }
  if (input.condition?.trim()) {
    attributes.condition = input.condition.trim();
  }
  if (input.city?.trim()) attributes.city = input.city.trim();
  if (input.needType?.trim()) attributes.needType = input.needType.trim();
  else if (subject === "PART") attributes.needType = "part";
  else if (subject === "VEHICLE") attributes.needType = "vehicle";
  else if (subject === "SERVICE") attributes.needType = "service";
  else if (subject === "MACHINE") attributes.needType = "machine";

  if (subject === "WHOLE_PRODUCT" || subject === "VEHICLE" || subject === "MACHINE") {
    if (input.brand?.trim()) attributes.brand = input.brand.trim();
    if (input.model?.trim()) attributes.model = input.model.trim();
  }

  const hasStructure =
    Boolean(tax.primaryLeafId) ||
    Boolean(input.brand) ||
    Boolean(input.part) ||
    subject !== "UNKNOWN";

  const provenance: InventoryDiscoveryProjection["provenance"] = !name
    ? "LEGACY_EMPTY"
    : hasStructure
      ? input.brand || input.part || input.subcategorySlug
        ? "STRUCTURED"
        : "DERIVED_PARTIAL"
      : "LEGACY_EMPTY";

  const hints = uniqueIds(
    fold(name)
      .split(/[\s,./\-_]+/)
      .filter((t) => t.length >= 2),
  ).slice(0, 12);

  return {
    version: INVENTORY_DISCOVERY_PROJECTION_VERSION,
    kind: "inventory_discovery_projection",
    semanticSubject: subject,
    taxonomyNodeIds: tax.taxonomyNodeIds,
    primaryLeafId: tax.primaryLeafId,
    categoryId,
    subcategorySlug,
    entityRefs: Object.keys(entityRefs).length ? entityRefs : undefined,
    compatibilityTarget,
    attributes,
    normalizedTextHints: hints,
    provenance,
    builtAt: new Date().toISOString(),
  };
}
