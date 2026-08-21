/**
 * RE listing ↔ budget-basis transitions + room layout + category breadcrumb labels.
 */
import assert from "node:assert/strict";

import { syncFromText } from "../src/lib/request-composer/sync";
import { syncFromBrowse } from "../src/lib/request-composer/sync";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { resolveBrowsePath } from "../src/lib/request-composer/resolve-browse-path";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";
import {
  budgetBasisForListing,
  budgetSummaryLabelForListing,
  normalizeListingKind,
} from "../src/lib/request-composer/v2/listing-budget-basis";
import { getCategoryById } from "../src/lib/request-category-engine";

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

check("normalize sale/rent/daily/unknown", () => {
  assert.equal(normalizeListingKind("Satılık"), "sale");
  assert.equal(normalizeListingKind("sale"), "sale");
  assert.equal(normalizeListingKind("Kiralık"), "rent");
  assert.equal(normalizeListingKind("rent"), "rent");
  assert.equal(normalizeListingKind("günlük"), "daily");
  assert.equal(normalizeListingKind(null), "unknown");
  assert.equal(budgetBasisForListing("Satılık"), "total");
  assert.equal(budgetBasisForListing("Kiralık"), "monthly");
  assert.equal(budgetBasisForListing(null), null);
  // Must NOT treat satılık as rent via substring "kira"
  assert.equal(normalizeListingKind("satılık"), "sale");
  assert.notEqual(budgetBasisForListing("satılık"), "monthly");
});

function budgetLabelFor(text: string, values: Record<string, string> = {}) {
  const { state } = syncFromText(null, text);
  let s = state;
  if (values.city) {
    const r = syncFromBrowse(s, {
      key: "city",
      value: values.city,
      isAny: false,
    });
    s = r.state;
  }
  const listing = String(
    s.fields.listingType?.kind === "VALUE"
      ? s.fields.listingType.value
      : (s.understanding.attributes?.listingType?.value ?? ""),
  );
  const hybrid = resolveHybridQuestions(s);
  const fieldStates = Object.fromEntries(
    Object.entries(s.fields).map(([k, f]) => [
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
  const schedule = scheduleComposerQuestions({
    categoryId: s.categoryId ?? "real-estate",
    candidates: hybrid.candidates,
    values: {
      listingType: listing,
      city: values.city ?? "",
      propertyType: values.propertyType,
    },
    fieldStates,
    realEstateLocationComplete: Boolean(values.city?.includes("/")),
  });
  const budget = schedule.visible.find((q) => q.fieldKey === "budget");
  const roomAsked = schedule.visible.some((q) => q.fieldKey === "roomCount");
  const facts = buildUnderstoodFacts(s);
  return {
    listing,
    budgetLabel: budget?.summaryLabel,
    budgetBasis: budget?.budgetBasis,
    roomAsked,
    roomFact: facts.find((f) => f.key === "roomCount")?.displayValue,
    listingFact: facts.find((f) => f.key === "listingType")?.displayValue,
  };
}

check("sale: Toplam before and after city/district", () => {
  const a = budgetLabelFor("2+1 satılık ev arıyorum");
  assert.equal(a.listingFact, "Satılık");
  assert.equal(a.roomFact, "2+1");
  assert.equal(a.roomAsked, false);
  assert.equal(a.budgetLabel, "Toplam bütçe");
  assert.equal(a.budgetBasis, "total");

  const b = budgetLabelFor("2+1 satılık ev arıyorum", {
    city: "İstanbul / Kadıköy",
  });
  assert.equal(b.budgetLabel, "Toplam bütçe");
  assert.equal(b.budgetBasis, "total");
  assert.equal(b.roomFact, "2+1");
});

check("rent: Aylık before and after city", () => {
  const a = budgetLabelFor("3+1 kiralık daire arıyorum");
  assert.equal(a.listingFact, "Kiralık");
  assert.equal(a.roomFact, "3+1");
  assert.equal(a.budgetLabel, "Aylık bütçe");
  assert.equal(a.budgetBasis, "monthly");

  const b = budgetLabelFor("3+1 kiralık daire arıyorum", {
    city: "İstanbul / Kadıköy",
  });
  assert.equal(b.budgetLabel, "Aylık bütçe");
  assert.equal(b.budgetBasis, "monthly");
});

check("sale↔rent edit flips basis labels", () => {
  assert.equal(budgetSummaryLabelForListing("Satılık"), "Toplam bütçe");
  assert.equal(budgetSummaryLabelForListing("Kiralık"), "Aylık bütçe");
  assert.equal(budgetSummaryLabelForListing(null, { isRealEstate: true }), "Bütçe");
});

check("category breadcrumb never uses raw slug", () => {
  const samples: Array<{ text: string; slug: string }> = [
    { text: "bebek arabası arıyorum", slug: "baby" },
    { text: "broşür bastırmak istiyorum", slug: "printing" },
    { text: "iphone 15 arıyorum", slug: "technology" },
    { text: "2+1 satılık ev arıyorum", slug: "real-estate" },
  ];
  for (const s of samples) {
    const { state } = syncFromText(null, s.text);
    const path = resolveBrowsePath(state);
    const labels = path.map((p) => p.label);
    assert.ok(
      !labels.includes(s.slug),
      `${s.text} leaked slug in ${labels.join(" > ")}`,
    );
    const cat = getCategoryById(s.slug);
    if (cat?.label && path[0]) {
      assert.equal(path[0].label, cat.label);
    }
  }
});

check("all engine root labels are display names not slugs", () => {
  const roots = [
    "printing",
    "automotive",
    "machinery",
    "furniture",
    "technology",
    "real-estate",
    "appliances",
    "health",
    "baby",
    "home-kitchen",
    "services",
  ];
  for (const id of roots) {
    const cat = getCategoryById(id);
    assert.ok(cat, `missing ${id}`);
    assert.notEqual(cat!.label, id);
    assert.ok(cat!.label.length > 2);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
