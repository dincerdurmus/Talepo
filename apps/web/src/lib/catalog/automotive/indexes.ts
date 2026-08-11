import type { CatalogConfidence, CatalogMatchMode } from "../types";
import {
  catalogFuelCompatible,
  catalogSlug,
  confidenceFromMatchMode,
  containsCatalogPhrase,
  foldCatalogKey,
  normalizeCatalogFuelType,
  normalizeCatalogKey,
} from "../normalize";
import { loadAutomotiveDataset, type AutomotiveTaxonomy } from "./dataset";
import type {
  AutomotiveBrandRecord,
  AutomotiveEngineMatchKind,
  AutomotiveEngineRecord,
  AutomotiveGenerationMatchKind,
  AutomotiveGenerationRecord,
  AutomotiveModelRecord,
  AutomotivePartRecord,
  AutomotivePositionRecord,
  AutomotiveTransmissionRecord,
  TransmissionFamily,
  TransmissionMatchKind,
} from "./types";
import {
  extractTransmissionLikePhrases,
  normalizeTransmissionMention,
  sanitizeTransmissionCode,
} from "./transmission-normalize";

type PhraseKind = "name" | "alias" | "platform_code";

type PhraseEntry<T> = {
  phrase: string;
  folded: string;
  tokenCount: number;
  length: number;
  record: T;
  kind: PhraseKind;
};

export type AutomotiveIndexes = {
  version: string;
  brands: AutomotiveBrandRecord[];
  models: AutomotiveModelRecord[];
  modelsByBrand: Map<string, AutomotiveModelRecord[]>;
  brandById: Map<string, AutomotiveBrandRecord>;
  modelById: Map<string, AutomotiveModelRecord>;
  brandPhrases: PhraseEntry<AutomotiveBrandRecord>[];
  modelPhrases: PhraseEntry<AutomotiveModelRecord>[];
  parts: AutomotivePartRecord[];
  partByCanonicalFold: Map<string, AutomotivePartRecord>;
  partPhrases: PhraseEntry<AutomotivePartRecord>[];
  positions: AutomotivePositionRecord[];
  positionPhrases: PhraseEntry<AutomotivePositionRecord>[];
  oemCrossrefs: unknown[];
  compatibility: unknown[];
  generations: AutomotiveGenerationRecord[];
  generationById: Map<string, AutomotiveGenerationRecord>;
  generationsByModel: Map<string, AutomotiveGenerationRecord[]>;
  generationsByBrand: Map<string, AutomotiveGenerationRecord[]>;
  generationPhrases: PhraseEntry<AutomotiveGenerationRecord>[];
  engines: AutomotiveEngineRecord[];
  engineById: Map<string, AutomotiveEngineRecord>;
  enginesByGeneration: Map<string, AutomotiveEngineRecord[]>;
  enginesByModel: Map<string, AutomotiveEngineRecord[]>;
  enginePhrases: PhraseEntry<AutomotiveEngineRecord>[];
  transmissions: AutomotiveTransmissionRecord[];
  transmissionById: Map<string, AutomotiveTransmissionRecord>;
  transmissionsByGeneration: Map<string, AutomotiveTransmissionRecord[]>;
  transmissionsByModel: Map<string, AutomotiveTransmissionRecord[]>;
  transmissionsByEngine: Map<string, AutomotiveTransmissionRecord[]>;
  transmissionPhrases: PhraseEntry<AutomotiveTransmissionRecord>[];
};

export type GenerationHit = {
  record: AutomotiveGenerationRecord;
  confidence: CatalogConfidence;
  matchMode: CatalogMatchMode | "platform_code";
  matchKind: AutomotiveGenerationMatchKind;
  yearConsistent?: boolean;
  matchedPhrase: string;
};

export type EngineLookup = {
  status: "resolved" | "ambiguous" | "unresolved";
  record?: AutomotiveEngineRecord;
  candidates?: AutomotiveEngineRecord[];
  confidence: CatalogConfidence;
  matchKind?: AutomotiveEngineMatchKind;
  matchMode?: CatalogMatchMode;
  yearConsistent?: boolean;
  matchedPhrase?: string;
  raw?: string;
};

export type TransmissionLookup = {
  status: "resolved" | "ambiguous" | "unresolved";
  record?: AutomotiveTransmissionRecord;
  candidates?: AutomotiveTransmissionRecord[];
  confidence: CatalogConfidence;
  matchKind?: TransmissionMatchKind;
  matchMode?: CatalogMatchMode;
  yearConsistent?: boolean;
  matchedPhrase?: string;
  raw?: string;
  /** Soft family hint when catalog empty / unresolved (never invents code). */
  familyHint?: TransmissionFamily;
  gearCountHint?: number | null;
  transmissionCodeHint?: string | null;
};

function phraseEntry<T>(
  phrase: string,
  record: T,
  kind: PhraseKind,
): PhraseEntry<T> | null {
  const norm = normalizeCatalogKey(phrase);
  if (!norm) return null;
  return {
    phrase: norm,
    folded: foldCatalogKey(phrase),
    tokenCount: norm.split(" ").length,
    length: norm.length,
    record,
    kind,
  };
}

function sortPhrases<T>(rows: PhraseEntry<T>[]): PhraseEntry<T>[] {
  return rows.sort((a, b) => {
    if (b.tokenCount !== a.tokenCount) return b.tokenCount - a.tokenCount;
    return b.length - a.length;
  });
}

