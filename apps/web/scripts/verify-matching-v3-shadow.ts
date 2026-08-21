/**
 * Matching v3 hardening verifier — binding golden asserts + acceptance gates.
 * Shadow only — no notifications.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  adaptDbCompanyToProfile,
  adaptDbRequestToEnvelope,
  buildDedupeKey,
  buildRequestRoutingEnvelope,
  buildSupplierCapabilityProfilePreserveIds,
  channelBrandModelFamily,
  channelPrimaryCategory,
  compareSyntheticLegacyAndShadow,
  CURRENT_NOTIFICATION_RELIABILITY_NOTES,
  DELIVERY_POLICY_CONTRACT,
  dedupeCandidates,
  generateCandidates,
  MATCHER_MODE,
  runShadowMatch,
  scoreBudget,
  scoreCandidate,
  scoreTiming,
  tierFromScore,
  deriveEffectiveTier,
} from "../src/lib/matching-v3";
import { corpusStats, GOLDEN_MATCH_CORPUS } from "../src/lib/matching-v3/golden/corpus";
import { CAT } from "../src/lib/matching-v3/golden/ids";
import { syntheticSuppliers } from "../src/lib/matching-v3/golden/suppliers";
import {
  categoryDbIdsOverlap,
  categorySlugsOverlap,
  isLikelyCategoryDbId,
  isLikelyCategorySlug,
  isTaxonomyId,
} from "../src/lib/matching-v3/identity";
import { buildUnderstandingSnapshot } from "../src/lib/request/understanding-snapshot";

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    passed += 1;
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(err);
  }
}

const suppliers = syntheticSuppliers();

type ShadowReport = ReturnType<typeof runShadowMatch>;

/** Real evidence only — NEVER inject expected needles into the search blob. */
function realEvidenceBlob(report: ShadowReport): string {
  return [
    ...report.candidates.flatMap((c) => [
      ...c.reasons,
      ...c.matchedSignals,
      ...c.tierGateReasons,
      ...c.channels,
      ...c.inventoryEvidence,
      ...c.followEvidence,
      ...c.conflicts,
    ]),
    ...report.reviewReasons,
    report.zeroMatch?.reasons.join(" ") ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

function assertStructuredGolden(
  scenario: (typeof GOLDEN_MATCH_CORPUS)[number],
  report: ShadowReport,
) {
  if (scenario.expectedEnvelope) {
    const e = scenario.expectedEnvelope;
    if (e.product !== undefined) {
      assert.equal(
        (report.envelope.product ?? "").toLocaleLowerCase("tr-TR"),
        (e.product ?? "").toLocaleLowerCase("tr-TR"),
        `${scenario.id}: envelope.product`,
      );
    }
    if (e.brand !== undefined) {
      assert.equal(
        (report.envelope.brand ?? "").toLocaleLowerCase("tr-TR"),
        (e.brand ?? "").toLocaleLowerCase("tr-TR"),
        `${scenario.id}: envelope.brand`,
      );
    }
    if (e.model !== undefined) {
      assert.equal(
        (report.envelope.model ?? "").toLocaleLowerCase("tr-TR"),
        (e.model ?? "").toLocaleLowerCase("tr-TR"),
        `${scenario.id}: envelope.model`,
      );
    }
    if (e.primaryCategoryDbId !== undefined) {
      assert.equal(
        report.envelope.categoryResolution.primaryCategoryDbId,
        e.primaryCategoryDbId,
        `${scenario.id}: envelope.primaryCategoryDbId`,
      );
    }
    if (e.primaryCategorySlug !== undefined) {
      assert.equal(
        report.envelope.categoryResolution.primaryCategorySlug,
        e.primaryCategorySlug,
        `${scenario.id}: envelope.primaryCategorySlug`,
      );
    }
  }

  if (scenario.expectedReviewOutcome) {
    const o = scenario.expectedReviewOutcome;
    if (o.reviewRequired !== undefined) {
      assert.equal(report.reviewRequired, o.reviewRequired, `${scenario.id}: reviewRequired`);
    }
    if (o.zeroMatch !== undefined) {
      assert.equal(Boolean(report.zeroMatch), o.zeroMatch, `${scenario.id}: zeroMatch`);
    }
    if (o.replayRecommended !== undefined) {
      assert.equal(
        Boolean(report.zeroMatch?.replayRecommended || report.replayRecommended),
        o.replayRecommended,
        `${scenario.id}: replayRecommended`,
      );
    }
  }

  const byCompany = (map: Record<string, string[]> | undefined, pick: (c: ShadowReport["candidates"][number]) => string[]) => {
    if (!map) return;
    for (const [companyId, expected] of Object.entries(map)) {
      const hit = report.candidates.find((c) => c.companyId === companyId);
      assert.ok(hit, `${scenario.id}: missing company for structured expect ${companyId}`);
      const actual = pick(hit!).map((x) => x.toLocaleLowerCase("tr-TR"));
      for (const needle of expected) {
        assert.ok(
          actual.includes(needle.toLocaleLowerCase("tr-TR")),
          `${scenario.id}: ${companyId} missing structured value ${needle}; got ${actual.join(",")}`,
        );
      }
    }
  };

  byCompany(scenario.expectedMatchedSignalsByCompany, (c) => c.matchedSignals);
  byCompany(scenario.expectedChannelsByCompany, (c) => c.channels);
  byCompany(scenario.expectedInventoryEvidenceByCompany, (c) => c.inventoryEvidence);
  byCompany(scenario.expectedFollowEvidenceByCompany, (c) => c.followEvidence);
  byCompany(scenario.expectedCandidateEvidenceByCompany, (c) => [
    ...c.reasons,
    ...c.matchedSignals,
    ...c.tierGateReasons,
    ...c.inventoryEvidence,
    ...c.followEvidence,
  ]);

  if (scenario.requiredReasonsByCompany) {
    for (const [companyId, needles] of Object.entries(scenario.requiredReasonsByCompany)) {
      const hit = report.candidates.find((c) => c.companyId === companyId);
      assert.ok(hit, `${scenario.id}: requiredReasonsByCompany missing company ${companyId}`);
      const blob = [...hit!.reasons, ...hit!.tierGateReasons]
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      for (const needle of needles) {
        assert.ok(
          blob.includes(needle.toLocaleLowerCase("tr-TR")),
          `${scenario.id}: ${companyId} missing reason ${needle}`,
        );
      }
    }
  }

  // Legacy requiredReasonsIncludes must NOT use cross-company union.
  // If present, require per-company map instead (fail closed).
  if (scenario.requiredReasonsIncludes?.length && !scenario.requiredReasonsByCompany) {
    assert.fail(
      `${scenario.id}: requiredReasonsIncludes is forbidden without requiredReasonsByCompany`,
    );
  }
}

function emptyGateExtras() {
  return {
    brandSpecialistMismatch: false,
    partialBrandMiss: false,
    partialProductMiss: false,
    partialModelMiss: false,
    cartesianListHit: false,
    verifiedBrandModelPair: false,
  };
}

// --- Category ID namespaces ---
check("category DB id / slug / taxonomy are distinct namespaces", () => {
  assert.ok(isLikelyCategoryDbId(CAT.baby.dbId));
  assert.ok(isLikelyCategorySlug(CAT.baby.slug));
  assert.ok(isTaxonomyId(CAT.baby.taxStroller));
  assert.notEqual(CAT.baby.dbId, CAT.baby.slug);
  assert.notEqual(CAT.baby.dbId, CAT.baby.taxStroller);
  assert.equal(categoryDbIdsOverlap(CAT.baby.slug, [CAT.baby.dbId]), false);
  assert.equal(categorySlugsOverlap([CAT.baby.dbId], [CAT.baby.slug]), false);
  assert.equal(categoryDbIdsOverlap(CAT.baby.dbId, [CAT.baby.dbId]), true);
  assert.equal(categorySlugsOverlap([CAT.baby.slug], [CAT.baby.slug]), true);
});

check("DB-shaped adapter keeps id namespaces", () => {
  const env = adaptDbRequestToEnvelope({
    id: "db-req-1",
    rawInput: "bebek arabası",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    taxonomyNodeIds: [CAT.baby.taxStroller],
    primaryLeafId: CAT.baby.taxStroller,
  });
  assert.equal(env.categoryResolution.primaryCategoryDbId, CAT.baby.dbId);
  assert.equal(env.categoryResolution.primaryCategorySlug, CAT.baby.slug);
  assert.ok(env.categoryResolution.primaryCategoryDbId !== env.categoryResolution.primaryCategorySlug);
  const profile = adaptDbCompanyToProfile({
    id: "db-co-1",
    categoryDbIds: [CAT.baby.dbId],
    categorySlugs: [CAT.baby.slug],
    taxonomyNodeIds: [CAT.baby.taxStroller],
  });
  assert.deepEqual(profile.categoryDbIds, [CAT.baby.dbId]);
  assert.deepEqual(profile.categorySlugs, [CAT.baby.slug]);
});

check("slug must not match as DB id in primary channel", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "id-mix",
    rawInput: "x",
    // Intentionally wrong: only slug provided as categoryDbId should be rejected
    categoryDbId: CAT.baby.slug,
    categorySlug: CAT.baby.slug,
  });
  assert.equal(env.categoryResolution.primaryCategoryDbId, null);
  assert.equal(env.categoryResolution.primaryCategorySlug, CAT.baby.slug);
  const hits = channelPrimaryCategory(env, suppliers);
  // Slug-only primary still matches via slug path
  assert.ok(hits.includes("sup-baby-stroller"));
});

