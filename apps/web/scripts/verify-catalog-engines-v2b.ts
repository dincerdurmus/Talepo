/**
 * Automotive catalog V2B — engine/propulsion enrichment.
 * Run: npx tsx scripts/verify-catalog-engines-v2b.ts
 */
import fixtures from "../../../data/catalogs/automotive/verification-fixtures-v2b.json";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { enrichAutomotiveSubject } from "../src/lib/catalog/automotive/enrich";
import {
  findEnginesInText,
  getAutomotiveIndexes,
} from "../src/lib/catalog/automotive/indexes";
import { lookupAutomotiveOem } from "../src/lib/catalog/automotive/oem";
import { lookupAutomotiveCompatibility } from "../src/lib/catalog/automotive/compatibility";
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog/automotive/provider";
import { normalizeCatalogFuelType } from "../src/lib/catalog/normalize";

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

check("engines loaded (>=20)", idx.engines.length >= 20);
check("engines count 31", idx.engines.length === 31);
check("engineById ready", idx.engineById.size === idx.engines.length);
check("enginesByGeneration ready", idx.enginesByGeneration.size > 0);
check("null engineCode allowed", idx.engines.some((e) => e.engineCode == null));
check(
  "BEV displacement null allowed",
  idx.engines.some((e) => e.electrification === "BEV" && e.displacementCc == null),
);
check("oem still empty", idx.oemCrossrefs.length === 0);
check("compatibility still empty", idx.compatibility.length === 0);

type Fixture = {
  input: string;
  expect: {
    brand?: string;
    model?: string;
    generation?: string;
    engineMarketingName?: string;
    powerKw?: number;
    engine?: null;
    unresolved?: string;
  };
};

for (const fx of fixtures as Fixture[]) {
  const e = enrichAutomotiveSubject({ rawText: fx.input, automotiveContext: true });
  if (fx.expect.brand) {
    check(
      `fixture brand ${fx.input}`,
      e.brand?.name === fx.expect.brand,
      `got ${e.brand?.name}`,
    );
  }
  if (fx.expect.model) {
    check(
      `fixture model ${fx.input}`,
      e.model?.name === fx.expect.model,
      `got ${e.model?.name}`,
    );
  }
  if (fx.expect.generation) {
    check(
      `fixture generation ${fx.input}`,
      e.generation?.status === "resolved" &&
        e.generation.name === fx.expect.generation,
      JSON.stringify(e.generation),
    );
  }
  if (fx.expect.engine === null) {
    check(
      `fixture engine unresolved ${fx.input}`,
      e.engine?.status !== "resolved" && !e.engine?.id,
      JSON.stringify(e.engine),
    );
    if (fx.expect.unresolved) {
      check(
        `fixture unresolved ${fx.expect.unresolved}`,
        (e.unresolvedTokens ?? []).some((t) =>
          fold(t).includes(fold(fx.expect.unresolved!)),
        ) || fold(e.engine?.raw ?? "").includes(fold(fx.expect.unresolved)),
        JSON.stringify({ unresolved: e.unresolvedTokens, engine: e.engine }),
      );
    }
  } else if (fx.expect.engineMarketingName) {
    check(
      `fixture engine ${fx.expect.engineMarketingName}`,
      e.engine?.status === "resolved" &&
        e.engine.marketingName === fx.expect.engineMarketingName,
      JSON.stringify(e.engine),
    );
  }
  if (fx.expect.powerKw != null) {
    check(
      `fixture powerKw ${fx.expect.powerKw}`,
      e.engine?.status === "resolved" && e.engine.powerKw === fx.expect.powerKw,
      `got ${e.engine?.powerKw}`,
    );
  }
}

{
  const e = enrichAutomotiveSubject({
    rawText: "2017 Golf 7 1.6 TDI sağ motor kulağı",
    automotiveContext: true,
  });
  check("detail VW", e.brand?.name === "Volkswagen");
  check("detail Golf", e.model?.name === "Golf");
  check("detail Golf VII", e.generation?.name === "Golf VII");
  check("detail 1.6 TDI EA288", e.engine?.marketingName === "1.6 TDI EA288");
  check("detail 85 kW", e.engine?.powerKw === 85);
  check("detail year 2017", e.modelYear === 2017);
  check("detail yearConsistent", e.engine?.yearConsistent === true);
  check("detail no fabricated code", e.engine?.engineCode == null);
  check(
    "detail motor kulağı",
    includesCI(e.part?.name, "motor kulağı"),
    `got ${e.part?.name}`,
  );
  check(
    "detail sağ",
    e.position?.id === "right" || includesCI(e.position?.name, "sağ"),
    `got ${e.position?.id}`,
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "2015 Golf 7 1.6 TDI",
    automotiveContext: true,
  });
  check("2015 year consistency 81 kW", e.engine?.powerKw === 81, `got ${e.engine?.powerKw}`);
  check(
    "2015 marketing 1.6 TDI",
    e.engine?.marketingName === "1.6 TDI",
    `got ${e.engine?.marketingName}`,
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Golf 7 1.6 TDI",
    automotiveContext: true,
  });
  check(
    "no year no random variant",
    e.engine?.status === "ambiguous" || e.engine?.status !== "resolved",
    JSON.stringify(e.engine),
  );
  check(
    "ambiguous has candidates",
    e.engine?.status !== "resolved" || (e.engine.candidates?.length ?? 0) > 1,
    JSON.stringify(e.engine?.candidates),
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Golf 7 1.6 TDI 115",
    automotiveContext: true,
  });
  check("power 115 → 85 kW", e.engine?.powerKw === 85, `got ${e.engine?.powerKw}`);
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Clio 4 0.9 TCe turbo hortumu",
    automotiveContext: true,
  });
  check("clio part turbo hortumu", includesCI(e.part?.name, "hortum"), `got ${e.part?.name}`);
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Egea 1.6 Multijet baskı balata",
    automotiveContext: true,
  });
  check("egea Fiat", e.brand?.name === "Fiat");
  check(
    "egea part debriyaj",
    includesCI(e.part?.name, "debriyaj"),
    `got ${e.part?.name}`,
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "BMW E90 320d",
    automotiveContext: true,
  });
  check("320d not 330d", e.engine?.marketingName === "320d");
  check("320d 130 kW", e.engine?.powerKw === 130);
  check("320d no engine code invented", e.engine?.engineCode == null);
}

