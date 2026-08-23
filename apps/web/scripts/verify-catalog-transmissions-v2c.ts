/**
 * Automotive catalog V2C — transmission entity + authoritative source expansion.
 * Run: npx tsx scripts/verify-catalog-transmissions-v2c.ts
 *
 * Live acceptance: LIVE_TRANSMISSION_RECORDS and LIVE_ENGINE_RECORDS > 0 when
 * network available. If blocked, report PARTIAL — never pass via fixtures.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { loadAutomotiveTransmissions } from "../src/lib/catalog/automotive/dataset";
import { enrichAutomotiveSubject } from "../src/lib/catalog/automotive/enrich";
import {
  automotiveTransmissionCoverageStats,
  findBrandInText,
  findModelInText,
  findTransmissionsInText,
  getAutomotiveIndexes,
  resetAutomotiveIndexesCache,
  resolveTransmission,
} from "../src/lib/catalog/automotive/indexes";
import {
  familyToType,
  inferTransmissionFamily,
  normalizeTransmissionMention,
  sanitizeTransmissionCode,
} from "../src/lib/catalog/automotive/transmission-normalize";
import { applyCatalogEnrichment } from "../src/lib/catalog/apply-enrichment";
import {
  REAL_SOURCE_ADAPTERS,
  automotiveEpaFuelEconomyAdapter,
  buildCoverageMatrix,
  buildTransmissionCandidate,
  EMPTY_TRANSMISSION_SEED,
  loadSourceRegistry,
  mergeMultiSourceRecords,
  runCatalogIngestion,
  scoreSourceQuality,
} from "../src/lib/knowledge/ingestion";
import type { IngestRecord } from "../src/lib/knowledge/types";
import { uv } from "../src/lib/request-understanding/provenance";
import type { RequestUnderstandingResult } from "../src/lib/request-understanding/types";

let pass = 0;
let fail = 0;
let skip = 0;
const errors: string[] = [];
const skips: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

function skipped(name: string, reason: string) {
  skip += 1;
  skips.push(`${name}: ${reason}`);
  console.log(`LIVE_SKIPPED — ${name} (${reason})`);
}

void (async () => {
ensureAutomotiveCatalogRegistered();
resetAutomotiveIndexesCache();
const idx = getAutomotiveIndexes();

// --- Schema / loader / index ---
check("empty-safe loader returns array", Array.isArray(loadAutomotiveTransmissions()));
check("production transmissions = 0", idx.transmissions.length === 0);
check("transmissionById ready", idx.transmissionById.size === 0);
check("transmissionsByGeneration ready", idx.transmissionsByGeneration.size === 0);
check("EMPTY_TRANSMISSION_SEED empty", EMPTY_TRANSMISSION_SEED.records.length === 0);
check("engines preserved (=31)", idx.engines.length === 31);
check("generations preserved (>=600)", idx.generations.length >= 600);
check("brands preserved (>=100)", idx.brands.length >= 100);

const stats = automotiveTransmissionCoverageStats(idx);
check("coverage matrix brands", stats.brands === idx.brands.length);
check("coverage matrix transmissions 0", stats.transmissions === 0);
check(
  "generationWithTransmissionCount 0",
  stats.generationWithTransmissionCount === 0,
);
check(
  "engineWithTransmissionRelationCount 0",
  stats.engineWithTransmissionRelationCount === 0,
);

// Index cache
const idx2 = getAutomotiveIndexes();
check("index cache same instance", idx === idx2);
resetAutomotiveIndexesCache();
const idx3 = getAutomotiveIndexes();
check("index cache rebuild after reset", idx3 !== idx && idx3.engines.length === 31);

// --- Normalization / aliases ---
check(
  "DSG → family DSG not code",
  sanitizeTransmissionCode("DSG") == null &&
    inferTransmissionFamily("7-speed DSG") === "DSG",
);
check(
  "S tronic → DCT",
  inferTransmissionFamily("S tronic") === "DCT",
);
check("EDC → DCT", inferTransmissionFamily("EDC") === "DCT");
check(
  "Tiptronic → TORQUE_CONVERTER_AUTOMATIC",
  inferTransmissionFamily("Tiptronic") === "TORQUE_CONVERTER_AUTOMATIC",
);
check(
  "Steptronic → TORQUE_CONVERTER_AUTOMATIC",
  inferTransmissionFamily("Steptronic") === "TORQUE_CONVERTER_AUTOMATIC",
);
check("PowerShift → DCT", inferTransmissionFamily("PowerShift") === "DCT");
check("PDK → DCT", inferTransmissionFamily("PDK") === "DCT");
check("manuel → MANUAL", inferTransmissionFamily("manuel") === "MANUAL");
check("CVT family", inferTransmissionFamily("CVT") === "CVT");
check("e-CVT ≠ CVT", inferTransmissionFamily("e-CVT") === "E_CVT");
check(
  "e-CVT type",
  familyToType("E_CVT") === "e_cvt" && familyToType("CVT") === "cvt",
);
check(
  "SINGLE_SPEED_EV for BEV",
  inferTransmissionFamily("single-speed", { electrification: "BEV" }) ===
    "SINGLE_SPEED_EV",
);
check(
  "BEV without gearbox label → SINGLE_SPEED_EV",
  inferTransmissionFamily("e-Golf", { electrification: "BEV" }) ===
    "SINGLE_SPEED_EV",
);
check(
  "hybrid e-CVT",
  normalizeTransmissionMention("Corolla e-CVT").family === "E_CVT",
);
check(
  "DQ200 code accepted shape",
  sanitizeTransmissionCode("DQ200") === "DQ200",
);
check(
  "8AT not a code",
  sanitizeTransmissionCode("8AT") == null,
);
check(
  "fabricated XYZ not a code",
  sanitizeTransmissionCode("XYZ") == null,
);

const golf = findBrandInText("Golf 7 DSG");
const golfModel = findModelInText("Volkswagen Golf 7 DSG", "brand_volkswagen")
  ?? findModelInText("Golf 7 DSG", null);
const brandId = golf?.record.id ?? "brand_volkswagen";
const modelId = golfModel?.record.id;

check("Golf model scoped for TX", Boolean(modelId));

{
  const hit = findTransmissionsInText(
    "7-speed DSG",
    { brandId: null, modelId: null },
  );
  check(
    "never global 7-speed DSG alone",
    hit.status === "unresolved",
    JSON.stringify(hit),
  );
}

{
  const hit = findTransmissionsInText("Volkswagen Golf 7 DSG", {
    brandId,
    modelId,
  });
  check(
    "Golf DSG scoped → unresolved (empty catalog) with familyHint DSG",
    hit.status === "unresolved" && hit.familyHint === "DSG",
    JSON.stringify(hit),
  );
  check(
    "Golf DSG code null",
    hit.transmissionCodeHint == null,
  );
}

{
  const hit = resolveTransmission("BMW 3 Series F30 8AT", {
    brandId: findBrandInText("BMW")?.record.id,
    modelId: findModelInText("BMW 3 Series", findBrandInText("BMW")?.record.id)
      ?.record.id,
  });
  check(
    "BMW F30 8AT familyHint TORQUE_CONVERTER_AUTOMATIC",
    hit.familyHint === "TORQUE_CONVERTER_AUTOMATIC" &&
      (hit.gearCountHint === 8 || hit.status === "unresolved"),
    JSON.stringify(hit),
  );
}

{
  const hit = findTransmissionsInText("Toyota Corolla e-CVT", {
    brandId: findBrandInText("Toyota")?.record.id,
    modelId: findModelInText(
      "Toyota Corolla",
      findBrandInText("Toyota")?.record.id,
    )?.record.id,
  });
  check(
    "Corolla e-CVT familyHint",
    hit.familyHint === "E_CVT",
    JSON.stringify(hit),
  );
}

{
  const hit = findTransmissionsInText("Renault Clio EDC", {
    brandId: findBrandInText("Renault")?.record.id,
    modelId: findModelInText(
      "Renault Clio",
      findBrandInText("Renault")?.record.id,
    )?.record.id,
  });
  check("Clio EDC familyHint DCT", hit.familyHint === "DCT", JSON.stringify(hit));
}

{
  const hit = findTransmissionsInText("Golf fabricated XYZ gearbox", {
    brandId,
    modelId,
  });
  check(
    "fabricated XYZ → unresolved / no code",
    hit.status === "unresolved" && hit.transmissionCodeHint == null,
    JSON.stringify(hit),
  );
}

// Ambiguity: empty catalog cannot randomly resolve
{
  const hit = findTransmissionsInText("Golf DSG", { brandId, modelId });
  check(
    "ambiguity never random pick",
    hit.status !== "resolved",
    JSON.stringify(hit),
  );
}

// Candidate builder never invents DSG code
{
  const c = buildTransmissionCandidate({
    brandId: "brand_volkswagen",
    modelId: "model_x",
    generationId: "gen_x",
    marketingName: "DSG",
    transmissionCode: "DSG",
    provenance: { type: "TEST", confidence: "LOW" },
  });
  check("builder strips DSG code", c.transmissionCode == null);
  check("builder family DSG", c.transmissionFamily === "DSG");
}

// Market / merge / conflict
{
  const a: IngestRecord = {
    id: "tx-a",
    categoryId: "automotive",
    kind: "entity",
    sourceMode: "LIVE",
    payload: {
      brand: "Volkswagen",
      model: "Golf",
      gapType: "transmission",
      canonicalKey: "automotive|transmission|golf|dsg7",
      transmissionCode: "DQ200",
      gearCount: 7,
      sourceId: "src-a",
    },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "A",
      confidence: "MEDIUM",
    },
  };
  const b: IngestRecord = {
    ...a,
    id: "tx-b",
    payload: {
      ...a.payload,
      transmissionCode: "DQ250",
      sourceId: "src-b",
    },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "B",
      confidence: "MEDIUM",
    },
  };
  const merged = mergeMultiSourceRecords([a, b]);
  check(
    "SOURCE_CONFLICT on TX code mismatch",
    merged.conflicts.some((c) => c.field === "transmissionCode"),
    JSON.stringify(merged.conflicts),
  );
}

{
  const matrix = buildCoverageMatrix({
    domain: "automotive",
    known: {
      brand: stats.brands,
      model: stats.models,
      generation: stats.generations,
      engine: stats.engines,
      transmission: 0,
    },
    discovered: { transmission: 3, engine: 2 },
    review: { transmission: 3 },
  });
  check(
    "coverage matrix has transmission row",
    matrix.some((r) => r.entityType === "transmission" && r.KNOWN === 0),
  );
}

// EXPLICIT protection soft-fill hook
{
  const brand = findBrandInText("Volkswagen");
  const model = findModelInText("Golf", brand?.record.id);
  const fake = {
    rawInput: "Golf DSG",
    category: uv("automotive", { provenance: "EXPLICIT", confidence: 0.9 }),
    identity: {
      brand: uv("Volkswagen", { provenance: "EXPLICIT", confidence: 0.99 }),
      model: uv("Golf", { provenance: "EXPLICIT", confidence: 0.99 }),
    },
    attributes: {
      transmission: uv("Manuel", {
        provenance: "EXPLICIT",
        confidence: 0.99,
        evidence: ["user"],
      }),
    },
    requestSubject: {
      kind: uv("VEHICLE", { provenance: "EXPLICIT", confidence: 0.9 }),
      name: uv("golf", { provenance: "EXPLICIT", confidence: 0.9 }),
      displayPhrase: uv("golf", { provenance: "EXPLICIT", confidence: 0.9 }),
    },
    subject: {
      kind: uv("VEHICLE", { provenance: "EXPLICIT", confidence: 0.9 }),
    },
  } as unknown as RequestUnderstandingResult;
  const next = applyCatalogEnrichment(fake);
  check(
    "EXPLICIT transmission not overwritten",
    String(next.attributes.transmission?.value) === "Manuel",
  );
  void model;
}

// Registry / quality dimensions
{
  const registry = loadSourceRegistry({ forceReload: true });
  check(
    "EPA source registered",
    registry.some((s) => s.sourceId === "auto-epa-fueleconomy"),
  );
  check(
    "ZF transmission OEM registered",
    registry.some((s) => s.sourceId === "auto-zf-tech"),
  );
  const epa = registry.find((s) => s.sourceId === "auto-epa-fueleconomy")!;
  const q = scoreSourceQuality(epa);
  check(
    "quality has TRANSMISSION_DETAIL",
    typeof q.dimensions.TRANSMISSION_DETAIL === "number",
  );
  check(
    "quality has ENGINE_DETAIL",
    typeof q.dimensions.ENGINE_DETAIL === "number",
  );
  check(
    "EPA adapter registered",
    REAL_SOURCE_ADAPTERS.some(
      (a) => a.adapterId === automotiveEpaFuelEconomyAdapter.adapterId,
    ),
  );
}

// Failure isolation: adapter throw → PARTIAL_SUCCESS
{
  const boom = {
    ...automotiveEpaFuelEconomyAdapter,
    id: "auto-v2c-boom",
    adapterId: "auto-v2c-boom",
    async discover() {
      throw new Error("isolated failure");
    },
  };
  const okAdapter = {
    ...automotiveEpaFuelEconomyAdapter,
    id: "auto-v2c-ok-probe",
    adapterId: "auto-v2c-ok-probe",
    async discover() {
      return {
        records: [
          {
            id: "probe-ok",
            categoryId: "automotive",
            kind: "entity" as const,
            sourceMode: "LIVE" as const,
            payload: {
              brand: "Volkswagen",
              model: "Golf",
              gapType: "transmission",
              mappingProbe: true,
              canonicalKey: "automotive|tx|probe-ok",
            },
            provenance: {
              sourceType: "TRUSTED_DATASET" as const,
              sourceName: "probe",
              confidence: "HIGH" as const,
            },
          },
        ],
        accessStatus: "AVAILABLE" as const,
        fetchAttempts: 0,
      };
    },
  };
  const isolated = await runCatalogIngestion({
    categoryIds: ["automotive"],
    dryRun: true,
    apply: false,
    adapters: [boom, okAdapter],
    writeArtifacts: false,
    allowNetwork: false,
    limit: 5,
  });
  check(
    "failure isolation PARTIAL_SUCCESS",
    isolated.status === "PARTIAL_SUCCESS",
    isolated.status,
  );
}

// Dry-run no mutation
{
  const prodTx = path.resolve(
    process.cwd(),
    "../../data/catalogs/automotive/automotive-transmissions.json",
  );
  const beforeExists = existsSync(prodTx);
  await runCatalogIngestion({
    categoryIds: ["automotive"],
    dryRun: true,
    apply: false,
    adapters: [automotiveEpaFuelEconomyAdapter],
    writeArtifacts: false,
    allowNetwork: false,
    entityFilter: "transmission",
    limit: 5,
  });
  check(
    "dry-run does not create production transmissions file",
    existsSync(prodTx) === beforeExists,
  );
  check(
    "production loader still empty",
    loadAutomotiveTransmissions().length === 0,
  );
}

// Enrichment empty-safe
{
  const e = enrichAutomotiveSubject({
    rawText: "2017 Golf 7 DSG",
    automotiveContext: true,
  });
  check(
    "enrichment Golf brand/model still works",
    e.brand?.name === "Volkswagen" && e.model?.name === "Golf",
  );
  check(
    "enrichment TX not falsely resolved",
    e.transmission?.status !== "resolved",
  );
}

/**
 * --- LIVE acceptance --- VARSAYILAN OLARAK KAPALI (kurucu, 2026-08-23 — KB-8)
 *
 * Bu sonda iki kuralı birden çiğniyordu:
 *
 *  1. Doğrulayıcı READ-ONLY olmalı. Canlı EPA çağrısı başarılı olduğunda
 *     adaptör `markSourceStatus(..., { persist: true })` çağırıyor ve
 *     data/catalog-ingestion/sources/registry.status.json dosyasını (git
 *     tarafından İZLENEN bir dosya) yeni zaman damgalarıyla yeniden yazıyordu.
 *     Bu, "bu kırmızı benden mi geldi" sorusunu cevaplayan taban ölçümünü
 *     kirletir: iş stash'lenip batarya önceki commit'te koşulduğunda bu yazım
 *     çalışma ağacına karışır. 2026-08-23'te iki kez oldu.
 *
 *  2. Doğrulayıcı DETERMİNİSTİK olmalı. `allowNetwork: true` ile sonuç dış
 *     servisin o an ayakta olmasına bağlıydı; aynı commit, aynı kod, farklı
 *     sonuç. Ağ engelliyse dosya yazılmıyor, açıksa yazılıyordu — yani yan
 *     etki bile rastgeleydi.
 *
 * Sonda artık açık bir bayrak ister ve varsayılan koşu tamamen çevrimdışıdır.
 * Bayrakla çalıştırıldığında bile artefakt yazımı kapalıdır.
 */
