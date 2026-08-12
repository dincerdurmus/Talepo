/**
 * Request Intelligence P1 Closure V1
 * Run from apps/web:
 *   npx --yes tsx scripts/verify-request-intelligence-p1-closure-v1.ts
 *
 * Offline fixtures. Does not load .env or touch databases.
 */
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import {
  applyBrowseSelectionToState,
  composeNaturalRequestText,
  createTextOnlyState,
} from "../src/lib/request-composer";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { buildUnderstandingSummary } from "../src/lib/request-understanding/activation-bridge";
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

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();

type CaseSpec = {
  id: number;
  input: string;
  category?: string | string[];
  categoryUnknown?: boolean;
  subject?: string | string[];
  brandIncludes?: string;
  brandEquals?: string;
  brandEmpty?: boolean;
  brandNot?: string | string[];
  modelIncludes?: string;
  modelEmpty?: boolean;
  modelNot?: string | string[];
  excludedIncludes?: string;
  anyBrand?: boolean;
  yearMin?: string;
  attributesIncludes?: string;
  productTypeIncludes?: string;
};

function snapshot(input: string) {
  const state = createTextOnlyState(input);
  const u = state.understanding;
  const facts = buildUnderstoodFacts(state);
  const text = composeNaturalRequestText(state);
  const projection = buildDiscoveryProjectionFromState(state);
  const brand = String(u.identity.brand?.value ?? state.fields.brand?.value ?? "");
  const model = String(u.identity.model?.value ?? state.fields.model?.value ?? "");
  const excluded = [
    ...(state.fields.brand?.excludedValues ?? []),
    ...(state.fields.model?.excludedValues ?? []),
  ];
  const any =
    state.fields.brand?.kind === "ANY" || Boolean(u.constraints?.byField?.brand?.any);
  const yearMin =
    u.attributes.yearMin?.value != null
      ? String(u.attributes.yearMin.value)
      : String(state.fields.yearMin?.value ?? "");
  const attrs = Object.entries(u.attributes)
    .filter(([, v]) => v?.value != null)
    .map(([k, v]) => `${k}=${JSON.stringify(v.value)}`)
    .join("; ");
  return {
    state,
    u,
    facts,
    text,
    projection,
    category: String(u.category.value ?? ""),
    subject: String(u.requestSubject.kind.value ?? ""),
    brand,
    model,
    excluded,
    any,
    yearMin,
    attrs,
    screenSize: String(
      state.fields.screenSize?.value ?? u.attributes.screenSize?.value ?? "",
    ),
    productType: String(state.fields.productType?.value ?? ""),
    storage: String(u.attributes.storage?.value ?? ""),
  };
}

function report(spec: CaseSpec, s: ReturnType<typeof snapshot>) {
  console.log(
    [
      `  #${spec.id} INPUT=${spec.input}`,
      `  CATEGORY=${s.category}`,
      `  SUBJECT=${s.subject}`,
      `  BRAND=${s.brand}`,
      `  MODEL=${s.model}`,
      `  EXCLUDED=${s.excluded.join("|") || "—"}`,
      `  ANY=${s.any}`,
      `  YEAR=${s.yearMin || "—"}`,
      `  ATTRIBUTES=${s.attrs || "—"}`,
      `  UNDERSTOOD FACTS=${s.facts.map((f) => `${f.key}=${f.displayValue}`).join("; ") || "—"}`,
      `  TEXT=${s.text}`,
      `  PROJECTION=${JSON.stringify({
        brand: s.projection.attributes.brand ?? null,
        model: s.projection.attributes.model ?? null,
        excluded: Object.fromEntries(
          Object.entries(s.projection.constraints).filter(
            ([, c]) => c.excluded?.length,
          ),
        ),
      })}`,
    ].join("\n"),
  );
}