check("routing envelope uses rawInput + snapshot authority", () => {
  const snap = buildUnderstandingSnapshot({
    categoryResolution: {
      status: "ambiguous",
      userSelected: false,
      userChoice: null,
      primary: { slug: CAT.baby.slug, confidence: 0.6, source: "ai" },
      candidates: [
        { slug: CAT.baby.slug, confidence: 0.6, source: "ai" },
        { slug: CAT.homeKitchen.slug, confidence: 0.4, source: "ai" },
      ],
    },
    entities: { product: { value: "bebek arabası" } },
  });
  const env = buildRequestRoutingEnvelope({
    requestId: "r1",
    rawInput: "bebek arabası arıyorum",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    understandingSnapshot: snap,
  });
  assert.equal(env.rawInput, "bebek arabası arıyorum");
  assert.equal(env.product, "bebek arabası");
  assert.equal(env.categoryResolution.primaryCategoryDbId, CAT.baby.dbId);
  assert.equal(env.categoryResolution.primaryCategorySlug, CAT.baby.slug);
});

check("supplier profile does not invent expertise", () => {
  const p = buildSupplierCapabilityProfilePreserveIds({
    companyId: "c1",
    categoryDbIds: [CAT.baby.dbId],
    categorySlugs: [CAT.baby.slug],
  });
  assert.deepEqual(p.brands, []);
  assert.deepEqual(p.products, []);
  assert.equal(p.budgetCapability, false);
  assert.equal(p.availabilityCapability, false);
});

