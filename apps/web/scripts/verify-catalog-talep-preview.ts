/**
 * Catalog facts on the real /talep understandRequest + preview mapper path.
 * Run: npx tsx scripts/verify-catalog-talep-preview.ts
 */
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { seedFieldValuesFromUnderstanding } from "../src/lib/request-understanding/activation-bridge";
import {
  composeSoughtPartLabel,
  toCanonicalCatalogFacts,
  toCatalogPreviewModel,
} from "../src/lib/catalog/consumer";

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

function previewText(raw: string) {
  const understanding = understandRequest(raw);
  const facts = toCanonicalCatalogFacts(understanding);
  const preview = toCatalogPreviewModel(understanding);
  const seeded = seedFieldValuesFromUnderstanding(understanding);
  return { understanding, facts, preview, seeded };
}

{
  const { facts, preview, seeded, understanding } = previewText(
    "2017 Volkswagen Golf 7 1.6 TDI sağ ön far arıyorum",
  );
  check("1 facts exist", Boolean(facts), "no canonical facts");
  check("1 brand VW", facts?.brand?.label === "Volkswagen", facts?.brand?.label);
  check("1 model Golf", facts?.model?.label === "Golf", facts?.model?.label);
  check("1 gen VII", facts?.generation?.label === "Golf VII", facts?.generation?.label);
  check("1 year 2017", facts?.modelYear === 2017, String(facts?.modelYear));
  check(
    "1 engine 1.6 TDI",
    includesCI(facts?.engine?.marketingName, "1.6 TDI"),
    facts?.engine?.marketingName,
  );
  check("1 no engineCode in facts", !("engineCode" in (facts?.engine ?? {})));
  check("1 part far", includesCI(facts?.part?.label, "far"), facts?.part?.label);
  check(
    "1 position sağ",
    includesCI(facts?.position?.label, "sağ"),
    facts?.position?.label,
  );
  check(
    "1 preview vehicle title",
    includesCI(preview?.vehicle?.title, "Volkswagen") &&
      includesCI(preview?.vehicle?.title, "Golf"),
    preview?.vehicle?.title,
  );
  check(
    "1 preview vehicle detail",
    includesCI(preview?.vehicle?.detail, "Golf VII") &&
      includesCI(preview?.vehicle?.detail, "2017") &&
      includesCI(preview?.vehicle?.detail, "1.6 TDI"),
    preview?.vehicle?.detail,
  );
  check(
    "1 preview part",
    includesCI(preview?.soughtPart?.title, "Far") &&
      includesCI(preview?.soughtPart?.title, "Sağ"),
    preview?.soughtPart?.title,
  );
  check("1 seed brand", seeded.brand === "Volkswagen", seeded.brand);
  check("1 seed generation", seeded.generation === "Golf VII", seeded.generation);
  check("1 seed engine", includesCI(seeded.engine, "1.6 TDI"), seeded.engine);
  check(
    "1 subject not generation",
    !includesCI(understanding.requestSubject.name?.value, "Golf VII"),
    String(understanding.requestSubject.name?.value),
  );
}

{
  const { facts, preview, seeded } = previewText("BMW E90 320d ön tampon lazım");
  check("2 brand BMW", facts?.brand?.label === "BMW", facts?.brand?.label);
  check("2 model 3 Serisi", facts?.model?.label === "3 Serisi", facts?.model?.label);
  check("2 gen E90", includesCI(facts?.generation?.label, "E90"), facts?.generation?.label);
  check("2 engine 320d", facts?.engine?.marketingName === "320d", facts?.engine?.marketingName);
  check("2 part tampon", includesCI(facts?.part?.label, "tampon"), facts?.part?.label);
  check(
    "2 preview vehicle",
    includesCI(preview?.vehicle?.title, "BMW") &&
      includesCI(preview?.vehicle?.title, "3 Serisi"),
    preview?.vehicle?.title,
  );
  check(
    "2 preview detail",
    includesCI(preview?.vehicle?.detail, "E90") &&
      includesCI(preview?.vehicle?.detail, "320d"),
    preview?.vehicle?.detail,
  );
  check(
    "2 preview part",
    includesCI(preview?.soughtPart?.title, "Tampon"),
    preview?.soughtPart?.title,
  );
  check("2 seed model", seeded.model === "3 Serisi", seeded.model);
}

