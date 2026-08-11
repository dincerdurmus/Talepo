/**
 * Automotive catalog enrichment verification.
 * Run: npx tsx scripts/verify-catalog-automotive.ts
 */
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { enrichAutomotiveSubject } from "../src/lib/catalog/automotive/enrich";
import { getAutomotiveIndexes } from "../src/lib/catalog/automotive/indexes";
import { lookupAutomotiveOem } from "../src/lib/catalog/automotive/oem";
import { lookupAutomotiveCompatibility } from "../src/lib/catalog/automotive/compatibility";
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog/automotive/provider";
import { getCatalogRegistry } from "../src/lib/catalog/registry";
import type { CatalogConfidence } from "../src/lib/catalog/types";

function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

function includesCI(hay: string | undefined, needle: string): boolean {
  if (!hay) return false;
  return fold(hay).includes(fold(needle));
}

const HIGHISH: CatalogConfidence[] = ["exact", "high"];

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
const registry = getCatalogRegistry();

check("registry has automotive", registry.has("automotive"));
check("brand index loaded", idx.brands.length >= 100);
check("model index loaded", idx.models.length >= 800);
check("part taxonomy indexed", idx.parts.length >= 100);
check("position index loaded", idx.positions.length >= 8);
check("alias phrases indexed", idx.partPhrases.some((p) => p.kind === "alias"));
check("generations loaded", idx.generations.length >= 100);
check("engines loaded", idx.engines.length >= 20);
check("oem dataset empty (intentional)", idx.oemCrossrefs.length === 0);
check("compatibility dataset empty (intentional)", idx.compatibility.length === 0);

// 1
{
  const raw = "2018 Volkswagen Golf sağ ön far";
  const r = understandRequest(raw);
  const e = r.catalogEnrichment;
  check(
    "1 brand Volkswagen",
    e?.brand?.name === "Volkswagen" && HIGHISH.includes(e.brand.confidence),
    `got ${e?.brand?.name}/${e?.brand?.confidence}`,
  );
  check(
    "1 model Golf",
    e?.model?.name === "Golf" && HIGHISH.includes(e.model.confidence),
    `got ${e?.model?.name}`,
  );
  check(
    "1 part Ön far",
    includesCI(e?.part?.name, "ön far"),
    `got ${e?.part?.name}`,
  );
  check(
    "1 position ön sağ",
    e?.position?.id === "front_right" || includesCI(e?.position?.name, "ön sağ"),
    `got ${e?.position?.id}/${e?.position?.name}`,
  );
  check(
    "1 confidence HIGH/EXACT",
    e?.confidence === "exact" || e?.confidence === "high",
    `got ${e?.confidence}`,
  );
  check("1 year 2018", e?.modelYear === 2018, `got ${e?.modelYear}`);
}

// 2
{
  const raw = "Golf 7 xenon beyni lazım";
  const e = enrichAutomotiveSubject({ rawText: raw, automotiveContext: true });
  const partOk =
    includesCI(e.part?.name, "far beyni") ||
    includesCI(e.part?.name, "xenon balast");
  check("2 model Golf", e.model?.name === "Golf", `got ${e.model?.name}`);
  check("2 part xenon/far beyni", partOk, `got ${e.part?.name}`);
  check(
    "2 generation Golf VII",
    e.generation?.status === "resolved" &&
      Boolean(e.generation.id) &&
      e.generation.name === "Golf VII",
    JSON.stringify(e.generation),
  );
  check("2 has confidence", Boolean(e.confidence), `got ${e.confidence}`);
}

// 3
{
  const e = enrichAutomotiveSubject({
    rawText: "Chery Tiggo 8 Pro Max stop lambası",
  });
  check("3 brand Chery", e.brand?.name === "Chery", `got ${e.brand?.name}`);
  check(
    "3 model Tiggo 8 Pro Max",
    e.model?.name === "Tiggo 8 Pro Max",
    `got ${e.model?.name}`,
  );
  check(
    "3 part Arka stop",
    includesCI(e.part?.name, "arka stop"),
    `got ${e.part?.name}`,
  );
}

// 4
{
  const e = enrichAutomotiveSubject({
    rawText: "Tofaş Şahin baskı balata",
  });
  check("4 brand Tofaş", e.brand?.name === "Tofaş", `got ${e.brand?.name}`);
  check("4 model Şahin", e.model?.name === "Şahin", `got ${e.model?.name}`);
  check(
    "4 part Debriyaj seti",
    includesCI(e.part?.name, "debriyaj seti"),
    `got ${e.part?.name}`,
  );
}

// 5
{
  let threw = false;
  let e;
  try {
    e = enrichAutomotiveSubject({
      rawText: "XYZ Motors ABC900 sol amortisör",
    });
  } catch {
    threw = true;
  }
  check("5 no throw", !threw);
  check("5 part Amortisör", includesCI(e?.part?.name, "amortisör"), `got ${e?.part?.name}`);
  check(
    "5 position Sol",
    e?.position?.id === "left" || includesCI(e?.position?.name, "sol"),
    `got ${e?.position?.id}`,
  );
  check(
    "5 brand unverified / absent",
    !e?.brand || e.brand.confidence === "unverified",
    `got ${e?.brand?.name}`,
  );
  check(
    "5 model unverified / absent",
    !e?.model || e.model.confidence === "unverified",
    `got ${e?.model?.name}`,
  );
}

// 6
{
  const oem = lookupAutomotiveOem("3G0858687A");
  const e = enrichAutomotiveSubject({ rawText: "3G0858687A" });
  check("6 oem unresolved", oem.status === "unresolved");
  check("6 oem not fabricated", !oem.partId && !oem.brandId);
  check(
    "6 enrichment oem unverified",
    e.oem?.status === "unresolved" && e.oem.confidence === "unverified",
    JSON.stringify(e.oem),
  );
}

const compat = lookupAutomotiveCompatibility({ modelId: "model_volkswagen_golf" });
check("compatibility ready_empty", compat.status === "ready_empty");

// Unknown fallback must not break understandRequest
{
  const r = understandRequest("XYZ Motors ABC900 sol amortisör");
  check("understandRequest unknown brand survives", Boolean(r.rawInput));
  check("understandRequest version intact", r.version === "v1");
}

console.log("\n========== CATALOG AUTOMOTIVE ==========");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
console.log(`VERIFY CATALOG AUTOMOTIVE: ${fail === 0 ? "PASS" : "FAIL"}`);
process.exit(fail === 0 ? 0 : 1);
