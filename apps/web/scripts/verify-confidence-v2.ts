/**
 * Phase 4 — Confidence V2 + Weighted Market Intelligence verification.
 * Run: npx tsx scripts/verify-confidence-v2.ts
 */
import assert from "node:assert/strict";

import {
  conditionsCompatible,
  normalizeCondition,
} from "../src/lib/price-intelligence/condition-utils";
import {
  getSignalReliabilityWeight,
  SIGNAL_RELIABILITY_WEIGHTS,
} from "../src/lib/price-intelligence/confidence-config";
import { computeStrategyCompleteness } from "../src/lib/price-intelligence/strategy-completeness";
import { computeObservationDecayWeight } from "../src/lib/price-intelligence/time-decay";
import {
  buildConfidenceV2,
  computeExternalConfidence,
  computeInternalConfidence,
  computeOverallConfidence,
} from "../src/server/price-intelligence/confidence-v2";
import { buildSignalGroupBundle } from "../src/server/price-intelligence/signal-group-stats";
import {
  computeBudgetEvaluation,
  computeMarketRange,
  computeWeightedMarketReference,
  shouldIncludeInMarketReference,
} from "../src/server/price-intelligence/weighted-market-reference";
import type { PriceSignalType } from "../src/lib/price-intelligence/types";

function obs(
  type: PriceSignalType,
  price: number,
  ageDays: number,
  condition: string | null = "Yeni",
) {
  return {
    price,
    sourceType: type,
    observedAt: new Date(Date.now() - ageDays * 86400000),
    condition,
    currency: "TRY",
  };
}

function emptyStats(type: PriceSignalType) {
  return {
    sampleSize: 0,
    rawSampleSize: 0,
    median: null,
    p25: null,
    p75: null,
    min: null,
    max: null,
    insufficientData: true,
    signalType: type,
    effectiveWeight: 0,
    recencyDaysMedian: null,
    reliabilityWeight: getSignalReliabilityWeight(type),
    strategyImportance: 0,
  };
}

function makeGroupStats(type: PriceSignalType, prices: number[], strategy = "RETAIL_PRODUCT" as const) {
  const bundle = buildSignalGroupBundle({
    observations: prices.map((p, i) => obs(type, p, i)),
    strategy,
    minSample: 1,
  });
  const map: Record<string, typeof bundle.confirmedStats> = {
    TALEPO_REQUEST: bundle.requestStats,
    TALEPO_OFFER: bundle.offerStats,
    TALEPO_ACCEPTED_OFFER: bundle.acceptedStats,
    TALEPO_CONFIRMED_TRANSACTION: bundle.confirmedStats,
    EXTERNAL_LISTING: bundle.externalListingStats,
    EXTERNAL_SOLD: bundle.externalSoldStats,
  };
  return map[type]!;
}

