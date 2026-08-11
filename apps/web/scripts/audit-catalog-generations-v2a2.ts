/**
 * Automotive catalog V2A.2 — generation merge conflict audit.
 * Reports hard errors and soft warnings; does NOT auto-delete records.
 *
 * Hard fail (exit 1): orphan brand/model refs, duplicate IDs,
 * yearFrom > yearTo, exact duplicate canonical within brand+model.
 * Soft (WARN, exit 0 if no hard errors): alias/platform collisions,
 * suspicious year overlaps.
 *
 * Run: npx tsx scripts/audit-catalog-generations-v2a2.ts
 */
import generationsBaseRaw from "../../../data/catalogs/automotive/automotive-generations.json";
import generationsDeltaRaw from "../../../data/catalogs/automotive/automotive-generations-v2a2-delta.json";
import {
  loadAutomotiveDataset,
  mergeAutomotiveGenerations,
} from "../src/lib/catalog/automotive/dataset";
import type { AutomotiveGenerationRecord } from "../src/lib/catalog/automotive/types";
import { foldCatalogKey, normalizeCatalogKey } from "../src/lib/catalog/normalize";

const data = loadAutomotiveDataset();
const brands = data.brands;
const models = data.models;
const brandIds = new Set(brands.map((b) => b.id));
const modelIds = new Set(models.map((m) => m.id));

const base = generationsBaseRaw as AutomotiveGenerationRecord[];
const delta = generationsDeltaRaw as AutomotiveGenerationRecord[];

// Recompute merge with same rules as loader (base JSON kept intact).
const { generations: merged, stats: mergeStats } = mergeAutomotiveGenerations(
  base,
  delta,
);

type Issue = { severity: "HARD" | "WARN" | "INFO"; kind: string; detail: string };

const hard: Issue[] = [];
const warn: Issue[] = [];
const info: Issue[] = [];

function push(sev: Issue["severity"], kind: string, detail: string) {
  const row = { severity: sev, kind, detail };
  if (sev === "HARD") hard.push(row);
  else if (sev === "WARN") warn.push(row);
  else info.push(row);
}

function yearOverlaps(
  a: AutomotiveGenerationRecord,
  b: AutomotiveGenerationRecord,
): boolean {
  const aTo = a.yearTo ?? 9999;
  const bTo = b.yearTo ?? 9999;
  return a.yearFrom <= bTo && b.yearFrom <= aTo;
}

function yearsUniquelySeparate(
  a: AutomotiveGenerationRecord,
  b: AutomotiveGenerationRecord,
): boolean {
  // Ranges may touch at a boundary year; still separable if interiors don't overlap
  // for disambiguation purposes — require non-overlap.
  return !yearOverlaps(a, b);
}

// --- Orphans (delta + merged) ---
let orphanBrandDelta = 0;
let orphanModelDelta = 0;
for (const g of delta) {
  if (!brandIds.has(g.brandId)) {
    orphanBrandDelta += 1;
    push("HARD", "orphan_brand", `delta ${g.id} brandId=${g.brandId}`);
  }
  if (!modelIds.has(g.modelId)) {
    orphanModelDelta += 1;
    push("HARD", "orphan_model", `delta ${g.id} modelId=${g.modelId}`);
  }
}

let orphanBrandMerged = 0;
let orphanModelMerged = 0;
for (const g of merged) {
  if (!brandIds.has(g.brandId)) {
    orphanBrandMerged += 1;
    push("HARD", "orphan_brand", `merged ${g.id} brandId=${g.brandId}`);
  }
  if (!modelIds.has(g.modelId)) {
    orphanModelMerged += 1;
    push("HARD", "orphan_model", `merged ${g.id} modelId=${g.modelId}`);
  }
}

// --- Duplicate IDs ---
const idCounts = new Map<string, number>();
for (const g of merged) {
  idCounts.set(g.id, (idCounts.get(g.id) ?? 0) + 1);
}
let duplicateIds = 0;
for (const [id, n] of idCounts) {
  if (n > 1) {
    duplicateIds += 1;
    push("HARD", "duplicate_id", `${id} count=${n}`);
  }
}

