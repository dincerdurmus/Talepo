/**
 * Browse Semantic Subject & Natural Text Closure V1
 * Run: npx tsx scripts/verify-browse-semantic-closure-v1.ts
 *
 * Ensures taxonomy path subject survives brand/model leaves through
 * CanonicalRequestState → questions → natural text → re-understand → discovery.
 */
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery";
import { getCategoryById, getVisibleCategoryFields } from "../src/lib/request-category-engine";
import {
  applyBrowseSelectionToState,
  buildUnderstoodFacts,
  composeNaturalRequestText,
  composeTextFromBrowseStack,
  createTextOnlyState,
  pinBrowseSemanticContext,
  resolveBrowseSemanticRole,
  resolveHybridQuestions,
  syncFromText,
  type CanonicalRequestState,
} from "../src/lib/request-composer";
import { buildUnderstandingSummary } from "../src/lib/request-understanding/activation-bridge";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";

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

function emptyShell(
  categoryId: string,
  subcategorySlug: string,
  taxonomyNodeId?: string | null,
): CanonicalRequestState {
  const role = resolveBrowseSemanticRole({
    categoryId,
    subcategorySlug,
    taxonomyNodeId,
  });
  let state = createTextOnlyState(" ");
  state = pinBrowseSemanticContext(
    {
      ...state,
      categoryId,
      subcategorySlug,
      taxonomyNodeId: taxonomyNodeId ?? null,
    },
    { categoryId, subcategorySlug, taxonomyNodeId },
  );
  const seed =
    role.compositionMode === "compatibility_part"
      ? "yedek parça arıyorum."
      : role.compositionMode === "service"
        ? "bakım arıyorum."
        : role.subjectKind === "VEHICLE"
          ? "araç arıyorum."
          : " ";
  const synced = syncFromText(state, seed, {
    structured: {
      categoryId,
      fieldValues: role.needType ? { needType: role.needType } : {},
    },
  });
  return pinBrowseSemanticContext(synced.state, {
    categoryId,
    subcategorySlug,
    taxonomyNodeId,
  });
}

function withBrandModel(
  state: CanonicalRequestState,
  brand: string,
  model: string,
): CanonicalRequestState {
  let next = applyBrowseSelectionToState(state, { key: "brand", value: brand });
  next = applyBrowseSelectionToState(next, { key: "model", value: model });
  return next;
}

function refreshUnderstanding(state: CanonicalRequestState): CanonicalRequestState {
  const text = composeNaturalRequestText(state);
  const need =
    state.fields.needType?.kind === "VALUE"
      ? String(state.fields.needType.value)
      : undefined;
  return syncFromText(state, text, {
    structured: {
      categoryId: state.categoryId ?? undefined,
      fieldValues: need ? { needType: need } : {},
    },
  }).state;
}

// ---------------------------------------------------------------------------
// A. Vehicle purchase — Alfa Romeo 156
// ---------------------------------------------------------------------------
{
  let state = emptyShell("automotive", "arac-satin-alma");
  state = withBrandModel(state, "Alfa Romeo", "156");
  const text = composeNaturalRequestText(state);
  const subject = state.understanding.requestSubject.kind.value;
  const need =
    state.fields.needType?.kind === "VALUE"
      ? String(state.fields.needType.value)
      : null;
  const q = resolveHybridQuestions(state);
  const summary = buildUnderstandingSummary(state.understanding);
  const form = getVisibleCategoryFields(
    getCategoryById("automotive").fields,
    { needType: need ?? "vehicle", brand: "Alfa Romeo", model: "156" },
    "automotive",
    { subcategorySlug: "arac-satin-alma" },
  );

  check("A role VEHICLE", resolveBrowseSemanticRole({
    categoryId: "automotive",
    subcategorySlug: "arac-satin-alma",
  }).subjectKind === "VEHICLE");
  check("A needType vehicle", need === "vehicle");
  check(
    "A subject VEHICLE after brand/model",
    (() => {
      const r = syncFromText(state, text, {
        structured: {
          categoryId: "automotive",
          fieldValues: { needType: "vehicle" },
        },
      });
      return r.state.understanding.requestSubject.kind.value === "VEHICLE";
    })(),
  );
  check(
    "A text means vehicle (no 'için yedek parça')",
    /alfa romeo/i.test(text) &&
      /156/.test(text) &&
      !/için yedek parça/i.test(text),
    text,
  );
  check(
    "A vehicle questions allowed (condition not suppressed as spare)",
    !q.suppressed.includes("condition") ||
      q.next.some((f) => f.key === "condition") ||
      form.some((f) => f.key === "condition"),
  );
  check(
    "A form hides needType (browse-pinned)",
    !form.some((f) => f.key === "needType"),
  );
  check(
    "A Talepo subtype Araç",
    summary.subtypeLabel === "Araç" || /Araç/i.test(summary.subtypeLabel ?? ""),
    summary.subtypeLabel ?? "null",
  );
  void subject;
}

