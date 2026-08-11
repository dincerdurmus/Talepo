/**
 * Multi-source merge with regional aliases — no blind merge of technical variants.
 */

import { foldCatalogKey } from "./normalize";
import type { IngestRecord } from "../types";

export type RegionalAliasMap = {
  canonicalName: string;
  aliases: string[];
  marketAliases?: Array<{ market: string; name: string }>;
  marketScope?: string[];
};

export type MergeConflict = {
  canonicalKey: string;
  field: string;
  values: Array<{ sourceId: string; value: unknown; recordId: string }>;
  reason: "SOURCE_CONFLICT";
};

export type MergeResult = {
  merged: IngestRecord[];
  conflicts: MergeConflict[];
  aliasResolved: number;
};

function sourceIdOf(record: IngestRecord): string {
  return (
    (typeof record.payload.sourceId === "string" && record.payload.sourceId) ||
    record.provenance.sourceName ||
    "unknown"
  );
}

function aliasKey(name: string, map: RegionalAliasMap[]): string {
  const fold = foldCatalogKey(name);
  for (const row of map) {
    if (foldCatalogKey(row.canonicalName) === fold) return foldCatalogKey(row.canonicalName);
    if (row.aliases.some((a) => foldCatalogKey(a) === fold)) {
      return foldCatalogKey(row.canonicalName);
    }
    if (row.marketAliases?.some((m) => foldCatalogKey(m.name) === fold)) {
      return foldCatalogKey(row.canonicalName);
    }
  }
  return fold;
}

/** Resolve a display name through regional alias maps. */
export function resolveRegionalAlias(
  name: string,
  maps: RegionalAliasMap[],
): { canonicalName: string; matched: boolean; market?: string } {
  const fold = foldCatalogKey(name);
  for (const row of maps) {
    if (foldCatalogKey(row.canonicalName) === fold) {
      return { canonicalName: row.canonicalName, matched: true };
    }
    if (row.aliases.some((a) => foldCatalogKey(a) === fold)) {
      return { canonicalName: row.canonicalName, matched: true };
    }
    const marketHit = row.marketAliases?.find((m) => foldCatalogKey(m.name) === fold);
    if (marketHit) {
      return {
        canonicalName: row.canonicalName,
        matched: true,
        market: marketHit.market,
      };
    }
  }
  return { canonicalName: name, matched: false };
}

/**
 * Merge same canonical candidate evidence.
 * Different power/displacement/engineCode/transmissionCode → SOURCE_CONFLICT REVIEW
 * (never silently merge technical variants).
 */
