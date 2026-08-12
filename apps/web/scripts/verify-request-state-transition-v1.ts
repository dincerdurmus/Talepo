/**
 * Sequential same-instance composer transitions.
 * Isolated createTextOnlyState(text) fixtures cannot catch browse/category pin leak.
 *
 * Run: npx tsx scripts/verify-request-state-transition-v1.ts
 */
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";
import {
  applyBrowseSelectionToState,
  browseWalkFromPath,
  buildUnderstoodFacts,
  composeNaturalRequestText,
  createBrowseOnlyState,
  createTextOnlyState,
  pinBrowseSemanticContext,
  resolveBrowsePath,
  resolveHybridQuestions,
  shouldSkipTextWalkRealign,
  stripIncompatibleDomainFields,
  syncFromBrowse,
  syncFromText,
  type CanonicalRequestState,
} from "../src/lib/request-composer";

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

function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

function includesFold(hay: string, needle: string): boolean {
  return fold(hay).includes(fold(needle));
}

function pathLabels(state: CanonicalRequestState): string[] {
  return resolveBrowsePath(state).map((s) => s.label);
}

function walkLabels(state: CanonicalRequestState): string[] {
  return browseWalkFromPath(resolveBrowsePath(state)).stack.map((n) => n.label);
}

function factKeys(state: CanonicalRequestState): string[] {
  return buildUnderstoodFacts(state).map((f) => f.key);
}

function factBlob(state: CanonicalRequestState): string {
  return buildUnderstoodFacts(state)
    .map((f) => `${f.label}:${f.displayValue}`)
    .join(" | ");
}

function questionKeys(state: CanonicalRequestState): string[] {
  const q = resolveHybridQuestions(state);
  return [
    ...q.candidates.map((c) => c.fieldKey),
    ...q.next.map((f) => f.key),
    ...q.missingRequired.map((f) => f.key),
  ];
}

function composed(state: CanonicalRequestState): string {
  return state.lastComposedText ?? composeNaturalRequestText(state);
}

function categoryOf(state: CanonicalRequestState): string | null {
  return state.categoryId ?? state.understanding.category.value ?? null;
}

function subjectName(state: CanonicalRequestState): string {
  return String(state.understanding.requestSubject.name?.value ?? "");
}

function hasAny(haystack: string[], needles: string[]): boolean {
  return needles.some((n) =>
    haystack.some((h) => includesFold(h, n)),
  );
}

function assertNoOldDomain(
  name: string,
  state: CanonicalRequestState,
  forbidden: string[],
) {
  const blob = [
    categoryOf(state) ?? "",
    subjectName(state),
    composed(state),
    factBlob(state),
    pathLabels(state).join(" "),
    walkLabels(state).join(" "),
    questionKeys(state).join(" "),
    String(state.fields.machineType?.value ?? ""),
    String(state.fields.propertyType?.value ?? ""),
    String(state.fields.part?.value ?? ""),
    String(state.taxonomyNodeId ?? ""),
  ].join(" | ");
  const hit = forbidden.find((f) => includesFold(blob, f));
  check(`${name} no leftover (${forbidden.join("/")})`, !hit, hit ? blob : undefined);
}

function assertPathHas(name: string, state: CanonicalRequestState, needles: string[]) {
  const labels = [...pathLabels(state), ...walkLabels(state)];
  const missing = needles.filter(
    (n) => !labels.some((l) => includesFold(l, n)),
  );
  check(`${name} path ${needles.join("→")}`, missing.length === 0, labels.join(" > "));
}

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();

