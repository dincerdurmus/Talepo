/**
 * Schema/template-driven natural request text — NOT a second AI brain.
 * Short Turkish; no IDs / confidence.
 */

import { resolveBrowseSemanticRole } from "./browse-semantic-role";
import type { CanonicalRequestState } from "./types";
import {
  isGenericCompatibilityNoun,
  stripRequestedItemClause,
} from "./attribute-hints";

function fieldValue(state: CanonicalRequestState, key: string): string | null {
  const f = state.fields[key];
  if (!f || f.kind !== "VALUE" || !f.value?.trim()) return null;
  return f.value.trim();
}

function fieldAny(state: CanonicalRequestState, key: string): boolean {
  return state.fields[key]?.kind === "ANY";
}

function automotiveNeedType(state: CanonicalRequestState): string | null {
  if (state.fields.needType?.kind === "VALUE" && state.fields.needType.value) {
    return String(state.fields.needType.value).toLowerCase();
  }
  const role = resolveBrowseSemanticRole({
    categoryId: state.categoryId,
    subcategorySlug: state.subcategorySlug,
  });
  if (role.needType) return role.needType;
  const subject = state.understanding.requestSubject.kind.value;
  if (subject === "PART" || subject === "ACCESSORY") return "part";
  if (subject === "SERVICE") return "service";
  if (subject === "VEHICLE") return "vehicle";
  return null;
}

function isTv(state: CanonicalRequestState): boolean {
  const pt = fieldValue(state, "productType")?.toLocaleLowerCase("tr-TR") ?? "";
  const raw = (state.understanding.rawInput ?? "").toLocaleLowerCase("tr-TR");
  return (
    pt.includes("televizyon") ||
    pt === "television" ||
    raw.includes("televizyon") ||
    /\btv\b/.test(raw) ||
    Boolean(state.taxonomyNodeId?.includes("televizyon"))
  );
}

function isVacuum(state: CanonicalRequestState): boolean {
  const pt = fieldValue(state, "productType")?.toLocaleLowerCase("tr-TR") ?? "";
  const raw = (state.understanding.rawInput ?? "").toLocaleLowerCase("tr-TR");
  const brand = fieldValue(state, "brand")?.toLocaleLowerCase("tr-TR") ?? "";
  return (
    pt.includes("supurge") ||
    pt.includes("süpürge") ||
    raw.includes("süpürge") ||
    raw.includes("supurge") ||
    brand === "dyson"
  );
}

function isAutoPart(state: CanonicalRequestState): boolean {
  const need = automotiveNeedType(state);
  if (need === "vehicle") return false;
  if (need === "part" || need === "tire") return true;
  if (state.subcategorySlug === "yedek-parca") return true;
  if (state.understanding.requestSubject.kind.value === "PART") return true;
  return false;
}

function isAutoVehicle(state: CanonicalRequestState): boolean {
  if (state.categoryId !== "automotive" &&
    state.understanding.category.value !== "automotive") {
    return false;
  }
  if (isAutoPart(state)) return false;
  const need = automotiveNeedType(state);
  return need === "vehicle" || need == null;
}

function preferredPhrase(state: CanonicalRequestState, key: string): string | null {
  const prefs = state.fields[key]?.preferredValues;
  if (!prefs?.length) return null;
  if (prefs.length === 1) return prefs[0]!;
  return `${prefs.slice(0, -1).join(", ")} veya ${prefs[prefs.length - 1]}`;
}

function excludedPhrase(state: CanonicalRequestState, key: string): string | null {
  const excl = state.fields[key]?.excludedValues;
  if (!excl?.length) return null;
  return excl.join(", ");
}

function strengthPrefix(state: CanonicalRequestState, key: string): string {
  const s = state.fields[key]?.strength;
  if (s === "MUST") return "mutlaka ";
  if (s === "PREFERRED") return "tercihen ";
  return "";
}