{
  const { facts, preview, seeded } = previewText("Clio 4 0.9 TCe turbo hortumu");
  check("3 brand Renault", facts?.brand?.label === "Renault", facts?.brand?.label);
  check("3 model Clio", facts?.model?.label === "Clio", facts?.model?.label);
  check("3 gen IV", facts?.generation?.label === "Clio IV", facts?.generation?.label);
  check(
    "3 engine 0.9 TCe",
    includesCI(facts?.engine?.marketingName, "0.9 TCe"),
    facts?.engine?.marketingName,
  );
  check("3 part hortum", includesCI(facts?.part?.label, "hortum"), facts?.part?.label);
  check(
    "3 preview",
    includesCI(preview?.vehicle?.title, "Renault") &&
      includesCI(preview?.vehicle?.detail, "Clio IV") &&
      includesCI(preview?.vehicle?.detail, "0.9 TCe") &&
      includesCI(preview?.soughtPart?.title, "Hortum"),
    JSON.stringify(preview),
  );
  check("3 seed generation", seeded.generation === "Clio IV", seeded.generation);
}

{
  let threw = false;
  let facts;
  let preview;
  let understanding;
  try {
    const out = previewText("Golf 7 9.9 TDI sağ far");
    facts = out.facts;
    preview = out.preview;
    understanding = out.understanding;
  } catch {
    threw = true;
  }
  check("4 does not throw", !threw);
  check("4 still Golf", facts?.model?.label === "Golf", facts?.model?.label);
  check("4 still VII", facts?.generation?.label === "Golf VII", facts?.generation?.label);
  check(
    "4 engine not fabricated",
    !facts?.engine &&
      understanding?.catalogEnrichment?.engine?.status !== "resolved",
    JSON.stringify(understanding?.catalogEnrichment?.engine),
  );
  check(
    "4 preview has no 1.6/2.0 engine",
    !includesCI(preview?.vehicle?.detail, "1.6") &&
      !includesCI(preview?.vehicle?.detail, "2.0") &&
      !includesCI(preview?.vehicle?.detail, "EA288"),
    preview?.vehicle?.detail,
  );
  check(
    "4 far still usable",
    includesCI(facts?.part?.label, "far") ||
      includesCI(preview?.soughtPart?.title, "Far"),
    preview?.soughtPart?.title ?? facts?.part?.label,
  );
}

{
  const understanding = understandRequest({
    rawInput: "2017 Volkswagen Golf 7 1.6 TDI sağ ön far",
    structured: { fieldValues: { brand: "Seat" } },
  });
  const seeded = seedFieldValuesFromUnderstanding(understanding);
  const preview = toCatalogPreviewModel(understanding);
  check("explicit brand not overwritten", seeded.brand === "Seat", seeded.brand);
  check(
    "explicit brand in preview title",
    includesCI(preview?.vehicle?.title, "Seat") &&
      !includesCI(preview?.vehicle?.title, "Volkswagen"),
    preview?.vehicle?.title,
  );
}

{
  const { understanding } = previewText("XYZ Motors ABC900 sol amortisör");
  check("unknown does not throw", Boolean(understanding.rawInput));
  check(
    "unknown does not block publish readiness shape",
    understanding.publishReadiness?.status !== undefined,
    understanding.publishReadiness?.status,
  );
}

{
  const composed = composeSoughtPartLabel({
    part: { id: "p", label: "Ön far" },
    position: { id: "front_right", label: "ön sağ" },
  });
  check("compose Ön Sağ Far", composed === "Ön Sağ Far", composed);
}

console.log("\n========== CATALOG TALEP PREVIEW ==========");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (errors.length) {
  for (const err of errors) console.log(`  - ${err}`);
}
console.log(`VERIFY CATALOG TALEP PREVIEW: ${fail === 0 ? "PASS" : "FAIL"}`);
process.exit(fail === 0 ? 0 : 1);
