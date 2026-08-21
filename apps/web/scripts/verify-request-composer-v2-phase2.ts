/**
 * Phase 2 remaining verifier — understanding regressions + focused question helpers.
 */
import assert from "node:assert/strict";

import { syncFromText } from "../src/lib/request-composer/sync";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { selectFocusedQuestions } from "../src/lib/request-composer/v2/focused-questions";
import { isFieldRequired } from "../src/lib/request-category-engine";

type Case = {
  name: string;
  text: string;
  expect: {
    brand?: string | null;
    model?: string | null;
    productIncludes?: string;
    screenIncludes?: string;
    screenUnit?: string;
    modelForbidden?: string[];
  };
};

const cases: Case[] = [
  {
    name: "Arçelik 55 inç — no fake model",
    text: "Arçelik 55 inç televizyon",
    expect: {
      brand: "Arçelik",
      model: null,
      productIncludes: "Televizyon",
      screenIncludes: "55",
      screenUnit: "inç",
      modelForbidden: ["inç", "televizyon"],
    },
  },
  {
    name: "55'' Smart TV",
    text: "55'' Arçelik Smart TV",
    expect: {
      brand: "Arçelik",
      model: null,
      productIncludes: "Televizyon",
      screenIncludes: "55",
      screenUnit: "inç",
    },
  },
  {
    name: "140 ekran",
    text: "140 ekran Arçelik televizyon",
    expect: {
      brand: "Arçelik",
      model: null,
      productIncludes: "Televizyon",
      screenIncludes: "140",
      screenUnit: "ekran",
    },
  },
  {
    name: "A55 D real model kept",
    text: "Arçelik A55 D 55 inç televizyon",
    expect: {
      brand: "Arçelik",
      model: "A55 D",
      productIncludes: "Televizyon",
      screenIncludes: "55",
      screenUnit: "inç",
      modelForbidden: ["Galaxy", "inç"],
    },
  },
  {
    name: "Samsung QLED",
    text: "Samsung 65 inç QLED TV",
    expect: {
      brand: "Samsung",
      model: null,
      productIncludes: "Televizyon",
      screenIncludes: "65",
      screenUnit: "inç",
    },
  },
  {
    name: "Heidelberg pump",
    text: "Heidelberg SM 74 nemlendirme pompası",
    expect: {
      brand: "Heidelberg",
      model: "SM 74",
      modelForbidden: ["pomp"],
    },
  },
];

let failed = 0;
let passed = 0;

function factValue(
  facts: ReturnType<typeof buildUnderstoodFacts>,
  key: string,
): string | null {
  return facts.find((f) => f.key === key)?.displayValue ?? null;
}

for (const c of cases) {
  try {
    const { state } = syncFromText(null, c.text);
    const facts = buildUnderstoodFacts(state);
    const brand = factValue(facts, "brand");
    const model = factValue(facts, "model");
    const product =
      factValue(facts, "productType") ?? factValue(facts, "applianceType");
    const screen = factValue(facts, "screenSize");

    if (c.expect.brand != null) {
      assert.equal(brand, c.expect.brand, `${c.name}: brand`);
    }
    if (c.expect.model === null) {
      assert.equal(model, null, `${c.name}: model should be empty`);
    } else if (c.expect.model) {
      assert.ok(
        model?.includes(c.expect.model),
        `${c.name}: model expected ${c.expect.model}, got ${model}`,
      );
    }
    if (c.expect.productIncludes) {
      assert.ok(
        product
          ?.toLocaleLowerCase("tr-TR")
          .includes(c.expect.productIncludes.toLocaleLowerCase("tr-TR")),
        `${c.name}: product`,
      );
    }
    if (c.expect.screenIncludes) {
      assert.ok(
        screen?.includes(c.expect.screenIncludes),
        `${c.name}: screen`,
      );
    }
    if (c.expect.screenUnit) {
      assert.ok(
        screen?.includes(c.expect.screenUnit),
        `${c.name}: screen unit ${c.expect.screenUnit}, got ${screen}`,
      );
    }
    // No raw English enums in display
    for (const f of facts) {
      assert.ok(
        !/^(hardware|software|television|vehicle|part)$/i.test(f.displayValue),
        `${c.name}: raw enum ${f.displayValue}`,
      );
    }
    for (const bad of c.expect.modelForbidden ?? []) {
      assert.ok(
        !model?.toLocaleLowerCase("tr-TR").includes(bad.toLocaleLowerCase("tr-TR")),
        `${c.name}: model must not include ${bad}`,
      );
    }
    console.log(`PASS ${c.name}`);
    passed += 1;
  } catch (err) {
    console.error(`FAIL ${c.name}`, err);
    failed += 1;
  }
}

// Stale clear
{
  const first = syncFromText(null, "Arçelik 55 inç televizyon");
  const second = syncFromText(first.state, "Heidelberg SM 74 nemlendirme pompası");
  const facts = buildUnderstoodFacts(second.state);
  assert.ok(
    !facts.some((f) => f.displayValue.includes("inç")),
    "stale TV residue cleared",
  );
  console.log("PASS stale facts cleared on text change");
  passed += 1;
}

// Soft publish keys
{
  assert.equal(
    isFieldRequired(
      { key: "dimensions", label: "Ölçü", type: "text", required: true },
      {},
    ),
    false,
  );
  assert.equal(
    isFieldRequired(
      { key: "brand", label: "Marka", type: "text", required: true },
      {},
    ),
    false,
  );
  console.log("PASS soft publish keys do not hard-require");
  passed += 1;
}

// Focused questions capped
{
  const { state } = syncFromText(null, "İstanbul’da kiralık 2+1 daire arıyorum");
  const hq = resolveHybridQuestions(state);
  const focused = selectFocusedQuestions({
    candidates: hq.candidates,
    strategy: null,
    requiredDynamicKeys: [],
    dynamicFields: [],
    maxVisible: 3,
  });
  assert.ok(focused.length <= 3, "max 3 questions");
  console.log(`PASS focused questions <=3 (got ${focused.length})`);
  passed += 1;
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