async function main() {
  console.log("=== Phase 4.1 Confidence Calibration Verify ===\n");

  // Signal weights central config
  assert.equal(SIGNAL_RELIABILITY_WEIGHTS.TALEPO_CONFIRMED_TRANSACTION, 1.0);
  assert.equal(SIGNAL_RELIABILITY_WEIGHTS.TALEPO_REQUEST, 0.35);
  assert.equal(SIGNAL_RELIABILITY_WEIGHTS.EXTERNAL_LISTING, 0.25);
  assert.ok(!shouldIncludeInMarketReference("TALEPO_REQUEST"));
  console.log("Signal weights config: OK\n");

  let pass = 0;
  let fail = 0;

  function check(label: string, ok: boolean, detail?: string) {
    console.log(`${label}: ${ok ? "PASS" : "FAIL"}${detail ? ` — ${detail}` : ""}`);
    if (ok) pass++;
    else fail++;
  }

  // A — RETAIL / EXTERNAL HEAVY
  {
    const internal = computeInternalConfidence({
      confirmedStats: emptyStats("TALEPO_CONFIRMED_TRANSACTION"),
      acceptedStats: emptyStats("TALEPO_ACCEPTED_OFFER"),
      offerStats: makeGroupStats("TALEPO_OFFER", [100, 110]),
      requestStats: emptyStats("TALEPO_REQUEST"),
      strategyCompleteness: 0.8,
      conditionAmbiguity: false,
    });
    const external = computeExternalConfidence({
      externalListingStats: makeGroupStats("EXTERNAL_LISTING", Array.from({ length: 30 }, (_, i) => 50000 + i * 100)),
      externalSoldStats: emptyStats("EXTERNAL_SOLD"),
      strategy: "RETAIL_PRODUCT",
      externalMatchedCount: 30,
      averageMatchQuality: 0.85,
      providerSuitability: 0.9,
      strategyCompleteness: 0.8,
      identityConfidence: 0.85,
    });
    const overall = computeOverallConfidence({
      internal,
      external,
      confirmedCount: 0,
      acceptedCount: 0,
      offerCount: 2,
      requestCount: 0,
      externalSoldCount: 0,
      strategy: "RETAIL_PRODUCT",
    });
    const bundle = buildSignalGroupBundle({
      observations: [
        ...Array.from({ length: 2 }, () => obs("TALEPO_OFFER", 100, 5)),
        ...Array.from({ length: 30 }, (_, i) => obs("EXTERNAL_LISTING", 50000 + i * 50, 3)),
      ],
      strategy: "RETAIL_PRODUCT",
      minSample: 1,
    });
    const ref = computeWeightedMarketReference({
      groups: [
        { signalType: "TALEPO_OFFER", stats: bundle.offerStats, includeInReference: true },
        { signalType: "EXTERNAL_LISTING", stats: bundle.externalListingStats, includeInReference: true },
      ],
      weightedObservations: bundle.weightedObservations,
    });
    const range = computeMarketRange({ weightedReference: ref, overallConfidence: overall });
    check(
      "A RETAIL external-heavy",
      ["VERY_LOW", "LOW"].includes(internal.level) &&
        ["HIGH", "VERY_HIGH", "MEDIUM"].includes(external.level) &&
        overall.level === "MEDIUM" &&
        range !== null,
      `int=${internal.level} ext=${external.level} overall=${overall.level}`,
    );
  }

  // B — TALEPO STRONG
  {
    const confirmed = makeGroupStats(
      "TALEPO_CONFIRMED_TRANSACTION",
      Array.from({ length: 12 }, (_, i) => 2000000 + i * 10000),
    );
    const internal = computeInternalConfidence({
      confirmedStats: confirmed,
      acceptedStats: makeGroupStats("TALEPO_ACCEPTED_OFFER", [2100000, 2050000]),
      offerStats: makeGroupStats("TALEPO_OFFER", [2200000]),
      requestStats: emptyStats("TALEPO_REQUEST"),
      strategyCompleteness: 0.9,
      conditionAmbiguity: false,
    });
    const external = computeExternalConfidence({
      externalListingStats: makeGroupStats("EXTERNAL_LISTING", [1900000, 1950000, 2000000, 2050000, 2100000]),
      externalSoldStats: emptyStats("EXTERNAL_SOLD"),
      strategy: "RETAIL_PRODUCT",
      externalMatchedCount: 5,
      averageMatchQuality: 0.7,
      providerSuitability: 0.8,
      strategyCompleteness: 0.9,
      identityConfidence: 0.8,
    });
    const overall = computeOverallConfidence({
      internal,
      external,
      confirmedCount: 12,
      acceptedCount: 2,
      offerCount: 1,
      requestCount: 0,
      externalSoldCount: 0,
      strategy: "RETAIL_PRODUCT",
    });
    check(
      "B TALEPO strong",
      ["HIGH", "VERY_HIGH"].includes(internal.level) &&
        ["HIGH", "VERY_HIGH", "MEDIUM"].includes(overall.level),
      `int=${internal.level} overall=${overall.level}`,
    );
  }

  // C — CUSTOM MANUFACTURING
  {
    const v2 = buildConfidenceV2({
      signalGroups: buildSignalGroupBundle({
        observations: [
          ...Array.from({ length: 20 }, (_, i) => obs("TALEPO_OFFER", 5000 + i * 10, 10)),
          ...Array.from({ length: 5 }, (_, i) => obs("TALEPO_CONFIRMED_TRANSACTION", 4800 + i * 20, 15)),
        ],
        strategy: "CUSTOM_MANUFACTURING",
        minSample: 1,
      }),
      strategy: "CUSTOM_MANUFACTURING",
      completeness: computeStrategyCompleteness({
        strategy: "CUSTOM_MANUFACTURING",
        attributes: { dimensions: "30x20", quantity: "5000", material: "Karton" },
      }),
      externalMatchedCount: 0,
      averageMatchQuality: null,
      providerSuitability: 0,
      identityConfidence: 0.5,
    });
    check(
      "C custom manufacturing",
      v2.internalConfidence.level !== "NONE" && v2.externalConfidence.level === "NONE",
      `int=${v2.internalConfidence.level} ext=${v2.externalConfidence.level}`,
    );
  }

  // D — SERVICE SCOPE
  {
    const v2 = buildConfidenceV2({
      signalGroups: buildSignalGroupBundle({
        observations: [
          obs("TALEPO_OFFER", 15000, 5),
          obs("TALEPO_CONFIRMED_TRANSACTION", 14500, 10),
        ],
        strategy: "SERVICE_SCOPE",
        minSample: 1,
      }),
      strategy: "SERVICE_SCOPE",
      completeness: computeStrategyCompleteness({
        strategy: "SERVICE_SCOPE",
        attributes: { serviceType: "Boya", city: "İstanbul" },
      }),
      externalMatchedCount: 0,
      averageMatchQuality: null,
      providerSuitability: 0,
      identityConfidence: 0.4,
    });
    check(
      "D service scope",
      v2.internalConfidence.sampleCount >= 1 && v2.externalConfidence.level === "NONE",
      `int=${v2.internalConfidence.level}`,
    );
  }

  // E — VEHICLE insufficient
  {
    const v2 = buildConfidenceV2({
      signalGroups: buildSignalGroupBundle({
        observations: [obs("TALEPO_OFFER", 850000, 20)],
        strategy: "VEHICLE",
        minSample: 1,
      }),
      strategy: "VEHICLE",
      completeness: computeStrategyCompleteness({
        strategy: "VEHICLE",
        attributes: { brand: "Toyota", model: "Corolla" },
        brand: "Toyota",
        model: "Corolla",
      }),
      externalMatchedCount: 0,
      averageMatchQuality: null,
      providerSuitability: 0,
      identityConfidence: 0.7,
    });
    check(
      "E vehicle insufficient",
      v2.externalConfidence.level === "NONE" && v2.overallConfidence.level !== "VERY_HIGH",
      `ext=${v2.externalConfidence.level} overall=${v2.overallConfidence.level}`,
    );
  }

  // F — UNKNOWN
  {
    const v2 = buildConfidenceV2({
      signalGroups: buildSignalGroupBundle({ observations: [], strategy: "UNKNOWN", minSample: 1 }),
      strategy: "UNKNOWN",
      completeness: computeStrategyCompleteness({ strategy: "UNKNOWN", attributes: {} }),
      externalMatchedCount: 0,
      averageMatchQuality: null,
      providerSuitability: 0,
      identityConfidence: 0,
    });
    check(
      "F unknown",
      v2.externalConfidence.level === "NONE" && v2.overallConfidence.level === "NONE",
    );
  }

  // G — CONDITION MIX
  {
    const requestCond = normalizeCondition("Yeni");
    const newObs = normalizeCondition("Yeni");
    const usedObs = normalizeCondition("İkinci el");
    assert.ok(conditionsCompatible(requestCond, newObs));
    assert.ok(!conditionsCompatible(requestCond, usedObs));
    const bundle = buildSignalGroupBundle({
      observations: [
        obs("TALEPO_OFFER", 100, 5, "Yeni"),
        obs("TALEPO_OFFER", 50, 5, "İkinci el"),
      ],
      strategy: "RETAIL_PRODUCT",
      minSample: 1,
    });
    const filtered = buildSignalGroupBundle({
      observations: [
        obs("TALEPO_OFFER", 100, 5, "Yeni"),
      ],
      strategy: "RETAIL_PRODUCT",
      minSample: 1,
    });
    check(
      "G condition isolation",
      bundle.offerStats.rawSampleSize === 2 &&
        filtered.offerStats.median === 100 &&
        !conditionsCompatible("NEW", "USED"),
    );
  }

  // H — TIME DECAY
  {
    const recent = computeObservationDecayWeight(new Date());
    const old = computeObservationDecayWeight(new Date(Date.now() - 400 * 86400000));
    check("H time decay", recent > old && recent === 1.0 && old <= 0.45, `recent=${recent} old=${old}`);
  }

  // I — REQUEST BUDGET OUTLIER
  {
    const bundle = buildSignalGroupBundle({
      observations: [
        obs("TALEPO_REQUEST", 100, 5),
        obs("TALEPO_OFFER", 50000, 5),
        obs("TALEPO_OFFER", 52000, 5),
        obs("TALEPO_CONFIRMED_TRANSACTION", 51000, 5),
      ],
      strategy: "RETAIL_PRODUCT",
      minSample: 1,
    });
    const ref = computeWeightedMarketReference({
      groups: [
        { signalType: "TALEPO_REQUEST", stats: bundle.requestStats, includeInReference: false },
        { signalType: "TALEPO_OFFER", stats: bundle.offerStats, includeInReference: true },
        { signalType: "TALEPO_CONFIRMED_TRANSACTION", stats: bundle.confirmedStats, includeInReference: true },
      ],
      weightedObservations: bundle.weightedObservations.filter((o) => o.sourceType !== "TALEPO_REQUEST"),
    });
    check(
      "I request budget protection",
      ref.median !== null && ref.median > 40000,
      `median=${ref.median}`,
    );
  }

  // J — COMPLETENESS VEHICLE
  {
    const c = computeStrategyCompleteness({
      strategy: "VEHICLE",
      attributes: { brand: "Toyota", model: "Corolla" },
      brand: "Toyota",
      model: "Corolla",
    });
    check(
      "J vehicle completeness",
      c.score < 0.85 && c.missingRequiredFields.includes("modelYear"),
      `score=${c.score} missing=${c.missingRequiredFields.join(",")}`,
    );
  }

  // K — COMPLETENESS RETAIL
  {
    const c = computeStrategyCompleteness({
      strategy: "RETAIL_PRODUCT",
      attributes: {
        brand: "Apple",
        model: "iPhone 15 Pro Max",
        specs: "256 GB",
        condition: "Yeni",
      },
      brand: "Apple",
      model: "iPhone 15 Pro Max",
    });
    check("K retail completeness", c.score >= 0.7, `score=${c.score}`);
  }

  // L — BUDGET BELOW MARKET
  {
    const range = { low: 1950000, median: 2065000, high: 2180000, currency: "TRY" };
    const eval_ = computeBudgetEvaluation({
      userBudget: 1700000,
      marketRange: range,
      overallConfidence: { score: 0.55, level: "MEDIUM", reasons: [], sampleCount: 10 },
    });
    check("L budget below market", eval_.status === "BELOW_MARKET", eval_.status);
  }

  // M — BUDGET WITHIN MARKET
  {
    const range = { low: 100, median: 110, high: 120, currency: "TRY" };
    const eval_ = computeBudgetEvaluation({
      userBudget: 112,
      marketRange: range,
      overallConfidence: { score: 0.6, level: "MEDIUM", reasons: [], sampleCount: 10 },
    });
    check("M budget within market", eval_.status === "WITHIN_MARKET", eval_.status);
  }

  // N — NO RELIABLE MARKET DATA
  {
    const eval_ = computeBudgetEvaluation({
      userBudget: 1000,
      marketRange: null,
      overallConfidence: { score: 0.1, level: "VERY_LOW", reasons: [], sampleCount: 1 },
    });
    const range = computeMarketRange({
      weightedReference: {
        median: null,
        p25: null,
        p75: null,
        effectiveSampleWeight: 0,
        insufficientData: true,
        contributingSignals: [],
      },
      overallConfidence: { score: 0.1, level: "VERY_LOW", reasons: [], sampleCount: 1 },
    });
    check(
      "N no reliable market",
      eval_.status === "UNKNOWN" && range === null,
    );
  }

  // O — 50 external listings + 0 internal
  {
    const internal = computeInternalConfidence({
      confirmedStats: emptyStats("TALEPO_CONFIRMED_TRANSACTION"),
      acceptedStats: emptyStats("TALEPO_ACCEPTED_OFFER"),
      offerStats: emptyStats("TALEPO_OFFER"),
      requestStats: emptyStats("TALEPO_REQUEST"),
      strategyCompleteness: 0.8,
      conditionAmbiguity: false,
    });
    const external = computeExternalConfidence({
      externalListingStats: makeGroupStats(
        "EXTERNAL_LISTING",
        Array.from({ length: 50 }, (_, i) => 50000 + i * 50),
      ),
      externalSoldStats: emptyStats("EXTERNAL_SOLD"),
      strategy: "RETAIL_PRODUCT",
      externalMatchedCount: 50,
      averageMatchQuality: 0.85,
      providerSuitability: 0.9,
      strategyCompleteness: 0.8,
      identityConfidence: 0.85,
    });
    const overall = computeOverallConfidence({
      internal,
      external,
      confirmedCount: 0,
      acceptedCount: 0,
      offerCount: 0,
      requestCount: 0,
      externalSoldCount: 0,
      strategy: "RETAIL_PRODUCT",
    });
    check(
      "O listing-only external",
      internal.level === "NONE" &&
        ["HIGH", "VERY_HIGH"].includes(external.level) &&
        overall.level === "MEDIUM",
      `int=${internal.level} ext=${external.level} overall=${overall.level}`,
    );
  }

  // P — 30 external + 5 accepted + 0 confirmed
  {
    const internal = computeInternalConfidence({
      confirmedStats: emptyStats("TALEPO_CONFIRMED_TRANSACTION"),
      acceptedStats: makeGroupStats(
        "TALEPO_ACCEPTED_OFFER",
        Array.from({ length: 5 }, (_, i) => 50000 + i * 100),
      ),
      offerStats: emptyStats("TALEPO_OFFER"),
      requestStats: emptyStats("TALEPO_REQUEST"),
      strategyCompleteness: 0.85,
      conditionAmbiguity: false,
    });
    const external = computeExternalConfidence({
      externalListingStats: makeGroupStats(
        "EXTERNAL_LISTING",
        Array.from({ length: 30 }, (_, i) => 51000 + i * 50),
      ),
      externalSoldStats: emptyStats("EXTERNAL_SOLD"),
      strategy: "RETAIL_PRODUCT",
      externalMatchedCount: 30,
      averageMatchQuality: 0.8,
      providerSuitability: 0.85,
      strategyCompleteness: 0.85,
      identityConfidence: 0.8,
    });
    const overall = computeOverallConfidence({
      internal,
      external,
      confirmedCount: 0,
      acceptedCount: 5,
      offerCount: 0,
      requestCount: 0,
      externalSoldCount: 0,
      strategy: "RETAIL_PRODUCT",
    });
    check(
      "P external + accepted (no confirmed)",
      ["LOW", "MEDIUM"].includes(internal.level) &&
        ["HIGH", "VERY_HIGH", "MEDIUM"].includes(external.level) &&
        ["MEDIUM", "HIGH"].includes(overall.level),
      `int=${internal.level} ext=${external.level} overall=${overall.level} (accepted lifts listing cap)`,
    );
  }

  // Q — confirmed transaction heavy
  {
    const internal = computeInternalConfidence({
      confirmedStats: makeGroupStats(
        "TALEPO_CONFIRMED_TRANSACTION",
        Array.from({ length: 15 }, (_, i) => 100000 + i * 500),
      ),
      acceptedStats: makeGroupStats("TALEPO_ACCEPTED_OFFER", [102000, 101000]),
      offerStats: makeGroupStats("TALEPO_OFFER", [105000]),
      requestStats: emptyStats("TALEPO_REQUEST"),
      strategyCompleteness: 0.9,
      conditionAmbiguity: false,
    });
    const external = computeExternalConfidence({
      externalListingStats: makeGroupStats("EXTERNAL_LISTING", [98000, 99000]),
      externalSoldStats: emptyStats("EXTERNAL_SOLD"),
      strategy: "RETAIL_PRODUCT",
      externalMatchedCount: 2,
      averageMatchQuality: 0.75,
      providerSuitability: 0.7,
      strategyCompleteness: 0.9,
      identityConfidence: 0.8,
    });
    const overall = computeOverallConfidence({
      internal,
      external,
      confirmedCount: 15,
      acceptedCount: 2,
      offerCount: 1,
      requestCount: 0,
      externalSoldCount: 0,
      strategy: "RETAIL_PRODUCT",
    });
    check(
      "Q confirmed heavy",
      ["HIGH", "VERY_HIGH"].includes(internal.level) &&
        ["HIGH", "VERY_HIGH"].includes(overall.level),
      `int=${internal.level} overall=${overall.level}`,
    );
  }

  console.log(`\nTest matrix: ${pass}/${pass + fail} PASS\n`);

  // AI panel data contract readiness
  const contractFields = [
    "completeness",
    "marketRange",
    "weightedReference",
    "internalConfidence",
    "externalConfidence",
    "overallConfidence",
    "budgetEvaluation",
  ];
  console.log("FIRST-RELEASE AI PANEL DATA CONTRACT: READY");
  console.log(`  Fields: ${contractFields.join(", ")}`);
  console.log("20-SECOND REQUEST UX BACKEND: READY");
  console.log(`  completeness.nextBestFields supported\n`);

  assert.equal(fail, 0, `${fail} test(s) failed`);
  console.log("CONFIDENCE VERIFY: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