// ---------------------------------------------------------------------------
// B. Spare part — Alfa Romeo 156
// ---------------------------------------------------------------------------
{
  let state = emptyShell("automotive", "yedek-parca");
  state = withBrandModel(state, "Alfa Romeo", "156");
  const text = composeNaturalRequestText(state);
  const reread = syncFromText(state, text, {
    structured: {
      categoryId: "automotive",
      fieldValues: { needType: "part" },
    },
  });
  const subject = reread.state.understanding.requestSubject.kind.value;
  const need =
    state.fields.needType?.kind === "VALUE"
      ? String(state.fields.needType.value)
      : null;
  const q = resolveHybridQuestions(reread.state);
  const summary = buildUnderstandingSummary(reread.state.understanding);
  const facts = buildUnderstoodFacts(reread.state);
  const form = getVisibleCategoryFields(
    getCategoryById("automotive").fields,
    { needType: "part", brand: "Alfa Romeo", model: "156" },
    "automotive",
    { subcategorySlug: "yedek-parca" },
  );
  const stackText = composeTextFromBrowseStack(
    [
      { kind: "category", label: "Otomotiv" },
      { kind: "subcategory", label: "Yedek Parça" },
      { kind: "brand", label: "Alfa Romeo" },
      { kind: "model", label: "156" },
    ],
    { categoryId: "automotive", subcategorySlug: "yedek-parca" },
  );

  check("B needType part", need === "part");
  check("B subject PART", subject === "PART", subject);
  check(
    "B text includes spare-part meaning",
    /için yedek parça/i.test(text) || /için yedek parça/i.test(stackText),
    `compose=${text} stack=${stackText}`,
  );
  check(
    "B stack text spare-part",
    /alfa romeo 156 için yedek parça/i.test(stackText),
    stackText,
  );
  check(
    "B vehicle-purchase questions forbidden",
    !q.candidates.some((c) => c.fieldKey === "condition") &&
      !q.next.some((f) => f.key === "condition") &&
      !form.some((f) => f.key === "condition"),
  );
  check(
    "B form hides needType + no vehicle condition",
    !form.some((f) => f.key === "needType") &&
      !form.some((f) => f.key === "condition"),
  );
  check(
    "B Talepo subtype Yedek parça",
    summary.subtypeLabel === "Yedek parça",
    summary.subtypeLabel ?? "null",
  );
  check(
    "B facts uyumlu marka/model",
    facts.some((f) => f.key === "brand" && /uyumlu/i.test(f.label)) &&
      facts.some((f) => f.key === "model" && /uyumlu/i.test(f.label)),
    facts.map((f) => `${f.label}=${f.displayValue}`).join("; "),
  );
  check(
    "B parent entity VEHICLE (compatibility)",
    reread.state.understanding.requestSubject.parentEntity?.kind === "VEHICLE",
  );
}

// ---------------------------------------------------------------------------
// C. Part + specific leaf (Golf lighting if available via part field)
// ---------------------------------------------------------------------------
{
  let state = emptyShell("automotive", "yedek-parca");
  state = withBrandModel(state, "Volkswagen", "Golf");
  state = applyBrowseSelectionToState(state, {
    key: "part",
    value: "sağ ön far",
  });
  const text = composeNaturalRequestText(state);
  check(
    "C PART + specific part text",
    /volkswagen golf için/i.test(text) && /far/i.test(text),
    text,
  );
  const subject = syncFromText(state, text, {
    structured: {
      categoryId: "automotive",
      fieldValues: { needType: "part" },
    },
  }).state.understanding.requestSubject.kind.value;
  check("C subject stays PART", subject === "PART", subject);
}

