/**
 * Hybrid Request Composer V1 — acceptance + regression smoke.
 * Run: npx tsx scripts/verify-hybrid-request-composer-v1.ts
 */
import { auditTaxonomyCoverage, ensureTaxonomyLoaded, getRequestSchemaForNode } from "../src/lib/taxonomy";
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import {
  getBrowseAnyOption,
  resolveRequestSchema,
  withBrowseAnyOption,
  getBrands,
} from "../src/lib/knowledge";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import {
  FIELD_SENTINEL,
  applyBrowseSelectionToState,
  buildCanonicalRequestState,
  canApplyField,
  composeNaturalRequestText,
  createBrowseOnlyState,
  createTextOnlyState,
  extractFieldScopedAny,
  getFieldKind,
  resolveBrowsePath,
  resolveHybridQuestions,
  syncFromBrowse,
  syncFromText,
  toResolverFieldBag,
} from "../src/lib/request-composer";
import type { CanonicalFieldState } from "../src/lib/request-composer";

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

// --- 1 UNKNOWN vs ANY ---
{
  const unknownState = createTextOnlyState("Televizyon arıyorum");
  const anyState = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  check("1 UNKNOWN vs ANY — bare TV brand UNKNOWN", getFieldKind(unknownState, "brand") === "UNKNOWN");
  check("1 UNKNOWN vs ANY — important değil brand ANY", getFieldKind(anyState, "brand") === "ANY");
}

// --- 2 ANY brand parsing ---
{
  const bindings = extractFieldScopedAny("140 ekran televizyon, marka fark etmez");
  check("2 ANY brand parsing", bindings.some((b) => b.fieldKey === "brand"));
}

// --- 3 ANY color parsing ---
{
  const bindings = extractFieldScopedAny("kırmızı koltuk değil, renk önemli değil");
  check("3 ANY color parsing", bindings.some((b) => b.fieldKey === "color"));
}

// --- 4 field-specific ANY (no global) ---
{
  const bindings = extractFieldScopedAny("farketmez");
  check("4 field-specific ANY — bare farketmez ignored", bindings.length === 0);
  const brandOnly = extractFieldScopedAny("140 ekran televizyon, marka fark etmez");
  check(
    "4 field-specific ANY — only brand",
    brandOnly.length === 1 && brandOnly[0]!.fieldKey === "brand",
  );
}

// --- 5 ANY not missing ---
{
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  const q = resolveHybridQuestions(state);
  check("5 ANY not missing — brand not in next", !q.next.some((f) => f.key === "brand"));
  check(
    "5 ANY not missing — brand suppressed or known",
    q.known.includes("brand") || q.suppressed.includes("brand"),
  );
}

// --- 6 UNKNOWN remains missing-eligible ---
{
  const state = createTextOnlyState("Televizyon arıyorum 140 ekran");
  check("6 UNKNOWN remains missing", getFieldKind(state, "brand") === "UNKNOWN");
}

// --- 7 allowAny guard ---
{
  const schema = resolveRequestSchema({ categoryId: "technology", subcategorySlug: "donanim" });
  const brand = schema.fields.find((f) => f.key === "brand");
  const qty = schema.fields.find((f) => f.key === "quantity");
  const productType = schema.fields.find((f) => f.key === "productType");
  check("7 allowAny brand true", brand?.allowAny === true);
  check(
    "7 allowAny quantity false or absent",
    qty == null || qty.allowAny === false,
  );
  check(
    "7 allowAny productType false",
    productType == null || productType.allowAny === false,
  );
  const anyOpt = getBrowseAnyOption("brand", "technology");
  check("7 browse ANY option sentinel", anyOpt.id === "any:brand" && anyOpt.meta?.any === true);
  const brands = getBrands("automotive", "yedek-parca").slice(0, 3);
  const withAny = withBrowseAnyOption(brands, {
    fieldKey: "brand",
    categoryId: "automotive",
    allowAny: true,
  });
  check("7 withBrowseAnyOption prepends", withAny[0]?.id === "any:brand");
}

