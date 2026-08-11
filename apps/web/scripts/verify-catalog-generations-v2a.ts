/**
 * Automotive catalog V2A — generation/kasa enrichment.
 * Run: npx tsx scripts/verify-catalog-generations-v2a.ts
 */
import fixtures from "../../../data/catalogs/automotive/verification-fixtures-v2a.json";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { enrichAutomotiveSubject } from "../src/lib/catalog/automotive/enrich";
import {
  findGenerationInText,
  getAutomotiveIndexes,
} from "../src/lib/catalog/automotive/indexes";
import { lookupAutomotiveOem } from "../src/lib/catalog/automotive/oem";
import { lookupAutomotiveCompatibility } from "../src/lib/catalog/automotive/compatibility";
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog/automotive/provider";
function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

function includesCI(hay: string | undefined, needle: string): boolean {
  if (!hay) return false;
  return fold(hay).includes(fold(needle));
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

check("generations loaded (>=100)", idx.generations.length >= 100);
// V2A base was 178; V2A.2 runtime merge may append delta records (prefer base on conflict).
check("generations count >= 178 (V2A base preserved)", idx.generations.length >= 178);
check("generationById ready", idx.generationById.size === idx.generations.length);
check("generationsByModel ready", idx.generationsByModel.size > 0);
check("generationsByBrand ready", idx.generationsByBrand.size > 0);
check(
  "generation phrases include name/alias/code",
  idx.generationPhrases.some((p) => p.kind === "name") &&
    idx.generationPhrases.some((p) => p.kind === "alias") &&
    idx.generationPhrases.some((p) => p.kind === "platform_code"),
);
check(
  "bare single-digit aliases not indexed",
  !idx.generationPhrases.some((p) => p.phrase === "7" || p.phrase === "4"),
);
check("engines loaded (v2b seed)", idx.engines.length >= 20);
check("oem dataset still empty", idx.oemCrossrefs.length === 0);
check("compatibility dataset still empty", idx.compatibility.length === 0);

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
  const e = enrichAutomotiveSubject({ rawText: fx.input, automotiveContext: true });
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
        (e.unresolvedTokens ?? []).some((t) => fold(t) === fold(fx.expect.unresolved!)),
        JSON.stringify(e.unresolvedTokens),
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
    rawText: "2017 Volkswagen Golf 7 sağ ön far",
    automotiveContext: true,
  });
  check("detail Golf VII id", e.generation?.id === "generation_volkswagen_golf_golf-vii");
  check("detail year 2017", e.modelYear === 2017, `got ${e.modelYear}`);
  check("detail yearConsistent", e.generation?.yearConsistent === true);
  check("detail matchKind alias", e.generation?.matchKind === "alias");
  check("detail part Ön far", includesCI(e.part?.name, "ön far"), `got ${e.part?.name}`);
  check(
    "detail position ön sağ",
    e.position?.id === "front_right" || includesCI(e.position?.name, "ön sağ"),
    `got ${e.position?.id}/${e.position?.name}`,
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Passat B8 sol stop",
    automotiveContext: true,
  });
  check("passat part Arka stop", includesCI(e.part?.name, "arka stop"), `got ${e.part?.name}`);
  check(
    "passat position Sol",
    e.position?.id === "left" || includesCI(e.position?.name, "sol"),
    `got ${e.position?.id}`,
  );
}

{
  const e = enrichAutomotiveSubject({ rawText: "B8" });
  check("B8 alone no brand", !e.brand);
  check("B8 alone no model", !e.model);
  check("B8 alone no generation", e.generation?.status !== "resolved" && !e.generation?.id);
}

{
  const e = enrichAutomotiveSubject({ rawText: "2017 Golf" });
  check("2017 Golf no invented generation", e.generation?.status !== "resolved");
}