function runCase(spec: CaseSpec) {
  const s = snapshot(spec.input);
  report(spec, s);
  const brandF = fold(s.brand);
  const modelF = fold(s.model);
  const catF = fold(s.category);
  const exclF = fold(s.excluded.join(" "));

  if (spec.categoryUnknown) {
    check(
      `#${spec.id} category unknown/empty`,
      !s.category ||
        s.u.category.status === "UNKNOWN" ||
        catF === "unknown" ||
        s.u.category.status === "TENTATIVE",
      `category=${s.category} status=${s.u.category.status}`,
    );
  } else if (spec.category) {
    const want = Array.isArray(spec.category) ? spec.category : [spec.category];
    check(
      `#${spec.id} category`,
      want.some((c) => catF.includes(fold(c))),
      s.category,
    );
  }
  if (spec.subject) {
    const want = Array.isArray(spec.subject) ? spec.subject : [spec.subject];
    check(
      `#${spec.id} subject`,
      want.some((v) => fold(s.subject) === fold(v)),
      s.subject,
    );
  }
  if (spec.brandIncludes) {
    check(
      `#${spec.id} brand includes ${spec.brandIncludes}`,
      brandF.includes(fold(spec.brandIncludes)),
      s.brand,
    );
  }
  if (spec.brandEquals) {
    check(
      `#${spec.id} brand equals ${spec.brandEquals}`,
      brandF === fold(spec.brandEquals) || brandF.includes(fold(spec.brandEquals)),
      s.brand,
    );
  }
  if (spec.brandEmpty) {
    check(`#${spec.id} brand empty`, !s.brand.trim(), s.brand);
  }
  for (const n of Array.isArray(spec.brandNot) ? spec.brandNot : spec.brandNot ? [spec.brandNot] : []) {
    check(`#${spec.id} brand not ${n}`, !brandF.includes(fold(n)), s.brand);
  }
  if (spec.modelIncludes) {
    check(
      `#${spec.id} model includes ${spec.modelIncludes}`,
      modelF.includes(fold(spec.modelIncludes)),
      s.model,
    );
  }
  if (spec.modelEmpty) {
    check(`#${spec.id} model empty`, !modelF.trim() || modelF === "null", s.model);
  }
  for (const n of Array.isArray(spec.modelNot) ? spec.modelNot : spec.modelNot ? [spec.modelNot] : []) {
    check(`#${spec.id} model not ${n}`, !modelF.includes(fold(n)), s.model);
  }
  if (spec.excludedIncludes) {
    check(
      `#${spec.id} excluded includes ${spec.excludedIncludes}`,
      exclF.includes(fold(spec.excludedIncludes)) ||
        s.facts.some(
          (f) =>
            f.key.includes("excluded") &&
            fold(f.displayValue).includes(fold(spec.excludedIncludes!)),
        ),
      s.excluded.join("|"),
    );
  }
  if (spec.anyBrand) {
    check(`#${spec.id} brand ANY`, s.any, `any=${s.any} brand=${s.brand}`);
  }
  if (spec.yearMin) {
    check(`#${spec.id} yearMin`, s.yearMin.includes(spec.yearMin), s.yearMin);
  }
  if (spec.attributesIncludes) {
    check(
      `#${spec.id} attributes`,
      fold(s.attrs).includes(fold(spec.attributesIncludes)) ||
        fold(s.screenSize).includes(fold(spec.attributesIncludes)) ||
        fold(s.storage).includes(fold(spec.attributesIncludes)) ||
        s.facts.some((f) => fold(`${f.key} ${f.displayValue}`).includes(fold(spec.attributesIncludes!))),
      s.attrs,
    );
  }
  if (spec.productTypeIncludes) {
    check(
      `#${spec.id} productType`,
      fold(s.productType).includes(fold(spec.productTypeIncludes)) ||
        fold(s.attrs).includes(fold(spec.productTypeIncludes)),
      s.productType,
    );
  }
}

