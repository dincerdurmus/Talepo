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

function composeTv(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const screen = fieldValue(state, "screenSize");
  if (screen) bits.push(`${screen} ekran`);

  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else {
    const brand = fieldValue(state, "brand");
    if (brand) bits.push(brand);
  }

  const model = fieldValue(state, "model");
  if (model) bits.push(model);

  const resolution = fieldValue(state, "resolution");
  if (resolution) bits.push(resolution);

  const condition = fieldValue(state, "condition");
  if (condition) {
    bits.push(condition.toLocaleLowerCase("tr-TR"));
  }

  bits.push("televizyon arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function composeVacuum(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const brand = fieldValue(state, "brand");
  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (brand) bits.push(brand);

  const model = fieldValue(state, "model");
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
  const product = fieldValue(state, "productType");
  if (product) bits.push(product);
  const condition = fieldValue(state, "condition");
  if (condition) bits.push(condition.toLocaleLowerCase("tr-TR"));
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
  return composeGeneric(state);
}
