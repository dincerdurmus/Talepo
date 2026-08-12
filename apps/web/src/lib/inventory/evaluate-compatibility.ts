/**
 * Deterministic inventory ↔ request compatibility evaluator.
 * Consumes Request.discoveryProjection + InventoryDiscoveryProjection.
 * No understandRequest / text reparse.
 */

import type { RequestDiscoveryProjection } from "@/lib/discovery/types";
import { isCandidateCompatibleWithProjection } from "@/lib/discovery/evaluate-filter";
import { resolveBrowseSemanticRole } from "@/lib/request-composer/browse-semantic-role";
import { getTaxonomyAncestorIds, getTaxonomyNode } from "@/lib/taxonomy";

import { inventoryCandidateBag } from "./attributes-envelope";
import type {
  InventoryCompatibilityResult,
  InventoryDiscoveryProjection,
  InventoryHardRejectReason,
  InventoryMatchLevel,
  InventoryMatchReason,
  InventorySemanticSubject,
} from "./types";

type RequestSubject =
  | "VEHICLE"
  | "PART"
  | "ACCESSORY"
  | "SERVICE"
  | "MACHINE"
  | "PRODUCT"
  | "UNKNOWN";

function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR").normalize("NFC").trim();
}

function resolveRequestSubject(
  request: RequestDiscoveryProjection,
): RequestSubject {
  const role = resolveBrowseSemanticRole({
    categoryId: request.categoryId,
    subcategorySlug: request.subcategorySlug,
    taxonomyNodeId: request.primaryLeafId,
    productType: request.attributes.applianceType ?? request.attributes.productType,
  });
  if (role.subjectKind === "PART") return "PART";
  if (role.subjectKind === "VEHICLE") return "VEHICLE";
  if (role.subjectKind === "SERVICE") return "SERVICE";
  if (role.subjectKind === "ACCESSORY") return "ACCESSORY";
  if (role.subjectKind === "INDUSTRIAL_EQUIPMENT") return "MACHINE";

  const need = fold(request.attributes.needType ?? "");
  if (need === "part" || need === "tire") return "PART";
  if (need === "vehicle") return "VEHICLE";
  if (need === "service") return "SERVICE";
  if (need === "machine") return "MACHINE";
  if (request.attributes.part?.trim()) return "PART";
  if (request.subcategorySlug === "yedek-parca") return "PART";
  if (request.subcategorySlug === "arac-satin-alma") return "VEHICLE";
  if (request.categoryId === "automotive") return "VEHICLE";
  if (request.categoryId === "machinery") return "MACHINE";
  return "PRODUCT";
}

function subjectsCompatible(
  request: RequestSubject,
  inventory: InventorySemanticSubject,
): boolean {
  if (request === "UNKNOWN" || inventory === "UNKNOWN") return true;

  if (request === "SERVICE" || inventory === "SERVICE") {
    return request === "SERVICE" && inventory === "SERVICE";
  }

  if (request === "VEHICLE") {
    return inventory === "VEHICLE" || inventory === "WHOLE_PRODUCT";
  }
  if (request === "PART") {
    return inventory === "PART" || inventory === "ACCESSORY" || inventory === "CONSUMABLE";
  }
  if (request === "ACCESSORY") {
    return inventory === "ACCESSORY" || inventory === "PART";
  }
  if (request === "MACHINE") {
    return inventory === "MACHINE" || inventory === "WHOLE_PRODUCT";
  }
  if (request === "PRODUCT") {
    return (
      inventory === "WHOLE_PRODUCT" ||
      inventory === "MACHINE" ||
      inventory === "VEHICLE"
    );
  }
  return true;
}