export function mergeMultiSourceRecords(
  records: IngestRecord[],
  opts?: { aliasMaps?: RegionalAliasMap[] },
): MergeResult {
  const aliasMaps = opts?.aliasMaps ?? [];
  const groups = new Map<string, IngestRecord[]>();
  let aliasResolved = 0;

  for (const record of records) {
    const brand =
      typeof record.payload.brand === "string" ? record.payload.brand : "";
    const model =
      typeof record.payload.model === "string" ? record.payload.model : "";
    const family =
      typeof record.payload.family === "string"
        ? record.payload.family
        : typeof record.payload.productFamily === "string"
          ? (record.payload.productFamily as string)
          : "";

    const brandResolved = brand
      ? resolveRegionalAlias(brand, aliasMaps)
      : { canonicalName: brand, matched: false };
    const modelResolved = model
      ? resolveRegionalAlias(model, aliasMaps)
      : { canonicalName: model, matched: false };
    if (brandResolved.matched || modelResolved.matched) aliasResolved += 1;

    const softIdentityKey = [
      record.payload.engineCode != null ? `ec:${record.payload.engineCode}` : "",
      record.payload.transmissionCode != null
        ? `tc:${record.payload.transmissionCode}`
        : "",
      record.payload.officialModelCode != null
        ? `omc:${record.payload.officialModelCode}`
        : "",
      // Intentionally exclude powerKw/displacement/gearCount from identity:
      // same marketing candidate with conflicting technical values → SOURCE_CONFLICT
    ]
      .filter(Boolean)
      .join("|");

    const key =
      (typeof record.payload.canonicalKey === "string" &&
        record.payload.canonicalKey) ||
      [
        record.categoryId,
        aliasKey(brandResolved.canonicalName || brand, aliasMaps),
        foldCatalogKey(family),
        aliasKey(modelResolved.canonicalName || model, aliasMaps),
        softIdentityKey,
      ]
        .filter(Boolean)
        .join("|");

    const list = groups.get(key) ?? [];
    list.push({
      ...record,
      payload: {
        ...record.payload,
        brand: brandResolved.canonicalName || brand || record.payload.brand,
        model: modelResolved.canonicalName || model || record.payload.model,
        regionalAliasMatched: brandResolved.matched || modelResolved.matched,
        marketScopeHint: brandResolved.market ?? modelResolved.market,
      },
    });
    groups.set(key, list);
  }

  const merged: IngestRecord[] = [];
  const conflicts: MergeConflict[] = [];

  const conflictFields = [
    "engineCode",
    "transmissionCode",
    "powerKw",
    "displacementCc",
    "gearCount",
    "fuelType",
    "officialModelCode",
  ] as const;

  for (const [canonicalKey, group] of groups) {
    if (group.length === 1) {
      merged.push(group[0]!);
      continue;
    }

    const base = { ...group[0]!, payload: { ...group[0]!.payload } };
    const sources = new Set<string>();
    let hasConflict = false;

    for (const field of conflictFields) {
      const values = group
        .map((r) => ({
          sourceId: sourceIdOf(r),
          value: r.payload[field],
          recordId: r.id,
        }))
        .filter((v) => v.value != null && v.value !== "");

      const unique = new Set(values.map((v) => JSON.stringify(v.value)));
      if (unique.size > 1) {
        hasConflict = true;
        conflicts.push({
          canonicalKey,
          field,
          values,
          reason: "SOURCE_CONFLICT",
        });
      } else if (values.length && base.payload[field] == null) {
        base.payload[field] = values[0]!.value;
      }
    }

    for (const r of group) {
      sources.add(sourceIdOf(r));
      // Merge aliases
      const aliases = new Set<string>([
        ...(Array.isArray(base.payload.aliases)
          ? (base.payload.aliases as string[])
          : []),
        ...(Array.isArray(r.payload.aliases) ? (r.payload.aliases as string[]) : []),
      ]);
      if (aliases.size) base.payload.aliases = [...aliases];

      // Merge specs conservatively (same keys conflicting → flag)
      const baseSpecs =
        base.payload.specs && typeof base.payload.specs === "object"
          ? { ...(base.payload.specs as Record<string, unknown>) }
          : {};
      const otherSpecs =
        r.payload.specs && typeof r.payload.specs === "object"
          ? (r.payload.specs as Record<string, unknown>)
          : {};
      for (const [k, v] of Object.entries(otherSpecs)) {
        if (baseSpecs[k] == null) baseSpecs[k] = v;
        else if (JSON.stringify(baseSpecs[k]) !== JSON.stringify(v)) {
          hasConflict = true;
          conflicts.push({
            canonicalKey,
            field: `specs.${k}`,
            values: [
              { sourceId: sourceIdOf(base), value: baseSpecs[k], recordId: base.id },
              { sourceId: sourceIdOf(r), value: v, recordId: r.id },
            ],
            reason: "SOURCE_CONFLICT",
          });
        }
      }
      if (Object.keys(baseSpecs).length) base.payload.specs = baseSpecs;
    }

    base.payload.mergedSourceIds = [...sources];
    base.payload.mergeCount = group.length;
    if (hasConflict) {
      base.payload.sourceConflict = true;
      base.payload.ambiguous = true;
    }
    merged.push(base);
  }

  return { merged, conflicts, aliasResolved };
}

/** Built-in regional aliases for common brand/model market names (non-technical). */
export const DEFAULT_REGIONAL_ALIASES: RegionalAliasMap[] = [
  {
    canonicalName: "Volkswagen",
    aliases: ["VW", "Volkswagen AG"],
    marketAliases: [{ market: "TR", name: "Volkswagen" }],
    marketScope: ["EU", "TR", "GLOBAL"],
  },
  {
    canonicalName: "BMW",
    aliases: ["Bayerische Motoren Werke", "BMW AG"],
    marketAliases: [
      { market: "TR", name: "BMW" },
      { market: "US", name: "BMW" },
    ],
    marketScope: ["EU", "TR", "US", "GLOBAL"],
  },
  {
    canonicalName: "3 Series",
    aliases: ["3 Serisi", "BMW 3 Series"],
    marketAliases: [{ market: "TR", name: "3 Serisi" }],
    marketScope: ["EU", "TR"],
  },
  {
    canonicalName: "Arçelik",
    aliases: ["Arcelik", "ARÇELİK"],
    marketAliases: [{ market: "TR", name: "Arçelik" }],
    marketScope: ["TR"],
  },
  {
    canonicalName: "Beko",
    aliases: ["BEKO"],
    marketScope: ["TR", "EU"],
  },
];