{
  const e = enrichAutomotiveSubject({
    rawText: "BMW E90 330d",
    automotiveContext: true,
  });
  check(
    "330d != 320d",
    e.engine?.status !== "resolved" || e.engine.marketingName !== "320d",
    JSON.stringify(e.engine),
  );
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Golf 7 9.9 TDI",
    automotiveContext: true,
  });
  check("9.9 no 1.6", e.engine?.marketingName !== "1.6 TDI");
  check("9.9 no 2.0", e.engine?.marketingName !== "2.0 TDI");
  check("9.9 no EA288", e.engine?.marketingName !== "1.6 TDI EA288");
  check("9.9 unresolved", e.engine?.status !== "resolved");
}

{
  const e = enrichAutomotiveSubject({
    rawText: "Golf 7 1.5 TDI",
    automotiveContext: true,
  });
  check(
    "1.5 != 1.6",
    e.engine?.status !== "resolved" || !includesCI(e.engine.marketingName, "1.6"),
    JSON.stringify(e.engine),
  );
}

{
  const bare = findEnginesInText("1.6 TDI", {});
  check("unscoped 1.6 TDI no match", bare.status === "unresolved");
}

{
  const e = enrichAutomotiveSubject({
    rawText: "2017 Golf 7 e-Golf",
    automotiveContext: true,
  });
  check("e-Golf BEV", e.engine?.electrification === "BEV", JSON.stringify(e.engine));
  check("e-Golf displacement null", e.engine?.displacementCc == null);
  check("e-Golf electric", e.engine?.fuelType === "ELECTRIC");
  check("e-Golf 100 kW year", e.engine?.powerKw === 100, `got ${e.engine?.powerKw}`);
}

check("fuel benzin → PETROL", normalizeCatalogFuelType("benzin") === "PETROL");
check("fuel petrol → PETROL", normalizeCatalogFuelType("petrol") === "PETROL");
check("fuel gasoline → PETROL", normalizeCatalogFuelType("gasoline") === "PETROL");
check("fuel dizel → DIESEL", normalizeCatalogFuelType("dizel") === "DIESEL");
check("fuel diesel → DIESEL", normalizeCatalogFuelType("diesel") === "DIESEL");
check("fuel elektrik → ELECTRIC", normalizeCatalogFuelType("elektrik") === "ELECTRIC");
check("fuel hibrit → HEV", normalizeCatalogFuelType("hibrit") === "HEV");
check("fuel mild hybrid → MHEV", normalizeCatalogFuelType("mild hybrid") === "MHEV");
check("fuel PHEV → PHEV", normalizeCatalogFuelType("plug-in hybrid") === "PHEV");

{
  const r = understandRequest("2017 Golf 7 1.6 TDI sağ motor kulağı");
  check("understandRequest engine on catalogEnrichment", r.catalogEnrichment?.engine?.powerKw === 85);
  check(
    "understandRequest does not put engine on subject name",
    !includesCI(r.requestSubject.name?.value, "EA288"),
    String(r.requestSubject.name?.value),
  );
  check(
    "understandRequest does not invent fuel overwrite",
    r.attributes.fuel == null || r.attributes.fuel.provenance === "EXPLICIT",
    JSON.stringify(r.attributes.fuel),
  );
}

{
  let threw = false;
  try {
    understandRequest("Golf 7 9.9 TDI");
  } catch {
    threw = true;
  }
  check("unknown engine does not throw", !threw);
}

const oem = lookupAutomotiveOem("3G0858687A");
check("oem still unresolved", oem.status === "unresolved" && !oem.partId);
const compat = lookupAutomotiveCompatibility({ modelId: "model_volkswagen_golf" });
check("compatibility still ready_empty", compat.status === "ready_empty");

console.log("\n========== CATALOG ENGINES V2B ==========");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (errors.length) {
  for (const err of errors) console.log(`  - ${err}`);
}
console.log(`VERIFY CATALOG ENGINES V2B: ${fail === 0 ? "PASS" : "FAIL"}`);
process.exit(fail === 0 ? 0 : 1);