// --- Duplicate canonical within brand+model ---
const canonMap = new Map<string, string[]>();
for (const g of merged) {
  const key = `${g.brandId}|${g.modelId}|${foldCatalogKey(g.name)}`;
  const list = canonMap.get(key) ?? [];
  list.push(g.id);
  canonMap.set(key, list);
}
let duplicateCanonical = 0;
for (const [key, ids] of canonMap) {
  if (ids.length > 1) {
    duplicateCanonical += 1;
    push("HARD", "duplicate_canonical", `${key} → ${ids.join(", ")}`);
  }
}

// --- Year range errors ---
let yearRangeErrors = 0;
for (const g of merged) {
  if (g.yearTo != null && g.yearFrom > g.yearTo) {
    yearRangeErrors += 1;
    push(
      "HARD",
      "year_range",
      `${g.id} yearFrom=${g.yearFrom} > yearTo=${g.yearTo}`,
    );
  }
}

// --- Alias collisions (scoped brand+model) ---
const aliasScope = new Map<string, Map<string, Set<string>>>();
for (const g of merged) {
  const scope = `${g.brandId}|${g.modelId}`;
  let map = aliasScope.get(scope);
  if (!map) {
    map = new Map();
    aliasScope.set(scope, map);
  }
  for (const alias of g.aliases ?? []) {
    const phrase = normalizeCatalogKey(alias);
    if (!phrase || phrase.length < 2 || /^\d$/.test(phrase)) continue;
    const ids = map.get(phrase) ?? new Set();
    ids.add(g.id);
    map.set(phrase, ids);
  }
}
let aliasCollisions = 0;
for (const [scope, map] of aliasScope) {
  for (const [phrase, ids] of map) {
    if (ids.size > 1) {
      aliasCollisions += 1;
      push(
        "WARN",
        "alias_collision",
        `scope=${scope} alias="${phrase}" → ${[...ids].join(", ")}`,
      );
    }
  }
}

// --- Platform code collisions (scoped brand+model) ---
const codeScope = new Map<string, Map<string, AutomotiveGenerationRecord[]>>();
for (const g of merged) {
  const scope = `${g.brandId}|${g.modelId}`;
  let map = codeScope.get(scope);
  if (!map) {
    map = new Map();
    codeScope.set(scope, map);
  }
  for (const code of g.platformCodes ?? []) {
    const phrase = normalizeCatalogKey(code);
    if (!phrase || phrase.length < 2 || /^\d$/.test(phrase)) continue;
    const list = map.get(phrase) ?? [];
    list.push(g);
    map.set(phrase, list);
  }
}
let platformCodeCollisions = 0;
let platformCodeSuspicious = 0;
let platformCodeInfo = 0;
for (const [scope, map] of codeScope) {
  for (const [phrase, gens] of map) {
    const unique = new Map(gens.map((g) => [g.id, g]));
    if (unique.size <= 1) continue;
    platformCodeCollisions += 1;
    const arr = [...unique.values()];
    let allSeparable = true;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (!yearsUniquelySeparate(arr[i], arr[j])) allSeparable = false;
      }
    }
    const detail = `scope=${scope} code="${phrase}" → ${arr
      .map((g) => `${g.id}(${g.yearFrom}-${g.yearTo ?? "open"})`)
      .join(", ")}`;
    if (allSeparable) {
      platformCodeInfo += 1;
      push("INFO", "platform_code_collision", detail);
    } else {
      platformCodeSuspicious += 1;
      push("WARN", "platform_code_collision_suspicious", detail);
    }
  }
}

