/**
 * Automotive catalog V2A.2 — delta generation enrichment fixtures.
 * Run: npx tsx scripts/verify-catalog-generations-v2a2.ts
 */
import fixtures from "../../../data/catalogs/automotive/verification-fixtures-v2a2.json";
import generationsDelta from "../../../data/catalogs/automotive/automotive-generations-v2a2-delta.json";
import { enrichAutomotiveSubject } from "../src/lib/catalog/automotive/enrich";
import {
  getAutomotiveIndexes,
} from "../src/lib/catalog/automotive/indexes";
import { loadAutomotiveDataset } from "../src/lib/catalog/automotive/dataset";
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog/automotive/provider";

function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

let pass = 0;
let fail = 0;
const errors: string[] = [];

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

ensureAutomotiveCatalogRegistered();
const idx = getAutomotiveIndexes();
const data = loadAutomotiveDataset();
const stats = data.generationMergeStats;

const OLD = 178;
const DELTA = (generationsDelta as unknown[]).length;
const expectedFinal = OLD + stats.appended;

check(
  "delta file count 423 (Togg near-dupes removed)",
  DELTA === 423,
  `got ${DELTA}`,
);
check("base preserved 178", stats.baseCount === OLD, `got ${stats.baseCount}`);
check(
  "final generation count = old + unique new",
  idx.generations.length === expectedFinal &&
    data.generations.length === expectedFinal &&
    idx.generations.length === 601 &&
    stats.skippedNearDuplicate === 0,
  `got idx=${idx.generations.length} data=${data.generations.length} expected=601/${expectedFinal} (appended=${stats.appended}, skippedId=${stats.skippedDuplicateId}, skippedCanon=${stats.skippedDuplicateCanonical}, skippedNear=${stats.skippedNearDuplicate})`,
);
check(
  "Zoe II not absorbed into Zoe I",
  idx.generationById.has("generation_renault_zoe_zoe-i") &&
    idx.generationById.has("generation_renault_zoe_zoe-ii"),
);
check(
  "Discovery 4 not absorbed into Discovery 3",
  idx.generationById.has("generation_land-rover_discovery_discovery-3") &&
    idx.generationById.has("generation_land-rover_discovery_discovery-4"),
);
check(
  "Togg T10X canonical only",
  idx.generationById.has("generation_togg_t10x_t10x") &&
    !idx.generationById.has("generation_togg_t10x_t10x-i"),
);
check(
  "Togg T10F canonical only",
  idx.generationById.has("generation_togg_t10f_t10f") &&
    !idx.generationById.has("generation_togg_t10f_t10f-i"),
);
check(
  "indexes include merged set",
  idx.generationById.size === idx.generations.length &&
    idx.generationsByModel.size > 0 &&
    idx.generationsByBrand.size > 0 &&
    idx.generationPhrases.length > 0,
);
check(
  "delta Touareg II present",
  idx.generationById.has("generation_volkswagen_touareg_touareg-ii") ||
    idx.generations.some(
      (g) =>
        g.modelId === "model_volkswagen_touareg" &&
        fold(g.name) === fold("Touareg II"),
    ),
);

type Fixture = {
  input: string;
  expect: {
    brand: string;
    model: string;
    generation: string | null;
    unresolved?: string;
  };
};

for (const fx of fixtures as Fixture[]) {
  const e = enrichAutomotiveSubject({
    rawText: fx.input,
    automotiveContext: true,
  });
  check(
    `fixture brand ${fx.input}`,
    e.brand?.name === fx.expect.brand,
    `got ${e.brand?.name}`,
  );
  check(
    `fixture model ${fx.input}`,
    e.model?.name === fx.expect.model,
    `got ${e.model?.name}`,
  );
  if (fx.expect.generation == null) {
    check(
      `fixture generation unresolved ${fx.input}`,
      e.generation?.status !== "resolved" && !e.generation?.id,
      JSON.stringify(e.generation),
    );
    if (fx.expect.unresolved) {
      check(
        `fixture unresolved ${fx.expect.unresolved}`,
        (e.unresolvedTokens ?? []).some(
          (t) => fold(t) === fold(fx.expect.unresolved!),
        ) ||
          (e.generation?.status === "unverified" &&
            fold(e.generation.raw ?? "") === fold(fx.expect.unresolved!)),
        JSON.stringify({
          unresolvedTokens: e.unresolvedTokens,
          generation: e.generation,
        }),
      );
    }
  } else {
    check(
      `fixture generation ${fx.expect.generation}`,
      e.generation?.status === "resolved" &&
        Boolean(e.generation.id) &&
        e.generation.name === fx.expect.generation,
      JSON.stringify(e.generation),
    );
  }
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Togg T10X ön far",
    automotiveContext: true,
  });
  check("runtime Togg brand", e.brand?.name === "Togg", `got ${e.brand?.name}`);
  check("runtime T10X model", e.model?.name === "T10X", `got ${e.model?.name}`);
  check(
    "runtime T10X generation",
    e.generation?.status === "resolved" &&
      e.generation.id === "generation_togg_t10x_t10x" &&
      e.generation.name === "T10X",
    JSON.stringify(e.generation),
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Togg T10F tampon",
    automotiveContext: true,
  });
  check("runtime Togg brand T10F", e.brand?.name === "Togg", `got ${e.brand?.name}`);
  check("runtime T10F model", e.model?.name === "T10F", `got ${e.model?.name}`);
  check(
    "runtime T10F generation",
    e.generation?.status === "resolved" &&
      e.generation.id === "generation_togg_t10f_t10f" &&
      e.generation.name === "T10F",
    JSON.stringify(e.generation),
  );
}

console.log("\n========== CATALOG GENERATIONS V2A2 ==========");
console.log(`OLD: ${OLD}`);
console.log(`DELTA: ${DELTA}`);
console.log(`APPENDED: ${stats.appended}`);
console.log(`FINAL: ${idx.generations.length}`);
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (errors.length) {
  for (const err of errors) console.log(`  - ${err}`);
}
console.log(
  `VERIFY CATALOG GENERATIONS V2A2: ${fail === 0 ? "PASS" : "FAIL"}`,
);
process.exit(fail === 0 ? 0 : 1);