// ---------------------------------------------------------------------------
// SEQUENCE 1 — same composer instance, full text replacements
// ---------------------------------------------------------------------------
{
  const steps: Array<{
    text: string;
    cat: string;
    path: string[];
    forbidden: string[];
  }> = [
    {
      text: "kesim makinesi arıyorum",
      cat: "machinery",
      path: ["Makine"],
      forbidden: ["bebek", "daire", "iphone", "golf"],
    },
    {
      text: "bebek arabası",
      cat: "baby",
      path: ["Bebek"],
      forbidden: ["Makine", "kesim", "daire", "Konut"],
    },
    {
      text: "bağcılarda 2+1 daire arıyorum",
      cat: "real-estate",
      path: ["Emlak"],
      forbidden: ["Makine", "kesim", "bebek arab", "iphone"],
    },
    {
      text: "iphone 15",
      cat: "technology",
      path: ["Teknoloji"],
      forbidden: ["Emlak", "daire", "Konut", "Makine", "bebek"],
    },
    {
      text: "golf 7 motor",
      cat: "automotive",
      path: ["Otomotiv"],
      forbidden: ["iphone", "Apple", "Teknoloji", "daire", "bebek"],
    },
    {
      text: "ofis koltuğu",
      cat: "furniture",
      path: ["Ofis"],
      forbidden: ["golf", "motor", "Otomotiv", "yedek", "iphone", "daire"],
    },
    {
      text: "e-ticaret sitesi arıyorum",
      cat: "technology",
      path: ["Web hizmetleri", "E-ticaret"],
      forbidden: ["konut", "daire", "Emlak", "koltuk", "Ofis"],
    },
  ];

  let state: CanonicalRequestState | null = null;
  let prevCat: string | null = null;
  for (const step of steps) {
    const result = syncFromText(state, step.text);
    state = result.state;
    const cat = categoryOf(state);
    check(
      `S1 "${step.text}" category=${step.cat}`,
      cat === step.cat,
      `got ${cat} authority=${result.authority} cleared=${result.clearedStaleBrowse}`,
    );
    if (prevCat && prevCat !== step.cat) {
      check(
        `S1 "${step.text}" cleared stale browse`,
        result.clearedStaleBrowse === true,
        `authority=${result.authority}`,
      );
      check(
        `S1 "${step.text}" not structured-locked to ${prevCat}`,
        !(state.understanding.category.evidence ?? []).some((e) =>
          includesFold(e, `categoryOverride=${prevCat}`),
        ),
        (state.understanding.category.evidence ?? []).join(","),
      );
    }
    check(
      `S1 "${step.text}" rawInput`,
      fold(state.understanding.rawInput) === fold(step.text),
    );
    assertPathHas(`S1 "${step.text}"`, state, step.path);
    assertNoOldDomain(`S1 "${step.text}"`, state, step.forbidden);
    check(
      `S1 "${step.text}" composed follows new request`,
      !includesFold(composed(state), "Kesim teknolojileri"),
      composed(state),
    );
    const q = questionKeys(state);
    if (step.cat !== "machinery") {
      check(
        `S1 "${step.text}" no machine questions`,
        !q.includes("machineType") && !q.includes("capacity"),
        q.join(","),
      );
    }
    if (step.cat !== "real-estate") {
      check(
        `S1 "${step.text}" no RE facts`,
        !factKeys(state).includes("propertyType") &&
          !factKeys(state).includes("listingType"),
        factBlob(state),
      );
    }
    if (step.cat !== "automotive") {
      check(
        `S1 "${step.text}" no auto part facts`,
        !factKeys(state).includes("part") &&
          !factKeys(state).includes("partSystem"),
        factBlob(state),
      );
    }
    if (includesFold(step.text, "e-ticaret")) {
      check(
        `S1 "${step.text}" compose not real-estate`,
        !includesFold(composed(state), "konut") &&
          !includesFold(composed(state), "daire") &&
          !includesFold(composed(state), "satılık"),
        composed(state),
      );
    }
    prevCat = step.cat;
  }

  check("S1 same instance generations", (state?.syncGeneration ?? 0) >= 5);
}