function flattenParts(taxonomy: AutomotiveTaxonomy): AutomotivePartRecord[] {
  const parts: AutomotivePartRecord[] = [];
  for (const [systemId, system] of Object.entries(taxonomy)) {
    for (const [subsystemId, names] of Object.entries(system.children ?? {})) {
      for (const name of names) {
        parts.push({
          id: `part:${systemId}:${subsystemId}:${catalogSlug(name)}`,
          name,
          systemId,
          systemNameTr: system.name_tr,
          subsystemId,
        });
      }
    }
  }
  return parts;
}

function buildIndexes(): AutomotiveIndexes {
  const data = loadAutomotiveDataset();
  const brandById = new Map(data.brands.map((b) => [b.id, b]));
  const modelById = new Map(data.models.map((m) => [m.id, m]));
  const modelsByBrand = new Map<string, AutomotiveModelRecord[]>();
  for (const model of data.models) {
    const list = modelsByBrand.get(model.brand_id) ?? [];
    list.push(model);
    modelsByBrand.set(model.brand_id, list);
  }

  const brandPhrases: PhraseEntry<AutomotiveBrandRecord>[] = [];
  for (const brand of data.brands) {
    const name = phraseEntry(brand.name, brand, "name");
    if (name) brandPhrases.push(name);
    for (const alias of brand.aliases ?? []) {
      const row = phraseEntry(alias, brand, "alias");
      if (row) brandPhrases.push(row);
    }
  }

  const modelPhrases: PhraseEntry<AutomotiveModelRecord>[] = [];
  for (const model of data.models) {
    const name = phraseEntry(model.name, model, "name");
    if (name) modelPhrases.push(name);
    for (const alias of model.aliases ?? []) {
      const row = phraseEntry(alias, model, "alias");
      if (row) modelPhrases.push(row);
    }
  }

  const parts = flattenParts(data.taxonomy);
  const partByCanonicalFold = new Map<string, AutomotivePartRecord>();
  for (const part of parts) {
    partByCanonicalFold.set(foldCatalogKey(part.name), part);
  }

  const partPhrases: PhraseEntry<AutomotivePartRecord>[] = [];
  for (const part of parts) {
    const name = phraseEntry(part.name, part, "name");
    if (name) partPhrases.push(name);
  }
  for (const [canonical, aliases] of Object.entries(data.partAliases)) {
    const part = partByCanonicalFold.get(foldCatalogKey(canonical));
    if (!part) continue;
    for (const alias of aliases) {
      const row = phraseEntry(alias, part, "alias");
      if (row) partPhrases.push(row);
    }
  }

  const positionPhrases: PhraseEntry<AutomotivePositionRecord>[] = [];
  for (const pos of data.positions) {
    const name = phraseEntry(pos.tr, pos, "name");
    if (name) positionPhrases.push(name);
    for (const alias of pos.aliases ?? []) {
      const row = phraseEntry(alias, pos, "alias");
      if (row) positionPhrases.push(row);
    }
  }

  const generations = data.generations;
  const generationById = new Map(generations.map((g) => [g.id, g]));
  const generationsByModel = new Map<string, AutomotiveGenerationRecord[]>();
  const generationsByBrand = new Map<string, AutomotiveGenerationRecord[]>();
  for (const gen of generations) {
    const byModel = generationsByModel.get(gen.modelId) ?? [];
    byModel.push(gen);
    generationsByModel.set(gen.modelId, byModel);
    const byBrand = generationsByBrand.get(gen.brandId) ?? [];
    byBrand.push(gen);
    generationsByBrand.set(gen.brandId, byBrand);
  }

  const generationPhrases: PhraseEntry<AutomotiveGenerationRecord>[] = [];
  for (const gen of generations) {
    const name = phraseEntry(gen.name, gen, "name");
    if (name) generationPhrases.push(name);
    for (const alias of gen.aliases ?? []) {
      if (!shouldIndexGenerationPhrase(alias)) continue;
      const row = phraseEntry(alias, gen, "alias");
      if (row) generationPhrases.push(row);
    }
    for (const code of gen.platformCodes ?? []) {
      if (!shouldIndexGenerationPhrase(code)) continue;
      const row = phraseEntry(code, gen, "platform_code");
      if (row) generationPhrases.push(row);
    }
  }

  const engines = data.engines;
  const engineById = new Map(engines.map((e) => [e.id, e]));
  const enginesByGeneration = new Map<string, AutomotiveEngineRecord[]>();
  const enginesByModel = new Map<string, AutomotiveEngineRecord[]>();
  for (const engine of engines) {
    const byGen = enginesByGeneration.get(engine.generationId) ?? [];
    byGen.push(engine);
    enginesByGeneration.set(engine.generationId, byGen);
    const byModel = enginesByModel.get(engine.modelId) ?? [];
    byModel.push(engine);
    enginesByModel.set(engine.modelId, byModel);
  }

  const enginePhrases: PhraseEntry<AutomotiveEngineRecord>[] = [];
  for (const engine of engines) {
    const name = phraseEntry(engine.marketingName, engine, "name");
    if (name) enginePhrases.push(name);
    for (const alias of engine.aliases ?? []) {
      if (!shouldIndexEnginePhrase(alias)) continue;
      const row = phraseEntry(alias, engine, "alias");
      if (row) enginePhrases.push(row);
    }
  }

  const transmissions = data.transmissions ?? [];
  const transmissionById = new Map(transmissions.map((t) => [t.id, t]));
  const transmissionsByGeneration = new Map<
    string,
    AutomotiveTransmissionRecord[]
  >();
  const transmissionsByModel = new Map<string, AutomotiveTransmissionRecord[]>();
  const transmissionsByEngine = new Map<string, AutomotiveTransmissionRecord[]>();
  for (const tx of transmissions) {
    const byGen = transmissionsByGeneration.get(tx.generationId) ?? [];
    byGen.push(tx);
    transmissionsByGeneration.set(tx.generationId, byGen);
    const byModel = transmissionsByModel.get(tx.modelId) ?? [];
    byModel.push(tx);
    transmissionsByModel.set(tx.modelId, byModel);
    if (tx.engineId) {
      const byEng = transmissionsByEngine.get(tx.engineId) ?? [];
      byEng.push(tx);
      transmissionsByEngine.set(tx.engineId, byEng);
    }
  }

  const transmissionPhrases: PhraseEntry<AutomotiveTransmissionRecord>[] = [];
  for (const tx of transmissions) {
    const canon = phraseEntry(tx.canonicalName, tx, "name");
    if (canon) transmissionPhrases.push(canon);
    if (foldCatalogKey(tx.marketingName) !== foldCatalogKey(tx.canonicalName)) {
      const mkt = phraseEntry(tx.marketingName, tx, "alias");
      if (mkt) transmissionPhrases.push(mkt);
    }
    for (const alias of tx.aliases ?? []) {
      if (!shouldIndexTransmissionPhrase(alias)) continue;
      const row = phraseEntry(alias, tx, "alias");
      if (row) transmissionPhrases.push(row);
    }
    if (tx.transmissionCode && shouldIndexTransmissionPhrase(tx.transmissionCode)) {
      const code = phraseEntry(tx.transmissionCode, tx, "alias");
      if (code) transmissionPhrases.push(code);
    }
  }

  return {
    version: data.manifest.version,
    brands: data.brands,
    models: data.models,
    modelsByBrand,
    brandById,
    modelById,
    brandPhrases: sortPhrases(brandPhrases),
    modelPhrases: sortPhrases(modelPhrases),
    parts,
    partByCanonicalFold,
    partPhrases: sortPhrases(partPhrases),
    positions: data.positions,
    positionPhrases: sortPhrases(positionPhrases),
    oemCrossrefs: data.oemCrossrefs,
    compatibility: data.compatibility,
    generations,
    generationById,
    generationsByModel,
    generationsByBrand,
    generationPhrases: sortPhrases(generationPhrases),
    engines,
    engineById,
    enginesByGeneration,
    enginesByModel,
    enginePhrases: sortPhrases(enginePhrases),
    transmissions,
    transmissionById,
    transmissionsByGeneration,
    transmissionsByModel,
    transmissionsByEngine,
    transmissionPhrases: sortPhrases(transmissionPhrases),
  };
}