console.log("\n=== NEGATION ===\n");
runCase({
  id: 1,
  input: "bmw olsun ama 3 serisi istemiyorum",
  brandIncludes: "bmw",
  modelNot: "olsun",
  excludedIncludes: "3",
});
runCase({
  id: 2,
  input: "toyota olsun corolla olmasın",
  brandIncludes: "toyota",
  modelNot: ["olsun", "corolla"],
  excludedIncludes: "corolla",
});
runCase({
  id: 3,
  input: "marka fark etmez samsung olmasın",
  anyBrand: true,
  excludedIncludes: "samsung",
  brandNot: "samsung",
});
runCase({
  id: 4,
  input: "samsung istemiyorum",
  excludedIncludes: "samsung",
  brandEmpty: true,
});

console.log("\n=== SAMSUNG ===\n");
runCase({
  id: 5,
  input: "samsung 55",
  category: "technology",
  brandIncludes: "samsung",
  modelNot: "55",
  attributesIncludes: "55",
});
runCase({
  id: 6,
  input: "samsung 55 inç",
  category: "technology",
  brandIncludes: "samsung",
  attributesIncludes: "55",
});
runCase({
  id: 7,
  input: "samsung s24",
  category: "technology",
  brandIncludes: "samsung",
  modelIncludes: "s24",
  modelNot: "55",
});
runCase({
  id: 8,
  input: "samsung buzdolabı",
  category: "appliances",
  brandIncludes: "samsung",
});

console.log("\n=== IPHONE ===\n");
runCase({
  id: 9,
  input: "iphone 15",
  brandEquals: "Apple",
  modelIncludes: "iphone 15",
  brandNot: "iphone",
});
runCase({
  id: 10,
  input: "iphone 15 pro",
  brandEquals: "Apple",
  modelIncludes: "iphone 15 pro",
});
runCase({
  id: 11,
  input: "iphone 15 pro max 256 gb",
  brandEquals: "Apple",
  modelIncludes: "iphone 15 pro max",
  attributesIncludes: "256",
});
runCase({
  id: 12,
  input: "iphone 14",
  brandEquals: "Apple",
  modelIncludes: "iphone 14",
});

console.log("\n=== MERCEDES ===\n");
runCase({
  id: 13,
  input: "2022 üstü c200",
  brandIncludes: "mercedes",
  modelIncludes: "c200",
  yearMin: "2022",
  brandNot: "2022",
});
runCase({
  id: 14,
  input: "c180",
  brandIncludes: "mercedes",
  modelIncludes: "c180",
});
runCase({
  id: 15,
  input: "e200",
  brandIncludes: "mercedes",
  modelIncludes: "e200",
});

console.log("\n=== OTHER MODEL IDENTITY ===\n");
runCase({
  id: 16,
  input: "bmw 320i",
  brandIncludes: "bmw",
  modelIncludes: "320i",
});
runCase({
  id: 17,
  input: "audi a3",
  brandIncludes: "audi",
  modelIncludes: "a3",
});
runCase({
  id: 18,
  input: "audi a4",
  brandIncludes: "audi",
  modelIncludes: "a4",
});

console.log("\n=== UNKNOWN ===\n");
runCase({
  id: 19,
  input: "bir şey lazım",
  brandNot: ["bir", "şey", "sey"],
});
runCase({
  id: 20,
  input: "bişey arıyom",
  brandNot: ["bişey", "bisey", "bir"],
});

console.log("\n=== PART ===\n");
runCase({
  id: 21,
  input: "golf 7 motor",
  subject: "PART",
});
runCase({
  id: 22,
  input: "alfa 156 tampon",
  subject: "PART",
  brandNot: "156",
});
runCase({
  id: 23,
  input: "bosch pompa",
  subject: "PART",
});

