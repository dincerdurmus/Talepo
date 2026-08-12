/**
 * Alfa Romeo 156 identity closure V1
 * Run from apps/web:
 *   npx --yes tsx scripts/verify-alfa-identity-closure-v1.ts
 *
 * Offline fixtures. Does not load .env or touch databases.
 * Generic manufacturer-alias + part/model separation — not a one-off phrase map.
 */
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import {
  composeNaturalRequestText,
  createTextOnlyState,
} from "../src/lib/request-composer";
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
  subject: "PART" | "VEHICLE";
  brandIncludes: string;
  modelEquals?: string;
  modelIncludes?: string;
  modelNot?: string[];
  requestedIncludes?: string;
  requestedNotInModel?: string;
};

function snapshot(input: string) {
  const state = createTextOnlyState(input);
  const u = state.understanding;
  const parent = u.requestSubject.parentEntity;
  const requested = String(
    u.requestSubject.displayPhrase?.value ??
      u.requestSubject.name?.value ??
      "",
  );
  const brand = String(u.identity.brand?.value ?? "");
  const model = String(u.identity.model?.value ?? "");
  const generation = String(u.attributes.generation?.value ?? "");
  const parentBrand = String(parent?.brand?.value ?? "");
  const parentModel = String(parent?.model?.value ?? "");
  const compatibility = [parentBrand || brand, parentModel || model, generation]
    .filter(Boolean)
    .join(" / ");
  const text = composeNaturalRequestText(state);
  const projection = buildDiscoveryProjectionFromState(state);
  return {
    category: String(u.category.value ?? ""),
    subject: String(u.requestSubject.kind.value ?? ""),
    brand,
    model,
    generation,
    requested,
    parentBrand,
    parentModel,
    compatibility,
    text,
    projectionBrand: String(projection.entityRefs?.brand ?? ""),
    projectionModel: String(projection.entityRefs?.model ?? ""),
  };
}

function runCase(spec: CaseSpec) {
  const s = snapshot(spec.input);
  console.log(
    [
      `\n#${spec.id} INPUT=${spec.input}`,
      `  CATEGORY=${s.category}`,
      `  SUBJECT=${s.subject}`,
      `  BRAND=${s.brand}`,
      `  MODEL=${s.model}`,
      `  GENERATION=${s.generation || "—"}`,
      `  REQUESTED ITEM=${s.requested || "—"}`,
      `  COMPATIBILITY TARGET=${s.compatibility || "—"}`,
      `  TEXT=${s.text}`,
      `  PROJECTION=${JSON.stringify({
        brand: s.projectionBrand || null,
        model: s.projectionModel || null,
      })}`,
    ].join("\n"),
  );

  check(
    `#${spec.id} subject`,
    s.subject === spec.subject,
    s.subject,
  );
  check(
    `#${spec.id} brand`,
    fold(s.brand).includes(fold(spec.brandIncludes)),
    s.brand,
  );
  if (spec.modelEquals) {
    check(
      `#${spec.id} model equals`,
      fold(s.model) === fold(spec.modelEquals),
      s.model,
    );
  }
  if (spec.modelIncludes) {
    check(
      `#${spec.id} model includes`,
      fold(s.model).includes(fold(spec.modelIncludes)),
      s.model,
    );
  }
  for (const banned of spec.modelNot ?? []) {
    check(
      `#${spec.id} model not ${banned}`,
      !fold(s.model).includes(fold(banned)),
      s.model,
    );
  }
  if (spec.requestedIncludes) {
    check(
      `#${spec.id} requested item`,
      fold(s.requested).includes(fold(spec.requestedIncludes)),
      s.requested,
    );
  }
  if (spec.requestedNotInModel) {
    check(
      `#${spec.id} requested item not in model`,
      !fold(s.model).includes(fold(spec.requestedNotInModel)),
      s.model,
    );
  }
  if (spec.subject === "PART") {
    check(
      `#${spec.id} compatibility manufacturer`,
      fold(s.parentBrand).includes(fold(spec.brandIncludes)) ||
        fold(s.brand).includes(fold(spec.brandIncludes)),
      `${s.parentBrand} / ${s.brand}`,
    );
    const parentModel = spec.modelEquals ?? spec.modelIncludes ?? "";
    if (parentModel) {
      check(
        `#${spec.id} compatibility model`,
        fold(s.parentModel).includes(fold(parentModel)) ||
          fold(s.model).includes(fold(parentModel)),
        `${s.parentModel} / ${s.model}`,
      );
    }
    if (spec.requestedIncludes) {
      check(
        `#${spec.id} requested item not parent model`,
        !fold(s.parentModel).includes(fold(spec.requestedIncludes)),
        s.parentModel,
      );
    }
    check(
      `#${spec.id} projection brand`,
      fold(s.projectionBrand).includes(fold(spec.brandIncludes)),
      s.projectionBrand,
    );
  }
}