function taxonomyRelation(
  request: RequestDiscoveryProjection,
  inventory: InventoryDiscoveryProjection,
): "exact" | "ancestor" | "conflict" | "neutral" {
  const reqLeaf = request.primaryLeafId;
  const invLeaf = inventory.primaryLeafId;
  if (!reqLeaf && !invLeaf) {
    // coarse category overlap
    if (
      request.categoryId &&
      inventory.categoryId &&
      request.categoryId === inventory.categoryId
    ) {
      return "neutral";
    }
    return "neutral";
  }
  if (reqLeaf && invLeaf) {
    if (reqLeaf === invLeaf) return "exact";
    const reqAnc = new Set(getTaxonomyAncestorIds(reqLeaf));
    const invAnc = new Set(getTaxonomyAncestorIds(invLeaf));
    if (reqAnc.has(invLeaf) || invAnc.has(reqLeaf)) return "ancestor";
    // Same category but unrelated leaves under parts → conflict when both specific
    const reqNode = getTaxonomyNode(reqLeaf);
    const invNode = getTaxonomyNode(invLeaf);
    if (
      reqNode &&
      invNode &&
      reqNode.categoryId === invNode.categoryId &&
      reqNode.subcategoryId &&
      invNode.subcategoryId &&
      reqNode.subcategoryId === invNode.subcategoryId &&
      reqNode.id !== invNode.id
    ) {
      // sibling product types under same subcategory (far vs balata)
      return "conflict";
    }
    if (
      request.categoryId &&
      inventory.categoryId &&
      request.categoryId !== inventory.categoryId
    ) {
      return "conflict";
    }
    return "neutral";
  }
  // One side has leaf: check if other's taxonomy path overlaps
  const pathA = new Set(request.taxonomyNodeIds);
  const pathB = new Set(inventory.taxonomyNodeIds);
  for (const id of pathA) {
    if (pathB.has(id)) return "ancestor";
  }
  if (
    request.categoryId &&
    inventory.categoryId &&
    request.categoryId !== inventory.categoryId
  ) {
    return "conflict";
  }
  return "neutral";
}

function requestBrandModel(request: RequestDiscoveryProjection): {
  brand?: string;
  model?: string;
  generation?: string;
} {
  return {
    brand:
      request.entityRefs?.brand ??
      request.attributes.brand ??
      undefined,
    model:
      request.entityRefs?.model ??
      request.attributes.model ??
      undefined,
    generation:
      request.entityRefs?.generation ??
      request.entityRefs?.series ??
      request.attributes.generation ??
      undefined,
  };
}

function inventoryBrandModel(inventory: InventoryDiscoveryProjection): {
  brand?: string;
  model?: string;
  generation?: string;
} {
  const ct = inventory.compatibilityTarget;
  if (ct) {
    return {
      brand: ct.brand,
      model: ct.model,
      generation: ct.generation,
    };
  }
  return {
    brand: inventory.entityRefs?.brand ?? inventory.attributes.brand,
    model: inventory.entityRefs?.model ?? inventory.attributes.model,
    generation:
      inventory.entityRefs?.generation ?? inventory.attributes.generation,
  };
}

function levelFromSignals(
  tax: "exact" | "ancestor" | "conflict" | "neutral",
  entityHits: number,
  preferenceMatches: string[],
): InventoryMatchLevel {
  if (tax === "exact" && entityHits >= 2) return "EXACT";
  if (tax === "exact" || (tax === "ancestor" && entityHits >= 1)) return "STRONG";
  if (preferenceMatches.length || entityHits >= 1 || tax === "ancestor") {
    return "PARTIAL";
  }
  return "PARTIAL";
}

/**
 * Evaluate hard + soft compatibility between request and inventory projections.
 */
