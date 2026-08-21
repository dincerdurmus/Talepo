/**
 * Entity + global-core regressions for composer v2 phase 2 hotfix.
 */
import assert from "node:assert/strict";

import { syncFromText } from "../src/lib/request-composer/sync";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";
import {
  computeComposerPublishReadiness,
} from "../src/lib/request-composer/v2/publish-readiness";
import { extractBrandFromText } from "../src/lib/product-identity/brand-extraction";
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";

function factsOf(text: string) {
  const { state } = syncFromText(null, text);
  const facts = buildUnderstoodFacts(state);
  const byKey = Object.fromEntries(facts.map((f) => [f.key, f.displayValue]));
  return { state, facts, byKey };
}

function scheduleOf(
  text: string,
  values: Record<string, string> = {},
  extras: { locationMode?: string; isRemote?: boolean } = {},
) {
  const { state } = syncFromText(null, text);
  const hybrid = resolveHybridQuestions(state);
  const fieldStates = Object.fromEntries(
    Object.entries(state.fields).map(([k, f]) => [
      k,
      {
        kind: f?.kind,
        value:
          f?.kind === "VALUE"
            ? String(f.value ?? "")
            : f?.kind === "ANY"
              ? "no_preference"
              : null,
      },
    ]),
  );
  return scheduleComposerQuestions({
    categoryId: state.categoryId ?? "technology",
    needType:
      state.fields.needType?.kind === "VALUE"
        ? String(state.fields.needType.value ?? "")
        : null,
    candidates: hybrid.candidates,
    values: {
      ...values,
      locationMode: extras.locationMode,
    },
    fieldStates,
    isRemoteService: extras.isRemote,
    realEstateLocationComplete:
      state.categoryId === "real-estate"
        ? Boolean(
            state.understanding.location?.city?.value &&
              state.understanding.location?.district?.value,
          )
        : undefined,
  });
}

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(e);
  }
}

const negative = [
  ["bebek arabası arıyorum", /bebek\s*arab/i],
  ["çamaşır makinesi arıyorum", /çamaşır|camasir/i],
  ["bulaşık makinesi arıyorum", /bulaşık|bulasik/i],
  ["kahve makinesi arıyorum", /kahve/i],
  ["ofis koltuğu arıyorum", /koltu/i],
  ["mama sandalyesi arıyorum", /mama|sandalye/i],
  ["kartvizit baskısı istiyorum", /kartvizit/i],
  ["logo tasarımı istiyorum", /logo|tasarım/i],
] as const;

for (const [text, productRe] of negative) {
  check(`negative: no brand/model — ${text}`, () => {
    const { byKey } = factsOf(text);
    assert.ok(
      !byKey.brand,
      `brand should be empty, got ${byKey.brand}`,
    );
    assert.ok(
      !byKey.model,
      `model should be empty, got ${byKey.model}`,
    );
    const product =
      byKey.productType ?? byKey.applianceType ?? byKey.furnitureType ?? "";
    if (product) assert.match(product, productRe);
  });
}

check("positive: Chicco Goody Plus", () => {
  const { byKey } = factsOf(
    "Chicco Goody Plus bebek arabası arıyorum",
  );
  assert.match(String(byKey.brand ?? ""), /Chicco/i);
  assert.ok(!byKey.model || /Goody/i.test(byKey.model));
  assert.ok(!/bebek/i.test(String(byKey.brand ?? "")));
});

check("positive: Chicco long sentence keeps model", () => {
  const { byKey } = factsOf(
    "İstanbul Kadıköy'e Chicco Goody Plus bebek arabası arıyorum, bütçem 20-30 bin TL",
  );
  assert.match(String(byKey.brand ?? ""), /Chicco/i);
  assert.match(String(byKey.model ?? ""), /Goody/i);
});

check("positive: Bosch Serie 6", () => {
  const { byKey } = factsOf("Bosch Serie 6 çamaşır makinesi arıyorum");
  assert.match(String(byKey.brand ?? ""), /Bosch/i);
  assert.match(String(byKey.model ?? ""), /Serie\s*6/i);
});