// ---------------------------------------------------------------------------
// D / E — Appliance whole vs part leaf
// ---------------------------------------------------------------------------
{
  const whole = pinBrowseSemanticContext(createTextOnlyState("Bosch çamaşır makinesi arıyorum."), {
    categoryId: "appliances",
    subcategorySlug: "beyaz-esya",
  });
  check(
    "D appliance whole not PART role",
    resolveBrowseSemanticRole({
      categoryId: "appliances",
      subcategorySlug: "beyaz-esya",
    }).subjectKind == null,
  );
  void whole;

  const partRole = resolveBrowseSemanticRole({
    categoryId: "appliances",
    subcategorySlug: "beyaz-esya",
    taxonomyNodeId: "tax:appliances:beyaz-esya:yedek-parca-ekipman",
  });
  check("E appliance part leaf → PART", partRole.subjectKind === "PART");
  check("E appliance part needType", partRole.needType === "part");

  let partState = emptyShell("appliances", "beyaz-esya");
  partState = {
    ...partState,
    taxonomyNodeId: "tax:appliances:beyaz-esya:yedek-parca-ekipman",
  };
  partState = pinBrowseSemanticContext(partState, {
    categoryId: "appliances",
    subcategorySlug: "beyaz-esya",
  });
  // Pin via taxonomy leaf role manually for needType when subcategory is whole
  if (partRole.needType) {
    partState = {
      ...partState,
      fields: {
        ...partState.fields,
        needType: {
          kind: "VALUE",
          value: partRole.needType,
          provenance: "EXPLICIT_BROWSE",
          confidence: 1,
          evidence: ["tax-leaf-part"],
        },
      },
    };
  }
  partState = withBrandModel(partState, "Bosch", "Serie 6");
  const partText = composeNaturalRequestText({
    ...partState,
    taxonomyNodeId: "tax:appliances:beyaz-esya:yedek-parca-ekipman",
  });
  check(
    "E appliance part text",
    /bosch/i.test(partText) && /için yedek parça/i.test(partText),
    partText,
  );
}

// ---------------------------------------------------------------------------
// F / G — Industrial whole vs part
// ---------------------------------------------------------------------------
{
  const wholeRole = resolveBrowseSemanticRole({
    categoryId: "machinery",
    subcategorySlug: "uretim-makinesi",
  });
  const partRole = resolveBrowseSemanticRole({
    categoryId: "machinery",
    subcategorySlug: "yedek-parca",
  });
  check("F industrial whole → machine", wholeRole.needType === "machine");
  check("G industrial part → PART", partRole.subjectKind === "PART");

  let partState = emptyShell("machinery", "yedek-parca");
  partState = withBrandModel(partState, "X", "Makine");
  partState = applyBrowseSelectionToState(partState, {
    key: "part",
    value: "rulman",
  });
  const text = composeNaturalRequestText(partState);
  check(
    "G industrial part text",
    /için/i.test(text) && (/rulman/i.test(text) || /yedek parça/i.test(text)),
    text,
  );
}

// ---------------------------------------------------------------------------
// H — Service
// ---------------------------------------------------------------------------
{
  const role = resolveBrowseSemanticRole({
    categoryId: "automotive",
    subcategorySlug: "arac-bakim",
  });
  check("H service role", role.subjectKind === "SERVICE" && role.needType === "service");
  let state = emptyShell("automotive", "arac-bakim");
  state = withBrandModel(state, "Alfa Romeo", "156");
  const text = composeNaturalRequestText(state);
  check(
    "H service text not vehicle-purchase",
    /için/i.test(text) && !/için yedek parça/i.test(text),
    text,
  );
  const form = getVisibleCategoryFields(
    getCategoryById("automotive").fields,
    { needType: "service", brand: "Alfa Romeo", model: "156" },
    "automotive",
    { subcategorySlug: "arac-bakim" },
  );
  check(
    "H service: no vehicle condition",
    !form.some((f) => f.key === "condition"),
  );
}

// ---------------------------------------------------------------------------
// I — Accessory (text path; taxonomy may not pin ACCESSORY via browse slug)
// ---------------------------------------------------------------------------
{
  const u = understandRequest({
    rawInput: "iPhone 15 için kılıf arıyorum",
  });
  const kind = u.requestSubject.kind.value;
  check(
    "I accessory or part subject",
    kind === "ACCESSORY" || kind === "PART",
    kind,
  );
}