check("candidate generators recall-union + dedupe", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "r2",
    rawInput: "bebek arabası",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "ambiguous",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.baby.slug, confidence: 0.5, source: "ai" },
        candidates: [{ slug: CAT.baby.slug, confidence: 0.5, source: "ai" }],
      },
      entities: { product: { value: "bebek arabası" } },
    }),
  });
  const generated = dedupeCandidates(generateCandidates(env, suppliers));
  const stroller = generated.find((g) => g.companyId === "sup-baby-stroller");
  assert.ok(stroller);
  assert.ok(stroller!.channels.length >= 1);
  assert.equal(
    generated.filter((g) => g.companyId === "sup-baby-stroller").length,
    1,
  );
});

check("budget/timing give 0 without supplier capability", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "r3",
    rawInput: "bebek arabası",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    budgetMin: 1000,
    budgetMax: 5000,
    isUrgent: true,
  });
  const profile = suppliers.find((p) => p.companyId === "sup-baby-stroller")!;
  assert.equal(profile.budgetCapability, false);
  assert.equal(profile.availabilityCapability, false);
  assert.equal(scoreBudget(env, profile).points, 0);
  assert.equal(scoreTiming(env, profile).points, 0);
  assert.equal(env.budget.status, "range");
  assert.equal(env.timing.urgency, true);
});

check("nationwide location does not city-eliminate", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "r4",
    rawInput: "daire",
    categoryDbId: CAT.realEstate.dbId,
    categorySlug: CAT.realEstate.slug,
    locationMode: "nationwide",
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.realEstate.slug, confidence: 0.9, source: "ai" },
        candidates: [],
      },
      entities: { product: { value: "daire" } },
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  assert.ok(report.candidates.some((c) => c.companyId === "sup-re-nationwide"));
  assert.equal(report.notificationsEmitted, false);
});