console.log("\n=== UNDERSTOOD STATE (single truth, no lag) ===\n");
{
  const base = createTextOnlyState("samsung 55");
  const beforeFacts = buildUnderstoodFacts(base);
  const beforeSummary = buildUnderstandingSummary(base.understanding);
  const answered = applyBrowseSelectionToState(base, {
    key: "city",
    value: "İstanbul",
  });
  const afterFacts = buildUnderstoodFacts(answered);
  const afterText = composeNaturalRequestText(answered);
  const afterProj = buildDiscoveryProjectionFromState(answered);
  const lagSummary = buildUnderstandingSummary(answered.understanding);

  check(
    "#24 same understanding snapshot (no second parse)",
    answered.understanding.rawInput === base.understanding.rawInput &&
      String(answered.understanding.identity.brand?.value) ===
        String(base.understanding.identity.brand?.value),
  );
  check(
    "#24 canonical city updates immediately",
    answered.fields.city?.kind === "VALUE" &&
      fold(String(answered.fields.city.value)).includes("istanbul"),
    String(answered.fields.city?.value),
  );
  check(
    "#24 understood facts include city immediately",
    afterFacts.some(
      (f) => f.key === "city" && fold(f.displayValue).includes("istanbul"),
    ),
    afterFacts.map((f) => `${f.key}=${f.displayValue}`).join("; "),
  );
  check(
    "#24 generated text reflects answer",
    fold(afterText).includes("istanbul"),
    afterText,
  );
  check(
    "#24 discovery projection reflects answer",
    fold(afterProj.attributes.city ?? "").includes("istanbul"),
    JSON.stringify(afterProj.attributes),
  );
  check(
    "#24 demoted summary lags (proof of single-truth switch)",
    !lagSummary.chips.some((c) => fold(c.displayValue).includes("istanbul")),
    lagSummary.chips.map((c) => `${c.fieldKey}=${c.displayValue}`).join("; "),
  );
  check(
    "#24 facts stay aligned with pre-answer identity",
    beforeFacts.some((f) => fold(f.displayValue).includes("samsung")) ||
      fold(String(base.fields.brand?.value)).includes("samsung"),
    beforeSummary.chips.map((c) => `${c.fieldKey}=${c.displayValue}`).join("; "),
  );

  const iphone = createTextOnlyState("iphone 15");
  const iphoneAnswered = applyBrowseSelectionToState(iphone, {
    key: "condition",
    value: "Sıfır",
  });
  const iphoneFacts = buildUnderstoodFacts(iphoneAnswered);
  const iphoneText = composeNaturalRequestText(iphoneAnswered);
  const iphoneProj = buildDiscoveryProjectionFromState(iphoneAnswered);
  check(
    "#25 iphone answer → facts",
    iphoneFacts.some((f) => f.key === "condition"),
    iphoneFacts.map((f) => `${f.key}=${f.displayValue}`).join("; "),
  );
  check(
    "#25 iphone answer → text",
    fold(iphoneText).includes("sıfır") || fold(iphoneText).includes("sifir"),
    iphoneText,
  );
  check(
    "#25 iphone answer → projection",
    fold(iphoneProj.attributes.condition ?? "").includes("sıfır") ||
      fold(iphoneProj.attributes.condition ?? "").includes("sifir") ||
      fold(String(iphoneAnswered.fields.condition?.value)).includes("sıfır"),
    JSON.stringify(iphoneProj.attributes),
  );
  check(
    "#25 apple brand preserved after answer",
    fold(String(iphoneAnswered.fields.brand?.value)).includes("apple"),
    String(iphoneAnswered.fields.brand?.value),
  );
}

console.log("\n=== CROSS-DOMAIN SANITY ===\n");
runCase({
  id: 26,
  input: "samsung s24",
  category: "technology",
  modelNot: "55",
});
runCase({
  id: 27,
  input: "2022 üstü c200",
  brandNot: "2022",
});

console.log(`\n${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log("\nFAILURES:");
  for (const e of errors) console.log(` - ${e}`);
}
process.exit(fail > 0 ? 1 : 0);
