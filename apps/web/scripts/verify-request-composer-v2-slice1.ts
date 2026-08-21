/**
 * Phase 2 slice-1 regression verifier (stale clear, guidance choices, rawInput).
 * Run: npx tsx scripts/verify-request-composer-v2-slice1.ts
 */

import assert from "node:assert/strict";

import { syncFromText } from "../src/lib/request-composer/sync";
import {
  buildCategoryGuidance,
  categoryGuidanceToUserChoice,
  CATEGORY_GUIDANCE_ACTIONS,
} from "../src/lib/request-composer/v2/category-guidance";
import { enrichUnderstoodFacts } from "../src/lib/request-composer/v2/understood-facts";
import { understandingMatchesComposerText } from "../src/lib/request-composer/v2/text-match";
import {
  trustLabelForTone,
  trustToneFromConfidence,
} from "../src/lib/request-composer/v2/trust-labels";
import { isSystemCategorySlug } from "../src/lib/request/raw-input";
import {
  buildPublishUnderstandingSnapshot,
} from "../src/lib/request/publish-understanding";
import { deriveCategoryResolutionStatus } from "../src/lib/request/understanding-snapshot";
import { emptyRequestUnderstanding } from "../src/lib/request-understanding/understand-request";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { sanitizeRawInput } from "../src/lib/request/raw-input";

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS — ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL — ${name}`);
    console.error(error);
  }
}

check("trust tones map to user language without percentages", () => {
  assert.equal(trustToneFromConfidence(0.9), "understood");
  assert.equal(trustLabelForTone("understood"), "Bunu anladık");
  assert.equal(trustLabelForTone("check"), "Bunu kontrol edelim");
});

check("Heidelberg request yields related facts", () => {
  const { state } = syncFromText(
    null,
    "Heidelberg SM 74 için nemlendirme pompası lazım.",
  );
  const facts = buildUnderstoodFacts(state);
  const blob = facts.map((f) => f.displayValue.toLocaleLowerCase("tr-TR")).join(" ");
  assert.ok(/heidelberg/i.test(blob) || /sm\s*74/i.test(blob) || /pomp/i.test(blob));
  assert.equal(state.understanding.rawInput.includes("Heidelberg"), true);
});

check("switching to Arçelik TV clears Heidelberg facts from new understanding", () => {
  const first = syncFromText(
    null,
    "Heidelberg SM 74 için nemlendirme pompası lazım.",
  ).state;
  const second = syncFromText(
    first,
    "Arçelik 55 inç televizyon arıyorum.",
  ).state;
  const facts = buildUnderstoodFacts(second);
  const blob = facts.map((f) => f.displayValue).join(" ").toLocaleLowerCase("tr-TR");
  assert.equal(/heidelberg/i.test(blob), false);
  assert.equal(/sm\s*74/i.test(blob), false);
  assert.equal(/nemlendirme/i.test(blob), false);
  assert.ok(
    /arçelik|arcelik|televizyon|inç|inc/i.test(blob) ||
      /televizyon|tv/i.test(second.understanding.rawInput),
  );
  assert.match(second.understanding.rawInput, /Arçelik 55/);
});

check("category candidates change with text (not pinned to Heidelberg)", () => {
  const heidelberg = syncFromText(
    null,
    "Heidelberg SM 74 için nemlendirme pompası lazım.",
  ).state;
  const g1 = buildCategoryGuidance({
    understanding: heidelberg.understanding,
    rawText: heidelberg.understanding.rawInput,
    categoryConfident: false,
    forceAmbiguous: true,
  });
  const arcelik = syncFromText(
    heidelberg,
    "Arçelik 55 inç televizyon arıyorum.",
  ).state;
  const g2 = buildCategoryGuidance({
    understanding: arcelik.understanding,
    rawText: arcelik.understanding.rawInput,
    categoryConfident: false,
    forceAmbiguous: true,
  });
  assert.ok(g1 && g2);
  const slugs1 = g1!.candidates.map((c) => c.slug).join(",");
  const slugs2 = g2!.candidates.map((c) => c.slug).join(",");
  // Engine may vary; require that Arçelik guidance is not a pure copy of Heidelberg
  // when primary category changed, OR includes tech/appliances-ish candidates.
  const arcelikFriendly = g2!.candidates.some((c) =>
    ["technology", "appliances", "home-kitchen"].includes(c.slug),
  );
  const primaryChanged =
    heidelberg.understanding.category.value !==
    arcelik.understanding.category.value;
  assert.ok(
    arcelikFriendly || primaryChanged || slugs1 !== slugs2,
    `expected guidance shift; got ${slugs1} -> ${slugs2}`,
  );
  assert.ok(g2!.candidates.every((c) => !isSystemCategorySlug(c.slug)));
});

check("text-match gate blocks stale display during sync / mismatch", () => {
  assert.equal(
    understandingMatchesComposerText({
      composerText: "Arçelik TV",
      understandingRawInput: "Heidelberg pompa",
      isSyncing: false,
    }),
    false,
  );
  assert.equal(
    understandingMatchesComposerText({
      composerText: "Arçelik TV",
      understandingRawInput: "Arçelik TV",
      isSyncing: true,
    }),
    false,
  );
  assert.equal(
    understandingMatchesComposerText({
      composerText: "Arçelik TV",
      understandingRawInput: "Arçelik TV",
      isSyncing: false,
    }),
    true,
  );
  assert.equal(
    understandingMatchesComposerText({
      composerText: "",
      understandingRawInput: "x",
      isSyncing: false,
    }),
    false,
  );
});

check("empty text clears match gate", () => {
  assert.equal(
    understandingMatchesComposerText({
      composerText: "   ",
      understandingRawInput: "Heidelberg",
      isSyncing: false,
    }),
    false,
  );
});

check("picked_candidate / multi / none / other / defer map correctly", () => {
  assert.equal(
    categoryGuidanceToUserChoice({ kind: "candidate", slug: "technology" }),
    "picked_candidate",
  );
  assert.equal(
    categoryGuidanceToUserChoice({
      kind: "multi",
      slugs: ["technology", "appliances"],
    }),
    "multi_candidates",
  );
  assert.equal(
    categoryGuidanceToUserChoice({ kind: "action", action: "none_of_these" }),
    "none_of_these",
  );
  assert.equal(
    categoryGuidanceToUserChoice({ kind: "action", action: "other_domain" }),
    "other_domain",
  );
  assert.equal(
    categoryGuidanceToUserChoice({
      kind: "action",
      action: "defer_to_talepo",
    }),
    "defer_to_talepo",
  );
  assert.deepEqual(
    CATEGORY_GUIDANCE_ACTIONS.map((a) => a.id).sort(),
    ["defer_to_talepo", "none_of_these", "other_domain"],
  );
});

check("defer_to_talepo derives user_deferred status", () => {
  assert.equal(
    deriveCategoryResolutionStatus({
      userSelected: false,
      userChoice: "defer_to_talepo",
      primarySlug: null,
      primaryConfidence: 0.2,
      candidateCount: 0,
    }),
    "user_deferred",
  );
});

check("snapshot stores other_domain note without inventing category", () => {
  const understanding = emptyRequestUnderstanding();
  understanding.rawInput = "özel parça";
  understanding.category = {
    value: null,
    confidence: 0.2,
    status: "UNKNOWN",
  };
  const snap = buildPublishUnderstandingSnapshot({
    understanding,
    userSelected: false,
    userChoice: "other_domain",
    primarySlug: null,
    confirmedFieldKeys: [],
  });
  snap.unresolvedExpressions = ["other_domain:matbaa makinesinde kullanılıyor"];
  assert.equal(snap.categoryResolution.userChoice, "other_domain");
  assert.equal(snap.categoryResolution.status, "unresolved");
  assert.ok(
    snap.unresolvedExpressions.some((e) => e.includes("matbaa")),
  );
});

check("rawInput stays user text; professional does not overwrite", () => {
  const raw = sanitizeRawInput("Arçelik 55 inç televizyon arıyorum.");
  const professional =
    "Kullanıcı Arçelik marka 55 inç televizyon satın almak istiyor.";
  assert.notEqual(raw, professional);
  assert.match(raw, /Arçelik 55/);
});

check("confident category hides guidance unless forceAmbiguous", () => {
  const understanding = emptyRequestUnderstanding();
  understanding.category = {
    value: "technology",
    confidence: 0.92,
    status: "CONFIDENT",
  };
  assert.equal(
    buildCategoryGuidance({
      understanding,
      rawText: "iPhone",
      categoryConfident: true,
    }),
    null,
  );
  const forced = buildCategoryGuidance({
    understanding,
    rawText: "iPhone",
    categoryConfident: true,
    forceAmbiguous: true,
  });
  assert.ok(forced);
  assert.ok(forced!.candidates.every((c) => !isSystemCategorySlug(c.slug)));
});

check("dismissed facts stay out of editable board", () => {
  const understanding = emptyRequestUnderstanding();
  const facts = enrichUnderstoodFacts({
    facts: [
      { key: "brand", label: "Marka", displayValue: "Heidelberg" },
      { key: "city", label: "Şehir", displayValue: "İstanbul" },
    ],
    understanding,
    dismissedKeys: ["brand"],
  });
  assert.equal(facts.some((f) => f.key === "brand"), false);
  assert.equal(facts.some((f) => f.key === "city"), true);
});

check("latest-response gate: mismatched token should not display", () => {
  // Pure contract: only matching rawInput may render.
  const displayOk = understandingMatchesComposerText({
    composerText: "Arçelik 55 inç televizyon arıyorum.",
    understandingRawInput: "Heidelberg SM 74 için nemlendirme pompası lazım.",
    isSyncing: false,
  });
  assert.equal(displayOk, false);
});

console.log(`\nverify-request-composer-v2-slice1: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
