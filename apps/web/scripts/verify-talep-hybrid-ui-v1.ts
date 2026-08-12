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
  buildQuickSelectGroups,
  browseWalkFromPath,
  listBrowseCascadeColumns,
  composeNaturalRequestText,
  composeTextFromBrowseStack,
} from "../src/lib/request-composer";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { resolveSchemaCategory } from "../src/lib/request-understanding/activation-bridge";
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
    "17 path brand ANY (Tümü/Farketmez)",
    r.path.some((p) => p.label === "Tümü" || p.label === "Farketmez"),
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

// 25 spare-part quick select: no duplicate Parça tercihi, no Araç durumu
{
  let state = createTextOnlyState("Mercedes C180 ön far arıyorum");
  state = syncFromBrowse(state, {
    key: "brand",
    value: "Mercedes-Benz",
    entityId: "brand_mercedes-benz",
  }).state;
  state = syncFromBrowse(state, {
    key: "part",
    value: "Ön far",
  }).state;
  // generation filled → partPreference can appear in both next + optionalUseful
  state = syncFromBrowse(state, {
    key: "generation",
    value: "W205",
  }).state;

  const groups = buildQuickSelectGroups(state, 8);
  const partPrefCount = groups.filter((g) => g.fieldKey === "partPreference").length;
  const conditionCount = groups.filter((g) => g.fieldKey === "condition").length;
  const keys = groups.map((g) => g.fieldKey);
  check(
    "25 quick select unique fieldKeys",
    new Set(keys).size === keys.length,
    keys.join(","),
  );
  check(
    "25 at most one Parça tercihi",
    partPrefCount <= 1,
    `count=${partPrefCount}`,
  );
  check(
    "25 no Araç durumu for spare part",
    conditionCount === 0,
    `count=${conditionCount}`,
  );
  const q = resolveHybridQuestions(state);
  check(
    "25 questions suppress condition for spare",
    !q.next.some((f) => f.key === "condition") &&
      !q.optionalUseful.some((f) => f.key === "condition"),
  );
}

// 26 emlak / daire → real-estate filters (not automotive)
{
  for (const phrase of ["emlak", "daire arıyorum", "kiralık 2+1"]) {
    const ru = understandRequest({ rawInput: phrase });
    const schema = resolveSchemaCategory(ru);
    const state = createTextOnlyState(phrase);
    const groups = buildQuickSelectGroups(state, 8);
    const autoKeys = groups.some(
      (g) =>
        g.fieldKey === "partPreference" ||
        g.fieldKey === "condition" ||
        g.label === "Araç durumu",
    );
    check(
      `26 ${phrase} → real-estate`,
      ru.category.value === "real-estate" || schema.categoryId === "real-estate",
      `cat=${ru.category.value} schema=${schema.categoryId} status=${ru.category.status}`,
    );
    check(`26 ${phrase} no automotive quick chips`, !autoKeys);
  }
}

// 27 text path → cascade walk columns
{
  const state = createTextOnlyState("Mercedes C180 ön far arıyorum");
  const path = resolveBrowsePath(state);
  const walk = browseWalkFromPath(path);
  const columns = listBrowseCascadeColumns(walk);
  check(
    "27 walk syncs automotive path",
    path.length >= 2 && walk.stack.length >= 1,
    `path=${path.length} stack=${walk.stack.length}`,
  );
  check(
    "27 cascade has multiple columns",
    columns.length >= 2,
    `cols=${columns.length}`,
  );
  check(
    "27 first column includes Otomotiv",
    columns[0]?.some((n) => n.id === "automotive") ?? false,
  );
}