check("positive: Heidelberg pump", () => {
  const { byKey } = factsOf(
    "Heidelberg SM 74 nemlendirme pompası arıyorum",
  );
  assert.match(String(byKey.brand ?? ""), /Heidelberg/i);
  assert.match(String(byKey.model ?? ""), /SM\s*74/i);
});

check("extractBrand: bebek arabası → none", () => {
  const r = extractBrandFromText("bebek arabası arıyorum");
  assert.equal(r.brand, null);
  assert.ok(r.productPhrase);
});

check("baby schedule includes city+budget", () => {
  const s = scheduleOf("bebek arabası arıyorum");
  assert.ok(s.blockingFieldKeys.includes("city"));
  assert.ok(s.blockingFieldKeys.includes("budget"));
  assert.equal(s.canEnterReview, false);
  assert.ok(s.visible.length <= 3);
  assert.ok(s.visible.some((q) => q.fieldKey === "city"));
  assert.ok(s.visible.some((q) => q.fieldKey === "budget"));
});

check("baby review blocked without budget/location", () => {
  const s = scheduleOf("bebek arabası arıyorum");
  const ready = computeComposerPublishReadiness({
    hasUsableText: true,
    schedule: s,
    categoryId: "baby",
    budgetValue: "",
    cityValue: "",
  });
  assert.equal(ready.canReview, false);
});

check("baby review opens after soft budget+location", () => {
  const s = scheduleOf("bebek arabası arıyorum", {
    budget: "Teklifleri görmek istiyorum",
    city: "Türkiye geneli",
    delivery: "Esnek",
  });
  const ready = computeComposerPublishReadiness({
    hasUsableText: true,
    schedule: s,
    categoryId: "baby",
    budgetValue: "Teklifleri görmek istiyorum",
    cityValue: "Türkiye geneli",
  });
  assert.equal(ready.canReview, true);
});

check("remote logo: location satisfied, budget still required", () => {
  const s = scheduleOf(
    "uzaktan logo tasarımı yaptırmak istiyorum",
    {},
    { locationMode: "remote", isRemote: true },
  );
  assert.ok(!s.blockingFieldKeys.includes("city"));
  assert.ok(s.blockingFieldKeys.includes("budget"));
});

// All 11 top categories: budget+location always scheduled when empty
for (const cat of REQUEST_CATEGORIES) {
  if ((cat as { system?: boolean }).system) continue;
  check(`global core: ${cat.id}`, () => {
    const sample =
      cat.id === "real-estate"
        ? "Kiralık daire arıyorum"
        : cat.id === "services"
          ? "Logo tasarımı istiyorum"
          : cat.id === "baby"
            ? "bebek arabası arıyorum"
            : cat.id === "printing"
              ? "kartvizit baskısı istiyorum"
              : cat.id === "automotive"
                ? "yedek parça arıyorum"
                : cat.id === "machinery"
                  ? "endüstriyel pompa arıyorum"
                  : cat.id === "furniture"
                    ? "ofis koltuğu arıyorum"
                    : cat.id === "technology"
                      ? "laptop arıyorum"
                      : cat.id === "appliances"
                        ? "çamaşır makinesi arıyorum"
                        : cat.id === "health"
                          ? "diş tedavisi arıyorum"
                          : cat.id === "home-kitchen"
                            ? "kahve makinesi arıyorum"
                            : `${cat.label} ürünü arıyorum`;

    const { state } = syncFromText(null, sample);
    const hybrid = resolveHybridQuestions(state);
    const schedule = scheduleComposerQuestions({
      categoryId: cat.id,
      candidates: hybrid.candidates,
      values: {},
      realEstateLocationComplete:
        cat.id === "real-estate" ? false : undefined,
    });
    assert.ok(
      schedule.blockingFieldKeys.includes("budget"),
      `${cat.id}: budget missing from block ${schedule.blockingFieldKeys.join(",")}`,
    );
    assert.ok(
      schedule.blockingFieldKeys.includes("city") ||
        cat.id === "services",
      `${cat.id}: city missing from block ${schedule.blockingFieldKeys.join(",")}`,
    );
    assert.ok(schedule.visible.length <= 3);
    assert.equal(schedule.canEnterReview, false);
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