// ---------------------------------------------------------------------------
// SEQUENCE 2 — manual machinery browse, then replace textarea with iphone
// ---------------------------------------------------------------------------
{
  let state = createBrowseOnlyState([]);
  state = pinBrowseSemanticContext(state, {
    categoryId: "machinery",
    subcategorySlug: "kesim-makinesi",
  });
  state = applyBrowseSelectionToState(state, {
    key: "machineType",
    value: "Kesim Makinesi",
  });
  check("S2 browse pin machinery", categoryOf(state) === "machinery");
  check(
    "S2 browse needType machine",
    state.fields.needType?.value === "machine" &&
      state.fields.needType?.provenance === "EXPLICIT_BROWSE",
  );

  const result = syncFromText(state, "iphone 15");
  state = result.state;
  check(
    "S2 text replace clears machinery pin",
    result.clearedStaleBrowse === true,
    `authority=${result.authority}`,
  );
  check("S2 category technology", categoryOf(state) === "technology", categoryOf(state) ?? "");
  check(
    "S2 walk not machinery",
    !walkLabels(state).some((l) => includesFold(l, "Makine")) &&
      !pathLabels(state).some((l) => includesFold(l, "Makine")),
    walkLabels(state).join(" > "),
  );
  assertPathHas("S2 iphone", state, ["Teknoloji"]);
  check(
    "S2 no machineType",
    state.fields.machineType?.kind !== "VALUE",
    String(state.fields.machineType?.value),
  );
  check(
    "S2 composed not kesim",
    !includesFold(composed(state), "kesim") &&
      !includesFold(composed(state), "makine"),
    composed(state),
  );
}

// ---------------------------------------------------------------------------
// SEQUENCE 3 — manual RE browse, then ofis koltuğu
// ---------------------------------------------------------------------------
{
  let state = createBrowseOnlyState([]);
  state = pinBrowseSemanticContext(state, {
    categoryId: "real-estate",
    subcategorySlug: "konut",
  });
  state = applyBrowseSelectionToState(state, {
    key: "listingType",
    value: "Satılık",
  });
  state = applyBrowseSelectionToState(state, {
    key: "propertyType",
    value: "Daire",
  });
  check("S3 browse pin real-estate", categoryOf(state) === "real-estate");

  const result = syncFromText(state, "ofis koltuğu");
  state = result.state;
  check("S3 cleared stale RE", result.clearedStaleBrowse === true, result.authority);
  check("S3 furniture", categoryOf(state) === "furniture", categoryOf(state) ?? "");
  check(
    "S3 no propertyType",
    state.fields.propertyType?.kind !== "VALUE",
    String(state.fields.propertyType?.value),
  );
  check(
    "S3 no listingType",
    state.fields.listingType?.kind !== "VALUE",
    String(state.fields.listingType?.value),
  );
  assertPathHas("S3 ofis koltuğu", state, ["Ofis"]);
  check(
    "S3 composed not daire/emlak",
    !includesFold(composed(state), "daire") &&
      !includesFold(composed(state), "konut"),
    composed(state),
  );
}

// ---------------------------------------------------------------------------
// SEQUENCE 4 — manual auto PART browse, then bebek arabası
// ---------------------------------------------------------------------------
{
  let state = createBrowseOnlyState([]);
  state = pinBrowseSemanticContext(state, {
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
  });
  state = applyBrowseSelectionToState(state, { key: "brand", value: "Alfa Romeo" });
  state = applyBrowseSelectionToState(state, { key: "model", value: "156" });
  check("S4 browse pin automotive", categoryOf(state) === "automotive");
  check(
    "S4 PART pin",
    state.fields.needType?.value === "part" ||
      state.understanding.requestSubject.kind.value === "PART",
  );

  const result = syncFromText(state, "bebek arabası");
  state = result.state;
  check("S4 cleared PART pin", result.clearedStaleBrowse === true, result.authority);
  check("S4 baby", categoryOf(state) === "baby", categoryOf(state) ?? "");
  check(
    "S4 no Alfa/156/part",
    !includesFold(factBlob(state), "Alfa") &&
      !includesFold(composed(state), "156") &&
      state.fields.part?.kind !== "VALUE" &&
      state.fields.needType?.value !== "part",
    `${factBlob(state)} || ${composed(state)}`,
  );
  assertPathHas("S4 bebek arabası", state, ["Bebek"]);
}