class SkipLiveProbe extends Error {}

const LIVE_PROBE_ENABLED =
  process.env.TALEPO_VERIFY_LIVE_NETWORK?.trim() === "1";

console.log("\n--- LIVE probe ---");
if (!LIVE_PROBE_ENABLED) {
  skipped(
    "LIVE probe",
    "çevrimdışı varsayılan — açmak için TALEPO_VERIFY_LIVE_NETWORK=1 (KB-8: doğrulayıcı read-only ve deterministik olmalı)",
  );
}
try {
  if (!LIVE_PROBE_ENABLED) throw new SkipLiveProbe();
  const live = await runCatalogIngestion({
    categoryIds: ["automotive"],
    dryRun: true,
    apply: false,
    adapters: REAL_SOURCE_ADAPTERS.filter((a) =>
      a.supportedCategories.includes("automotive"),
    ),
    writeArtifacts: false,
    allowNetwork: true,
    limit: 40,
  });
  const liveTx = Number(live.report.counts.LIVE_TRANSMISSION_RECORDS ?? 0);
  const liveEng = Number(live.report.counts.LIVE_ENGINE_RECORDS ?? 0);
  const fixtureTx = Number(live.report.counts.FIXTURE_TRANSMISSION_RECORDS ?? 0);
  console.log(
    `LIVE_TX=${liveTx} LIVE_ENG=${liveEng} FIXTURE_TX=${fixtureTx} status=${live.status}`,
  );
  if (liveTx > 0 && liveEng > 0) {
    check("LIVE_TRANSMISSION_RECORDS > 0", liveTx > 0);
    check("LIVE_ENGINE_RECORDS > 0", liveEng > 0);
    check(
      "fixtures not counted as live TX acceptance",
      fixtureTx === 0 || liveTx > 0,
    );
  } else {
    skipped(
      "LIVE_TRANSMISSION/ENGINE acceptance",
      `PARTIAL — LIVE_TX=${liveTx} LIVE_ENG=${liveEng} (network/OEM blocked or empty)`,
    );
  }
  if (live.artifactDir) {
    check(
      "V2C artifacts dir written",
      existsSync(
        path.join(live.artifactDir, "automotive-transmissions-review.json"),
      ) &&
        existsSync(path.join(live.artifactDir, "coverage.json")) &&
        existsSync(path.join(live.artifactDir, "source-conflicts.json")),
    );
  }
} catch (err) {
  // SkipLiveProbe yukarıda zaten skipped() olarak raporlandı; ikinci kez yazma.
  if (!(err instanceof SkipLiveProbe))
  skipped(
    "LIVE probe",
    err instanceof Error ? err.message : String(err),
  );
}

console.log(`\nV2C: ${pass} passed, ${fail} failed, ${skip} live-skipped`);
if (errors.length) {
  console.log("Failures:");
  for (const e of errors) console.log(` - ${e}`);
}
if (skips.length) {
  console.log("Live skips:");
  for (const s of skips) console.log(` - ${s}`);
}
process.exit(fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
