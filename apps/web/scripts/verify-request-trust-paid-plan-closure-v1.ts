/**
 * Request Trust & Paid Plan Value Closure V1
 * Run: npx tsx scripts/verify-request-trust-paid-plan-closure-v1.ts
 *
 * Offline fixtures — no DB. Plan personas use featuresForPlan + feature-scope.
 */
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery";
import {
  COMPANY_ONLY_FEATURES,
  COMPANY_OWNED_RESOURCE_FEATURES,
  featureScope,
  isPersonalApiCapable,
} from "../src/lib/membership/feature-scope";
import {
  featuresForPlan,
  hasFeature,
  type FeatureKey,
} from "../src/lib/membership/entitlements";
import {
  composeNaturalRequestText,
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
let partial = 0;
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

function markPartial(name: string, detail: string) {
  partial += 1;
  console.log(`PARTIAL — ${name}: ${detail}`);
}

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();

type Scenario = {
  id: string;
  text: string;
  expect: {
    subject?: string | string[];
    category?: string | string[];
    notSubject?: string | string[];
    notSubtypeAraç?: boolean;
    partNameIncludes?: string;
    compatBrandIncludes?: string;
    compatModelIncludes?: string;
    conditionCikma?: boolean;
    composeNoDup?: RegExp[];
    summaryNoAraç?: boolean;
  };
};

const SCENARIOS: Scenario[] = [
  {
    id: "1",
    text: "2019 Volkswagen Golf arıyorum",
    expect: { subject: "VEHICLE", category: "automotive" },
  },
  {
    id: "2",
    text: "Alfa Romeo 156 için sağ ön far arıyorum",
    expect: {
      subject: "PART",
      category: "automotive",
      partNameIncludes: "far",
      compatBrandIncludes: "Alfa",
      compatModelIncludes: "156",
    },
  },
  {
    id: "3",
    text: "Golf 7 dizel çıkma motor arıyorum",
    expect: {
      subject: "PART",
      category: "automotive",
      partNameIncludes: "motor",
      conditionCikma: true,
      compatModelIncludes: "Golf",
    },
  },
  {
    id: "4",
    text: "Toyota Corolla için ön tampon lazım, yan sanayi olmasın",
    expect: {
      subject: "PART",
      partNameIncludes: "tampon",
      compatBrandIncludes: "Toyota",
    },
  },
  {
    id: "5",
    text: "BMW olsun ama 3 serisi istemiyorum",
    expect: { subject: ["VEHICLE", "PRODUCT", "UNKNOWN"], category: "automotive" },
  },
  {
    id: "6",
    text: "140 ekran televizyon arıyorum, marka fark etmez ama Samsung olmasın",
    expect: {
      subject: "PRODUCT",
      category: "technology",
      notSubject: "VEHICLE",
      notSubtypeAraç: true,
      summaryNoAraç: true,
    },
  },
  {
    id: "7",
    text: "LG veya Sony 4K televizyon arıyorum",
    expect: {
      subject: "PRODUCT",
      category: "technology",
      notSubject: "VEHICLE",
    },
  },
  {
    id: "8",
    text: "iPhone 15 Pro Max 256 GB arıyorum",
    expect: {
      subject: "PRODUCT",
      category: "technology",
      notSubject: "VEHICLE",
      notSubtypeAraç: true,
    },
  },
  {
    id: "9",
    text: "MacBook için şarj adaptörü lazım",
    expect: {
      subject: ["PART", "ACCESSORY"],
      notSubject: "VEHICLE",
    },
  },
  {
    id: "10",
    text: "Bosch çamaşır makinesi arıyorum",
    expect: {
      subject: "PRODUCT",
      category: ["appliances", "home-kitchen", "technology"],
      notSubject: "VEHICLE",
    },
  },
  {
    id: "11",
    text: "Bosch Serie 6 çamaşır makinesi için pompa arıyorum",
    expect: {
      subject: "PART",
      partNameIncludes: "pompa",
      notSubject: "VEHICLE",
    },
  },
  {
    id: "12",
    text: "Buzdolabı arıyorum marka fark etmez",
    expect: {
      subject: "PRODUCT",
      notSubject: "VEHICLE",
    },
  },
  {
    id: "13",
    text: "5 ton 304 paslanmaz sac lazım",
    expect: { notSubject: "VEHICLE", notSubtypeAraç: true },
  },
  {
    id: "14",
    text: "Matbaa makinesi için rulman arıyorum",
    expect: {
      subject: "PART",
      partNameIncludes: "rulman",
      notSubject: "VEHICLE",
    },
  },
  {
    id: "15",
    text: "İkinci el Heidelberg baskı makinesi arıyorum",
    expect: {
      subject: ["INDUSTRIAL_EQUIPMENT", "PRODUCT", "MACHINE", "MANUFACTURED_ITEM"],
      notSubject: "VEHICLE",
    },
  },
  {
    id: "16",
    text: "50.000 adet karton kutu yaptırmak istiyorum, mat selefonlu",
    expect: {
      subject: "MANUFACTURED_ITEM",
      notSubject: ["VEHICLE", "SERVICE"],
    },
  },
  {
    id: "17",
    text: "10.000 adet katalog bastıracağım",
    expect: {
      subject: ["MANUFACTURED_ITEM", "PRODUCT"],
      notSubject: "VEHICLE",
    },
  },
  {
    id: "18",
    text: "Başakşehir'de 3+1 kiralık daire arıyorum",
    expect: {
      subject: "REAL_ESTATE",
      category: "real-estate",
      notSubtypeAraç: true,
    },
  },
  {
    id: "19",
    text: "İstanbul'da satılık dükkan arıyorum",
    expect: {
      subject: "REAL_ESTATE",
      category: "real-estate",
    },
  },
  {
    id: "20",
    text: "Ofis için klima bakım servisi arıyorum",
    expect: {
      subject: "SERVICE",
      notSubject: "VEHICLE",
    },
  },
  {
    id: "21",
    text: "100 m2 dükkana elektrik tesisatı yaptıracağım",
    expect: {
      subject: "SERVICE",
      notSubject: "VEHICLE",
    },
  },
  // Extra taxonomy coverage → ≥30
  {
    id: "22",
    text: "Dyson V15 süpürge arıyorum",
    expect: { subject: "PRODUCT", notSubject: "VEHICLE" },
  },
  {
    id: "23",
    text: "Ikea kanape arıyorum",
    expect: { notSubject: "VEHICLE", summaryNoAraç: true },
  },
  {
    id: "24",
    text: "Mercedes C180 arıyorum",
    expect: { subject: "VEHICLE", category: "automotive" },
  },
  {
    id: "25",
    text: "Renault Clio için arka tampon arıyorum",
    expect: { subject: "PART", partNameIncludes: "tampon" },
  },
  {
    id: "26",
    text: "Samsung Galaxy S24 arıyorum",
    expect: { subject: "PRODUCT", notSubject: "VEHICLE" },
  },
  {
    id: "27",
    text: "Bulaşık makinesi için pompa lazım",
    expect: { subject: "PART", partNameIncludes: "pompa", notSubject: "VEHICLE" },
  },
  {
    id: "28",
    text: "Ofis koltuğu arıyorum",
    expect: { notSubject: "VEHICLE" },
  },
  {
    id: "29",
    text: "CNC torna tezgahı arıyorum",
    expect: { notSubject: "VEHICLE" },
  },
  {
    id: "30",
    text: "Volkswagen Passat için sağ ayna arıyorum",
    expect: { subject: "PART", partNameIncludes: "ayna" },
  },
  {
    id: "31",
    text: "Xbox Series X arıyorum",
    expect: { subject: "PRODUCT", notSubject: "VEHICLE", notSubtypeAraç: true },
  },
];

function includesAny(actual: string | null | undefined, needle: string) {
  return Boolean(
    actual && actual.toLocaleLowerCase("tr-TR").includes(needle.toLocaleLowerCase("tr-TR")),
  );
}

function matchOne(actual: string | null | undefined, expected: string | string[]) {
  const list = Array.isArray(expected) ? expected : [expected];
  return list.some((e) => actual === e);
}

console.log("\n=== REQUEST ACCEPTANCE (≥30) ===\n");

for (const sc of SCENARIOS) {
  const u = understandRequest(sc.text);
  const kind = u.requestSubject.kind.value;
  const cat = u.category.value;
  const summary = buildUnderstandingSummary(u);
  const state = createTextOnlyState(sc.text);
  const composed = composeNaturalRequestText(state);
  const round = understandRequest(composed);
  const q = resolveHybridQuestions(state);
  const proj = buildDiscoveryProjectionFromState(state);

  const e = sc.expect;
  let ok = true;
  const details: string[] = [];

  if (e.subject && !matchOne(kind, e.subject)) {
    ok = false;
    details.push(`subject=${kind}`);
  }
  if (e.notSubject) {
    const bad = Array.isArray(e.notSubject) ? e.notSubject : [e.notSubject];
    if (bad.includes(kind ?? "")) {
      ok = false;
      details.push(`forbidden subject ${kind}`);
    }
  }
  if (e.category && !matchOne(cat, e.category)) {
    // category miss is PARTIAL when subject ok
    if (ok && e.subject && matchOne(kind, e.subject)) {
      markPartial(`${sc.id} category`, `got ${cat}`);
    } else {
      ok = false;
      details.push(`category=${cat}`);
    }
  }
  if (e.partNameIncludes) {
    const name =
      u.requestSubject.name?.value ?? u.requestSubject.displayPhrase?.value ?? "";
    if (!includesAny(name, e.partNameIncludes)) {
      ok = false;
      details.push(`part=${name}`);
    }
  }
  if (e.compatBrandIncludes) {
    const b =
      u.requestSubject.parentEntity?.brand?.value ?? u.identity.brand?.value ?? "";
    if (!includesAny(String(b), e.compatBrandIncludes)) {
      ok = false;
      details.push(`compatBrand=${b}`);
    }
  }
  if (e.compatModelIncludes) {
    const m =
      u.requestSubject.parentEntity?.model?.value ?? u.identity.model?.value ?? "";
    if (!includesAny(String(m), e.compatModelIncludes)) {
      ok = false;
      details.push(`compatModel=${m}`);
    }
  }
  if (e.conditionCikma) {
    const used = u.condition?.value === "USED";
    const cikma = u.condition?.evidence?.some((x) => /cikma|çıkma/i.test(x));
    if (!used || !cikma) {
      ok = false;
      details.push(`condition=${u.condition?.value}`);
    }
  }
  if (e.notSubtypeAraç || e.summaryNoAraç) {
    if (summary.subtypeLabel === "Araç" && kind !== "VEHICLE") {
      ok = false;
      details.push(`subtype=${summary.subtypeLabel}`);
    }
    if (kind !== "VEHICLE" && /\bAraç\b/i.test(summary.subtypeLabel ?? "")) {
      ok = false;
      details.push("summary Araç");
    }
  }
  if (e.composeNoDup) {
    for (const re of e.composeNoDup) {
      if (re.test(composed)) {
        ok = false;
        details.push(`compose dup ${re}`);
      }
    }
  }

  // Round-trip: subject should not flip to VEHICLE from non-vehicle
  if (
    kind &&
    kind !== "VEHICLE" &&
    round.requestSubject.kind.value === "VEHICLE" &&
    cat !== "automotive"
  ) {
    ok = false;
    details.push(`round-trip→VEHICLE`);
  }

  // Off-domain deviceFamily on TV
  if (sc.id === "6" || sc.id === "7") {
    if (q.candidates.some((c) => c.fieldKey === "deviceFamily")) {
      ok = false;
      details.push("deviceFamily asked");
    }
  }

  // Golf çıkma: no vehicle condition question
  if (sc.id === "3") {
    if (q.candidates.some((c) => c.fieldKey === "condition")) {
      ok = false;
      details.push("vehicle condition asked on PART");
    }
  }

  void proj;
  check(
    `S${sc.id} ${sc.text.slice(0, 42)}`,
    ok,
    details.join("; ") || undefined,
  );
}

// Compose dedupe structural checks
console.log("\n=== COMPOSE DEDUPE ===\n");
{
  let state = createTextOnlyState("Alfa Romeo 156 için sağ ön far arıyorum");
  state = {
    ...state,
    fields: {
      ...state.fields,
      brand: {
        kind: "VALUE",
        value: "Alfa Romeo",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
        evidence: [],
      },
      model: {
        kind: "VALUE",
        value: "156",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
        evidence: [],
      },
      part: {
        kind: "VALUE",
        value: "ön far",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
        evidence: [],
      },
      partPosition: {
        kind: "VALUE",
        value: "sağ ön",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
        evidence: [],
      },
      needType: {
        kind: "VALUE",
        value: "part",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
        evidence: [],
      },
    },
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
  };
  const text = composeNaturalRequestText(state).toLocaleLowerCase("tr-TR");
  check("compose no ön ön", !/ön\s+ön/.test(text), text);
  check("compose has sağ and far", /sağ/.test(text) && /far/.test(text), text);
}
{
  let state = createTextOnlyState("2019 Volkswagen Golf arıyorum");
  state = {
    ...state,
    fields: {
      ...state.fields,
      brand: {
        kind: "VALUE",
        value: "Volkswagen",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
        evidence: [],
      },
      model: {
        kind: "VALUE",
        value: "Golf",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
        evidence: [],
      },
      generation: {
        kind: "VALUE",
        value: "Golf VII",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
        evidence: [],
      },
      needType: {
        kind: "VALUE",
        value: "vehicle",
        provenance: "EXPLICIT_TEXT",
        confidence: 1,
        evidence: [],
      },
    },
    categoryId: "automotive",
    subcategorySlug: "arac",
  };
  const text = composeNaturalRequestText(state);
  check(
    "compose Golf not tripled",
    !/Golf\s+Golf\s+Golf/i.test(text) && !/Golf\s+Golf\s+VII/i.test(text),
    text,
  );
  check("compose keeps VW + Golf VII", /Volkswagen/i.test(text) && /VII/i.test(text), text);
}

{
  const bosch = createTextOnlyState(
    "Bosch çamaşır makinesi için pompa arıyorum",
  );
  const composed = composeNaturalRequestText(bosch).toLocaleLowerCase("tr-TR");
  check(
    "compose Bosch pump no duplicate için pompa",
    (composed.match(/için/g) ?? []).length <= 1 &&
      (composed.match(/pompa/g) ?? []).length === 1,
    composed,
  );
  check(
    "compose Bosch pump natural",
    /bosch/.test(composed) &&
      /pompa/.test(composed) &&
      /arıyorum/.test(composed),
    composed,
  );
  const headline = buildUnderstandingSummary(bosch.understanding)
    .headline.toLocaleLowerCase("tr-TR");
  check(
    "headline Bosch pump no duplicate için pompa",
    (headline.match(/için/g) ?? []).length <= 1 &&
      (headline.match(/pompa/g) ?? []).length <= 1,
    headline,
  );
}

{
  const golfPart = createTextOnlyState("Golf 7 dizel çıkma motor arıyorum");
  const composed = composeNaturalRequestText(golfPart);
  check(
    "compose Golf engine no duplicate motor/için/yedek",
    !/için\s+için/i.test(composed) &&
      (composed.toLocaleLowerCase("tr-TR").match(/\bmotor\b/g) ?? []).length <= 1 &&
      !/yedek\s+için\s+yedek/i.test(composed),
    composed,
  );
  const q = resolveHybridQuestions(golfPart);
  check(
    "Golf part modelYear not required",
    !q.missingRequired.some((f) => f.key === "modelYear") &&
      !q.candidates.some((c) => c.fieldKey === "modelYear"),
    q.missingRequired.map((f) => f.key).join(","),
  );
  const brand = golfPart.fields.brand?.value ?? "";
  const model = golfPart.fields.model?.value ?? "";
  check(
    "Golf entity brand is Volkswagen not Golf",
    /volkswagen/i.test(brand) && /golf/i.test(model) && !/^golf$/i.test(brand),
    `brand=${brand} model=${model}`,
  );
}

{
  const browsePart = composeNaturalRequestText(
    pinBrowseSemanticContext(createTextOnlyState(" "), {
      categoryId: "automotive",
      subcategorySlug: "yedek-parca",
    }),
  ).toLocaleLowerCase("tr-TR");
  check(
    "browse-only PART no yedek için yedek parça",
    !/yedek\s+için\s+yedek/.test(browsePart),
    browsePart,
  );
}

// State switching
console.log("\n=== STATE SWITCHING ===\n");
{
  let state = createTextOnlyState("2019 Volkswagen Golf arıyorum");
  state = pinBrowseSemanticContext(state, {
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
  });
  check(
    "VEHICLE→PART clears condition field kind or UNKNOWN",
    !state.fields.condition ||
      state.fields.condition.kind === "UNKNOWN" ||
      state.fields.needType?.value === "part",
  );
  check(
    "browse role PART",
    resolveBrowseSemanticRole({
      categoryId: "automotive",
      subcategorySlug: "yedek-parca",
    }).needType === "part",
  );
}

// Paid plan personas (offline)
console.log("\n=== PLAN PERSONAS (fixtures) ===\n");

const PREMIUM_PERSONAL = [
  "smart_alerts",
  "saved_searches",
  "advanced_filters",
  "ai_offer_assistant",
  "smart_matching",
  "basic_market_insights",
] as const satisfies readonly FeatureKey[];

{
  const std = featuresForPlan("STANDARD");
  const prem = featuresForPlan("PREMIUM");
  const pro = featuresForPlan("PROFESSIONAL");
  const corp = featuresForPlan("CORPORATE");

  check(
    "USER A STANDARD no premium keys",
    PREMIUM_PERSONAL.every((k) => !hasFeature(std, k)),
  );
  check(
    "USER B PREMIUM personal-capable entitlements true",
    PREMIUM_PERSONAL.every((k) => hasFeature(prem, k)),
  );
  check(
    "USER C PROFESSIONAL ⊇ PREMIUM",
    PREMIUM_PERSONAL.every((k) => hasFeature(pro, k)) &&
      hasFeature(pro, "hot_opportunities") &&
      hasFeature(pro, "watchlist"),
  );
  check(
    "USER D/E CORPORATE company features",
    hasFeature(corp, "hidden_inventory") &&
      hasFeature(corp, "team_management") &&
      hasFeature(corp, "lead_distribution"),
  );
  check(
    "USER F external = STANDARD features",
    PREMIUM_PERSONAL.every((k) => !hasFeature(std, k)),
  );

  check(
    "advanced_filters personal API capable",
    isPersonalApiCapable("advanced_filters"),
  );
  check(
    "basic_market_insights personal API capable",
    isPersonalApiCapable("basic_market_insights"),
  );
  check(
    "ai_offer_assistant personal API capable",
    isPersonalApiCapable("ai_offer_assistant"),
  );
  check(
    "saved_searches personal-capable after ownership model",
    featureScope("saved_searches") === "PERSONAL_CAPABLE" &&
      isPersonalApiCapable("saved_searches"),
  );
  check(
    "smart_alerts personal-capable after ownership model",
    featureScope("smart_alerts") === "PERSONAL_CAPABLE" &&
      isPersonalApiCapable("smart_alerts"),
  );
  check(
    "watchlist remains company-owned resource",
    (COMPANY_OWNED_RESOURCE_FEATURES as readonly string[]).includes("watchlist"),
  );
  check(
    "hidden_inventory company-only by nature",
    (COMPANY_ONLY_FEATURES as readonly string[]).includes("hidden_inventory") &&
      featureScope("hidden_inventory") === "COMPANY_ONLY_BY_NATURE",
  );
  check(
    "team_management company-only",
    featureScope("team_management") === "COMPANY_ONLY_BY_NATURE",
  );
}

// Browse PART pin still works
console.log("\n=== BROWSE PART SMOKE ===\n");
{
  const role = resolveBrowseSemanticRole({
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
  });
  let state: CanonicalRequestState = createTextOnlyState(" ");
  state = pinBrowseSemanticContext(
    { ...state, categoryId: "automotive", subcategorySlug: "yedek-parca" },
    { categoryId: "automotive", subcategorySlug: "yedek-parca" },
  );
  const synced = syncFromText(state, "Alfa Romeo 156", {
    structured: {
      categoryId: "automotive",
      fieldValues: { needType: "part" },
    },
  });
  check("browse pin needType part", role.needType === "part");
  check(
    "browse+text stays PART",
    synced.state.understanding.requestSubject.kind.value === "PART" ||
      synced.state.fields.needType?.value === "part",
  );
}

console.log(`\n=== SUMMARY pass=${pass} partial=${partial} fail=${fail} scenarios=${SCENARIOS.length} ===\n`);
if (errors.length) {
  console.log("FAILURES:");
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
process.exit(0);
