/**
 * Schema/template-driven natural request text — NOT a second AI brain.
 * Short Turkish; no IDs / confidence.
 */

import type { CanonicalRequestState } from "./types";

function fieldValue(state: CanonicalRequestState, key: string): string | null {
  const f = state.fields[key];
  if (!f || f.kind !== "VALUE" || !f.value?.trim()) return null;
  return f.value.trim();
}

function fieldAny(state: CanonicalRequestState, key: string): boolean {
  return state.fields[key]?.kind === "ANY";
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
  return (
    state.categoryId === "automotive" ||
    state.understanding.category.value === "automotive" ||
    state.understanding.requestSubject.kind.value === "PART"
  );
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

function composeAutoPart(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const brand = fieldValue(state, "brand");
  const model = fieldValue(state, "model");
  const generation = fieldValue(state, "generation");
  const part = fieldValue(state, "part");
  const pos = fieldValue(state, "partPosition");

  if (brand && brand.toLocaleLowerCase("tr-TR") !== "golf") bits.push(brand);
  if (model) bits.push(model);
  else if (brand && brand.toLocaleLowerCase("tr-TR") === "golf") bits.push("Golf");
  if (generation) bits.push(generation);
  if (pos) bits.push(pos.toLocaleLowerCase("tr-TR"));
  if (part) bits.push(part.toLocaleLowerCase("tr-TR"));
  const exclLight = excludedPhrase(state, "lightingType");
  if (exclLight) bits.push(`${exclLight.toLocaleLowerCase("tr-TR")} olmasın`);
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
  const bits: string[] = [];
  const applianceType = fieldValue(state, "applianceType");
  const product = fieldValue(state, "productType");
  const brand = fieldValue(state, "brand");

  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (brand) bits.push(brand);

  if (applianceType) bits.push(applianceType);
  else if (product) bits.push(product);
  else if (state.subcategorySlug === "kucuk-ev-aletleri") {
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
  if (isAutoPart(state)) return composeAutoPart(state);
  if (
    state.categoryId === "real-estate" ||
    state.understanding.category.value === "real-estate"
  ) {
    return composeRealEstate(state);
  }
  if (isFurniture(state)) return composeFurniture(state);
  if (isAppliances(state)) return composeAppliances(state);
  return composeGeneric(state);
}

/** Compose natural request from live browse cascade stack (category → leaf). */
export function composeTextFromBrowseStack(
  stack: Array<{ kind: string; label: string }>,
): string {
  if (!stack.length) return "";
  const product = [...stack]
    .reverse()
    .find(
      (n) =>
        n.kind === "product_type" ||
        n.kind === "service_type" ||
        n.kind === "commodity_type" ||
        n.kind === "part" ||
        n.kind === "brand",
    );
  const group = [...stack].reverse().find((n) => n.kind === "group");
  const sub = [...stack].reverse().find((n) => n.kind === "subcategory");
  const cat = stack.find((n) => n.kind === "category");

  const subject =
    product?.label ?? group?.label ?? sub?.label ?? cat?.label ?? "";
  if (!subject.trim()) return "";
  return `${subject.trim()} arıyorum.`;
}
