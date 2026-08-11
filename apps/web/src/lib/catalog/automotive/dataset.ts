/**
 * Automotive catalog dataset — JSON files live in /data/catalogs/automotive.
 * Relative path keeps a single source of truth (no copied constants).
 *
 * From this file: src/lib/catalog/automotive → repo root is 6 levels up.
 *
 * Generations: V2A base ∪ V2A.2 delta merged at runtime (prefer base on conflict).
 */
import brands from "../../../../../../data/catalogs/automotive/automotive-brands.json";
import models from "../../../../../../data/catalogs/automotive/automotive-models-core.json";
import groups from "../../../../../../data/catalogs/automotive/automotive-manufacturer-groups.json";
import taxonomy from "../../../../../../data/catalogs/automotive/automotive-part-taxonomy.json";
import aliasesTr from "../../../../../../data/catalogs/automotive/automotive-part-aliases-tr.json";
import positions from "../../../../../../data/catalogs/automotive/automotive-positions.json";
import generationsBase from "../../../../../../data/catalogs/automotive/automotive-generations.json";
import generationsDelta from "../../../../../../data/catalogs/automotive/automotive-generations-v2a2-delta.json";
import engines from "../../../../../../data/catalogs/automotive/automotive-engines.json";
import oemCrossrefs from "../../../../../../data/catalogs/automotive/automotive-oem-crossrefs.json";
import compatibility from "../../../../../../data/catalogs/automotive/automotive-compatibility.json";
import manifest from "../../../../../../data/catalogs/automotive/manifest.json";

import { foldCatalogKey } from "../normalize";
import type {
  AutomotiveBrandRecord,
  AutomotiveEngineRecord,
  AutomotiveGenerationRecord,
  AutomotiveManufacturerGroup,
  AutomotiveModelRecord,
  AutomotivePositionRecord,
} from "./types";

export type AutomotiveTaxonomy = Record<
  string,
  {
    name_tr: string;
    children: Record<string, string[]>;
  }
>;

export type AutomotiveManifest = {
  version: string;
  counts?: Record<string, number>;
  generationCount?: number;
  engineRecordCount?: number;
  generatedAt?: string;
  files: string[];
};

export type GenerationMergeStats = {
  baseCount: number;
  deltaCount: number;
  appended: number;
  skippedDuplicateId: number;
  skippedDuplicateCanonical: number;
  /** Same brand+model + shared platform code + overlapping years → folded into base. */
  skippedNearDuplicate: number;
  absorbedIntoBase: string[];
  finalCount: number;
};

function normalizeGenerationRecord(
  raw: AutomotiveGenerationRecord | (Omit<AutomotiveGenerationRecord, "notes"> & { notes?: string | null }),
): AutomotiveGenerationRecord {
  return {
    ...raw,
    aliases: [...(raw.aliases ?? [])],
    platformCodes: [...(raw.platformCodes ?? [])],
    bodyTypes: [...(raw.bodyTypes ?? [])],
    marketScope: [...(raw.marketScope ?? [])],
    notes: raw.notes ?? null,
  };
}

function generationCanonicalKey(gen: AutomotiveGenerationRecord): string {
  return `${gen.brandId}\0${gen.modelId}\0${foldCatalogKey(gen.name)}`;
}

function yearsOverlap(
  a: AutomotiveGenerationRecord,
  b: AutomotiveGenerationRecord,
): boolean {
  const aTo = a.yearTo ?? 9999;
  const bTo = b.yearTo ?? 9999;
  return a.yearFrom <= bTo && b.yearFrom <= aTo;
}

function sharedPlatformCodes(
  a: AutomotiveGenerationRecord,
  b: AutomotiveGenerationRecord,
): string[] {
  const aCodes = new Set(
    (a.platformCodes ?? []).map((c) => foldCatalogKey(c)).filter(Boolean),
  );
  const out: string[] = [];
  for (const code of b.platformCodes ?? []) {
    const folded = foldCatalogKey(code);
    if (folded && aCodes.has(folded)) out.push(code);
  }
  return out;
}