// 28 BUY vehicle → Araç Satın Alma (not yedek parça / far)
{
  const state = createTextOnlyState("mercedes c180 satın almak istiyorum");
  const path = resolveBrowsePath(state);
  const labels = path.map((p) => p.label);
  check(
    "28 BUY needType vehicle",
    state.fields.needType?.value === "vehicle",
    String(state.fields.needType?.value),
  );
  check(
    "28 BUY subcategory arac-satin-alma",
    state.subcategorySlug === "arac-satin-alma",
    String(state.subcategorySlug),
  );
  check(
    "28 BUY path Araç Satın Alma",
    labels.includes("Araç Satın Alma"),
    labels.join(" > "),
  );
  check(
    "28 BUY path not Yedek Parça",
    !labels.includes("Yedek Parça") && !labels.some((l) => /far/i.test(l)),
    labels.join(" > "),
  );
  check(
    "28 BUY no part field dump",
    state.fields.part?.kind !== "VALUE",
    String(state.fields.part?.value),
  );
}

// 29 spare still lands on yedek parça
{
  const state = createTextOnlyState("Mercedes C180 ön far arıyorum");
  const path = resolveBrowsePath(state);
  const labels = path.map((p) => p.label);
  check(
    "29 PART subcategory yedek-parca",
    state.subcategorySlug === "yedek-parca" ||
      state.fields.needType?.value === "part",
    `sub=${state.subcategorySlug} need=${state.fields.needType?.value}`,
  );
  check(
    "29 PART path Yedek Parça",
    labels.includes("Yedek Parça"),
    labels.join(" > "),
  );
}

// 30 real-estate satılık daire → Emlak > Konut > Satılık > Daire
{
  const state = createTextOnlyState(
    "İstanbul bağcılarda satılık 2+1 daire arıyorum",
  );
  const path = resolveBrowsePath(state);
  const labels = path.map((p) => p.label);
  const walk = browseWalkFromPath(path);
  const cols = listBrowseCascadeColumns(walk);
  check(
    "30 RE subcategory satilik-konut",
    state.subcategorySlug === "satilik-konut",
    String(state.subcategorySlug),
  );
  check(
    "30 RE path Emlak>Konut>Satılık>Daire",
    labels.includes("Emlak") &&
      labels.includes("Konut") &&
      labels.includes("Satılık") &&
      labels.includes("Daire"),
    labels.join(" > "),
  );
  check(
    "30 RE path labels not Satılık daire",
    !labels.some((l) => /^satılık\s+daire$/i.test(l)),
    labels.join(" > "),
  );
  check(
    "30 RE cascade columns depth",
    cols.length >= 4 &&
      (cols[1]?.some((n) => n.label === "Konut") ?? false) &&
      (cols[2]?.some((n) => n.label === "Satılık") ?? false),
    `cols=${cols.length}`,
  );
}

// 31 Satılık / Kiralık konut types — same canonical list (no ikinci el / floor junk)
{
  const expected = [
    "Tümü",
    "Daire",
    "Rezidans",
    "Müstakil Ev",
    "Villa",
    "Çiftlik Evi",
    "Köşk & Konak",
    "Yalı",
    "Yalı Dairesi",
  ];
  const satPath = [
    { id: "real-estate", kind: "category", label: "Emlak" },
    { id: "re:group:konut", kind: "group", label: "Konut" },
    {
      id: "real-estate/satilik-konut",
      kind: "subcategory",
      label: "Satılık",
    },
  ];
  const kirPath = [
    { id: "real-estate", kind: "category", label: "Emlak" },
    { id: "re:group:konut", kind: "group", label: "Konut" },
    {
      id: "real-estate/kiralik-konut",
      kind: "subcategory",
      label: "Kiralık",
    },
  ];
  const satWalk = browseWalkFromPath(satPath as never);
  const kirWalk = browseWalkFromPath(kirPath as never);
  const satCols = listBrowseCascadeColumns(satWalk);
  const kirCols = listBrowseCascadeColumns(kirWalk);
  const satTypes = (satCols[3] ?? []).map((n) => n.label);
  const kirTypes = (kirCols[3] ?? []).map((n) => n.label);
  check(
    "31 Satılık konut types canonical",
    expected.every((l) => satTypes.includes(l)) &&
      !satTypes.some((l) => /ikinci el|sıfır|bahçe katı|çatı katı/i.test(l)),
    satTypes.join(", "),
  );
  check(
    "31 Kiralık konut types same as Satılık",
    expected.every((l) => kirTypes.includes(l)) &&
      kirTypes.join("|") === satTypes.join("|"),
    `sat=[${satTypes.join(", ")}] kir=[${kirTypes.join(", ")}]`,
  );
  const generic = createTextOnlyState("satılık gayrimenkul arıyorum.");
  const gPath = resolveBrowsePath(generic).map((p) => p.label);
  check(
    "31 generic gayrimenkul not a path leaf",
    !gPath.some((l) => /^gayrimenkul$/i.test(l)),
    gPath.join(" > "),
  );
  check(
    "31 generic gayrimenkul not Marka:Emlak",
    !(
      generic.fields.brand?.kind === "VALUE" &&
      String(generic.fields.brand.value).toLocaleLowerCase("tr-TR") === "emlak"
    ),
    String(generic.fields.brand?.value ?? ""),
  );
}