function composeTv(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const screen = fieldValue(state, "screenSize");
  if (screen) bits.push(`${screen} ekran`);

  const brandPrefs = preferredPhrase(state, "brand");
  if (fieldAny(state, "brand")) {
    bits.push("marka fark etmez");
    const excl = excludedPhrase(state, "brand");
    if (excl) bits.push(`ama ${excl} olmasın`);
  } else if (brandPrefs) {
    bits.push(`${brandPrefs} olabilir`);
  } else {
    const brand = fieldValue(state, "brand");
    if (brand) bits.push(brand);
    const excl = excludedPhrase(state, "brand");
    if (excl) bits.push(`ama ${excl} olmasın`);
  }

  const model = fieldValue(state, "model") ?? preferredPhrase(state, "model");
  if (model) bits.push(model);

  const resolution = fieldValue(state, "resolution");
  if (resolution) bits.push(`${strengthPrefix(state, "resolution")}${resolution}`.trim());

  const condition = fieldValue(state, "condition");
  if (condition) {
    bits.push(condition.toLocaleLowerCase("tr-TR"));
  } else if (state.fields.condition?.excludedValues?.includes("USED")) {
    bits.push("ikinci el olmasın");
  }

  bits.push("televizyon arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function composeVacuum(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const brand = fieldValue(state, "brand");
  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (brand) bits.push(brand);

  const model =
    fieldValue(state, "model") ?? preferredPhrase(state, "model");
  if (model) bits.push(model);

  bits.push("süpürge arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

/** Role-aware identity phrase: brand + model + generation without token echo. */
function planIdentityPhrase(
  brand: string | null,
  model: string | null,
  generation: string | null,
): string[] {
  const bits: string[] = [];
  const push = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const lower = t.toLocaleLowerCase("tr-TR");
    const existing = bits.map((b) => b.toLocaleLowerCase("tr-TR"));
    if (existing.some((e) => e === lower)) return;
    // Drop token fully covered by a longer existing bit (Golf ⊂ Golf VII)
    if (existing.some((e) => e.includes(lower) && e !== lower)) return;
    // Replace shorter bit when new token subsumes it
    for (let i = bits.length - 1; i >= 0; i--) {
      const e = existing[i]!;
      if (lower.includes(e) && lower !== e) {
        bits.splice(i, 1);
      }
    }
    bits.push(t);
  };

  if (brand) push(brand);
  if (model && !isGenericCompatibilityNoun(model)) push(model);
  if (generation) push(generation);
  return bits;
}

function targetAlreadyExpressesItem(target: string, item: string): boolean {
  const t = target.toLocaleLowerCase("tr-TR");
  const i = item.toLocaleLowerCase("tr-TR").trim();
  if (!i) return false;
  if (t === i) return true;
  if (t.includes(`için ${i}`)) return true;
  const itemTokens = i.split(/\s+/).filter((tok) => tok.length > 2);
  if (itemTokens.length === 0) return t.includes(i);
  return itemTokens.every((tok) => t.includes(tok));
}

/**
 * Plan compatibility-part sentence from semantic roles, not string surgery
 * on a finished sentence.
 */
function composeCompatibilityPartSentence(input: {
  brand: string | null;
  model: string | null;
  generation: string | null;
  parentProduct?: string | null;
  part: string | null;
  position?: string | null;
  fallbackNoun: string;
}): string {
  const requestedItem = planPartPhrase(
    input.part?.toLocaleLowerCase("tr-TR") ?? null,
    input.position ?? null,
    input.fallbackNoun,
  );
  const model = stripRequestedItemClause(input.model, requestedItem);
  const parentProduct = stripRequestedItemClause(
    input.parentProduct,
    requestedItem,
  );
  const brand = isGenericCompatibilityNoun(input.brand)
    ? null
    : input.brand;

  let modelForPlan = model;
  if (parentProduct) {
    if (!modelForPlan) {
      modelForPlan = parentProduct;
    } else {
      const mf = modelForPlan.toLocaleLowerCase("tr-TR");
      const pf = parentProduct.toLocaleLowerCase("tr-TR");
      if (mf !== pf && !mf.includes(pf) && !pf.includes(mf)) {
        modelForPlan = `${parentProduct} ${modelForPlan}`;
      }
    }
  }

  const targetBits = planIdentityPhrase(
    brand,
    modelForPlan,
    input.generation,
  ).filter((bit) => !isGenericCompatibilityNoun(bit));

  const itemIsGeneric = isGenericCompatibilityNoun(requestedItem);
  if (targetBits.length === 0) {
    return `${requestedItem} arıyorum.`.replace(/\s+/g, " ").trim();
  }
  const target = targetBits.join(" ");
  if (itemIsGeneric && isGenericCompatibilityNoun(target)) {
    return `${requestedItem} arıyorum.`.replace(/\s+/g, " ").trim();
  }
  if (targetAlreadyExpressesItem(target, requestedItem)) {
    if (/(arıyorum|ariyorum)\s*[.!?]*$/i.test(target)) {
      return `${target.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "")}.`;
    }
    return `${target} arıyorum.`.replace(/\s+/g, " ").trim();
  }
  return `${target} için ${requestedItem} arıyorum.`
    .replace(/\s+/g, " ")
    .trim();
}

const POSITION_ORDER = ["sol", "sağ", "ön", "arka", "üst", "alt", "iç", "dış"];

/** Merge position field + part noun so "ön" is not repeated. */
function planPartPhrase(
  part: string | null,
  pos: string | null,
  fallbackNoun: string,
): string {
  const noun = (part ?? fallbackNoun).trim();
  const nounLower = noun.toLocaleLowerCase("tr-TR");
  const posTokens = (pos ?? "")
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !nounLower.split(/\s+/).includes(t));

  // Also strip position tokens already embedded in the noun from a leading re-prefix
  const leadingPos = new Set(POSITION_ORDER);
  const nounTokens = nounLower.split(/\s+/).filter(Boolean);
  const strippedNounTokens = [...nounTokens];
  while (strippedNounTokens.length && leadingPos.has(strippedNounTokens[0]!)) {
    // keep first occurrence inside noun; don't also prefix
    break;
  }

  const orderedPos = [...new Set(posTokens)].sort(
    (a, b) => POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b),
  );
  return [...orderedPos, noun].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function composeAutoPart(state: CanonicalRequestState): string {
  const role = resolveBrowseSemanticRole({
    categoryId: state.categoryId,
    subcategorySlug: state.subcategorySlug,
  });
  const fallbackNoun =
    automotiveNeedType(state) === "tire"
      ? "lastik"
      : role.subjectNounTr ?? "yedek parça";
  return composeCompatibilityPartSentence({
    brand: fieldValue(state, "brand"),
    model: fieldValue(state, "model"),
    generation: fieldValue(state, "generation"),
    part: fieldValue(state, "part"),
    position: fieldValue(state, "partPosition"),
    fallbackNoun,
  });
}

function composeAutoVehicle(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const brand = fieldValue(state, "brand");
  const model = fieldValue(state, "model");
  const generation = fieldValue(state, "generation");
  const year = fieldValue(state, "year");
  const condition = fieldValue(state, "condition");

  if (year) bits.push(`${year} model`);
  bits.push(...planIdentityPhrase(brand, model, generation));
  if (condition) bits.push(condition.toLocaleLowerCase("tr-TR"));
  if (bits.length === 0) bits.push("araç");
  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function composeRealEstate(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const listing = fieldValue(state, "listingType");
  const prop = fieldValue(state, "propertyType");
  const rooms = fieldValue(state, "roomCount");
  if (listing) bits.push(listing.toLocaleLowerCase("tr-TR"));
  if (rooms) bits.push(rooms);
  if (prop) bits.push(prop.toLocaleLowerCase("tr-TR"));
  else bits.push("konut");
  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function isFurniture(state: CanonicalRequestState): boolean {
  return (
    state.categoryId === "furniture" ||
    state.understanding.category.value === "furniture" ||
    Boolean(state.subcategorySlug?.includes("mobilya")) ||
    Boolean(state.taxonomyNodeId?.startsWith("tax:furniture:")) ||
    Boolean(fieldValue(state, "furnitureType"))
  );
}

function composeFurniture(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const furnitureType = fieldValue(state, "furnitureType");
  const product = fieldValue(state, "productType");
  const brand = fieldValue(state, "brand");

  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (brand) bits.push(brand);

  if (furnitureType) bits.push(furnitureType);
  else if (product) bits.push(product);
  else if (state.subcategorySlug === "ev-mobilyasi") bits.push("ev mobilyası");
  else if (state.subcategorySlug === "ofis-mobilyalari") {
    bits.push("ofis mobilyası");
  } else {
    bits.push("mobilya");
  }

  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function isAppliances(state: CanonicalRequestState): boolean {
  return (
    state.categoryId === "appliances" ||
    state.understanding.category.value === "appliances" ||
    Boolean(state.taxonomyNodeId?.startsWith("tax:appliances:")) ||
    Boolean(fieldValue(state, "applianceType"))
  );
}

function composeAppliances(state: CanonicalRequestState): string {
  const role = resolveBrowseSemanticRole({
    categoryId: state.categoryId,
    subcategorySlug: state.subcategorySlug,
    taxonomyNodeId: state.taxonomyNodeId,
    productType:
      fieldValue(state, "applianceType") ?? fieldValue(state, "productType"),
  });
  if (role.compositionMode === "compatibility_part") {
    return composeCompatibilityPartSentence({
      brand: fieldValue(state, "brand"),
      model: fieldValue(state, "model"),
      generation: fieldValue(state, "generation"),
      parentProduct:
        fieldValue(state, "applianceType") ?? fieldValue(state, "productType"),
      part: fieldValue(state, "part"),
      fallbackNoun: role.subjectNounTr ?? "yedek parça",
    });
  }

  const bits: string[] = [];
  const applianceType = fieldValue(state, "applianceType");
  const product = fieldValue(state, "productType");
  const brand = fieldValue(state, "brand");

  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (brand) bits.push(brand);

  if (applianceType && !/yedek\s*par/i.test(applianceType)) {
    bits.push(applianceType);
  } else if (product && !/yedek\s*par/i.test(product)) {
    bits.push(product);
  } else if (state.subcategorySlug === "kucuk-ev-aletleri") {
    bits.push("küçük ev aleti");
  } else if (state.subcategorySlug === "beyaz-esya") {
    bits.push("beyaz eşya");
  } else if (state.subcategorySlug === "isitma-sogutma-ve-havalandirma") {
    bits.push("ısıtma soğutma");
  } else {
    bits.push("beyaz eşya");
  }

  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function composeGeneric(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const brand = fieldValue(state, "brand");
  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (brand) bits.push(brand);
  const model = fieldValue(state, "model");
  if (model) bits.push(model);
  const furnitureType = fieldValue(state, "furnitureType");
  if (furnitureType) bits.push(furnitureType);
  const product = fieldValue(state, "productType");
  if (product && product !== furnitureType) bits.push(product);
  const condition = fieldValue(state, "condition");
  if (condition) bits.push(condition.toLocaleLowerCase("tr-TR"));
  if (
    bits.length === 0 ||
    (bits.length === 1 && fieldAny(state, "brand"))
  ) {
    /* keep arıyorum */
  }
  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

/**
 * Render short Turkish natural-language request from canonical state.
 */
export function composeNaturalRequestText(
  state: CanonicalRequestState,
): string {
  if (isTv(state)) return composeTv(state);
  if (isVacuum(state)) return composeVacuum(state);

  const role = resolveBrowseSemanticRole({
    categoryId: state.categoryId,
    subcategorySlug: state.subcategorySlug,
    taxonomyNodeId: state.taxonomyNodeId,
    productType:
      fieldValue(state, "applianceType") ??
      fieldValue(state, "productType") ??
      fieldValue(state, "machineType"),
  });

  if (role.compositionMode === "compatibility_part") {
    if (state.categoryId === "automotive" || isAutoPart(state)) {
      return composeAutoPart(state);
    }
    return composeCompatibilityPartSentence({
      brand: fieldValue(state, "brand"),
      model: fieldValue(state, "model"),
      generation: fieldValue(state, "generation"),
      parentProduct:
        fieldValue(state, "applianceType") ?? fieldValue(state, "productType"),
      part: fieldValue(state, "part"),
      fallbackNoun: role.subjectNounTr ?? "yedek parça",
    });
  }

  if (role.compositionMode === "service") {
    const brand = fieldValue(state, "brand");
    const model = fieldValue(state, "model");
    const target = [brand, model].filter(Boolean).join(" ");
    const subject =
      fieldValue(state, "serviceType") ?? role.subjectNounTr ?? "bakım";
    if (target) return `${target} için ${subject} arıyorum.`;
    return `${subject} arıyorum.`;
  }

  if (isAutoPart(state)) return composeAutoPart(state);
  if (isAutoVehicle(state)) return composeAutoVehicle(state);
  if (
    state.categoryId === "real-estate" ||
    state.understanding.category.value === "real-estate"
  ) {
    return composeRealEstate(state);
  }
  if (isFurniture(state)) return composeFurniture(state);
  if (isAppliances(state)) return composeAppliances(state);
  if (
    role.compositionMode === "whole_product" &&
    (state.categoryId === "machinery" || state.categoryId === "industrial")
  ) {
    const bits = [
      fieldValue(state, "brand"),
      fieldValue(state, "machineType") ?? fieldValue(state, "productType"),
      fieldValue(state, "model"),
    ].filter(Boolean);
    if (bits.length) return `${bits.join(" ")} arıyorum.`;
    return `${role.subjectNounTr ?? "makine"} arıyorum.`;
  }
  return composeGeneric(state);
}

/** Compose natural request from live browse cascade stack (category → leaf). */
export function composeTextFromBrowseStack(
  stack: Array<{ kind: string; label: string }>,
  opts?: {
    categoryId?: string | null;
    subcategorySlug?: string | null;
  },
): string {
  if (!stack.length) return "";

  const sub =
    [...stack].reverse().find((n) => n.kind === "subcategory") ?? null;
  const subcategorySlug =
    opts?.subcategorySlug ??
    (sub
      ? sub.label
          .toLocaleLowerCase("tr-TR")
          .replace(/ğ/g, "g")
          .replace(/ü/g, "u")
          .replace(/ş/g, "s")
          .replace(/ı/g, "i")
          .replace(/ö/g, "o")
          .replace(/ç/g, "c")
          .replace(/\s+/g, "-")
      : null);

  const categoryId =
    opts?.categoryId ??
    stack.find((n) => n.kind === "category")?.label ??
    null;

  const resolvedCategoryId = (() => {
    if (opts?.categoryId) return opts.categoryId;
    if (typeof categoryId !== "string") return null;
    const fold = categoryId.toLocaleLowerCase("tr-TR");
    if (fold === "otomotiv" || categoryId === "automotive") return "automotive";
    if (fold === "makine" || categoryId === "machinery") return "machinery";
    if (fold.includes("beyaz") || fold === "appliances") return "appliances";
    if (!categoryId.includes(" ") && !categoryId.includes("·")) return categoryId;
    return null;
  })();

  const resolvedSubSlug = opts?.subcategorySlug ?? subcategorySlug;

  // Prefer structured slug when caller passes it (composer walk).
  const role = resolveBrowseSemanticRole({
    categoryId: resolvedCategoryId,
    subcategorySlug: resolvedSubSlug,
  });

  const brand = [...stack].reverse().find((n) => n.kind === "brand");
  const model = [...stack].reverse().find((n) => n.kind === "model");
  const generation = [...stack].reverse().find((n) => n.kind === "generation");
  const part = [...stack].reverse().find((n) => n.kind === "part");
  const product = [...stack]
    .reverse()
    .find(
      (n) =>
        n.kind === "product_type" ||
        n.kind === "service_type" ||
        n.kind === "commodity_type",
    );
  const group = [...stack].reverse().find((n) => n.kind === "group");
  const cat = stack.find((n) => n.kind === "category");

  if (role.compositionMode === "compatibility_part") {
    return composeCompatibilityPartSentence({
      brand: brand?.label ?? null,
      model: model?.label ?? null,
      generation: generation?.label ?? null,
      part: part?.label?.toLocaleLowerCase("tr-TR") ?? null,
      fallbackNoun: role.subjectNounTr ?? "yedek parça",
    });
  }

  if (role.compositionMode === "service") {
    const target = [brand?.label, model?.label].filter(Boolean).join(" ");
    const subject = product?.label ?? role.subjectNounTr ?? "bakım";
    if (target) return `${target} için ${subject} arıyorum.`;
    return `${subject} arıyorum.`;
  }

  if (role.compositionMode === "whole_product") {
    const bits = [brand?.label, model?.label, generation?.label].filter(Boolean);
    if (bits.length) return `${bits.join(" ")} arıyorum.`;
  }

  const subject =
    part?.label ??
    product?.label ??
    brand?.label ??
    group?.label ??
    sub?.label ??
    cat?.label ??
    "";
  if (!subject.trim()) return "";
  return `${subject.trim()} arıyorum.`;
}
