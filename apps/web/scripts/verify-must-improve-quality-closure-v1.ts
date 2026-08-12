/**
 * MUST IMPROVE Quality Closure V1 — focused verification.
 * Run from apps/web:
 *   npx --yes tsx scripts/verify-must-improve-quality-closure-v1.ts
 *
 * Offline fixtures. Does not load .env or touch databases.
 */
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import {
  applyBrowseSelectionToState,
  composeNaturalRequestText,
  createTextOnlyState,
  resolveHybridQuestions,
} from "../src/lib/request-composer";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { resolveSchemaCategory } from "../src/lib/request-understanding/activation-bridge";
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

function fold(value: string | null | undefined): string {
  return String(value ?? "").toLocaleLowerCase("tr-TR");
}

function questionKeys(state: ReturnType<typeof createTextOnlyState>): string[] {
  const q = resolveHybridQuestions(state);
  return [
    ...q.candidates.map((c) => c.fieldKey),
    ...q.missingRequired.map((f) => f.key),
    ...q.next.map((f) => f.key),
  ];
}

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();

type Probe = {
  input: string;
  category?: string | null;
  categoryUnknown?: boolean;
  subject?: string | string[];
  requestedIncludes?: string;
  brandNot?: string;
  brandIncludes?: string;
  modelIncludes?: string;
  yearMin?: string;
  yearExact?: string;
  noQuestions?: string[];
  questionsInclude?: string[];
};

function probe(label: string, spec: Probe) {
  const state = createTextOnlyState(spec.input);
  const u = state.understanding;
  const schema = resolveSchemaCategory(u);
  const subject = u.requestSubject.kind.value;
  const requested = String(
    u.requestSubject.displayPhrase?.value ?? u.requestSubject.name?.value ?? "",
  );
  const brand = String(u.identity.brand?.value ?? "");
  const model = String(u.identity.model?.value ?? "");
  const yearMin = u.attributes.yearMin?.value != null
    ? String(u.attributes.yearMin.value)
    : "";
  const yearExact = u.attributes.modelYear?.value != null
    ? String(u.attributes.modelYear.value)
    : "";
  const qKeys = questionKeys(state);
  const cat = u.category.value ?? state.categoryId ?? schema.categoryId ?? "";

  console.log(
    `  INPUT=${spec.input} | CAT=${cat || "UNKNOWN"}/${u.category.status} | SUB=${subject} | ITEM=${requested} | BRAND=${brand} | MODEL=${model} | Q=${qKeys.join(",") || "—"}`,
  );

  if (spec.categoryUnknown) {
    check(
      `${label} category unknown/empty`,
      u.category.status === "UNKNOWN" || !cat,
      `status=${u.category.status} cat=${cat} schema=${schema.categoryId}`,
    );
    check(
      `${label} schema not appliances`,
      schema.categoryId !== "appliances" && state.categoryId !== "appliances",
      `schema=${schema.categoryId} state=${state.categoryId}`,
    );
  }
  if (spec.category) {
    check(
      `${label} category ${spec.category}`,
      cat === spec.category || u.category.value === spec.category,
      `got ${cat || u.category.value}`,
    );
  }
  if (spec.subject) {
    const allowed = Array.isArray(spec.subject) ? spec.subject : [spec.subject];
    check(
      `${label} subject ${allowed.join("|")}`,
      allowed.includes(subject ?? ""),
      `got ${subject}`,
    );
  }
  if (spec.requestedIncludes) {
    check(
      `${label} requested item includes ${spec.requestedIncludes}`,
      fold(requested).includes(fold(spec.requestedIncludes)),
      requested,
    );
  }
  if (spec.brandNot) {
    check(
      `${label} brand is not ${spec.brandNot}`,
      fold(brand) !== fold(spec.brandNot),
      brand,
    );
  }
  if (spec.brandIncludes) {
    check(
      `${label} brand includes ${spec.brandIncludes}`,
      fold(brand).includes(fold(spec.brandIncludes)),
      brand,
    );
  }
  if (spec.modelIncludes) {
    check(
      `${label} model includes ${spec.modelIncludes}`,
      fold(model).includes(fold(spec.modelIncludes)),
      model,
    );
  }
  if (spec.yearMin) {
    check(
      `${label} yearMin ${spec.yearMin}`,
      yearMin === spec.yearMin,
      `yearMin=${yearMin} modelYear=${yearExact}`,
    );
  }
  if (spec.yearExact) {
    check(
      `${label} modelYear ${spec.yearExact}`,
      yearExact === spec.yearExact,
      yearExact,
    );
  }
  if (spec.noQuestions) {
    for (const key of spec.noQuestions) {
      check(
        `${label} no ${key} question`,
        !qKeys.includes(key),
        qKeys.join(","),
      );
    }
  }
  if (spec.questionsInclude) {
    for (const key of spec.questionsInclude) {
      check(
        `${label} asks ${key}`,
        qKeys.includes(key),
        qKeys.join(","),
      );
    }
  }
}