// 32 Technology: TV / laptop / phone brands + no TV filters on laptop
{
  const tvWalk = browseWalkFromPath([
    { id: "technology", kind: "category", label: "Teknoloji" },
    { id: "technology/donanim", kind: "subcategory", label: "Donanım" },
    {
      id: "tax:technology:donanim:tv-ve-goruntu",
      kind: "group",
      label: "TV ve görüntü",
    },
    {
      id: "tax:technology:donanim:tv-ve-goruntu:televizyon",
      kind: "product_type",
      label: "Televizyon",
    },
  ] as never);
  const tvCols = listBrowseCascadeColumns(tvWalk);
  const tvBrands = (tvCols[4] ?? tvCols[tvCols.length - 1] ?? []).map(
    (n) => n.label,
  );
  check(
    "32 TV brands include Samsung/LG/Tümü",
    tvBrands.includes("Tümü") &&
      tvBrands.includes("Samsung") &&
      tvBrands.includes("LG") &&
      tvBrands.includes("Vestel") &&
      tvBrands.length > 5,
    tvBrands.slice(0, 12).join(", "),
  );

  const phoneWalk = browseWalkFromPath([
    { id: "technology", kind: "category", label: "Teknoloji" },
    { id: "technology/donanim", kind: "subcategory", label: "Donanım" },
    {
      id: "tax:technology:donanim:telefon-ve-tablet",
      kind: "group",
      label: "Cep Telefonu & Aksesuar",
    },
  ] as never);
  const phoneCols = listBrowseCascadeColumns(phoneWalk);
  const phoneTypes = (phoneCols[3] ?? []).map((n) => n.label);
  check(
    "32 phone leaf is Cep Telefonu not Akıllı telefon",
    phoneTypes.includes("Cep Telefonu") &&
      !phoneTypes.some((l) => /^akıllı telefon$/i.test(l)),
    phoneTypes.join(", "),
  );

  const phoneBrandWalk = browseWalkFromPath([
    { id: "technology", kind: "category", label: "Teknoloji" },
    { id: "technology/donanim", kind: "subcategory", label: "Donanım" },
    {
      id: "tax:technology:donanim:telefon-ve-tablet",
      kind: "group",
      label: "Cep Telefonu & Aksesuar",
    },
    {
      id: "tax:technology:donanim:telefon-ve-tablet:akilli-telefon",
      kind: "product_type",
      label: "Cep Telefonu",
    },
  ] as never);
  const phoneBrandCols = listBrowseCascadeColumns(phoneBrandWalk);
  const phoneBrands = (
    phoneBrandCols[4] ??
    phoneBrandCols[phoneBrandCols.length - 1] ??
    []
  ).map((n) => n.label);
  check(
    "32 phone brands include Apple/Samsung",
    phoneBrands.includes("Tümü") &&
      phoneBrands.includes("Apple") &&
      phoneBrands.includes("Samsung"),
    phoneBrands.slice(0, 12).join(", "),
  );

  const laptop = createTextOnlyState("HP marka dizüstü bilgisayar arıyorum.");
  const laptopPath = resolveBrowsePath(laptop).map((p) => p.label);
  const laptopQuick = buildQuickSelectGroups(laptop);
  check(
    "32 laptop path Donanım>Bilgisayar>Dizüstü",
    laptopPath.includes("Donanım") &&
      laptopPath.includes("Bilgisayar") &&
      laptopPath.some((l) => /dizüstü/i.test(l)) &&
      (laptopPath.includes("HP") ||
        laptop.fields.brand?.kind === "VALUE"),
    laptopPath.join(" > "),
  );
  check(
    "32 laptop no resolution quick chips",
    !laptopQuick.some((g) => g.fieldKey === "resolution"),
    laptopQuick.map((g) => g.fieldKey).join(", "),
  );

  const laptopWalk = browseWalkFromPath([
    { id: "technology", kind: "category", label: "Teknoloji" },
    { id: "technology/donanim", kind: "subcategory", label: "Donanım" },
    {
      id: "tax:technology:donanim:bilgisayar",
      kind: "group",
      label: "Bilgisayar",
    },
    {
      id: "tax:technology:donanim:bilgisayar:dizustu-bilgisayar",
      kind: "product_type",
      label: "Dizüstü bilgisayar",
    },
  ] as never);
  const laptopBrands = (
    listBrowseCascadeColumns(laptopWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "32 laptop brands include HP/Dell/Lenovo",
    laptopBrands.includes("HP") &&
      laptopBrands.includes("Dell") &&
      laptopBrands.includes("Lenovo"),
    laptopBrands.slice(0, 12).join(", "),
  );

  // Web Sitesi service leaves must NOT grow hardware brand columns
  for (const leaf of [
    {
      id: "tax:technology:web-sitesi:web-hizmetleri:e-ticaret-sitesi",
      label: "E-ticaret sitesi",
    },
    {
      id: "tax:technology:web-sitesi:web-hizmetleri:landing-page",
      label: "Landing page",
    },
    {
      id: "tax:technology:web-sitesi:web-hizmetleri:hosting-domain-kurulumu",
      label: "Hosting / domain kurulumu",
    },
  ]) {
    const walk = browseWalkFromPath([
      { id: "technology", kind: "category", label: "Teknoloji" },
      { id: "technology/web-sitesi", kind: "subcategory", label: "Web Sitesi" },
      {
        id: "tax:technology:web-sitesi:web-hizmetleri",
        kind: "group",
        label: "Web hizmetleri",
      },
      { id: leaf.id, kind: "service_type", label: leaf.label },
    ] as never);
    const last = listBrowseCascadeColumns(walk).pop() ?? [];
    const labels = last.map((n) => n.label);
    check(
      `32 no hardware brands under ${leaf.label}`,
      !labels.some((l) =>
        /^(Apple|Samsung|Xiaomi|Huawei|HP|Dell|Lenovo|Tümü)$/i.test(l),
      ),
      labels.join(", ") || "(empty)",
    );
  }

  const web = createTextOnlyState("e-ticaret sitesi yaptırmak istiyorum");
  check(
    "32 web service not Marka:Web Sitesi",
    !(
      web.fields.brand?.kind === "VALUE" &&
      /web\s*sitesi/i.test(String(web.fields.brand.value ?? ""))
    ),
    String(web.fields.brand?.value ?? ""),
  );
}

// 33 Ev Mobilyası sahibinden-style rooms + product leaves
{
  const roomsExpected = [
    "Tümü",
    "Oturma Odası & Salon",
    "Mutfak",
    "Yemek Odası",
    "Yatak Odası",
    "Çocuk & Genç Odası",
    "Tamamlayıcı Ürünler",
  ];
  const roomWalk = browseWalkFromPath([
    { id: "furniture", kind: "category", label: "Mobilya ve Ofis" },
    {
      id: "furniture/ev-mobilyasi",
      kind: "subcategory",
      label: "Ev Mobilyası",
    },
  ] as never);
  const roomCols = listBrowseCascadeColumns(roomWalk);
  const rooms = (roomCols[2] ?? roomCols[roomCols.length - 1] ?? []).map(
    (n) => n.label,
  );
  check(
    "33 Ev Mobilyası rooms",
    roomsExpected.every((r) => rooms.includes(r)),
    rooms.join(", "),
  );

  const mutfakWalk = browseWalkFromPath([
    { id: "furniture", kind: "category", label: "Mobilya ve Ofis" },
    {
      id: "furniture/ev-mobilyasi",
      kind: "subcategory",
      label: "Ev Mobilyası",
    },
    {
      id: "tax:furniture:ev-mobilyasi:mutfak",
      kind: "group",
      label: "Mutfak",
    },
  ] as never);
  const mutfakItems = (
    listBrowseCascadeColumns(mutfakWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "33 Mutfak products",
    mutfakItems.includes("Tümü") &&
      mutfakItems.includes("Hazır Mutfak") &&
      mutfakItems.includes("Yer Sofrası") &&
      mutfakItems.includes("Fırın Dolabı"),
    mutfakItems.join(", "),
  );

  const salonWalk = browseWalkFromPath([
    { id: "furniture", kind: "category", label: "Mobilya ve Ofis" },
    {
      id: "furniture/ev-mobilyasi",
      kind: "subcategory",
      label: "Ev Mobilyası",
    },
    {
      id: "tax:furniture:ev-mobilyasi:oturma-odasi-salon",
      kind: "group",
      label: "Oturma Odası & Salon",
    },
  ] as never);
  const salonItems = (
    listBrowseCascadeColumns(salonWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "33 Salon products",
    salonItems.includes("Koltuk Takımı") &&
      salonItems.includes("TV Ünitesi") &&
      salonItems.includes("Köşe Koltuk Takımı"),
    salonItems.join(", "),
  );

  const yatakWalk = browseWalkFromPath([
    { id: "furniture", kind: "category", label: "Mobilya ve Ofis" },
    {
      id: "furniture/ev-mobilyasi",
      kind: "subcategory",
      label: "Ev Mobilyası",
    },
    {
      id: "tax:furniture:ev-mobilyasi:yatak-odasi",
      kind: "group",
      label: "Yatak Odası",
    },
  ] as never);
  const yatakItems = (
    listBrowseCascadeColumns(yatakWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "33 Yatak Odası products",
    yatakItems.includes("Gardırop") &&
      yatakItems.includes("Baza") &&
      yatakItems.includes("Makyaj Masası"),
    yatakItems.join(", "),
  );
}

// 34 Ofis Mobilyaları sahibinden-style groups + products
{
  const groupsExpected = [
    "Tümü",
    "Aksesuar",
    "Dolaplar",
    "Masalar",
    "Oturma Grubu",
    "Makam Oda Takımı",
  ];
  const groupWalk = browseWalkFromPath([
    { id: "furniture", kind: "category", label: "Mobilya ve Ofis" },
    {
      id: "furniture/ofis-mobilyalari",
      kind: "subcategory",
      label: "Ofis Mobilyaları",
    },
  ] as never);
  const groups = (
    listBrowseCascadeColumns(groupWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "34 Ofis Mobilyaları groups",
    groupsExpected.every((g) => groups.includes(g)),
    groups.join(", "),
  );

  const masaWalk = browseWalkFromPath([
    { id: "furniture", kind: "category", label: "Mobilya ve Ofis" },
    {
      id: "furniture/ofis-mobilyalari",
      kind: "subcategory",
      label: "Ofis Mobilyaları",
    },
    {
      id: "tax:furniture:ofis-mobilyalari:masalar",
      kind: "group",
      label: "Masalar",
    },
  ] as never);
  const masaItems = (
    listBrowseCascadeColumns(masaWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "34 Masalar products",
    masaItems.includes("Tümü") &&
      masaItems.includes("Çalışma Masası") &&
      masaItems.includes("Toplantı Masası") &&
      masaItems.includes("Banko"),
    masaItems.join(", "),
  );

  const oturmaWalk = browseWalkFromPath([
    { id: "furniture", kind: "category", label: "Mobilya ve Ofis" },
    {
      id: "furniture/ofis-mobilyalari",
      kind: "subcategory",
      label: "Ofis Mobilyaları",
    },
    {
      id: "tax:furniture:ofis-mobilyalari:oturma-grubu",
      kind: "group",
      label: "Oturma Grubu",
    },
  ] as never);
  const oturmaItems = (
    listBrowseCascadeColumns(oturmaWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "34 Oturma Grubu products",
    oturmaItems.includes("Yönetici Koltuğu") &&
      oturmaItems.includes("Bekleme Koltuğu") &&
      oturmaItems.includes("Personel & Ofis Koltuğu"),
    oturmaItems.join(", "),
  );

  const dolapWalk = browseWalkFromPath([
    { id: "furniture", kind: "category", label: "Mobilya ve Ofis" },
    {
      id: "furniture/ofis-mobilyalari",
      kind: "subcategory",
      label: "Ofis Mobilyaları",
    },
    {
      id: "tax:furniture:ofis-mobilyalari:dolaplar",
      kind: "group",
      label: "Dolaplar",
    },
  ] as never);
  const dolapItems = (
    listBrowseCascadeColumns(dolapWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "34 Dolaplar products",
    dolapItems.includes("Dosya Dolabı") &&
      dolapItems.includes("Keson") &&
      dolapItems.includes("Vitrin"),
    dolapItems.join(", "),
  );
}

// 35 Browse leaf → natural text (Şaraplık), not "Ev arıyorum"
{
  const browsed = applyTextThenBrowse("ev mobilyası arıyorum", [
    {
      key: "furnitureType",
      value: "Şaraplık",
      entityId: "tax:furniture:ev-mobilyasi:yemek-odasi:saraplik",
    },
  ]);
  check(
    "35 furniture browse compose Şaraplık",
    /şaraplık/i.test(browsed.composedText) &&
      !/^ev\s+arıyorum/i.test(browsed.composedText.trim()),
    browsed.composedText,
  );
  check(
    "35 furnitureType VALUE Şaraplık",
    browsed.state.fields.furnitureType?.kind === "VALUE" &&
      String(browsed.state.fields.furnitureType.value) === "Şaraplık",
    String(browsed.state.fields.furnitureType?.value ?? ""),
  );

  const fromText = createTextOnlyState("şaraplık arıyorum");
  check(
    "35 text şaraplık → furniture",
    fromText.categoryId === "furniture" ||
      fromText.taxonomyNodeId?.includes("saraplik") ||
      fromText.fields.furnitureType?.kind === "VALUE",
    `cat=${fromText.categoryId} tax=${fromText.taxonomyNodeId} ft=${fromText.fields.furnitureType?.value}`,
  );
}

// 36 Appliances Beyaz Eşya pillars + browse ↔ text
{
  const rootWalk = browseWalkFromPath([
    { id: "appliances", kind: "category", label: "Beyaz Eşya" },
  ] as never);
  const applianceSubs = (
    listBrowseCascadeColumns(rootWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "36 appliances pillars",
    applianceSubs.includes("Küçük Ev Aletleri") &&
      applianceSubs.includes("Beyaz Eşya") &&
      applianceSubs.includes("Isıtma, Soğutma ve Havalandırma"),
    applianceSubs.join(", "),
  );

  const beyazWalk = browseWalkFromPath([
    { id: "appliances", kind: "category", label: "Beyaz Eşya" },
    {
      id: "appliances/beyaz-esya",
      kind: "subcategory",
      label: "Beyaz Eşya",
    },
  ] as never);
  const beyaz = (
    listBrowseCascadeColumns(beyazWalk).pop() ?? []
  ).map((n) => n.label);
  check(
    "36 Beyaz Eşya products",
    beyaz.includes("Tümü") &&
      beyaz.includes("Buzdolabı") &&
      beyaz.includes("Şarap Dolabı") &&
      beyaz.includes("Çamaşır Makinesi"),
    beyaz.join(", "),
  );

  const browsed = applyTextThenBrowse("beyaz eşya arıyorum", [
    {
      key: "applianceType",
      value: "Buzdolabı",
      entityId: "tax:appliances:beyaz-esya:buzdolabi",
    },
  ]);
  check(
    "36 browse Buzdolabı compose",
    /buzdolabı/i.test(browsed.composedText) &&
      !/^beyaz\s+eşya\s+arıyorum/i.test(browsed.composedText.trim()),
    browsed.composedText,
  );
  check(
    "36 applianceType VALUE Buzdolabı",
    browsed.state.fields.applianceType?.kind === "VALUE" &&
      String(browsed.state.fields.applianceType.value) === "Buzdolabı",
    String(browsed.state.fields.applianceType?.value ?? ""),
  );

  const fromText = createTextOnlyState("Buzdolabı arıyorum");
  check(
    "36 text Buzdolabı → appliances",
    fromText.categoryId === "appliances" ||
      fromText.taxonomyNodeId?.includes("buzdolabi") ||
      fromText.fields.applianceType?.kind === "VALUE",
    `cat=${fromText.categoryId} tax=${fromText.taxonomyNodeId} at=${fromText.fields.applianceType?.value}`,
  );

  const path = resolveBrowsePath(fromText);
  check(
    "36 text Buzdolabı browse path",
    path.some((p) => /buzdolabı/i.test(p.label)) &&
      path.some((p) => /beyaz eşya/i.test(p.label)),
    path.map((p) => p.label).join(" › "),
  );
}

{
  const browseOnly = composeTextFromBrowseStack(
    [
      { kind: "category", label: "Otomotiv" },
      { kind: "subcategory", label: "Yedek Parça" },
    ],
    { categoryId: "automotive", subcategorySlug: "yedek-parca" },
  ).toLocaleLowerCase("tr-TR");
  check(
    "37 browse-only PART no yedek için yedek parça",
    !/yedek\s+için\s+yedek/.test(browseOnly) && /yedek parça/.test(browseOnly),
    browseOnly,
  );

  const alfa = composeTextFromBrowseStack(
    [
      { kind: "category", label: "Otomotiv" },
      { kind: "subcategory", label: "Yedek Parça" },
      { kind: "brand", label: "Alfa Romeo" },
      { kind: "model", label: "156" },
    ],
    { categoryId: "automotive", subcategorySlug: "yedek-parca" },
  );
  check(
    "37 Alfa browse PART natural",
    /Alfa Romeo/i.test(alfa) &&
      /156/.test(alfa) &&
      /arıyorum/i.test(alfa) &&
      !/yedek\s+için\s+yedek/i.test(alfa),
    alfa,
  );

  const bosch = createTextOnlyState(
    "Bosch çamaşır makinesi için pompa arıyorum",
  );
  const boschComposed = composeNaturalRequestText(bosch).toLocaleLowerCase(
    "tr-TR",
  );
  check(
    "37 Bosch compose no duplicate pompa clause",
    (boschComposed.match(/pompa/g) ?? []).length === 1 &&
      (boschComposed.match(/için/g) ?? []).length <= 1,
    boschComposed,
  );
}

console.log("\n========================================");
console.log(`verify-talep-hybrid-ui-v1: ${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log("Failures:");
  for (const e of errors) console.log(` - ${e}`);
}
process.exit(fail > 0 ? 1 : 0);