export function evaluateInventoryRequestCompatibility(
  request: RequestDiscoveryProjection,
  inventory: InventoryDiscoveryProjection,
): InventoryCompatibilityResult {
  const hardRejectReasons: InventoryHardRejectReason[] = [];
  const matchReasons: InventoryMatchReason[] = [];
  const preferenceMatches: string[] = [];
  const missingSignals: string[] = [];
  const reasonLabels: string[] = [];

  const path: InventoryCompatibilityResult["path"] =
    inventory.provenance === "LEGACY_EMPTY" ? "LEGACY_FALLBACK" : "CANONICAL";

  const reqSubject = resolveRequestSubject(request);
  const invSubject = inventory.semanticSubject;

  if (!subjectsCompatible(reqSubject, invSubject)) {
    if (reqSubject === "SERVICE" || invSubject === "SERVICE") {
      hardRejectReasons.push("SERVICE_PHYSICAL_MISMATCH");
    } else {
      hardRejectReasons.push("SUBJECT_MISMATCH");
    }
    return {
      compatible: false,
      hardRejectReasons,
      matchReasons,
      preferenceMatches,
      missingSignals,
      reasonLabels: ["Konu uyumsuz (ürün / parça)"],
      path,
    };
  }
  matchReasons.push("SUBJECT_MATCH");
  reasonLabels.push("Talep konusu uyumlu");

  const tax = taxonomyRelation(request, inventory);
  if (tax === "conflict") {
    hardRejectReasons.push("TAXONOMY_CONFLICT");
    return {
      compatible: false,
      hardRejectReasons,
      matchReasons,
      preferenceMatches,
      missingSignals,
      reasonLabels: ["Kategori çelişkisi"],
      path,
    };
  }
  if (tax === "exact") {
    matchReasons.push("TAXONOMY_EXACT");
    reasonLabels.push("Kategori tam eşleşiyor");
  } else if (tax === "ancestor") {
    matchReasons.push("TAXONOMY_ANCESTOR");
    reasonLabels.push("Kategori eşleşiyor");
  }

  // Entity / compatibility target
  const reqId = requestBrandModel(request);
  const invId = inventoryBrandModel(inventory);
  let entityHits = 0;

  const brandMust =
    request.constraints.brand?.strength === "MUST" ||
    Boolean(request.filterContract.include?.brand?.length);
  const modelMust =
    request.constraints.model?.strength === "MUST" ||
    Boolean(request.filterContract.include?.model?.length);
  const genMust =
    request.constraints.generation?.strength === "MUST" ||
    Boolean(request.filterContract.include?.generation?.length);

  if (reqId.brand && invId.brand) {
    if (fold(reqId.brand) === fold(invId.brand)) {
      entityHits += 1;
      matchReasons.push("ENTITY_BRAND_MATCH");
      if (
        reqSubject === "PART" ||
        invSubject === "PART" ||
        invSubject === "ACCESSORY"
      ) {
        matchReasons.push("COMPATIBILITY_TARGET_MATCH");
        reasonLabels.push(`${invId.brand} ile uyumlu`);
      } else {
        reasonLabels.push(`Marka: ${invId.brand}`);
      }
    } else {
      hardRejectReasons.push("ENTITY_CONFLICT");
      return {
        compatible: false,
        hardRejectReasons,
        matchReasons,
        preferenceMatches,
        missingSignals,
        reasonLabels: ["Marka uyumsuz"],
        path,
      };
    }
  } else if (reqId.brand && !invId.brand) {
    if (brandMust) {
      missingSignals.push("brand");
    } else {
      missingSignals.push("brand");
    }
  }

  if (reqId.model && invId.model) {
    if (fold(reqId.model) === fold(invId.model)) {
      entityHits += 1;
      matchReasons.push("ENTITY_MODEL_MATCH");
      reasonLabels.push(`Model: ${invId.model}`);
    } else {
      hardRejectReasons.push("ENTITY_CONFLICT");
      return {
        compatible: false,
        hardRejectReasons,
        matchReasons,
        preferenceMatches,
        missingSignals,
        reasonLabels: ["Model uyumsuz"],
        path,
      };
    }
  } else if (reqId.model && !invId.model && modelMust) {
    missingSignals.push("model");
  }

  if (reqId.generation && invId.generation) {
    if (fold(reqId.generation) === fold(invId.generation)) {
      entityHits += 1;
      matchReasons.push("ENTITY_GENERATION_MATCH");
      reasonLabels.push(`Nesil: ${invId.generation}`);
    } else {
      hardRejectReasons.push("ENTITY_CONFLICT");
      return {
        compatible: false,
        hardRejectReasons,
        matchReasons,
        preferenceMatches,
        missingSignals,
        reasonLabels: ["Nesil uyumsuz"],
        path,
      };
    }
  } else if (reqId.generation && !invId.generation && genMust) {
    missingSignals.push("generation");
  }

  // Phase 2 constraints on candidate bag
  const candidate = inventoryCandidateBag(inventory);
  const constraintEval = isCandidateCompatibleWithProjection(request, candidate);
  if (!constraintEval.compatible) {
    const reason = constraintEval.reasons[0] ?? "";
    if (reason.startsWith("excluded:")) {
      hardRejectReasons.push("EXCLUDED_VALUE");
    } else if (reason.startsWith("must:") || reason.startsWith("include:")) {
      hardRejectReasons.push("MUST_MISMATCH");
    } else {
      hardRejectReasons.push("ATTRIBUTE_CONFLICT");
    }
    return {
      compatible: false,
      hardRejectReasons,
      matchReasons,
      preferenceMatches,
      missingSignals,
      reasonLabels: ["Zorunlu özellik / hariç tutma çelişkisi"],
      path,
    };
  }

  // Attribute soft matches
  for (const key of ["part", "partPosition", "condition", "resolution", "screenSize"]) {
    const rv = request.attributes[key];
    const iv = inventory.attributes[key] ?? candidate[key];
    if (rv && iv && fold(rv) === fold(iv)) {
      matchReasons.push("ATTRIBUTE_MATCH");
      if (key === "partPosition") reasonLabels.push("Konum eşleşiyor");
      else if (key === "part") reasonLabels.push("Parça eşleşiyor");
      else reasonLabels.push("Özellik eşleşiyor");
    }
  }

  // PREFERRED — soft only
  for (const [key, field] of Object.entries(request.constraints)) {
    const prefs = field.preferred?.length
      ? field.preferred
      : field.strength === "PREFERRED" && field.value
        ? [field.value]
        : request.filterContract.preferred[key] ?? [];
    if (!prefs.length) continue;
    const cand = candidate[key];
    if (!cand) continue;
    if (prefs.some((p) => fold(p) === fold(cand))) {
      preferenceMatches.push(key);
      matchReasons.push("PREFERENCE_MATCH");
      reasonLabels.push(`Tercih: ${key}`);
    }
  }

  // Ranges (quantity) — only when inventory quantity known
  const qtyRange =
    request.constraints.quantity?.range ??
    request.filterContract.range.quantity;
  if (qtyRange && inventory.attributes.quantity) {
    const q = Number(inventory.attributes.quantity);
    if (Number.isFinite(q)) {
      if (qtyRange.min != null && q < qtyRange.min) {
        hardRejectReasons.push("MUST_MISMATCH");
        return {
          compatible: false,
          hardRejectReasons,
          matchReasons,
          preferenceMatches,
          missingSignals,
          reasonLabels: ["Miktar yetersiz"],
          path,
        };
      }
      matchReasons.push("RANGE_MATCH");
    }
  }

  matchReasons.push("INVENTORY_RELEVANT");
  if (!reasonLabels.some((l) => /envanter/i.test(l))) {
    reasonLabels.unshift("Envanterinizde uyumlu ürün var");
  }

  // Require at least subject + (taxonomy or entity or attribute) signal
  const weakOnly =
    tax === "neutral" &&
    entityHits === 0 &&
    !matchReasons.includes("ATTRIBUTE_MATCH");
  if (weakOnly && inventory.provenance === "LEGACY_EMPTY") {
    return {
      compatible: false,
      hardRejectReasons,
      matchReasons: ["LEGACY_FALLBACK"],
      preferenceMatches,
      missingSignals: ["insufficient_signal"],
      reasonLabels: [],
      path: "LEGACY_FALLBACK",
    };
  }
  if (weakOnly && path === "CANONICAL") {
    // Derived partial with only subject — allow PARTIAL if same category
    if (
      !(
        request.categoryId &&
        inventory.categoryId &&
        request.categoryId === inventory.categoryId
      )
    ) {
      missingSignals.push("taxonomy");
      return {
        compatible: false,
        hardRejectReasons,
        matchReasons,
        preferenceMatches,
        missingSignals,
        reasonLabels: [],
        path,
      };
    }
  }

  const level = levelFromSignals(tax, entityHits, preferenceMatches);
  return {
    compatible: true,
    level,
    hardRejectReasons,
    matchReasons: [...new Set(matchReasons)],
    preferenceMatches,
    missingSignals,
    reasonLabels: [...new Set(reasonLabels)].slice(0, 5),
    path: inventory.provenance === "DERIVED_PARTIAL" ? "DERIVED" : path,
  };
}

/** Map compatibility level to opportunity score band (not fake AI %). */
export function inventoryMatchScore(
  result: InventoryCompatibilityResult,
): number {
  if (!result.compatible) return 0;
  if (result.path === "LEGACY_FALLBACK") return 28;
  if (result.level === "EXACT") return 92;
  if (result.level === "STRONG") return 80;
  if (result.preferenceMatches.length) return 72;
  return 60;
}