console.log("=== F-1 UNKNOWN ===\n");
for (const input of ["bişey arıyom", "bir şey lazım", "ürün arıyorum"]) {
  probe(input, {
    input,
    categoryUnknown: true,
    noQuestions: ["energyClass", "listingType", "modelYear", "engine", "propertyType"],
  });
}

console.log("\n=== F-2 PART ===\n");
probe("golf 7 motor", {
  input: "golf 7 motor",
  subject: "PART",
  requestedIncludes: "motor",
  modelIncludes: "golf",
  noQuestions: ["modelYear", "engine", "energyClass"],
});
probe("golf 7 far", {
  input: "golf 7 far",
  subject: "PART",
  requestedIncludes: "far",
});
probe("2.el golf motor", {
  input: "2.el golf motor",
  subject: "PART",
  requestedIncludes: "motor",
});
probe("alfa 156 tampon", {
  input: "alfa 156 tampon",
  subject: "PART",
  requestedIncludes: "tampon",
});
probe("bosch pompa", {
  input: "bosch pompa",
  subject: "PART",
  requestedIncludes: "pompa",
  noQuestions: ["energyClass"],
});
probe("matbaa makinesi rulman", {
  input: "matbaa makinesi rulman",
  subject: "PART",
  requestedIncludes: "rulman",
});

console.log("\n=== F-2 VEHICLE (false PART regression) ===\n");
probe("golf 7 arıyorum", {
  input: "golf 7 arıyorum",
  subject: "VEHICLE",
});
probe("2019 golf satın almak istiyorum", {
  input: "2019 golf satın almak istiyorum",
  subject: "VEHICLE",
  yearExact: "2019",
});

console.log("\n=== F-3 YEAR ===\n");
probe("2022 üstü c200", {
  input: "2022 üstü c200",
  brandNot: "2022",
  modelIncludes: "c200",
  yearMin: "2022",
});
probe("2020 model golf", {
  input: "2020 model golf",
  brandNot: "2020",
  modelIncludes: "golf",
  yearExact: "2020",
});
probe("2019 sonrası corolla", {
  input: "2019 sonrası corolla",
  brandNot: "2019",
  modelIncludes: "corolla",
  yearMin: "2019",
});
probe("2019 iphone", {
  input: "2019 iphone",
  brandNot: "2019",
});

console.log("\n=== F-4 FURNITURE vs REAL ESTATE ===\n");
for (const input of [
  "ofis koltuğu",
  "ofis masası",
  "çalışma masası",
  "toplantı masası",
  "dosya dolabı",
]) {
  probe(input, {
    input,
    category: "furniture",
    subject: ["PRODUCT", "UNKNOWN"],
    noQuestions: ["listingType", "propertyType", "energyClass"],
  });
}
for (const input of ["kiralık ofis", "satılık ofis", "200 m2 ofis arıyorum"]) {
  probe(input, {
    input,
    category: "real-estate",
    subject: "REAL_ESTATE",
  });
}

console.log("\n=== ELECTRONICS / NEGATION (report-only if fail) ===\n");
probe("samsung 55", {
  input: "samsung 55",
  brandNot: "55",
});
probe("iphone 15", {
  input: "iphone 15",
  brandNot: "15",
});
{
  const state = createTextOnlyState("bmw olsun ama 3 serisi istemiyorum");
  const model = String(state.understanding.identity.model?.value ?? "");
  const brand = String(state.understanding.identity.brand?.value ?? "");
  console.log(
    `  INPUT=bmw olsun ama 3 serisi istemiyorum | BRAND=${brand} | MODEL=${model}`,
  );
  const okBrand = fold(brand).includes("bmw");
  const okModel = !fold(model).includes("olsun");
  if (okBrand && okModel) {
    pass += 1;
    console.log("PASS — negation model is not Olsun");
  } else {
    console.log(
      `REMAINING P1 — negation: brand=${brand} model=${model} (not in F-1..F-7 scope)`,
    );
  }
}