check("plan never used in relevance + runShadowMatch has no plan param", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "r5",
    rawInput: "Chicco",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.baby.slug, confidence: 0.9, source: "ai" },
        candidates: [],
      },
      entities: { brand: { value: "Chicco" }, product: { value: "bebek arabası" } },
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  assert.equal(report.planUsedInRelevance, false);
  assert.equal(report.mode, MATCHER_MODE);
  assert.equal(report.productionShadowComparison, "not_wired");
  assert.equal(runShadowMatch.length, 1);
});

check("wrong primary does not kill product/entity", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "r6",
    rawInput: "bebek arabası",
    categoryDbId: CAT.services.dbId,
    categorySlug: CAT.services.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "user_confirmed",
        userSelected: true,
        userChoice: "picked_candidate",
        primary: { slug: CAT.services.slug, confidence: 1, source: "user" },
        candidates: [
          { slug: CAT.services.slug, confidence: 1, source: "user" },
          { slug: CAT.baby.slug, confidence: 0.4, source: "ai" },
        ],
      },
      entities: { product: { value: "bebek arabası" } },
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  assert.ok(report.candidates.some((c) => c.companyId === "sup-baby-stroller"));
});

check("unresolved sparse yields zero-match review", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "r7",
    rawInput: "bilmiyorum ne arıyorum",
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "unresolved",
        userSelected: false,
        userChoice: "none_of_these",
        primary: null,
        candidates: [],
      },
      unresolvedExpressions: ["bilmiyorum ne arıyorum"],
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  assert.ok(report.zeroMatch);
  assert.equal(report.zeroMatch!.candidateCount, 0);
  assert.equal(report.reviewRequired, true);
  assert.equal(report.replayRecommended, true);
});

check("Heidelberg evaluates parts + machine signals", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "r8",
    rawInput: "Heidelberg SM 74 nemlendirme pompası",
    categoryDbId: CAT.printing.dbId,
    categorySlug: CAT.printing.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.printing.slug, confidence: 0.9, source: "ai" },
        candidates: [
          { slug: CAT.printing.slug, confidence: 0.9, source: "ai" },
          { slug: CAT.machinery.slug, confidence: 0.5, source: "ai" },
        ],
      },
      entities: {
        product: { value: "nemlendirme pompası" },
        brand: { value: "Heidelberg" },
        model: { value: "SM 74" },
      },
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  const ids = report.candidates.map((c) => c.companyId);
  assert.ok(ids.includes("sup-print-parts"));
  assert.ok(ids.includes("sup-print-press"));
  assert.ok(channelBrandModelFamily(env, suppliers).includes("sup-print-parts"));
  assert.ok(!ids.includes("sup-water-pump"));
});

check("brand+model AND blocks cross-brand A55", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "r-a55",
    rawInput: "Arçelik A55",
    categoryDbId: CAT.appliances.dbId,
    categorySlug: CAT.appliances.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.appliances.slug, confidence: 0.9, source: "ai" },
        candidates: [],
      },
      entities: {
        brand: { value: "Arçelik" },
        model: { value: "A55" },
        product: { value: "televizyon" },
      },
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  assert.ok(report.candidates.some((c) => c.companyId === "sup-tv-arcelik"));
  assert.ok(!report.candidates.some((c) => c.companyId === "sup-samsung-phone"));
});

check("category-only cannot be EXACT/STRONG via evidence gate", () => {
  const gate = deriveEffectiveTier({
    rawScore: 90,
    hasConflict: false,
    matchedSignals: ["category_exact"],
    inventoryEvidence: [],
    followEvidence: [],
    brandSpecified: false,
    modelSpecified: false,
    brandHit: false,
    modelHit: false,
    brandModelOk: true,
    brandSpecialistMismatch: false,
    productHit: false,
    taxonomyLeafHit: false,
    inventoryBrandModelExact: false,
  });
  assert.equal(gate.scoreBand, "EXACT");
  assert.equal(gate.effectiveTier, "NEAR");
  assert.ok(gate.tierGateReasons.some((r) => r.includes("category_only")));
});