/** Bare single digits / 1-char tokens are never generation phrases. */
function shouldIndexGenerationPhrase(phrase: string): boolean {
  const norm = normalizeCatalogKey(phrase);
  if (!norm || norm.length < 2) return false;
  if (/^\d$/.test(norm)) return false;
  return true;
}

/** Bare PS/HP-only aliases stay; single digits do not become engine phrases. */
function shouldIndexEnginePhrase(phrase: string): boolean {
  const norm = normalizeCatalogKey(phrase);
  if (!norm || norm.length < 2) return false;
  if (/^\d$/.test(norm)) return false;
  return true;
}

/** Bare "AT"/"MT" alone are too ambiguous to index globally — still allowed as aliases on records. */
function shouldIndexTransmissionPhrase(phrase: string): boolean {
  const norm = normalizeCatalogKey(phrase);
  if (!norm || norm.length < 2) return false;
  if (/^\d$/.test(norm)) return false;
  return true;
}

type GlobalIdx = { __talepoAutomotiveIndexes?: AutomotiveIndexes };

export function getAutomotiveIndexes(): AutomotiveIndexes {
  const g = globalThis as GlobalIdx;
  if (!g.__talepoAutomotiveIndexes) {
    g.__talepoAutomotiveIndexes = buildIndexes();
  }
  return g.__talepoAutomotiveIndexes;
}

/** Test helper — clears globalThis cache (does not mutate production JSON). */
export function resetAutomotiveIndexesCache(): void {
  const g = globalThis as GlobalIdx;
  delete g.__talepoAutomotiveIndexes;
}

export function matchModeForHit(
  textNorm: string,
  phrase: string,
  kind: "name" | "alias",
  usedFold: boolean,
): CatalogMatchMode {
  if (kind === "alias") return "alias";
  if (usedFold && foldCatalogKey(textNorm).includes(foldCatalogKey(phrase))) {
    if (normalizeCatalogKey(phrase) !== foldCatalogKey(phrase)) return "normalized";
  }
  return containsCatalogPhrase(textNorm, phrase) ? "normalized" : "alias";
}

function findFirstPhrase<T>(
  textNorm: string,
  phrases: PhraseEntry<T>[],
  opts?: { allowFold?: boolean; predicate?: (row: PhraseEntry<T>) => boolean },
): { row: PhraseEntry<T>; usedFold: boolean } | null {
  const padded = ` ${textNorm} `;
  const foldedHay = ` ${foldCatalogKey(textNorm)} `;
  for (const row of phrases) {
    if (opts?.predicate && !opts.predicate(row)) continue;
    if (padded.includes(` ${row.phrase} `)) {
      return { row, usedFold: false };
    }
    if (opts?.allowFold !== false && foldedHay.includes(` ${row.folded} `)) {
      return { row, usedFold: true };
    }
  }
  return null;
}

function looksLikeChassisCode(token: string): boolean {
  const t = foldCatalogKey(token).replace(/\s/g, "");
  if (!t || t.length > 8) return false;
  if (/^(?:19|20)\d{2}$/.test(t)) return false;
  return /^(?:[a-z]{1,4}\d{1,4}[a-z0-9]{0,4}|\d{1,2}[a-z]{1,3})$/.test(t);
}