{
  const r = understandRequest("2018 Volkswagen Golf sağ ön far");
  const e = r.catalogEnrichment;
  check("2018 Golf year only no generation", e?.generation?.status !== "resolved");
  check("2018 Golf still VW", e?.brand?.name === "Volkswagen");
  check("2018 Golf still Golf", e?.model?.name === "Golf");
  check(
    "2018 Golf subject not overwritten by generation",
    !includesCI(r.requestSubject.name?.value, "Golf VII") &&
      !includesCI(r.requestSubject.displayPhrase?.value, "Golf VII"),
    `${r.requestSubject.name?.value} / ${r.requestSubject.displayPhrase?.value}`,
  );
}

{
  const r = understandRequest("Golf 7 sağ ayna");
  check(
    "Golf 7 ayna subject stays ayna",
    includesCI(r.requestSubject.name?.value, "ayna") ||
      includesCI(r.requestSubject.displayPhrase?.value, "ayna"),
    `${r.requestSubject.name?.value}`,
  );
  check(
    "Golf 7 ayna generation on catalog only",
    r.catalogEnrichment?.generation?.name === "Golf VII" &&
      r.catalogEnrichment?.generation?.status === "resolved",
    JSON.stringify(r.catalogEnrichment?.generation),
  );
}

{
  const oem = lookupAutomotiveOem("3G0858687A");
  const e = enrichAutomotiveSubject({ rawText: "3G0858687A" });
  check("OEM still unresolved", oem.status === "unresolved");
  check("OEM not fabricated", !oem.partId && !oem.brandId);
  check("OEM enrichment unresolved", e.oem?.status === "unresolved");
  check("OEM text no generation", e.generation?.status !== "resolved");
}

check(
  "compatibility still ready_empty",
  lookupAutomotiveCompatibility({ modelId: "model_volkswagen_golf" }).status ===
    "ready_empty",
);

for (const bare of ["E90", "W124", "FC", "J11", "5G"]) {
  const hit = findGenerationInText(bare, {});
  const e = enrichAutomotiveSubject({ rawText: bare });
  check(
    `bare ${bare} not resolved`,
    hit == null && e.generation?.status !== "resolved",
    JSON.stringify({ hit: hit?.record.id, gen: e.generation }),
  );
}

{
  const e = enrichAutomotiveSubject({ rawText: "Merc W124" });
  check("Merc too short for Mercedes-Benz", e.brand?.name !== "Mercedes-Benz");
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Passat 3A",
    automotiveContext: true,
  });
  check(
    "shared platform 3A no pick without year",
    e.generation?.status !== "resolved",
    JSON.stringify(e.generation),
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Passat 3A 1990",
    automotiveContext: true,
  });
  check(
    "shared platform 3A year disambiguates B3",
    e.generation?.name === "Passat B3" && e.generation.status === "resolved",
    JSON.stringify(e.generation),
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Passat 3C",
    automotiveContext: true,
  });
  check(
    "shared platform 3C no pick without year",
    e.generation?.status !== "resolved",
    JSON.stringify(e.generation),
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Golf B27 far",
    automotiveContext: true,
  });
  check("B27 not Golf VII", e.generation?.name !== "Golf VII");
  check("B27 far still found", includesCI(e.part?.name, "far"), `got ${e.part?.name}`);
}

{
  const r = understandRequest("BMW E90 ön tampon");
  check(
    "understandRequest BMW E90 generation",
    r.catalogEnrichment?.generation?.name === "E90/E91/E92/E93",
    JSON.stringify(r.catalogEnrichment?.generation),
  );
  check(
    "understandRequest does not put generation on subject name",
    !includesCI(r.requestSubject.name?.value, "E90/E91"),
    String(r.requestSubject.name?.value),
  );
}

console.log("\n========== CATALOG GENERATIONS V2A ==========");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (errors.length) {
  for (const err of errors) console.log(`  - ${err}`);
}
console.log(`VERIFY CATALOG GENERATIONS V2A: ${fail === 0 ? "PASS" : "FAIL"}`);
process.exit(fail === 0 ? 0 : 1);