check("every match has explainable reasons + gate reasons", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "r9",
    rawInput: "Renault Clio",
    categoryDbId: CAT.automotive.dbId,
    categorySlug: CAT.automotive.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.automotive.slug, confidence: 0.9, source: "ai" },
        candidates: [],
      },
      entities: {
        brand: { value: "Renault" },
        model: { value: "Clio" },
        product: { value: "otomobil" },
      },
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  assert.ok(report.candidates.length > 0);
  for (const c of report.candidates) {
    assert.ok(c.reasons.length > 0, `${c.companyId} missing reasons`);
    assert.ok(c.tierGateReasons.length > 0, `${c.companyId} missing tierGateReasons`);
    assert.ok(c.effectiveTier);
    assert.ok(typeof c.rawScore === "number");
  }
});

check("tierFromScore is scoreBand only — not final authority", () => {
  assert.equal(tierFromScore(75, false), "EXACT");
  const gated = deriveEffectiveTier({
    rawScore: 75,
    hasConflict: false,
    matchedSignals: ["lexical"],
    inventoryEvidence: [],
    followEvidence: [],
    brandSpecified: false,
    modelSpecified: false,
    brandHit: false,
    modelHit: false,
    brandModelOk: true,
    productHit: false,
    taxonomyLeafHit: false,
    inventoryBrandModelExact: false,
    ...emptyGateExtras(),
  });
  assert.notEqual(gated.effectiveTier, "EXACT");
});

check("NEGATIVE: fake mustKeepSignal self-inject would pass old blob — new assert fails", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "neg-fake-signal",
    rawInput: "bebek arabası",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.baby.slug, confidence: 0.9, source: "ai" },
        candidates: [],
      },
      entities: { product: { value: "bebek arabası" } },
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  const fake = "totally_fabricated_signal_xyz_987";
  const blob = realEvidenceBlob(report);
  assert.equal(
    blob.includes(fake),
    false,
    "fabricated signal must not appear in real evidence",
  );
  // Old broken pattern: prepend expected into blob → would pass. Prove it would.
  const selfFulfilling = [fake, blob].join(" ").toLocaleLowerCase("tr-TR");
  assert.ok(selfFulfilling.includes(fake), "documents old self-fulfilling pattern");
  // New assert: searching only real evidence must throw when expecting fake.
  assert.throws(() => {
    assert.ok(
      blob.includes(fake),
      "fake mustKeepSignal not evidenced",
    );
  });
});

check("POSITIVE: real structured product evidence is present", () => {
  const scenario = GOLDEN_MATCH_CORPUS.find((s) => s.id === "baby-stroller-no-user-cat")!;
  const report = runShadowMatch({ envelope: scenario.envelope, profiles: suppliers });
  const hit = report.candidates.find((c) => c.companyId === "sup-baby-stroller");
  assert.ok(hit);
  assert.ok(hit!.matchedSignals.includes("product"));
  assertStructuredGolden(scenario, report);
});

check("NEGATIVE: allowedTiers company missing → fail", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "neg-missing-tier-co",
    rawInput: "bebek arabası",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.baby.slug, confidence: 0.9, source: "ai" },
        candidates: [],
      },
      entities: { product: { value: "bebek arabası" } },
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  assert.throws(() => {
    const companyId = "sup-does-not-exist-xyz";
    const hit = report.candidates.find((c) => c.companyId === companyId);
    assert.ok(hit, `allowedTiers company missing: ${companyId}`);
  });
});

check("NEGATIVE: one company's reason cannot satisfy another company's expectation", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "neg-reason-cross",
    rawInput: "Chicco bebek arabası",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.baby.slug, confidence: 0.9, source: "ai" },
        candidates: [],
      },
      entities: {
        brand: { value: "Chicco" },
        product: { value: "bebek arabası" },
      },
    }),
  });
  const report = runShadowMatch({ envelope: env, profiles: suppliers });
  const chicco = report.candidates.find((c) => c.companyId === "sup-chicco-dealer");
  const general = report.candidates.find((c) => c.companyId === "sup-baby-general");
  assert.ok(chicco && general);
  assert.ok(chicco!.matchedSignals.includes("brand"), "chicco must match brand");
  const unionBlob = report.candidates
    .flatMap((c) => c.reasons)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
  assert.ok(unionBlob.includes("chicco"), "union of all reasons contains chicco");
  const generalBlob = general!.reasons.join(" ").toLocaleLowerCase("tr-TR");
  // Company-scoped: baby-general must not inherit chicco dealer's brand reason text.
  assert.equal(generalBlob.includes("chicco"), false);
  assert.equal(general!.matchedSignals.includes("brand"), false);
});