/**
 * Unique prefix fallback: "Mercedes" → Mercedes-Benz.
 * Token must be >= 6 chars; "Merc" must not match.
 * Tokens shorter than 8 also need a following chassis-like token.
 */
function findUniqueBrandPrefix(
  textNorm: string,
  idx: AutomotiveIndexes,
): AutomotiveBrandRecord | null {
  const tokens = textNorm.split(" ").filter(Boolean);
  const first = tokens[0];
  if (!first || first.length < 6) return null;
  const foldedFirst = foldCatalogKey(first);
  const matches = idx.brands.filter((brand) => {
    const foldedName = foldCatalogKey(brand.name);
    return (
      foldedName === foldedFirst || foldedName.startsWith(`${foldedFirst} `)
    );
  });
  if (matches.length !== 1) return null;
  if (first.length < 8) {
    const next = tokens[1];
    if (!next || !looksLikeChassisCode(next)) return null;
  }
  return matches[0];
}

export function findBrandInText(text: string) {
  const idx = getAutomotiveIndexes();
  const textNorm = normalizeCatalogKey(text);
  const hit = findFirstPhrase(textNorm, idx.brandPhrases);
  if (hit) {
    const mode: CatalogMatchMode =
      hit.row.kind === "alias"
        ? "alias"
        : hit.usedFold
          ? "normalized"
          : "exact";
    return {
      record: hit.row.record,
      confidence: confidenceFromMatchMode(mode),
      matchMode: mode,
    };
  }

  const prefix = findUniqueBrandPrefix(textNorm, idx);
  if (!prefix) return null;
  return {
    record: prefix,
    confidence: "high" as const,
    matchMode: "normalized" as const,
  };
}

const SHORT_UNANCHORED_MODEL = 3;

function modelSafeUnanchored(model: AutomotiveModelRecord): boolean {
  const name = normalizeCatalogKey(model.name);
  if (name.length < SHORT_UNANCHORED_MODEL) return false;
  if (/^\d+$/.test(name)) return false;
  return true;
}

export function findModelInText(
  text: string,
  brandId?: string | null,
) {
  const idx = getAutomotiveIndexes();
  const textNorm = normalizeCatalogKey(text);
  const hit = findFirstPhrase(textNorm, idx.modelPhrases, {
    predicate: (row) => {
      if (brandId && row.record.brand_id !== brandId) return false;
      if (!brandId && !modelSafeUnanchored(row.record)) return false;
      return true;
    },
  });
  if (!hit) return null;

  if (!brandId) {
    const sameName = idx.models.filter(
      (m) => foldCatalogKey(m.name) === foldCatalogKey(hit.row.record.name),
    );
    if (sameName.length > 1) return null;
  }

  const mode: CatalogMatchMode =
    hit.row.kind === "alias"
      ? "alias"
      : hit.usedFold
        ? "normalized"
        : "exact";
  return {
    record: hit.row.record,
    confidence: confidenceFromMatchMode(mode, {
      uniqueInference: !brandId,
    }),
    matchMode: mode,
  };
}

export function findPartsInText(text: string): Array<{
  record: AutomotivePartRecord;
  confidence: CatalogConfidence;
  matchMode: CatalogMatchMode;
}> {
  const idx = getAutomotiveIndexes();
  const textNorm = normalizeCatalogKey(text);
  const padded = ` ${textNorm} `;
  const foldedHay = ` ${foldCatalogKey(textNorm)} `;
  const found: Array<{
    record: AutomotivePartRecord;
    confidence: CatalogConfidence;
    matchMode: CatalogMatchMode;
    phraseLen: number;
  }> = [];
  const seen = new Set<string>();

  for (const row of idx.partPhrases) {
    const inNorm = padded.includes(` ${row.phrase} `);
    const inFold = !inNorm && foldedHay.includes(` ${row.folded} `);
    if (!inNorm && !inFold) continue;
    if (seen.has(row.record.id)) continue;
    // Skip very short alias hits unless they are the full phrase
    if (row.phrase.length < 3) continue;
    seen.add(row.record.id);
    const mode: CatalogMatchMode =
      row.kind === "alias" ? "alias" : inFold ? "normalized" : "exact";
    found.push({
      record: row.record,
      confidence: confidenceFromMatchMode(mode),
      matchMode: mode,
      phraseLen: row.length,
    });
  }

  found.sort((a, b) => b.phraseLen - a.phraseLen);
  return found;
}

const POSITION_COMPOSE: Record<string, string> = {
  "front+left": "front_left",
  "front+right": "front_right",
  "rear+left": "rear_left",
  "rear+right": "rear_right",
};

export function findPositionInText(text: string) {
  const idx = getAutomotiveIndexes();
  const textNorm = normalizeCatalogKey(text);
  const hit = findFirstPhrase(textNorm, idx.positionPhrases);
  if (hit) {
    const mode: CatalogMatchMode =
      hit.row.kind === "alias"
        ? "alias"
        : hit.usedFold
          ? "normalized"
          : "exact";
    return {
      record: hit.row.record,
      confidence: confidenceFromMatchMode(mode),
      matchMode: mode,
    };
  }

  // Compose from independent axis tokens (ön + sağ)
  const axes = { front: false, rear: false, left: false, right: false };
  for (const pos of idx.positions) {
    if (!containsCatalogPhrase(textNorm, pos.tr) &&
        !(pos.aliases ?? []).some((a) => containsCatalogPhrase(textNorm, a))) {
      continue;
    }
    if (pos.id === "front") axes.front = true;
    if (pos.id === "rear") axes.rear = true;
    if (pos.id === "left") axes.left = true;
    if (pos.id === "right") axes.right = true;
  }
  const lr = axes.left ? "left" : axes.right ? "right" : "";
  const fb = axes.front ? "front" : axes.rear ? "rear" : "";
  if (fb && lr) {
    const composedId = POSITION_COMPOSE[`${fb}+${lr}`];
    const record = idx.positions.find((p) => p.id === composedId);
    if (record) {
      return {
        record,
        confidence: "high" as const,
        matchMode: "normalized" as const,
      };
    }
  }
  return null;
}