function unionStrings(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((s) => foldCatalogKey(s)));
  const next = [...existing];
  for (const value of incoming) {
    const folded = foldCatalogKey(value);
    if (!folded || seen.has(folded)) continue;
    seen.add(folded);
    next.push(value);
  }
  return next;
}

/**
 * Prefer keeping `into` (base). Merge aliases / platform codes / delta name as alias.
 */
function absorbGenerationInto(
  into: AutomotiveGenerationRecord,
  from: AutomotiveGenerationRecord,
): void {
  into.aliases = unionStrings(into.aliases, [
    ...(from.aliases ?? []),
    from.name,
  ]);
  into.platformCodes = unionStrings(
    into.platformCodes,
    from.platformCodes ?? [],
  );
}

/**
 * Merge V2A base generations with V2A.2 delta.
 * Prefer base on id, brand+model+canonical-name, or near-duplicate
 * (same brand+model + shared platform code + overlapping years).
 * Never mutates the source JSON arrays.
 */
export function mergeAutomotiveGenerations(
  base: AutomotiveGenerationRecord[],
  delta: AutomotiveGenerationRecord[],
): { generations: AutomotiveGenerationRecord[]; stats: GenerationMergeStats } {
  const generations = base.map(normalizeGenerationRecord);
  const byId = new Map(generations.map((g) => [g.id, g]));
  const byCanonical = new Set(generations.map(generationCanonicalKey));

  let skippedDuplicateId = 0;
  let skippedDuplicateCanonical = 0;
  let skippedNearDuplicate = 0;
  const absorbedIntoBase: string[] = [];
  let appended = 0;

  for (const raw of delta) {
    const gen = normalizeGenerationRecord(raw);
    if (byId.has(gen.id)) {
      skippedDuplicateId += 1;
      continue;
    }
    const canon = generationCanonicalKey(gen);
    if (byCanonical.has(canon)) {
      skippedDuplicateCanonical += 1;
      continue;
    }

    // Near-duplicate only when year span is identical + shared platform.
    // Do NOT fold legitimate successive gens that share a Typenschlüssel
    // across changeover years (Zoe I/II X10, Discovery 3/4 L319, Passat 3A/3C).
    const nearDup = generations.find((existing) => {
      if (existing.brandId !== gen.brandId || existing.modelId !== gen.modelId) {
        return false;
      }
      if (sharedPlatformCodes(existing, gen).length === 0) return false;
      if (existing.yearFrom !== gen.yearFrom) return false;
      if ((existing.yearTo ?? null) !== (gen.yearTo ?? null)) return false;
      return yearsOverlap(existing, gen);
    });
    if (nearDup) {
      absorbGenerationInto(nearDup, gen);
      skippedNearDuplicate += 1;
      absorbedIntoBase.push(`${gen.id}→${nearDup.id}`);
      continue;
    }

    generations.push(gen);
    byId.set(gen.id, gen);
    byCanonical.add(canon);
    appended += 1;
  }

  return {
    generations,
    stats: {
      baseCount: base.length,
      deltaCount: delta.length,
      appended,
      skippedDuplicateId,
      skippedDuplicateCanonical,
      skippedNearDuplicate,
      absorbedIntoBase,
      finalCount: generations.length,
    },
  };
}

const mergedGenerations = mergeAutomotiveGenerations(
  generationsBase as AutomotiveGenerationRecord[],
  generationsDelta as AutomotiveGenerationRecord[],
);

export function loadAutomotiveDataset() {
  return {
    manifest: manifest as AutomotiveManifest,
    brands: brands as AutomotiveBrandRecord[],
    models: models as AutomotiveModelRecord[],
    groups: groups as AutomotiveManufacturerGroup[],
    taxonomy: taxonomy as AutomotiveTaxonomy,
    partAliases: aliasesTr as Record<string, string[]>,
    positions: positions as AutomotivePositionRecord[],
    generations: mergedGenerations.generations,
    generationMergeStats: mergedGenerations.stats,
    engines: engines as AutomotiveEngineRecord[],
    oemCrossrefs: oemCrossrefs as unknown[],
    compatibility: compatibility as unknown[],
  };
}