check("coverage defaults never auto-exhaustive", () => {
  const p = buildSupplierCapabilityProfilePreserveIds({
    companyId: "x",
    brands: ["a"],
    products: ["b"],
    models: ["c"],
  });
  assert.equal(p.brandCoverage, "unknown");
  assert.equal(p.productCoverage, "unknown");
  assert.equal(p.modelCoverage, "unknown");
  assert.deepEqual(p.brandModelPairs, []);
});

check("UNKNOWN/MISSING capability never acts as explicit exclude", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "unk-cap",
    rawInput: "Chicco bebek arabası",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.baby.slug, confidence: 0.9, source: "ai" },
        candidates: [],
      },
      entities: {
        brand: { value: "Chicco" },
        product: { value: "bebek arabası" },
      },
    }),
  });
  const partial = suppliers.find((p) => p.companyId === "sup-partial-brand-generalist")!;
  const result = scoreCandidate({
    envelope: env,
    profile: partial,
    channels: ["primary_category", "product_entity"],
  });
  assert.notEqual(result.effectiveTier, "NO_MATCH");
  assert.ok(
    result.effectiveTier === "NEAR" || result.effectiveTier === "REVIEW",
  );
  assert.ok(
    result.reasons.some((r) => r.includes("partial_brand_miss")) ||
      result.tierGateReasons.some((r) => r.includes("partial")),
  );
});

check("dedupe key contract + delivery contract separate", () => {
  const key = buildDedupeKey({
    requestId: "r",
    companyId: "c",
    policyVersion: "delivery-policy/v0-contract",
    channel: "in_app",
  });
  assert.equal(key, "r:c:delivery-policy/v0-contract:in_app");
  assert.ok(DELIVERY_POLICY_CONTRACT.some((r) => r.tier === "EXACT"));
  assert.equal(CURRENT_NOTIFICATION_RELIABILITY_NOTES.queue, false);
});

check("shadow mode never claims notifications", () => {
  const report = runShadowMatch({
    envelope: buildRequestRoutingEnvelope({
      requestId: "r10",
      rawInput: "x",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
    }),
    profiles: suppliers,
  });
  assert.equal(report.notificationsEmitted, false);
});

check("static plan-boundary: relevance core must not import plan/billing", () => {
  const root = path.resolve(__dirname, "../src/lib/matching-v3");
  const forbiddenImport =
    /from\s+["'][^"']*(membership\/plans|entitlement|billing|subscription|monetization\/plans)/i;
  const skipDir = new Set(["contracts", "golden"]);
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDir.has(entry.name)) continue;
        walk(full);
      } else if (entry.name.endsWith(".ts") && entry.name !== "index.ts") {
        files.push(full);
      }
    }
  }
  walk(root);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.ok(!forbiddenImport.test(text), `plan import in ${file}`);
    assert.ok(
      !/getPlanDefinition|PlanDefinition|planTier/.test(text),
      `plan symbol in ${file}`,
    );
    // Delivery policy contract must stay outside scoring/generators/shadow core imports.
    if (
      /scoring|generators|shadow-match|routing-envelope|identity|thresholds|supplier-capability|text\.ts|matcher-version|adapters/.test(
        file,
      )
    ) {
      assert.ok(
        !/delivery-policy/.test(text),
        `delivery-policy leak into relevance core: ${file}`,
      );
    }
  }
});

check(`golden corpus size >= 78 (got ${GOLDEN_MATCH_CORPUS.length})`, () => {
  const stats = corpusStats();
  assert.ok(stats.total >= 78, `total=${stats.total}`);
  const priority = ["baby", "technology", "printing", "automotive", "real-estate"];
  for (const b of priority) {
    assert.ok((stats.byBucket[b] ?? 0) >= 8, `${b} count ${stats.byBucket[b]}`);
  }
  assert.ok((stats.byBucket.adversarial ?? 0) >= 20, "adversarial < 20");
});