export function extractModelYear(text: string): number | undefined {
  const m = text.match(/\b((?:19|20)\d{2})\b/);
  if (!m) return undefined;
  const year = Number(m[1]);
  if (year < 1950 || year > 2035) return undefined;
  return year;
}

function yearFitsGeneration(
  gen: AutomotiveGenerationRecord,
  year: number,
): boolean {
  if (year < gen.yearFrom) return false;
  if (gen.yearTo != null && year > gen.yearTo) return false;
  return true;
}

function generationKind(
  kind: PhraseKind,
): AutomotiveGenerationMatchKind | null {
  if (kind === "name") return "exact_name";
  if (kind === "platform_code") return "platform_code";
  if (kind === "alias") return "alias";
  return null;
}

function bestGenerationKind(
  kinds: AutomotiveGenerationMatchKind[],
): AutomotiveGenerationMatchKind {
  if (kinds.includes("exact_name")) return "exact_name";
  if (kinds.includes("platform_code")) return "platform_code";
  return "alias";
}

function surfaceGenerationPhrase(
  row: PhraseEntry<AutomotiveGenerationRecord>,
): string {
  if (row.kind === "name") return row.record.name;
  if (row.kind === "platform_code") {
    return (
      row.record.platformCodes.find(
        (code) => normalizeCatalogKey(code) === row.phrase,
      ) ?? row.phrase
    );
  }
  return (
    row.record.aliases.find((alias) => normalizeCatalogKey(alias) === row.phrase) ??
    row.phrase
  );
}

function toGenerationHit(
  record: AutomotiveGenerationRecord,
  hits: PhraseEntry<AutomotiveGenerationRecord>[],
  year?: number,
): GenerationHit {
  const matchKind = bestGenerationKind(
    hits
      .map((row) => generationKind(row.kind))
      .filter((k): k is AutomotiveGenerationMatchKind => k != null),
  );
  const best =
    hits.find((row) => generationKind(row.kind) === matchKind) ?? hits[0];
  const confidence: CatalogConfidence =
    matchKind === "exact_name" ? "exact" : "high";
  const matchMode: CatalogMatchMode | "platform_code" =
    matchKind === "exact_name"
      ? "exact"
      : matchKind === "platform_code"
        ? "platform_code"
        : "alias";
  return {
    record,
    confidence,
    matchMode,
    matchKind,
    matchedPhrase: surfaceGenerationPhrase(best),
    yearConsistent:
      year == null ? undefined : yearFitsGeneration(record, year),
  };
}

/**
 * Scoped generation lookup. Never searches globally.
 * Year never selects a generation by itself — only consistency / overlap disambiguation.
 */
export function findGenerationInText(
  text: string,
  scope: { brandId?: string | null; modelId?: string | null },
  year?: number,
): GenerationHit | null {
  if (!scope.brandId && !scope.modelId) return null;

  const idx = getAutomotiveIndexes();
  const textNorm = normalizeCatalogKey(text);
  const padded = ` ${textNorm} `;
  const foldedHay = ` ${foldCatalogKey(textNorm)} `;

  const hits: PhraseEntry<AutomotiveGenerationRecord>[] = [];
  for (const row of idx.generationPhrases) {
    if (scope.modelId) {
      if (row.record.modelId !== scope.modelId) continue;
    } else if (scope.brandId && row.record.brandId !== scope.brandId) {
      continue;
    }
    const inNorm = padded.includes(` ${row.phrase} `);
    const inFold = !inNorm && foldedHay.includes(` ${row.folded} `);
    if (!inNorm && !inFold) continue;
    hits.push(row);
  }
  if (hits.length === 0) return null;

  // Precision-first: only the longest explicit phrase competes.
  // Shorter hits (shared codes) must not veto a longer unique name/alias.
  let bestTokens = 0;
  let bestLen = 0;
  for (const hit of hits) {
    if (
      hit.tokenCount > bestTokens ||
      (hit.tokenCount === bestTokens && hit.length > bestLen)
    ) {
      bestTokens = hit.tokenCount;
      bestLen = hit.length;
    }
  }
  const topHits = hits.filter(
    (hit) => hit.tokenCount === bestTokens && hit.length === bestLen,
  );

  const byId = new Map<string, PhraseEntry<AutomotiveGenerationRecord>[]>();
  for (const hit of topHits) {
    const list = byId.get(hit.record.id) ?? [];
    list.push(hit);
    byId.set(hit.record.id, list);
  }

  if (byId.size === 1) {
    const [recordHits] = byId.values();
    return toGenerationHit(recordHits[0].record, recordHits, year);
  }

  // Multiple explicit matches: year may uniquely disambiguate. Never year-select alone.
  if (year != null) {
    const fitting = [...byId.entries()].filter(([, rows]) =>
      yearFitsGeneration(rows[0].record, year),
    );
    if (fitting.length === 1) {
      const [, recordHits] = fitting[0];
      return toGenerationHit(recordHits[0].record, recordHits, year);
    }
  }

  return null;
}

export function extractChassisLikeTokens(text: string): string[] {
  const tokens = normalizeCatalogKey(text).split(" ").filter(Boolean);
  const out: string[] = [];
  for (const tok of tokens) {
    if (looksLikeChassisCode(tok)) out.push(tok.toUpperCase());
  }
  return out;
}

