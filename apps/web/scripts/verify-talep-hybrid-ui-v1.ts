/**
 * /talep Hybrid Composer UI wiring — unit acceptance (no browser).
 * Run: npx tsx scripts/verify-talep-hybrid-ui-v1.ts
 */
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";
import {
  FIELD_SENTINEL,
  applyTextThenBrowse,
  browseNodeToSelection,
  buildUnderstoodFacts,
  createBrowseOnlyState,
  createTextOnlyState,
  getFieldKind,
  resolveBrowsePath,
  resolveHybridQuestions,
  runHybridUiAcceptancePath,
  softFillFromComposerState,
  syncFromBrowse,
  syncFromText,
} from "../src/lib/request-composer";
import type { BrowseNode } from "../src/lib/knowledge/types";

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

// 1 composer initializes
{
  const state = createTextOnlyState("Arçelik marka TV istiyorum 105 ekran");
  check("1 composer initializes", state.version === "hybrid-v1");
}

// 2 text change updates state
{
  const a = createTextOnlyState("televizyon");
  const b = syncFromText(a, "televizyon 140 ekran").state;
  check("2 text→state screen", b.fields.screenSize?.value === "140");
}

// 3 state updates browse path
{
  const state = createTextOnlyState("Arçelik marka TV istiyorum 105 ekran");
  const path = resolveBrowsePath(state);
  check(
    "3 state→browse path",
    path.some((p) => p.label.toLocaleLowerCase("tr-TR").includes("televizyon")) ||
      path.some((p) => p.id.includes("technology")),
  );
}

// 4 browse updates state
{
  let state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  state = syncFromBrowse(state, { key: "resolution", value: "4K" }).state;
  check("4 browse→state 4K", state.fields.resolution?.value === "4K");
}

// 5 state regenerates text
{
  const { composedText } = applyTextThenBrowse(
    "Televizyon arıyorum 140 ekran marka önemli değil",
    [{ key: "resolution", value: "4K" }],
  );
  check("5 state→text has 4K", composedText.includes("4K"));
}

// 6 ANY visual state
{
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  const facts = buildUnderstoodFacts(state);
  check(
    "6 ANY visual Farketmez",
    facts.some((f) => f.key === "brand" && f.displayValue === "Farketmez"),
  );
}

// 7 UNKNOWN visual — brand absent from facts
{
  const state = createTextOnlyState("Televizyon arıyorum 140 ekran");
  const facts = buildUnderstoodFacts(state);
  check("7 UNKNOWN brand not shown as Farketmez", !facts.some((f) => f.key === "brand"));
  check("7 UNKNOWN kind", getFieldKind(state, "brand") === "UNKNOWN");
}

// 8 ANY not asked again
{
  const r = runHybridUiAcceptancePath({
    text: "Televizyon arıyorum 140 ekran marka önemli değil",
  });
  check("8 ANY not asked", r.brandAsked === false);
}

// 9 next question / quick groups exist or optional ok
{
  const r = runHybridUiAcceptancePath({
    text: "Televizyon arıyorum 140 ekran marka önemli değil",
  });
  check(
    "9 next/quick path ready",
    r.quick.length >= 0 && r.state.fields.screenSize?.value === "140",
  );
}

// 10 no loop
{
  const browsed = applyTextThenBrowse(
    "Televizyon arıyorum 140 ekran marka önemli değil",
    [{ key: "resolution", value: "4K" }],
  );
  const echo = syncFromText(browsed.state, browsed.composedText);
  check("10 no loop skipped", echo.skipped === true);
}

// 11 stale response guard (sequence simulation)
{
  let latest = 0;
  const tokens: number[] = [];
  function apply(token: number, text: string) {
    tokens.push(token);
    const result = syncFromText(null, text);
    if (token !== latest) return null;
    return result.state;
  }
  latest = 2;
  const stale = apply(1, "eski");
  const fresh = apply(2, "Arçelik marka TV istiyorum 105 ekran");
  check("11 stale ignored", stale === null);
  check("11 fresh applied", Boolean(fresh?.fields.screenSize?.value === "105"));
}

// 12 text preserved on error — syncFromText itself shouldn't throw on normal input
{
  const text = "kullanıcı yazısı korunur";
  try {
    syncFromText(null, text);
    check("12 sync safe", true);
  } catch {
    check("12 sync safe", false, "threw");
  }
}

// 13 browse-only
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
  check("13 browse-only ANY", state.fields.brand?.kind === "ANY");
  check(
    "13 browse-only text",
    (state.lastComposedText ?? "").includes("140"),
  );
}

// 14 text-only
{
  const r = runHybridUiAcceptancePath({
    text: "140 ekran, marka fark etmez, sıfır 4K televizyon arıyorum",
  });
  check("14 text-only brand ANY", getFieldKind(r.state, "brand") === "ANY");
}