// ---------------------------------------------------------------------------
// Same-domain enrichment must KEEP current browse (do not over-reset)
// ---------------------------------------------------------------------------
{
  let state = createTextOnlyState("Televizyon arıyorum");
  state = syncFromBrowse(state, { key: "brand", value: "Arçelik" }).state;
  const next = syncFromText(state, "Televizyon arıyorum 140 ekran");
  check(
    "enrich TV Arçelik preserved",
    next.state.fields.brand?.value === "Arçelik" &&
      next.state.fields.brand?.provenance === "EXPLICIT_BROWSE",
    String(next.state.fields.brand?.value),
  );
  check(
    "enrich TV not a stale-browse clear",
    next.clearedStaleBrowse !== true,
    next.authority,
  );
  check(
    "enrich TV screen from text",
    next.state.fields.screenSize?.value === "140",
  );
}

{
  let state = createBrowseOnlyState([]);
  state = pinBrowseSemanticContext(state, {
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
  });
  state = applyBrowseSelectionToState(state, { key: "brand", value: "Alfa Romeo" });
  state = applyBrowseSelectionToState(state, { key: "model", value: "156" });
  const next = syncFromText(state, "Alfa Romeo 156 tampon");
  check(
    "enrich PART pin survives brand+model+part text",
    next.clearedStaleBrowse !== true &&
      (next.state.fields.needType?.value === "part" ||
        next.state.understanding.requestSubject.kind.value === "PART"),
    `authority=${next.authority} need=${next.state.fields.needType?.value} kind=${next.state.understanding.requestSubject.kind.value}`,
  );
  check(
    "enrich PART still automotive",
    categoryOf(next.state) === "automotive",
    categoryOf(next.state) ?? "",
  );
}

// ---------------------------------------------------------------------------
// Walk realign: browse click skip must not survive a domain jump
// ---------------------------------------------------------------------------
{
  check(
    "skip realign same root",
    shouldSkipTextWalkRealign({
      skipOnce: true,
      walkCategoryId: "machinery",
      path: [{ id: "machinery", kind: "category", label: "Makine" }],
    }) === true,
  );
  check(
    "do not skip realign on domain jump",
    shouldSkipTextWalkRealign({
      skipOnce: true,
      walkCategoryId: "machinery",
      path: [{ id: "technology", kind: "category", label: "Teknoloji" }],
    }) === false,
  );
  check(
    "no skip flag → never skip",
    shouldSkipTextWalkRealign({
      skipOnce: false,
      walkCategoryId: "machinery",
      path: [{ id: "technology", kind: "category", label: "Teknoloji" }],
    }) === false,
  );
}

// ---------------------------------------------------------------------------
// Canonical coherence: mixed-domain fields cannot survive strip
// ---------------------------------------------------------------------------
{
  const mixed = stripIncompatibleDomainFields(
    {
      machineType: {
        kind: "VALUE",
        value: "Kesim Makinesi",
        provenance: "EXPLICIT_BROWSE",
      },
      propertyType: {
        kind: "VALUE",
        value: "daire",
        provenance: "EXPLICIT_TEXT",
      },
      city: {
        kind: "VALUE",
        value: "Bağcılar",
        provenance: "EXPLICIT_TEXT",
      },
    },
    "real-estate",
  );
  check(
    "strip drops machineType on RE",
    mixed.machineType?.kind !== "VALUE",
  );
  check(
    "strip keeps propertyType on RE",
    mixed.propertyType?.kind === "VALUE",
  );
  check("strip keeps global city", mixed.city?.kind === "VALUE");
}

{
  let state = createTextOnlyState("kesim makinesi arıyorum");
  state = {
    ...state,
    fields: {
      ...state.fields,
      propertyType: {
        kind: "VALUE",
        value: "daire",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
      },
    },
  };
  const facts = buildUnderstoodFacts(state);
  check(
    "facts hide RE property on machinery",
    !facts.some((f) => f.key === "propertyType"),
    facts.map((f) => f.key).join(","),
  );
}

console.log(`\nState transition: ${pass} PASS / ${fail} FAIL`);
if (errors.length) {
  console.log("Failures:");
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
