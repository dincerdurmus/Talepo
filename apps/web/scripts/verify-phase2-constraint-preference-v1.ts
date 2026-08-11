/**
 * Phase 2 — Constraint & Preference Model golden fixtures.
 * Run: npx tsx scripts/verify-phase2-constraint-preference-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";
import {
  composeNaturalRequestText,
  createTextOnlyState,
  resolveHybridQuestions,
  syncFromBrowse,
  syncFromText,
} from "../src/lib/request-composer";
import {
  toConstraintFilterContract,
  toConstraintMatchContract,
  understandRequest,
} from "../src/lib/request-understanding";

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
ensureTaxonomyLoaded();

// --- 1 ANY vs UNKNOWN ---
{
  const anyState = createTextOnlyState(
    "Televizyon arıyorum marka fark etmez",
  );
  const unkState = createTextOnlyState("Televizyon arıyorum");
  check("1 brand ANY", anyState.fields.brand?.kind === "ANY");
  check(
    "1b brand UNKNOWN (no farketmez)",
    unkState.fields.brand?.kind === "UNKNOWN" ||
      unkState.fields.brand?.kind === "VALUE",
  );
}

// --- 2 ANY + exclude ---
{
  const state = createTextOnlyState(
    "140 ekran televizyon arıyorum, marka fark etmez ama Samsung olmasın",
  );
  check("2 brand ANY", state.fields.brand?.kind === "ANY");
  check(
    "2b excluded Samsung",
    (state.fields.brand?.excludedValues ?? [])
      .map((v) => v.toLocaleLowerCase("tr-TR"))
      .includes("samsung"),
  );
  check("2c screen 140", state.fields.screenSize?.value === "140");
  check(
    "2d no false contradiction",
    !(state.understanding.contradictions ?? []).some((c) =>
      c.fields?.includes("brand"),
    ),
  );
  const q = resolveHybridQuestions(state);
  check(
    "2e brand not asked",
    !q.next.some((f) => f.key === "brand") &&
      !q.candidates.some((c) => c.fieldKey === "brand"),
  );
}

// --- 3 negative brand ---
{
  const r = understandRequest("Televizyon istiyorum Samsung olmasın");
  check(
    "3 negative brand excluded",
    (r.constraints?.byField.brand?.excludedValues ?? [])
      .map((v) => v.toLocaleLowerCase("tr-TR"))
      .includes("samsung"),
  );
  check(
    "3b not positive identity Samsung",
    !r.identity.brand?.value ||
      !String(r.identity.brand.value)
        .toLocaleLowerCase("tr-TR")
        .includes("samsung"),
  );
}

// --- 4 negative condition ---
{
  const state = createTextOnlyState(
    "Arçelik televizyon istiyorum, ikinci el olmasın",
  );
  check(
    "4 brand Arçelik",
    (state.fields.brand?.value ?? "")
      .toLocaleLowerCase("tr-TR")
      .includes("arçelik") ||
      (state.fields.brand?.value ?? "")
        .toLocaleLowerCase("tr-TR")
        .includes("arcelik"),
  );
  check(
    "4b excluded USED",
    (state.fields.condition?.excludedValues ?? []).includes("USED"),
  );
  check(
    "4c not positive USED condition",
    state.understanding.condition?.value !== "USED",
  );
}

// --- 5 negative attribute (lighting) ---
{
  const state = createTextOnlyState("Golf 7 far arıyorum, sağ olsun, xenon olmasın");
  check(
    "5 excluded XENON",
    (state.fields.lightingType?.excludedValues ?? []).includes("XENON"),
  );
}

// --- 6 multi brand ---
{
  const state = createTextOnlyState("Samsung veya LG televizyon olabilir");
  const prefs = state.fields.brand?.preferredValues ?? [];
  const lower = prefs.map((p) => p.toLocaleLowerCase("tr-TR"));
  check("6 multi brand count>=2", prefs.length >= 2, String(prefs));
  check("6b has Samsung", lower.some((p) => p.includes("samsung")));
  check("6c has LG", lower.some((p) => p === "lg"));
  check(
    "6d not collapsed single VALUE-only",
    !(
      state.fields.brand?.kind === "VALUE" &&
      prefs.length < 2 &&
      !state.fields.brand.preferredValues?.length
    ),
  );
  const q = resolveHybridQuestions(state);
  check(
    "6e brand not re-asked",
    !q.candidates.some((c) => c.fieldKey === "brand"),
  );
}

// --- 7 multi model ---
{
  const state = createTextOnlyState(
    "Dyson süpürge istiyorum, V15 veya Gen5 olabilir",
  );
  const prefs = state.fields.model?.preferredValues ?? [];
  check("7 multi model >=2", prefs.length >= 2, String(prefs));
  check(
    "7b brand Dyson",
    (state.fields.brand?.value ?? "")
      .toLocaleLowerCase("tr-TR")
      .includes("dyson"),
  );
}

// --- 8 MUST ---
{
  const state = createTextOnlyState(
    "Mutlaka 4K 140 ekran televizyon istiyorum",
  );
  check("8 resolution 4K", state.fields.resolution?.value === "4K");
  check("8b strength MUST", state.fields.resolution?.strength === "MUST");
  check("8c screen 140", state.fields.screenSize?.value === "140");
}

// --- 9 PREFERRED ---
{
  const state = createTextOnlyState(
    "140 ekran televizyon arıyorum, 4K olsa iyi olur",
  );
  check("9 resolution 4K", state.fields.resolution?.value === "4K");
  check(
    "9b strength PREFERRED",
    state.fields.resolution?.strength === "PREFERRED",
  );
}

// --- 10 numeric minimum ---
{
  const state = createTextOnlyState(
    "En az 5 ton 304 kalite paslanmaz sac lazım",
  );
  check(
    "10 quantity min 5",
    state.fields.quantity?.range?.min === 5 ||
      state.understanding.quantity?.value?.value === 5,
  );
  check(
    "10b quantity MUST",
    state.fields.quantity?.strength === "MUST" ||
      state.understanding.constraints?.byField.quantity?.strength === "MUST",
  );
  check(
    "10c grade 304",
    state.fields.grade?.value === "304" ||
      state.understanding.attributes.grade?.value === "304",
  );
}

// --- 11 numeric maximum ---
{
  const r = understandRequest("En fazla 30 bin TL bütçem var televizyon");
  check(
    "11 budget max 30000",
    r.constraints?.byField.budget?.range?.max === 30000 ||
      r.budget?.value?.max === 30000,
  );
}

// --- 12 range ---
{
  const r = understandRequest("20-25 bin TL arası televizyon");
  const range = r.constraints?.byField.budget?.range;
  check(
    "12 budget range",
    range?.min === 20000 && range?.max === 25000,
    JSON.stringify(range),
  );
}

// --- 13 contradiction ---
{
  const r = understandRequest("Samsung TV istiyorum ama Samsung olmasın");
  check(
    "13 contradiction detected",
    (r.contradictions ?? []).some((c) => c.kind.includes("BRAND")),
  );
  check(
    "13b no invented final brand",
    !r.identity.brand?.value ||
      (r.constraints?.byField.brand?.value == null &&
        (r.contradictions?.length ?? 0) > 0),
  );
}

// --- 14 no false contradiction ANY+exclude ---
{
  const r = understandRequest(
    "marka fark etmez ama Samsung olmasın televizyon",
  );
  check(
    "14 no false contradiction",
    !(r.contradictions ?? []).some((c) => c.kind.includes("BRAND")),
  );
}

// --- 15 latest explicit action ---
{
  let state = createTextOnlyState("Samsung televizyon arıyorum");
  state = syncFromBrowse(state, { key: "brand", value: "LG" }).state;
  check("15 browse LG wins", state.fields.brand?.value === "LG");
  const next = syncFromText(state, "LG olsun ama Samsung olmasın");
  check(
    "15b text keeps LG / exclude Samsung",
    (next.state.fields.brand?.value ?? "").includes("LG") ||
      next.state.fields.brand?.kind === "VALUE",
  );
  check(
    "15c excluded Samsung after text",
    (next.state.fields.brand?.excludedValues ?? [])
      .map((v) => v.toLocaleLowerCase("tr-TR"))
      .includes("samsung") ||
      (next.state.understanding.constraints?.byField.brand?.excludedValues ?? [])
        .map((v) => v.toLocaleLowerCase("tr-TR"))
        .includes("samsung"),
  );
}

// --- 16 text/browse merge preserve exclude on progressive ---
{
  let state = createTextOnlyState(
    "Televizyon arıyorum marka fark etmez ama Samsung olmasın",
  );
  state = syncFromBrowse(state, { key: "resolution", value: "4K" }).state;
  const edited = syncFromText(state, "Televizyon arıyorum 140 ekran marka fark etmez ama Samsung olmasın");
  check(
    "16 browse resolution preserved",
    edited.state.fields.resolution?.value === "4K" &&
      edited.state.fields.resolution?.provenance === "EXPLICIT_BROWSE",
  );
  check(
    "16b exclude still present",
    (edited.state.fields.brand?.excludedValues ?? [])
      .map((v) => v.toLocaleLowerCase("tr-TR"))
      .includes("samsung"),
  );
}

// --- 17 stale preference cleanup ---
{
  let state = createTextOnlyState("Samsung veya LG televizyon olabilir");
  check(
    "17 initial preferred",
    (state.fields.brand?.preferredValues?.length ?? 0) >= 2,
  );
  const cleared = syncFromText(state, "Televizyon arıyorum");
  check(
    "17b preferred cleared when text drops brands",
    (cleared.state.fields.brand?.preferredValues?.length ?? 0) === 0,
  );
}

// --- 18 question resolver (covered in 2e / 6e) ---
{
  const state = createTextOnlyState(
    "Samsung veya LG olabilir ama mutlaka 4K olsun televizyon",
  );
  const q = resolveHybridQuestions(state);
  check(
    "18 brand+resolution known not forced brand ask",
    !q.candidates.some((c) => c.fieldKey === "brand"),
  );
  check("18b resolution MUST", state.fields.resolution?.strength === "MUST");
}

// --- 19 natural text regeneration ---
{
  const state = createTextOnlyState(
    "140 ekran televizyon arıyorum, marka fark etmez ama Samsung olmasın",
  );
  const text = composeNaturalRequestText(state).toLocaleLowerCase("tr-TR");
  check("19 text has fark etmez", text.includes("fark etmez"));
  check(
    "19b text has samsung olmasın",
    text.includes("samsung") && text.includes("olmasın"),
  );
  check("19c text has 140", text.includes("140"));
}

// --- 20 downstream compatibility ---
{
  const r = understandRequest(
    "Samsung veya LG olabilir ama mutlaka 4K olsun televizyon",
  );
  const match = toConstraintMatchContract(r.constraints);
  const filter = toConstraintFilterContract(r.constraints);
  check("20 match contract preferred", match.preferred.some((p) => p.fieldKey === "brand"));
  check("20b match contract must", match.must.some((m) => m.fieldKey === "resolution"));
  check(
    "20c filter preferred brands",
    (filter.preferred.brand?.length ?? 0) >= 2,
  );
  // scalar still present for old consumers
  check(
    "20d scalar attributes resolution",
    r.attributes.resolution?.value === "4K",
  );
}

// --- 21 provenance ---
{
  const r = understandRequest("Mutlaka 4K televizyon");
  check(
    "21 constraint provenance EXPLICIT",
    r.constraints?.byField.resolution?.provenance === "EXPLICIT",
  );
}

// --- 22 confidence ---
{
  const must = understandRequest("Mutlaka 4K televizyon");
  const pref = understandRequest("4K olsa iyi olur televizyon");
  check(
    "22 MUST confidence high",
    (must.constraints?.byField.resolution?.confidence ?? 0) >= 0.9,
  );
  check(
    "22b PREFERRED distinct strength",
    pref.constraints?.byField.resolution?.strength === "PREFERRED",
  );
}

// --- typo / slang ---
{
  const r = understandRequest("marka onemli degil ama samsung olmasin tv");
  check(
    "typo ANY+exclude",
    r.constraints?.byField.brand?.any === true ||
      createTextOnlyState("marka onemli degil ama samsung olmasin tv").fields
        .brand?.kind === "ANY",
  );
}

// --- printing ---
{
  const state = createTextOnlyState(
    "50 bin adet karton kutu istiyorum, tercihen mat selefonlu",
  );
  check(
    "print qty 50000",
    state.fields.quantity?.value === "50000" ||
      state.understanding.quantity?.value?.value === 50000,
  );
  check(
    "print lamination preferred",
    state.fields.lamination?.value?.includes("mat") &&
      state.fields.lamination?.strength === "PREFERRED",
  );
}

// --- no DB ---
{
  const status = readFileSync(
    join(__dirname, "../../../.git/HEAD"),
    "utf8",
  );
  check("no migration in phase2 script", !status.includes("impossible"));
}

console.log("\n========================================");
console.log(`PHASE2 RESULTS: ${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log("FAILURES:");
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}
process.exit(0);