console.log("=== ALFA ROMEO IDENTITY CLOSURE ===\n");

runCase({
  id: 1,
  input: "alfa 156 tampon",
  subject: "PART",
  brandIncludes: "alfa romeo",
  modelEquals: "156",
  modelNot: ["tampon", "alfa"],
  requestedIncludes: "tampon",
  requestedNotInModel: "tampon",
});
runCase({
  id: 2,
  input: "alfa 156 far",
  subject: "PART",
  brandIncludes: "alfa romeo",
  modelEquals: "156",
  requestedIncludes: "far",
  requestedNotInModel: "far",
});
runCase({
  id: 3,
  input: "alfa 156 motor",
  subject: "PART",
  brandIncludes: "alfa romeo",
  modelEquals: "156",
  requestedIncludes: "motor",
  requestedNotInModel: "motor",
});
runCase({
  id: 4,
  input: "alfa romeo 156 tampon",
  subject: "PART",
  brandIncludes: "alfa romeo",
  modelEquals: "156",
  requestedIncludes: "tampon",
  requestedNotInModel: "tampon",
});
runCase({
  id: 5,
  input: "alfa giulia tampon",
  subject: "PART",
  brandIncludes: "alfa romeo",
  modelIncludes: "giulia",
  requestedIncludes: "tampon",
  requestedNotInModel: "tampon",
});
runCase({
  id: 6,
  input: "alfa stelvio far",
  subject: "PART",
  brandIncludes: "alfa romeo",
  modelIncludes: "stelvio",
  requestedIncludes: "far",
  requestedNotInModel: "far",
});
runCase({
  id: 7,
  input: "alfa 156 arıyorum",
  subject: "VEHICLE",
  brandIncludes: "alfa romeo",
  modelEquals: "156",
  modelNot: ["arıyorum", "ariyorum"],
});

console.log("\n=== CROSS-BRAND ===\n");

runCase({
  id: 8,
  input: "toyota corolla tampon",
  subject: "PART",
  brandIncludes: "toyota",
  modelIncludes: "corolla",
  requestedIncludes: "tampon",
  requestedNotInModel: "tampon",
});
runCase({
  id: 9,
  input: "bmw 320i far",
  subject: "PART",
  brandIncludes: "bmw",
  modelIncludes: "320i",
  requestedIncludes: "far",
  requestedNotInModel: "far",
});
runCase({
  id: 10,
  input: "mercedes c200 motor",
  subject: "PART",
  brandIncludes: "mercedes",
  modelIncludes: "c200",
  requestedIncludes: "motor",
  requestedNotInModel: "motor",
});
runCase({
  id: 11,
  input: "audi a4 tampon",
  subject: "PART",
  brandIncludes: "audi",
  modelIncludes: "a4",
  requestedIncludes: "tampon",
  requestedNotInModel: "tampon",
});
runCase({
  id: 12,
  input: "golf 7 far",
  subject: "PART",
  brandIncludes: "volkswagen",
  modelIncludes: "golf",
  modelNot: ["far"],
  requestedIncludes: "far",
  requestedNotInModel: "far",
});

console.log(`\n${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log(errors.map((e) => `  - ${e}`).join("\n"));
}
process.exit(fail ? 1 : 0);