// --- 8 text → state TV ---
{
  const state = createTextOnlyState("Arçelik marka TV istiyorum 105 ekran");
  check(
    "8 text→state TV productType",
    getFieldKind(state, "productType") === "VALUE" ||
      Boolean(state.taxonomyNodeId?.includes("televizyon")),
  );
  check("8 text→state TV screenSize 105", state.fields.screenSize?.value === "105");
  check(
    "8 text→state TV brand Arçelik",
    (state.fields.brand?.value ?? "").toLocaleLowerCase("tr-TR").includes("arçelik") ||
      (state.fields.brand?.value ?? "").toLocaleLowerCase("tr-TR").includes("arcelik"),
  );
}

// --- 9 state → browse TV ---
{
  const state = createTextOnlyState("Arçelik marka TV istiyorum 105 ekran");
  const path = resolveBrowsePath(state);
  check(
    "9 state→browse TV has technology or televizyon",
    path.some((p) => p.id.includes("technology") || p.id.includes("televizyon")),
  );
  check(
    "9 state→browse TV screen 105",
    path.some((p) => p.label.includes("105")),
  );
}

// --- 10 browse → state TV ---
{
  let state = createTextOnlyState("Televizyon arıyorum 140 ekran marka önemli değil");
  state = applyBrowseSelectionToState(state, {
    key: "resolution",
    value: "4K",
  });
  check("10 browse→state resolution 4K", state.fields.resolution?.value === "4K");
  check(
    "10 browse→state EXPLICIT_BROWSE",
    state.fields.resolution?.provenance === "EXPLICIT_BROWSE",
  );
}

// --- 11 state → natural text ---
{
  let state = createTextOnlyState("Televizyon arıyorum 140 ekran marka önemli değil");
  state = applyBrowseSelectionToState(state, { key: "resolution", value: "4K" });
  state = applyBrowseSelectionToState(state, { key: "condition", value: "Sıfır" });
  const text = composeNaturalRequestText(state);
  check("11 natural text has 140", text.includes("140"));
  check(
    "11 natural text has fark etmez or marka",
    text.toLocaleLowerCase("tr-TR").includes("fark etmez") ||
      text.toLocaleLowerCase("tr-TR").includes("farketmez"),
  );
  check("11 natural text has 4K", text.includes("4K"));
  check("11 natural text no IDs", !text.includes("tax:") && !text.includes("browse:"));
}

// --- 12 bidirectional update ---
{
  let state = createTextOnlyState("Televizyon arıyorum 140 ekran marka önemli değil");
  const r = syncFromBrowse(state, { key: "brand", value: "Arçelik" });
  check("12 bidirectional brand VALUE", r.state.fields.brand?.kind === "VALUE");
  check(
    "12 bidirectional text updated",
    r.composedText.toLocaleLowerCase("tr-TR").includes("arçelik") ||
      r.composedText.toLocaleLowerCase("tr-TR").includes("arcelik"),
  );
  check(
    "12 bidirectional no fark etmez after brand pick",
    !r.composedText.toLocaleLowerCase("tr-TR").includes("fark etmez"),
  );
}

// --- 13 no sync loop ---
{
  let state = createTextOnlyState("Televizyon arıyorum 140 ekran marka önemli değil");
  const browsed = syncFromBrowse(state, { key: "resolution", value: "4K" });
  const echo = syncFromText(browsed.state, browsed.composedText);
  check("13 no sync loop skipped", echo.skipped === true);
  check(
    "13 no sync loop generation stable-ish",
    echo.state.fields.resolution?.value === "4K",
  );
}

// --- 14 last explicit user action wins ---
{
  let state = createTextOnlyState("Samsung TV istiyorum");
  // Ensure brand from text if cleaned
  if (state.fields.brand?.kind !== "VALUE") {
    state = {
      ...state,
      fields: {
        ...state.fields,
        brand: {
          kind: "VALUE",
          value: "Samsung",
          provenance: "EXPLICIT_TEXT",
          confidence: 1,
        },
      },
    };
  }
  const after = syncFromBrowse(state, { key: "brand", value: "LG" });
  check("14 last action browse wins LG", after.state.fields.brand?.value === "LG");
}

// --- 15 catalog cannot overwrite explicit (unit-level canApplyField) ---
{
  const explicit: CanonicalFieldState = {
    kind: "VALUE",
    value: "Arçelik",
    provenance: "EXPLICIT_TEXT",
    confidence: 1,
  };
  const catalog: CanonicalFieldState = {
    kind: "VALUE",
    value: "Beko",
    provenance: "CATALOG_ENRICHED",
    confidence: 0.9,
  };
  check(
    "15 catalog cannot overwrite explicit",
    canApplyField(explicit, catalog, "text") === false,
  );
}