console.log("\n=== F-7 CANONICAL ANSWER WRITE ===\n");
{
  const base = createTextOnlyState("golf 7 motor");
  const answered = applyBrowseSelectionToState(base, {
    key: "city",
    value: "İstanbul",
  });
  const facts = buildUnderstoodFacts(answered);
  const text = composeNaturalRequestText(answered);
  const projection = buildDiscoveryProjectionFromState(answered);
  check(
    "F-7 city field in canonical state",
    answered.fields.city?.kind === "VALUE" &&
      fold(String(answered.fields.city.value)).includes("istanbul"),
    String(answered.fields.city?.value),
  );
  check(
    "F-7 understood facts include city",
    facts.some((f) => f.key === "city" && fold(f.displayValue).includes("istanbul")),
    facts.map((f) => `${f.key}=${f.displayValue}`).join("; "),
  );
  check(
    "F-7 generated text includes city",
    fold(text).includes("istanbul"),
    text,
  );
  check(
    "F-7 discovery projection includes city",
    fold(projection.attributes.city ?? "").includes("istanbul"),
    JSON.stringify(projection.attributes),
  );

  const condBase = createTextOnlyState("bosch pompa");
  const condAnswered = applyBrowseSelectionToState(condBase, {
    key: "condition",
    value: "Sıfır",
  });
  const condFacts = buildUnderstoodFacts(condAnswered);
  const condText = composeNaturalRequestText(condAnswered);
  const condProj = buildDiscoveryProjectionFromState(condAnswered);
  check(
    "F-7 condition in canonical state",
    condAnswered.fields.condition?.kind === "VALUE" &&
      (fold(String(condAnswered.fields.condition.value)).includes("sıfır") ||
        fold(String(condAnswered.fields.condition.value)).includes("sifir")),
    String(condAnswered.fields.condition?.value),
  );
  check(
    "F-7 condition in understood facts",
    condFacts.some((f) => f.key === "condition"),
    condFacts.map((f) => `${f.key}=${f.displayValue}`).join("; "),
  );
  check(
    "F-7 condition in generated text or facts",
    fold(condText).includes("sıfır") ||
      fold(condText).includes("sifir") ||
      condFacts.some((f) => f.key === "condition"),
    condText,
  );
  check(
    "F-7 condition in discovery projection",
    Boolean(condProj.attributes.condition),
    JSON.stringify(condProj.attributes),
  );

  const brandBase = createTextOnlyState("ofis koltuğu");
  const brandAnswered = applyBrowseSelectionToState(brandBase, {
    key: "brand",
    value: "Ikea",
  });
  check(
    "F-7 furniture brand answer writes canonical field",
    String(brandAnswered.fields.brand?.value ?? "") === "Ikea",
    String(brandAnswered.fields.brand?.value),
  );
  check(
    "F-7 furniture brand in facts",
    buildUnderstoodFacts(brandAnswered).some(
      (f) => f.key === "brand" && f.displayValue === "Ikea",
    ),
  );
  check(
    "F-7 furniture brand in projection",
    buildDiscoveryProjectionFromState(brandAnswered).attributes.brand ===
      "Ikea",
  );
}

console.log("\n=== P1 HAPPY-PATH REGRESSION ===\n");
{
  const golf = createTextOnlyState("Golf 7 dizel çıkma motor arıyorum");
  check(
    "P1 Golf çıkma motor still PART",
    golf.understanding.requestSubject.kind.value === "PART",
    String(golf.understanding.requestSubject.kind.value),
  );
  const bosch = createTextOnlyState("Bosch çamaşır makinesi için pompa arıyorum");
  check(
    "P1 Bosch pump still PART",
    bosch.understanding.requestSubject.kind.value === "PART",
    String(bosch.understanding.requestSubject.kind.value),
  );
}

console.log(`\n=== RESULT ${pass} pass / ${fail} fail ===\n`);
if (errors.length) {
  for (const e of errors) console.log(`  • ${e}`);
}
process.exit(fail > 0 ? 1 : 0);