const OEM_TOKEN = /\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{8,14}\b/gi;

export function extractOemCandidates(text: string): string[] {
  const compact = text.toUpperCase().replace(/[\s-]/g, " ");
  const found = compact.match(OEM_TOKEN) ?? [];
  return [...new Set(found.map((t) => t.toUpperCase()))].filter((tok) => {
    if (/^(19|20)\d{2}$/.test(tok)) return false;
    return /[A-Z]/.test(tok) && /\d/.test(tok);
  });
}

function yearFitsEngine(engine: AutomotiveEngineRecord, year: number): boolean {
  if (engine.yearFrom != null && year < engine.yearFrom) return false;
  if (engine.yearTo != null && year > engine.yearTo) return false;
  return true;
}

function engineInScope(
  engine: AutomotiveEngineRecord,
  scope: { brandId?: string | null; modelId?: string | null; generationId?: string | null },
): boolean {
  if (scope.generationId) return engine.generationId === scope.generationId;
  if (scope.modelId) {
    if (engine.modelId !== scope.modelId) return false;
    if (scope.brandId && engine.brandId !== scope.brandId) return false;
    return true;
  }
  return false;
}

export function extractPowerHints(text: string): number[] {
  const masked = text
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b\d{3}\s*[dDiI]\b/g, " ");
  const hints: number[] = [];
  for (const m of masked.matchAll(/\b(\d{2,3})\s*(?:kw|ps|hp|bg)\b/gi)) {
    hints.push(Number(m[1]));
  }
  for (const m of masked.matchAll(/\b(\d{2,3})\b/g)) {
    const n = Number(m[1]);
    if (n >= 50 && n <= 800) hints.push(n);
  }
  return [...new Set(hints)];
}

const ENGINE_FAMILY =
  "t-?gdi|tdi|tsi|tce|multijet|mjet|vtec|mpi|gdi|cdi|hdi|dci|turbo|bluemotion|fire";

export function extractEngineLikePhrases(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(
    `\\b\\d{1,2}[.,]\\d\\s*(?:${ENGINE_FAMILY})\\b`,
    "gi",
  );
  for (const m of text.match(re) ?? []) out.push(m.trim());
  for (const m of text.match(/\b\d{3}\s*[dDiI]\b/g) ?? []) out.push(m.trim());
  if (/\be[-\s]?golf\b/i.test(text)) out.push("e-Golf");
  return out;
}

function powerFitsEngine(engine: AutomotiveEngineRecord, hints: number[]): boolean {
  if (hints.length === 0) return true;
  return hints.some(
    (n) => engine.powerKw === n || engine.powerHp === n,
  );
}

function applyEngineFilters(
  rows: AutomotiveEngineRecord[],
  year: number | undefined,
  powerHints: number[],
  fuelHint: string | null,
): AutomotiveEngineRecord[] {
  let next = rows;
  if (fuelHint) {
    next = next.filter((e) => catalogFuelCompatible(e.fuelType, fuelHint));
  }
  if (year != null) {
    next = next.filter((e) => yearFitsEngine(e, year));
  }
  if (powerHints.length > 0) {
    next = next.filter((e) => powerFitsEngine(e, powerHints));
  }
  return next;
}

function engineMatchKind(
  engine: AutomotiveEngineRecord,
  phrase: string,
  kind: PhraseKind,
): AutomotiveEngineMatchKind {
  if (
    kind === "name" &&
    normalizeCatalogKey(engine.marketingName) === phrase
  ) {
    return "exact_marketing_name";
  }
  return "alias";
}

/**
 * Engine lookup is brand+model+generation scoped.
 * Generation preferred; model-only is allowed when generation is unknown.
 * Never global. Year/power only disambiguate; never invent a variant.
 * Never fabricates engineCode.
 */