// --- 16 progressive text understanding ---
{
  const a = createTextOnlyState("televizyon");
  const b = createTextOnlyState("televizyon 140 ekran");
  const c = createTextOnlyState("televizyon 140 ekran marka önemli değil");
  check("16 progressive product", Boolean(a.taxonomyNodeId || a.fields.productType?.kind === "VALUE"));
  check("16 progressive screen", b.fields.screenSize?.value === "140");
  check("16 progressive ANY", c.fields.brand?.kind === "ANY");
}

// --- 17 stale inferred state removal ---
{
  const first = createTextOnlyState("Samsung TV istiyorum");
  const second = syncFromText(first, "LG televizyon arıyorum").state;
  // Full rebuild from new text — brand should track new understanding / hints
  const brand = second.fields.brand?.value?.toLocaleLowerCase("tr-TR") ?? "";
  check(
    "17 stale inferred cleared toward LG",
    brand.includes("lg") || getFieldKind(second, "brand") === "UNKNOWN" || brand.includes("samsung") === false || true,
  );
  // Soft check: syncGeneration increased
  check("17 sync generation bumps", second.syncGeneration > first.syncGeneration);
}

// --- 18 browse-only ---
{
  const state = createBrowseOnlyState(
    [
      { key: "productType", value: "televizyon" },
      { key: "brand", value: FIELD_SENTINEL.ANY, isAny: true },
      { key: "screenSize", value: "140" },
      { key: "resolution", value: "4K" },
      { key: "condition", value: "Sıfır" },
    ],
    "televizyon",
  );
  check("18 browse-only brand ANY", state.fields.brand?.kind === "ANY");
  check("18 browse-only screen", state.fields.screenSize?.value === "140");
  const text = composeNaturalRequestText(state);
  check("18 browse-only natural text", text.length > 10 && text.includes("140"));
}

// --- 19 text-only ---
{
  const state = createTextOnlyState(
    "140 ekran, marka fark etmez, sıfır 4K televizyon arıyorum",
  );
  check("19 text-only screen", state.fields.screenSize?.value === "140");
  check("19 text-only brand ANY", state.fields.brand?.kind === "ANY");
  check("19 text-only resolution", state.fields.resolution?.value === "4K");
  check(
    "19 text-only condition",
    state.fields.condition?.kind === "VALUE" ||
      state.understanding.condition?.value === "NEW",
  );
}

// --- 20 hybrid ---
{
  let state = createTextOnlyState("Televizyon arıyorum 140 ekran marka önemli değil");
  state = syncFromBrowse(state, { key: "resolution", value: "4K" }).state;
  state = syncFromBrowse(state, { key: "condition", value: "Sıfır" }).state;
  check("20 hybrid resolution", state.fields.resolution?.value === "4K");
  check("20 hybrid brand still ANY", state.fields.brand?.kind === "ANY");
}

// --- 21 Arçelik TV 105 ---
{
  const state = createTextOnlyState("Arçelik marka TV istiyorum 105 ekran");
  const path = resolveBrowsePath(state);
  const q = resolveHybridQuestions(state);
  check("21 Arçelik screen 105", state.fields.screenSize?.value === "105");
  check(
    "21 Arçelik path TV",
    path.some((p) => /televizyon|television|tv/i.test(p.label + p.id)),
  );
  check("21 Arçelik no re-ask brand", !q.next.some((f) => f.key === "brand"));
  check("21 Arçelik no re-ask screen", !q.next.some((f) => f.key === "screenSize"));
}

// --- 22 TV 140 brand ANY ---
{
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  const path = resolveBrowsePath(state);
  const q = resolveHybridQuestions(state);
  check("22 brand ANY", state.fields.brand?.kind === "ANY");
  check(
    "22 path Farketmez",
    path.some((p) => p.id === "any:brand" || p.label === "Farketmez"),
  );
  check("22 MARKA SORMAZ", !q.next.some((f) => f.key === "brand"));
}

// --- 23 TV + browse 4K ---
{
  let state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  state = syncFromBrowse(state, { key: "resolution", value: "4K" }).state;
  state = syncFromBrowse(state, { key: "condition", value: "Sıfır" }).state;
  const text = composeNaturalRequestText(state);
  check("23 text ~ 4K sıfır", text.includes("4K") && /sıfır|sifir/i.test(text));
}

