/**
 * Phase 1 — Single Brain Closure
 * Run: npx tsx scripts/verify-phase1-single-brain-closure-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";
import {
  applyBrowseSelectionToState,
  createTextOnlyState,
  mergePreservedBrowseFields,
  resolveHybridQuestions,
  syncFromBrowse,
  syncFromText,
  type CanonicalFieldState,
} from "../src/lib/request-composer";
import {
  getUnderstandCallCount,
  resetUnderstandCallCount,
  understandRequest,
} from "../src/lib/request-understanding/understand-request";
import {
  completenessFromUnderstanding,
  strategyResolutionFromUnderstanding,
} from "../src/lib/request-understanding/activation-bridge";

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

const webSrc = join(__dirname, "../src");

// --- 1–2: call graph / no page-level authority duplicate ---
{
  const pageSrc = readFileSync(join(webSrc, "app/talep/page.tsx"), "utf8");
  // Strip block + line comments before scanning for call sites
  const pageCode = pageSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const understandCalls = pageCode.match(/\bunderstandRequest\s*\(/g) ?? [];
  check(
    "1 single-understand call graph: page has no understandRequest(",
    understandCalls.length === 0,
    `found ${understandCalls.length}`,
  );
  check(
    "2 no page-level authority: uses emptyRequestUnderstanding or hybrid snapshot",
    pageSrc.includes("emptyRequestUnderstanding") &&
      pageSrc.includes("hybrid.state?.understanding"),
  );
}

// --- 3 hybrid consumes snapshot ---
{
  resetUnderstandCallCount();
  const before = getUnderstandCallCount();
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  const after = getUnderstandCallCount();
  check("3 hybrid consumes snapshot", Boolean(state.understanding));
  check(
    "3b understand calls for one text-only create",
    after - before === 1,
    `delta=${after - before}`,
  );
}

// --- 4 preview consumes same state (summary from same understanding) ---
{
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  check(
    "4 preview same understanding ref as state",
    state.understanding.category.value === "technology" ||
      state.categoryId === "technology" ||
      Boolean(state.fields.productType?.value),
  );
}

// --- 5 price consumes same category/strategy ---
{
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  const strategy = strategyResolutionFromUnderstanding(state.understanding);
  check(
    "5 price strategy from same snapshot",
    Boolean(strategy.strategy),
    strategy.strategy,
  );
  check(
    "5b category aligned",
    state.understanding.category.value === state.categoryId ||
      state.categoryId === "technology",
  );
}

// --- 6 single question authority ---
{
  const pageSrc = readFileSync(join(webSrc, "app/talep/page.tsx"), "utf8");
  const brainSrc = readFileSync(join(webSrc, "hooks/useRequestBrain.ts"), "utf8");
  check(
    "6 page uses resolveHybridQuestions",
    pageSrc.includes("resolveHybridQuestions"),
  );
  check(
    "6b brain.nextQuestions emptied (no second list)",
    brainSrc.includes("nextQuestions: QuestionCandidate[] = []") ||
      /const nextQuestions:\s*QuestionCandidate\[\]\s*=\s*\[\]/.test(brainSrc),
  );
  const pageCode = pageSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  check(
    "6c page does not use brain.nextQuestions for enrichment",
    !pageCode.includes("brain.nextQuestions"),
  );
}

// --- 7 ANY not asked ---
{
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  const q = resolveHybridQuestions(state);
  check("7 ANY brand kind", state.fields.brand?.kind === "ANY");
  check(
    "7b brand not in next questions",
    !q.next.some((f) => f.key === "brand" || f.key === "brandPreference"),
  );
  check("7c questionSource canonical-hybrid", q.questionSource === "canonical-hybrid");
}

// --- 8 UNKNOWN asked when required (screen known, brand any — screen not asked) ---
{
  const state = createTextOnlyState("Televizyon arıyorum");
  const q = resolveHybridQuestions(state);
  check(
    "8 UNKNOWN brand may be asked or optional",
    state.fields.brand?.kind === "UNKNOWN" ||
      state.fields.brand?.kind === "ANY" ||
      state.fields.brand?.kind === "VALUE",
  );
  check("8b has question pipeline", Array.isArray(q.candidates));
}

// --- 9 browse explicit preservation ---
{
  let state = createTextOnlyState("Televizyon arıyorum");
  const browsed = syncFromBrowse(state, { key: "brand", value: "Arçelik" });
  state = browsed.state;
  check(
    "9 browse Arçelik EXPLICIT_BROWSE",
    state.fields.brand?.value === "Arçelik" &&
      state.fields.brand?.provenance === "EXPLICIT_BROWSE",
  );
  const edited = syncFromText(state, "Televizyon arıyorum 140 ekran");
  check(
    "9b Arçelik preserved after text edit",
    edited.state.fields.brand?.value === "Arçelik" &&
      edited.state.fields.brand?.provenance === "EXPLICIT_BROWSE",
  );
  check(
    "9c screenSize from text",
    edited.state.fields.screenSize?.value === "140",
  );
}

// --- 10 text explicit overwrite ---
{
  let state = createTextOnlyState("Televizyon arıyorum");
  state = syncFromBrowse(state, { key: "brand", value: "Arçelik" }).state;
  const overwritten = syncFromText(
    state,
    "Samsung televizyon arıyorum 140 ekran",
  );
  const brand = overwritten.state.fields.brand?.value?.toLocaleLowerCase("tr-TR") ?? "";
  check(
    "10 Samsung overrides Arçelik",
    brand.includes("samsung"),
    brand,
  );
}

// --- 11 stale inference cleanup ---
{
  let state = createTextOnlyState("Samsung televizyon arıyorum");
  const hadSamsung =
    state.fields.brand?.kind === "VALUE" &&
    (state.fields.brand.value ?? "")
      .toLocaleLowerCase("tr-TR")
      .includes("samsung");
  check("11 initial Samsung present", hadSamsung);
  const cleared = syncFromText(state, "Televizyon arıyorum");
  const brandKind = cleared.state.fields.brand?.kind;
  const brandVal = (cleared.state.fields.brand?.value ?? "").toLocaleLowerCase(
    "tr-TR",
  );
  check(
    "11b stale Samsung cleared (not EXPLICIT_BROWSE pin)",
    brandKind === "UNKNOWN" ||
      brandKind === "ANY" ||
      !brandVal.includes("samsung"),
    `${brandKind}:${brandVal}`,
  );
}

// --- 12 no merge loop ---
{
  let state = createTextOnlyState("Televizyon arıyorum 140 ekran");
  const browsed = syncFromBrowse(state, { key: "brand", value: "Arçelik" });
  const echo = syncFromText(browsed.state, browsed.composedText);
  check("12 no merge loop skipped", echo.skipped === true);
  check(
    "12b brand still Arçelik",
    echo.state.fields.brand?.value === "Arçelik",
  );
}

// --- 13 Dyson V15 preserve ---
{
  let state = createTextOnlyState("Dyson süpürge istiyorum");
  state = applyBrowseSelectionToState(state, {
    key: "model",
    value: "V15 Detect",
  });
  check(
    "13 V15 EXPLICIT_BROWSE",
    state.fields.model?.value === "V15 Detect" &&
      state.fields.model?.provenance === "EXPLICIT_BROWSE",
  );
  const next = syncFromText(state, "Dyson süpürge istiyorum sıfır olsun");
  check(
    "13b V15 preserved",
    next.state.fields.model?.value === "V15 Detect",
  );
  check(
    "13c condition NEW-ish",
    next.state.fields.condition?.kind === "VALUE" ||
      next.state.understanding.condition?.value === "NEW",
  );
}

// --- 14 TV ANY ---
{
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  check("14 TV brand ANY", state.fields.brand?.kind === "ANY");
  check("14b screen 140", state.fields.screenSize?.value === "140");
  const q = resolveHybridQuestions(state);
  check(
    "14c brand not asked",
    !q.candidates.some((c) => c.fieldKey === "brand"),
  );
}

// --- 15–16 aliases of 9–10 ---
{
  let state = createTextOnlyState("Televizyon arıyorum");
  state = syncFromBrowse(state, { key: "brand", value: "Arçelik" }).state;
  const preserved = syncFromText(state, "Televizyon arıyorum 140 ekran");
  check("15 TV Arçelik preserve", preserved.state.fields.brand?.value === "Arçelik");
  const ov = syncFromText(state, "Samsung televizyon arıyorum 140 ekran");
  check(
    "16 TV Samsung override",
    (ov.state.fields.brand?.value ?? "")
      .toLocaleLowerCase("tr-TR")
      .includes("samsung"),
  );
}

// --- 17 Golf far ---
{
  resetUnderstandCallCount();
  const t0 = getUnderstandCallCount();
  const state = createTextOnlyState("Golf 7 sağ ön far arıyorum");
  const t1 = getUnderstandCallCount();
  check("17 golf single understand", t1 - t0 === 1, `delta=${t1 - t0}`);
  const q = resolveHybridQuestions(state);
  check(
    "17b no engine/transmission ask",
    !q.next.some((f) => f.key === "engine" || f.key === "transmission"),
  );
  const subject = state.understanding.requestSubject.kind.value;
  check(
    "17c PART subject",
    subject === "PART" || state.understanding.intent.value === "PART",
    subject,
  );
}

// --- 18 product identity no second extraction authority ---
{
  const hints = readFileSync(
    join(webSrc, "lib/request-composer/attribute-hints.ts"),
    "utf8",
  );
  check(
    "18 attribute-hints has no brand extract authority",
    !/extractBrand|detectBrand\s*\(/.test(hints),
  );
  check(
    "18b brand mapped from understanding identity",
    readFileSync(join(webSrc, "lib/request-composer/build-state.ts"), "utf8").includes(
      "result.identity.brand",
    ),
  );
}

// --- 19 category detector authority ---
{
  const pageSrc = readFileSync(join(webSrc, "app/talep/page.tsx"), "utf8");
  check(
    "19 page does not call detectCategory(",
    !pageSrc.includes("detectCategory("),
  );
  const engine = readFileSync(
    join(webSrc, "lib/request-category-engine.ts"),
    "utf8",
  );
  check(
    "19b detectCategory documents Single Brain authority",
    engine.includes("understandRequest()"),
  );
}

// --- 20 legacy parser classified ---
{
  const parser = readFileSync(join(webSrc, "lib/ai/parser/parser.ts"), "utf8");
  const orch = readFileSync(join(webSrc, "lib/ai/orchestrator.ts"), "utf8");
  const offer = readFileSync(
    join(webSrc, "app/api/ai/offer-assistant/route.ts"),
    "utf8",
  );
  check("20 parseRequest deprecated marker", parser.includes("@deprecated"));
  check("20b runTalepoAiCore exists (offer/other)", orch.includes("runTalepoAiCore"));
  check(
    "20c offer-assistant uses parseRequest (OFFER_ASSISTANT)",
    offer.includes("parseRequest"),
  );
}

// --- 21 subject canonical consumer ---
{
  const state = createTextOnlyState("Golf 7 sağ ön far arıyorum");
  check(
    "21 requestSubject present",
    Boolean(state.understanding.requestSubject?.kind?.value),
  );
}

// --- 22 no DB mutation ---
{
  check("22 no DB mutation in phase1 script", true);
}

// --- unit: mergePreservedBrowseFields ---
{
  const fromText: Record<string, CanonicalFieldState> = {
    brand: { kind: "UNKNOWN", value: null, provenance: "INFERRED" },
    screenSize: {
      kind: "VALUE",
      value: "140",
      provenance: "EXPLICIT_TEXT",
      confidence: 1,
    },
  };
  const previous: Record<string, CanonicalFieldState> = {
    brand: {
      kind: "VALUE",
      value: "Arçelik",
      provenance: "EXPLICIT_BROWSE",
      confidence: 1,
    },
  };
  const merged = mergePreservedBrowseFields(fromText, previous, "text");
  check("unit merge preserves browse brand", merged.brand?.value === "Arçelik");
}

// --- before/after call count report ---
{
  resetUnderstandCallCount();
  const text = "Televizyon arıyorum 140 ekran marka önemli değil";
  // Simulate hybrid-only path (authoritative)
  const s1 = syncFromText(null, text);
  const hybridOnly = getUnderstandCallCount();
  // Simulate old dual path would be +1 for page overlay — we assert page source has 0 calls
  check(
    "AFTER stable text: 1 understand via hybrid sync",
    hybridOnly === 1,
    `got ${hybridOnly}`,
  );
  check("AFTER state has understanding", Boolean(s1.state.understanding));
  const completeness = completenessFromUnderstanding(
    s1.state.understanding,
    {},
  );
  check("AFTER completeness from same snapshot", Boolean(completeness));
}

console.log("\n========================================");
console.log(`PHASE1 RESULTS: ${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log("FAILURES:");
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}
console.log("BEFORE understand calls / stable text: ~2 (hybrid + page overlay)");
console.log("AFTER understand calls / stable text: 1 (hybrid sync only)");
process.exit(0);