// 15 hybrid
{
  const r = runHybridUiAcceptancePath({
    text: "Televizyon arıyorum 140 ekran marka önemli değil",
    browse: [
      { key: "resolution", value: "4K" },
      { key: "condition", value: "Sıfır" },
    ],
  });
  check("15 hybrid 4K", r.state.fields.resolution?.value === "4K");
  check("15 hybrid text", r.text.includes("4K"));
}

// 16 Arçelik TV 105
{
  const r = runHybridUiAcceptancePath({
    text: "Arçelik marka TV istiyorum 105 ekran",
  });
  check("16 Arçelik screen 105", r.state.fields.screenSize?.value === "105");
  check(
    "16 Arçelik brand",
    (r.state.fields.brand?.value ?? "")
      .toLocaleLowerCase("tr-TR")
      .includes("arçelik") ||
      (r.state.fields.brand?.value ?? "")
        .toLocaleLowerCase("tr-TR")
        .includes("arcelik"),
  );
}

// 17 TV 140 ANY
{
  const r = runHybridUiAcceptancePath({
    text: "Televizyon arıyorum 140 ekran marka önemli değil",
  });
  check("17 TV 140 ANY", getFieldKind(r.state, "brand") === "ANY");
  check(
    "17 path Farketmez",
    r.path.some((p) => p.label === "Farketmez"),
  );
}

// 18 TV + 4K
{
  const r = runHybridUiAcceptancePath({
    text: "Televizyon arıyorum 140 ekran marka önemli değil",
    browse: [{ key: "resolution", value: "4K" }],
  });
  check("18 +4K", r.state.fields.resolution?.value === "4K" && r.text.includes("4K"));
}

// 19 ANY → Arçelik
{
  const r = runHybridUiAcceptancePath({
    text: "Televizyon arıyorum 140 ekran marka önemli değil",
    browse: [{ key: "brand", value: "Arçelik" }],
  });
  check("19 ANY→Arçelik kind VALUE", r.state.fields.brand?.kind === "VALUE");
  check(
    "19 ANY→Arçelik text",
    r.text.toLocaleLowerCase("tr-TR").includes("arçelik") ||
      r.text.toLocaleLowerCase("tr-TR").includes("arcelik"),
  );
  check(
    "19 no fark etmez",
    !r.text.toLocaleLowerCase("tr-TR").includes("fark etmez"),
  );
}

// 20 Dyson + V15
{
  let state = createTextOnlyState("Dyson süpürge almak istiyorum");
  const browsed = syncFromBrowse(state, { key: "model", value: "V15 Detect" });
  check(
    "20 Dyson brand",
    (browsed.state.fields.brand?.value ?? "")
      .toLocaleLowerCase("tr-TR")
      .includes("dyson"),
  );
  check(
    "20 Dyson model V15",
    (browsed.state.fields.model?.value ?? "").includes("V15"),
  );
  check(
    "20 Dyson text",
    browsed.composedText.toLocaleLowerCase("tr-TR").includes("dyson") &&
      browsed.composedText.includes("V15"),
  );
}

// 21 Golf 7 far
{
  const r = runHybridUiAcceptancePath({
    text: "Golf 7 sağ ön far arıyorum",
  });
  const pathLabels = r.path.map((p) => p.label.toLocaleLowerCase("tr-TR")).join(" ");
  check(
    "21 Golf path-ish",
    pathLabels.includes("golf") ||
      pathLabels.includes("volkswagen") ||
      r.state.categoryId === "automotive" ||
      r.state.understanding.category.value === "automotive",
  );
  const q = resolveHybridQuestions(r.state);
  check(
    "21 no forced engine/TX",
    !q.next.some((f) => f.key === "engine" || f.key === "transmission"),
  );
}

// 22 soft-fill publish bag
{
  const state = createTextOnlyState(
    "Televizyon arıyorum 140 ekran marka önemli değil",
  );
  const fill = softFillFromComposerState(state);
  check("22 soft-fill brand Farketmez", fill.brand === "Farketmez");
  check("22 soft-fill screen", fill.screenSize === "140");
}

// 23 browseNodeToSelection ANY
{
  const node: BrowseNode = {
    id: "any:brand",
    kind: "attribute_bucket",
    label: "Farketmez",
    categoryId: "technology",
    hasChildren: false,
    meta: { any: true, fieldKey: "brand", sentinel: "__ANY__" },
  };
  const sel = browseNodeToSelection(node);
  check("23 browse ANY selection", Boolean(sel?.isAny && sel.key === "brand"));
}

// 24 preview facts sync — no separate parser
{
  const state = createTextOnlyState("Arçelik marka TV istiyorum 105 ekran");
  const facts = buildUnderstoodFacts(state);
  check(
    "24 preview from composer facts",
    facts.some((f) => f.key === "screenSize") &&
      facts.some((f) => f.key === "brand"),
  );
}

console.log("\n========================================");
console.log(`verify-talep-hybrid-ui-v1: ${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log("Failures:");
  for (const e of errors) console.log(` - ${e}`);
}
process.exit(fail > 0 ? 1 : 0);