export function findEnginesInText(
  text: string,
  scope: {
    brandId?: string | null;
    modelId?: string | null;
    generationId?: string | null;
  },
  year?: number,
): EngineLookup {
  const leftover = extractEngineLikePhrases(text);
  const unresolved = (raw?: string): EngineLookup => ({
    status: "unresolved",
    confidence: "unverified",
    raw: raw ?? leftover[0],
  });

  if (!scope.generationId && !scope.modelId) return unresolved();

  const idx = getAutomotiveIndexes();
  const textNorm = normalizeCatalogKey(text);
  const padded = ` ${textNorm} `;
  const foldedHay = ` ${foldCatalogKey(textNorm)} `;
  const powerHints = extractPowerHints(text);
  const fuelHint = normalizeCatalogFuelType(text);

  const direct: PhraseEntry<AutomotiveEngineRecord>[] = [];
  for (const row of idx.enginePhrases) {
    if (!engineInScope(row.record, scope)) continue;
    const inNorm = padded.includes(` ${row.phrase} `);
    const inFold = !inNorm && foldedHay.includes(` ${row.folded} `);
    if (!inNorm && !inFold) continue;
    direct.push(row);
  }

  if (direct.length === 0) return unresolved();

  let bestTokens = 0;
  let bestLen = 0;
  for (const hit of direct) {
    if (
      hit.tokenCount > bestTokens ||
      (hit.tokenCount === bestTokens && hit.length > bestLen)
    ) {
      bestTokens = hit.tokenCount;
      bestLen = hit.length;
    }
  }
  const topPhrases = direct.filter(
    (hit) => hit.tokenCount === bestTokens && hit.length === bestLen,
  );
  const topPhrase = topPhrases[0].phrase;

  const byId = new Map<string, PhraseEntry<AutomotiveEngineRecord>>();
  for (const hit of topPhrases) {
    if (!byId.has(hit.record.id)) byId.set(hit.record.id, hit);
  }

  // Same-scope records whose marketing name / alias contains the matched phrase
  // (e.g. "1.6 TDI" also considers "1.6 TDI EA288") — not fuzzy displacement.
  const scopedEngines = scope.generationId
    ? (idx.enginesByGeneration.get(scope.generationId) ?? [])
    : (idx.enginesByModel.get(scope.modelId ?? "") ?? []).filter((e) =>
        engineInScope(e, scope),
      );
  for (const engine of scopedEngines) {
    if (byId.has(engine.id)) continue;
    const surfaces = [engine.marketingName, ...(engine.aliases ?? [])];
    const contains = surfaces.some((surface) =>
      containsCatalogPhrase(surface, topPhrase),
    );
    if (!contains) continue;
    const synthetic = phraseEntry(engine.marketingName, engine, "alias");
    if (synthetic) byId.set(engine.id, synthetic);
  }

  const all = [...byId.values()];
  const exact = all.filter(
    (row) =>
      engineMatchKind(row.record, topPhrase, row.kind) === "exact_marketing_name",
  );

  const pickGroup = (rows: PhraseEntry<AutomotiveEngineRecord>[]) =>
    applyEngineFilters(
      rows.map((r) => r.record),
      year,
      powerHints,
      fuelHint,
    );

  let chosenRows = exact.length > 0 ? exact : all;
  let filtered = pickGroup(chosenRows);
  if (filtered.length === 0 && exact.length > 0) {
    chosenRows = all;
    filtered = pickGroup(chosenRows);
  }
  if (filtered.length === 0) return unresolved(leftover[0] ?? topPhrase);

  if (filtered.length > 1) {
    return {
      status: "ambiguous",
      candidates: filtered,
      confidence: "medium",
      matchKind: exact.length > 0 ? "exact_marketing_name" : "alias",
      matchMode: exact.length > 0 ? "exact" : "alias",
      matchedPhrase: topPhrase,
      raw: leftover[0] ?? topPhrase,
    };
  }

  const record = filtered[0];
  const source =
    chosenRows.find((r) => r.record.id === record.id) ?? chosenRows[0];
  const matchKind = engineMatchKind(record, topPhrase, source.kind);
  return {
    status: "resolved",
    record,
    confidence: matchKind === "exact_marketing_name" ? "exact" : "high",
    matchKind,
    matchMode: matchKind === "exact_marketing_name" ? "exact" : "alias",
    matchedPhrase: topPhrase,
    yearConsistent: year == null ? undefined : yearFitsEngine(record, year),
  };
}

/** Leftover generation hint near a known model — never invents catalog generation. */
export function extractUnverifiedGenerationRaw(
  text: string,
  modelName: string,
): string | undefined {
  const norm = normalizeCatalogKey(text);
  const model = normalizeCatalogKey(modelName);
  const re = new RegExp(
    `${model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d{1,2}|[ivx]{1,5})(?!\\d)`,
    "i",
  );
  const m = norm.match(re);
  if (!m?.[1]) return undefined;
  if (/^(19|20)\d{2}$/.test(m[1])) return undefined;
  return m[1];
}

function yearFitsTransmission(
  tx: AutomotiveTransmissionRecord,
  year: number,
): boolean {
  if (tx.yearFrom != null && year < tx.yearFrom) return false;
  if (tx.yearTo != null && year > tx.yearTo) return false;
  return true;
}

function transmissionInScope(
  tx: AutomotiveTransmissionRecord,
  scope: {
    brandId?: string | null;
    modelId?: string | null;
    generationId?: string | null;
    engineId?: string | null;
  },
): boolean {
  if (scope.engineId) {
    if (tx.engineId && tx.engineId !== scope.engineId) return false;
  }
  if (scope.generationId) {
    if (tx.generationId !== scope.generationId) return false;
    if (scope.brandId && tx.brandId !== scope.brandId) return false;
    if (scope.modelId && tx.modelId !== scope.modelId) return false;
    return true;
  }
  if (scope.modelId) {
    if (tx.modelId !== scope.modelId) return false;
    if (scope.brandId && tx.brandId !== scope.brandId) return false;
    return true;
  }
  return false;
}

function transmissionMatchKind(
  tx: AutomotiveTransmissionRecord,
  phrase: string,
  kind: PhraseKind,
): TransmissionMatchKind {
  if (tx.transmissionCode && normalizeCatalogKey(tx.transmissionCode) === phrase) {
    return "code";
  }
  if (
    kind === "name" &&
    normalizeCatalogKey(tx.canonicalName) === phrase
  ) {
    return "exact_canonical_name";
  }
  if (normalizeCatalogKey(tx.marketingName) === phrase) {
    return "exact_marketing_name";
  }
  return "alias";
}

/**
 * Transmission lookup is brand→model→generation→engine scoped.
 * NEVER resolves a global "7-speed DSG" alone.
 * Ambiguity → ambiguous (never random pick). Never fabricates transmissionCode.
 * Empty production catalog → unresolved (+ optional familyHint when scoped).
 */