// ---------------------------------------------------------------------------
// J — PART → VEHICLE transition clears stale part inference + pins vehicle
// ---------------------------------------------------------------------------
{
  let state = emptyShell("automotive", "yedek-parca");
  state = withBrandModel(state, "Alfa Romeo", "156");
  state = applyBrowseSelectionToState(state, {
    key: "part",
    value: "ön tampon",
  });
  // Simulate inferred vehicle condition wrongly present
  state = {
    ...state,
    fields: {
      ...state.fields,
      condition: {
        kind: "VALUE",
        value: "İkinci el",
        provenance: "INFERRED",
        confidence: 0.5,
      },
    },
  };
  state = pinBrowseSemanticContext(state, {
    categoryId: "automotive",
    subcategorySlug: "arac-satin-alma",
  });
  check(
    "J needType vehicle after switch",
    state.fields.needType?.value === "vehicle",
  );
  check(
    "J part field cleared on VEHICLE switch",
    !state.fields.part ||
      state.fields.part.kind === "UNKNOWN" ||
      !state.fields.part.value,
  );
  const text = composeNaturalRequestText(state);
  check(
    "J text is vehicle after switch",
    /alfa romeo/i.test(text) && !/için yedek parça/i.test(text),
    text,
  );
}

// ---------------------------------------------------------------------------
// K — VEHICLE → PART transition clears vehicle condition
// ---------------------------------------------------------------------------
{
  let state = emptyShell("automotive", "arac-satin-alma");
  state = withBrandModel(state, "Alfa Romeo", "156");
  state = applyBrowseSelectionToState(state, {
    key: "condition",
    value: "Sıfır",
  });
  state = pinBrowseSemanticContext(state, {
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
  });
  check("K needType part after switch", state.fields.needType?.value === "part");
  check(
    "K vehicle condition cleared",
    !state.fields.condition ||
      state.fields.condition.kind === "UNKNOWN" ||
      !state.fields.condition.value,
  );
  const text = composeNaturalRequestText(state);
  check(
    "K text is spare-part after switch",
    /için yedek parça/i.test(text),
    text,
  );
  const q = resolveHybridQuestions(state);
  check(
    "K no condition question after switch",
    !q.candidates.some((c) => c.fieldKey === "condition"),
  );
}

// ---------------------------------------------------------------------------
// Round-trip: free text spare-part without structured needType
// ---------------------------------------------------------------------------
{
  const u = understandRequest({
    rawInput: "Alfa Romeo 156 için yedek parça arıyorum.",
  });
  check(
    "round-trip text → PART",
    u.requestSubject.kind.value === "PART",
    u.requestSubject.kind.value,
  );
  const vehicleText = understandRequest({
    rawInput: "Alfa Romeo 156 arıyorum.",
    structured: {
      categoryId: "automotive",
      fieldValues: { needType: "vehicle" },
    },
  });
  check(
    "round-trip vehicle structured → VEHICLE",
    vehicleText.requestSubject.kind.value === "VEHICLE",
    vehicleText.requestSubject.kind.value,
  );
}

// ---------------------------------------------------------------------------
// Discovery projection preserves subject
// ---------------------------------------------------------------------------
{
  let state = emptyShell("automotive", "yedek-parca");
  state = withBrandModel(state, "Alfa Romeo", "156");
  const synced = syncFromText(state, composeNaturalRequestText(state), {
    structured: {
      categoryId: "automotive",
      fieldValues: { needType: "part" },
    },
  }).state;
  const proj = buildDiscoveryProjectionFromState(synced);
  check(
    "discovery preserves part needType + subcategory",
    proj.attributes?.needType === "part" &&
      proj.subcategorySlug === "yedek-parca" &&
      synced.understanding.requestSubject.kind.value === "PART",
    JSON.stringify({
      needType: proj.attributes?.needType,
      sub: proj.subcategorySlug,
      subject: synced.understanding.requestSubject.kind.value,
    }),
  );
}

console.log("\n=== browse-semantic-closure-v1 ===");
console.log(`pass=${pass} fail=${fail}`);
if (fail > 0) {
  console.log("Failures:");
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}
process.exit(0);