for (const scenario of GOLDEN_MATCH_CORPUS) {
  check(`golden:${scenario.id}`, () => {
    const report = runShadowMatch({
      envelope: scenario.envelope,
      profiles: suppliers,
    });
    assert.equal(report.notificationsEmitted, false);
    assert.equal(report.planUsedInRelevance, false);
    assert.equal(report.productionShadowComparison, "not_wired");

    // Structured expectations only — never self-inject mustKeepSignal into evidence blob.
    assertStructuredGolden(scenario, report);

    if (scenario.allowZeroMatchReview) {
      assert.ok(report.zeroMatch, "expected zero-match REVIEW");
      assert.equal(report.zeroMatch!.reviewRequired, true);
      assert.equal(report.reviewRequired, true);
      return;
    }

    if (scenario.expectReviewRequired) {
      assert.equal(report.reviewRequired, true);
    }

    const ids = new Set(report.candidates.map((c) => c.companyId));
    for (const expected of scenario.expectedCompanyIds) {
      assert.ok(
        ids.has(expected),
        `missing expected ${expected}; got ${[...ids].join(",")}`,
      );
    }
    for (const unexpected of scenario.unexpectedCompanyIds) {
      assert.ok(!ids.has(unexpected), `unexpected ${unexpected} present`);
    }

    if (scenario.allowedTiersByCompany) {
      for (const [companyId, allowed] of Object.entries(
        scenario.allowedTiersByCompany,
      )) {
        const hit = report.candidates.find((c) => c.companyId === companyId);
        assert.ok(
          hit,
          `${scenario.id}: allowedTiers company missing from report: ${companyId}`,
        );
        assert.ok(
          allowed.includes(hit!.effectiveTier),
          `${companyId} tier ${hit!.effectiveTier} not in allowed [${allowed.join(",")}] (scoreBand=${hit!.scoreBand}) gates=${hit!.tierGateReasons.join(";")}`,
        );
      }
    }

    for (const c of report.candidates) {
      assert.ok(c.reasons.length > 0);
      assert.ok(c.tierGateReasons.length > 0);
    }

    if (scenario.id === "adv-dedupe-multichannel") {
      assert.equal(
        report.candidates.filter((c) => c.companyId === "sup-multi-channel-same")
          .length,
        1,
      );
      const multi = report.candidates.find(
        (c) => c.companyId === "sup-multi-channel-same",
      )!;
      assert.ok(multi.channels.length >= 2);
    }
  });
}

check("synthetic legacy comparison (production not_wired)", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "cmp1",
    rawInput: "bebek arabası arıyorum",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "ambiguous",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.baby.slug, confidence: 0.55, source: "ai" },
        candidates: [{ slug: CAT.baby.slug, confidence: 0.55, source: "ai" }],
      },
      entities: { product: { value: "bebek arabası" } },
    }),
  });
  const shadow = runShadowMatch({ envelope: env, profiles: suppliers });
  const legacyIds = suppliers
    .filter((p) => p.categoryDbIds.includes(CAT.baby.dbId))
    .map((p) => p.companyId);
  const cmp = compareSyntheticLegacyAndShadow({
    requestId: "cmp1",
    legacyCompanyIds: legacyIds,
    shadow,
    primaryCategoryDbId: CAT.baby.dbId,
    primaryCategorySlug: CAT.baby.slug,
    profiles: suppliers,
  });
  assert.equal(cmp.kind, "syntheticLegacyComparison");
  assert.equal(cmp.productionShadowComparison, "not_wired");
  assert.ok(cmp.byTier);
  assert.ok(Array.isArray(cmp.entityRescued));
});

check("score components separately testable", () => {
  const env = buildRequestRoutingEnvelope({
    requestId: "sc1",
    rawInput: "Chicco bebek arabası",
    categoryDbId: CAT.baby.dbId,
    categorySlug: CAT.baby.slug,
    understandingSnapshot: buildUnderstandingSnapshot({
      categoryResolution: {
        status: "resolved",
        userSelected: false,
        userChoice: null,
        primary: { slug: CAT.baby.slug, confidence: 0.9, source: "ai" },
        candidates: [],
      },
      entities: {
        brand: { value: "Chicco" },
        product: { value: "bebek arabası" },
      },
    }),
  });
  const profile = suppliers.find((p) => p.companyId === "sup-chicco-dealer")!;
  const result = scoreCandidate({
    envelope: env,
    profile,
    channels: ["primary_category", "brand_model_family", "product_entity"],
  });
  assert.ok(result.components.some((c) => c.id === "brand" && c.matched));
  assert.ok(result.components.some((c) => c.id === "product" && c.matched));
  assert.ok(result.rawScore > 0);
  assert.ok(result.tierGateReasons.length > 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
console.log("corpus:", JSON.stringify(corpusStats()));
if (failed > 0) process.exit(1);
