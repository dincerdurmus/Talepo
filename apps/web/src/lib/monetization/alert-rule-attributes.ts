import {
  getExploreFilterDefs,
  type ExploreFilterFieldDef,
} from "@/lib/explore/category-filters";

export type AlertRuleAttributes = Record<string, string>;

/** Validate alert rule attributes against category explore filter defs. */
export function validateAlertRuleAttributes(
  categorySlug: string | null | undefined,
  attributes: unknown,
): { ok: true; value: AlertRuleAttributes | null } | { ok: false; message: string } {
  if (attributes == null || attributes === "") {
    return { ok: true, value: null };
  }

  if (typeof attributes !== "object" || Array.isArray(attributes)) {
    return { ok: false, message: "Attributes geçersiz format." };
  }

  const raw = attributes as Record<string, unknown>;
  const keys = Object.keys(raw);
  if (keys.length === 0) return { ok: true, value: null };

  if (!categorySlug?.trim()) {
    return {
      ok: false,
      message: "Kategoriye özel kriterler için kategori seçilmeli.",
    };
  }

  const defs = getExploreFilterDefs(categorySlug);
  const defByParam = new Map(defs.map((d) => [d.param, d]));
  const cleaned: AlertRuleAttributes = {};

  for (const [key, value] of Object.entries(raw)) {
    if (value === "" || value == null) continue;
    const def = defByParam.get(key);
    if (!def) {
      return { ok: false, message: `"${key}" bu kategori için geçerli değil.` };
    }
    const str = String(value).trim();
    if (!str) continue;
    if (def.input === "number" && !/^\d{1,6}$/.test(str)) {
      return { ok: false, message: `"${def.label}" sayısal olmalı.` };
    }
    cleaned[key] = str;
  }

  return { ok: true, value: Object.keys(cleaned).length > 0 ? cleaned : null };
}

export function getAlertAttributeDefs(
  categorySlug: string | null | undefined,
): ExploreFilterFieldDef[] {
  if (!categorySlug?.trim()) return [];
  return getExploreFilterDefs(categorySlug);
}