// --- Suspicious dense year overlaps within same model ---
const byModel = new Map<string, AutomotiveGenerationRecord[]>();
for (const g of merged) {
  const list = byModel.get(g.modelId) ?? [];
  list.push(g);
  byModel.set(g.modelId, list);
}
let suspiciousOverlaps = 0;
for (const [modelId, gens] of byModel) {
  if (gens.length < 3) continue;
  let overlapPairs = 0;
  for (let i = 0; i < gens.length; i++) {
    for (let j = i + 1; j < gens.length; j++) {
      if (yearOverlaps(gens[i], gens[j])) overlapPairs += 1;
    }
  }
  // Dense: many gens and a high share of overlapping pairs
  const maxPairs = (gens.length * (gens.length - 1)) / 2;
  if (overlapPairs >= 3 && overlapPairs / maxPairs >= 0.35) {
    suspiciousOverlaps += 1;
    push(
      "WARN",
      "suspicious_dense_overlap",
      `modelId=${modelId} gens=${gens.length} overlapPairs=${overlapPairs}/${maxPairs} ids=${gens
        .map((g) => g.id)
        .join(", ")}`,
    );
  }
}

// --- Print report ---
console.log("========== CATALOG GENERATIONS V2A.2 AUDIT ==========");
console.log(`BASE COUNT: ${mergeStats.baseCount}`);
console.log(`DELTA COUNT: ${mergeStats.deltaCount}`);
console.log(`APPENDED: ${mergeStats.appended}`);
console.log(`SKIPPED DUPLICATE ID: ${mergeStats.skippedDuplicateId}`);
console.log(`SKIPPED DUPLICATE CANONICAL: ${mergeStats.skippedDuplicateCanonical}`);
console.log(`SKIPPED NEAR DUPLICATE: ${mergeStats.skippedNearDuplicate}`);
if (mergeStats.absorbedIntoBase.length) {
  console.log(`ABSORBED INTO BASE: ${mergeStats.absorbedIntoBase.join("; ")}`);
}
console.log(`FINAL MERGED COUNT: ${mergeStats.finalCount}`);
console.log(`LOADER FINAL COUNT: ${data.generations.length}`);
console.log(`ORPHAN BRAND REFERENCES (delta): ${orphanBrandDelta}`);
console.log(`ORPHAN MODEL REFERENCES (delta): ${orphanModelDelta}`);
console.log(`ORPHAN BRAND REFERENCES (merged): ${orphanBrandMerged}`);
console.log(`ORPHAN MODEL REFERENCES (merged): ${orphanModelMerged}`);
console.log(`DUPLICATE IDS: ${duplicateIds}`);
console.log(`DUPLICATE CANONICAL GENERATIONS: ${duplicateCanonical}`);
console.log(`ALIAS COLLISIONS: ${aliasCollisions}`);
console.log(
  `PLATFORM CODE COLLISIONS: ${platformCodeCollisions} (suspicious=${platformCodeSuspicious}, info=${platformCodeInfo})`,
);
console.log(`YEAR RANGE ERRORS: ${yearRangeErrors}`);
console.log(`SUSPICIOUS OVERLAPS: ${suspiciousOverlaps}`);
console.log(`HARD ISSUES: ${hard.length}`);
console.log(`WARN ISSUES: ${warn.length}`);
console.log(`INFO ISSUES: ${info.length}`);

const show = (rows: Issue[], limit = 40) => {
  for (const row of rows.slice(0, limit)) {
    console.log(`  [${row.severity}] ${row.kind}: ${row.detail}`);
  }
  if (rows.length > limit) {
    console.log(`  ... ${rows.length - limit} more`);
  }
};

if (hard.length) {
  console.log("\n--- HARD ---");
  show(hard);
}
if (warn.length) {
  console.log("\n--- WARN ---");
  show(warn);
}
if (info.length) {
  console.log("\n--- INFO ---");
  show(info, 20);
}

const ok = hard.length === 0;
console.log(
  `\nAUDIT CATALOG GENERATIONS V2A2: ${ok ? "PASS" : "FAIL"} (hard-only gate)`,
);
if (!ok) {
  console.log(
    "Failed hard checks: orphan refs, duplicate IDs, yearFrom>yearTo, and/or duplicate canonical within brand+model.",
  );
}
process.exit(ok ? 0 : 1);