export function findTransmissionsInText(
  text: string,
  scope: {
    brandId?: string | null;
    modelId?: string | null;
    generationId?: string | null;
    engineId?: string | null;
  },
  year?: number,
): TransmissionLookup {
  const leftover = extractTransmissionLikePhrases(text);
  const soft = leftover[0]
    ? normalizeTransmissionMention(leftover[0])
    : leftover.length === 0 && /(?:dsg|dct|cvt|e-?cvt|edc|manuel|manual|otomatik)/i.test(text)
      ? normalizeTransmissionMention(text)
      : null;

  const unresolved = (raw?: string): TransmissionLookup => ({
    status: "unresolved",
    confidence: "unverified",
    raw: raw ?? leftover[0],
    familyHint: soft && soft.family !== "UNKNOWN" ? soft.family : undefined,
    gearCountHint: soft?.gearCount ?? null,
    transmissionCodeHint: soft?.transmissionCode ?? null,
    matchKind: soft ? "family_hint" : undefined,
  });

  // Never global — require at least model (brand→model chain).
  if (!scope.modelId && !scope.generationId) return unresolved();

  const idx = getAutomotiveIndexes();
  const textNorm = normalizeCatalogKey(text);
  const padded = ` ${textNorm} `;
  const foldedHay = ` ${foldCatalogKey(textNorm)} `;

  const direct: PhraseEntry<AutomotiveTransmissionRecord>[] = [];
  for (const row of idx.transmissionPhrases) {
    if (!transmissionInScope(row.record, scope)) continue;
    const inNorm = padded.includes(` ${row.phrase} `);
    const inFold = !inNorm && foldedHay.includes(` ${row.folded} `);
    if (!inNorm && !inFold) continue;
    direct.push(row);
  }

  // Precision: DQ200 ≠ DQ250 — prefer longer / more specific phrases
  if (direct.length === 0) {
    // Soft family hint only when vehicle is scoped; still unresolved (no catalog id).
    return unresolved(leftover[0] ?? soft?.raw);
  }

  let bestTokens = 0;
  let bestLen = 0;
  for (const hit of direct) {
    if (
      hit.tokenCount > bestTokens ||
      (hit.tokenCount === bestTokens && hit.length > bestLen)
    ) {
      bestTokens = hit.tokenCount;
      bestLen = hit.length;
    }
  }
  const topPhrases = direct.filter(
    (hit) => hit.tokenCount === bestTokens && hit.length === bestLen,
  );
  const topPhrase = topPhrases[0]!.phrase;

  const byId = new Map<string, PhraseEntry<AutomotiveTransmissionRecord>>();
  for (const hit of topPhrases) {
    if (!byId.has(hit.record.id)) byId.set(hit.record.id, hit);
  }

  let filtered = [...byId.values()].map((r) => r.record);
  if (scope.engineId) {
    const engScoped = filtered.filter(
      (t) => !t.engineId || t.engineId === scope.engineId,
    );
    if (engScoped.length) filtered = engScoped;
  }
  if (year != null) {
    const yearFit = filtered.filter((t) => yearFitsTransmission(t, year));
    if (yearFit.length) filtered = yearFit;
  }

  // Gear-count precision: 6MT ≠ 5MT, 7DCT ≠ 6DCT
  if (soft?.gearCount != null) {
    const gearFit = filtered.filter(
      (t) => t.gearCount == null || t.gearCount === soft.gearCount,
    );
    if (gearFit.length) filtered = gearFit;
  }

  // Explicit OEM code in text must not cross-match different codes
  const codeInText = sanitizeTransmissionCode(
    text.match(/\b((?:DQ|DL)\d{2,3}|8HP\d{0,2}|7G-?DCT)\b/i)?.[1] ?? null,
  );
  if (codeInText) {
    const codeFit = filtered.filter(
      (t) =>
        t.transmissionCode == null ||
        t.transmissionCode.toUpperCase() === codeInText,
    );
    if (codeFit.length) filtered = codeFit;
  }

  if (filtered.length === 0) return unresolved(leftover[0] ?? topPhrase);

  if (filtered.length > 1) {
    return {
      status: "ambiguous",
      candidates: filtered,
      confidence: "medium",
      matchKind: "alias",
      matchMode: "alias",
      matchedPhrase: topPhrase,
      raw: leftover[0] ?? topPhrase,
      familyHint: soft?.family,
      gearCountHint: soft?.gearCount ?? null,
      transmissionCodeHint: codeInText,
    };
  }

  const record = filtered[0]!;
  const source = byId.get(record.id)!;
  const matchKind = transmissionMatchKind(record, topPhrase, source.kind);
  return {
    status: "resolved",
    record,
    confidence:
      matchKind === "exact_canonical_name" || matchKind === "code"
        ? "exact"
        : matchKind === "exact_marketing_name"
          ? "high"
          : "high",
    matchKind,
    matchMode:
      matchKind === "exact_canonical_name" || matchKind === "exact_marketing_name"
        ? "exact"
        : "alias",
    matchedPhrase: topPhrase,
    yearConsistent:
      year == null ? undefined : yearFitsTransmission(record, year),
  };
}

/** Alias for findTransmissionsInText (engine-style naming). */
export function resolveTransmission(
  text: string,
  scope: {
    brandId?: string | null;
    modelId?: string | null;
    generationId?: string | null;
    engineId?: string | null;
  },
  year?: number,
): TransmissionLookup {
  return findTransmissionsInText(text, scope, year);
}

/** Coverage helpers for ingestion matrix (counts only). */
export function automotiveTransmissionCoverageStats(idx?: AutomotiveIndexes) {
  const i = idx ?? getAutomotiveIndexes();
  const gensWithEngine = new Set(i.engines.map((e) => e.generationId));
  const gensWithTx = new Set(i.transmissions.map((t) => t.generationId));
  const enginesWithTx = new Set(
    i.transmissions.map((t) => t.engineId).filter(Boolean) as string[],
  );
  return {
    brands: i.brands.length,
    models: i.models.length,
    generations: i.generations.length,
    engines: i.engines.length,
    transmissions: i.transmissions.length,
    generationWithEngineCount: gensWithEngine.size,
    generationWithTransmissionCount: gensWithTx.size,
    engineWithTransmissionRelationCount: enginesWithTx.size,
  };
}