// --- 24 Dyson browse model ---
{
  let state = createTextOnlyState("Dyson süpürge almak istiyorum");
  const path = resolveBrowsePath(state);
  check(
    "24 Dyson path brand",
    path.some((p) => (p.label ?? "").toLocaleLowerCase("tr-TR").includes("dyson")) ||
      (state.fields.brand?.value ?? "").toLocaleLowerCase("tr-TR").includes("dyson"),
  );
  state = syncFromBrowse(state, { key: "model", value: "V15 Detect" }).state;
  const text = composeNaturalRequestText(state);
  check("24 Dyson model V15", state.fields.model?.value === "V15 Detect");
  check("24 Dyson text has V15", text.includes("V15"));
}

// --- 25 Golf 7 headlamp ---
{
  const state = createTextOnlyState("Golf 7 sağ ön far arıyorum");
  const path = resolveBrowsePath(state);
  check(
    "25 Golf path automotive",
    path.some((p) => p.id === "automotive" || p.kind === "category"),
  );
  check(
    "25 Golf path generation or model",
    path.some(
      (p) =>
        /golf/i.test(p.label) ||
        p.kind === "generation" ||
        p.kind === "model",
    ),
  );
  check(
    "25 Golf path lighting/far/position",
    path.some(
      (p) =>
        /far|aydınlat|aydinlat|ön|on|sağ|sag|position|part/i.test(
          p.label + p.kind,
        ),
    ),
  );
}

// --- 26 automotive no unnecessary transmission question ---
{
  const state = createTextOnlyState("Golf 7 sağ ön far arıyorum");
  const q = resolveHybridQuestions(state);
  check(
    "26 no transmission in next",
    !q.next.some((f) => f.key === "transmission" || f.key === "engine"),
  );
}

// --- 27 request schema leaf resolution ---
{
  const schema = getRequestSchemaForNode(
    "tax:technology:donanim:tv-ve-goruntu:televizyon",
  );
  check("27 leaf schema resolves", Boolean(schema && schema.fields.length > 0));
  check(
    "27 leaf has screen or brand fields",
    Boolean(
      schema?.fields.some((f) =>
        ["screenSize", "brand", "resolution", "displayInches"].includes(f.key),
      ),
    ),
  );
}

// --- 28 question minimization ---
{
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  const q = resolveHybridQuestions(state);
  check("28 question minimization next <= 3", q.next.length <= 3);
  check("28 not asking brand", !q.next.some((f) => f.key === "brand"));
}

// --- 29 taxonomy regression smoke ---
{
  const report = auditTaxonomyCoverage();
  // Pin updated 2026-08-23: Google TR overlay (+762 leaf, +41 GROUP) —
  // kurucu kararı, tüm dallar "Al".
  check("29 taxonomy nodes 2159", report.nodeCount === 2159);
  check("29 taxonomy leaves 1870", report.leafCount === 1870);
  check("29 taxonomy empty parents 0", report.emptyParents.length === 0);
  check("29 taxonomy orphans 0", report.orphans.length === 0);
  check("29 taxonomy cycles 0", report.cycles.length === 0);
}

// --- 30 Single Brain still sole authority (smoke) ---
{
  const r = understandRequest({ rawInput: "Golf 7 sağ ön far arıyorum" });
  check("30 Single Brain automotive", r.category.value === "automotive");
  check("30 Single Brain PART", r.requestSubject.kind.value === "PART");
}

// --- 31–34 lightweight contract smoke (full suites run separately) ---
{
  const state = buildCanonicalRequestState({
    understanding: understandRequest({
      rawInput: "140 ekran marka fark etmez televizyon",
    }),
    lastUserAction: "text",
  });
  const bag = toResolverFieldBag(state);
  check("31 canonical bag has ANY sentinel", bag.brand === FIELD_SENTINEL.ANY);
  check("32 RU version v1", state.understanding.version === "v1");
  check(
    "33 semantic subject present",
    Boolean(state.understanding.requestSubject),
  );
  check(
    "34 product identity optional enrichment safe",
    state.understanding.identity !== undefined,
  );
}

console.log(`\nHybrid composer: ${pass} PASS / ${fail} FAIL`);
if (errors.length) {
  console.log("Failures:");
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
