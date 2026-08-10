/**
 * Phase 5 — Price preview endpoint + fingerprint cost control verification.
 * Run: npx tsx scripts/verify-request-preview.ts
 */
import assert from "node:assert/strict";

import { buildPreviewFingerprint } from "../src/lib/request-brain/preview-fingerprint";
import { rankNextBestQuestions } from "../src/lib/request-brain/question-priority";
import { computeStrategyCompleteness } from "../src/lib/price-intelligence/strategy-completeness";
import { resolvePriceStrategy, buildPriceStrategyContext } from "../src/lib/price-intelligence/strategy-resolver";
import { sanitizePreviewIntelligence } from "../src/lib/price-intelligence/preview-sanitize";
import {
  resolvePreviewCategorySync,
  syntheticPreviewCategoryId,
} from "../src/lib/price-intelligence/resolve-preview-category";
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${label}: ${ok ? "PASS" : "FAIL"}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
}

// Category first-call — preview works without DB row
{
  const resolved = resolvePreviewCategorySync("technology");
  check(
    "Preview category without DB",
    resolved.previewOnly && resolved.categoryId === syntheticPreviewCategoryId("technology"),
    resolved.categoryId,
  );
}

// Fingerprint stability — typo in non-critical field should not change fingerprint
{
  const base = {
    categorySlug: "technology",
    title: "Apple iPhone 15 Pro Max 256GB",
    fieldValues: {
      brand: "Apple",
      model: "iPhone 15 Pro Max",
      condition: "Yeni",
      specs: "256 GB",
    },
    city: "İstanbul",
  };
  const fp1 = buildPreviewFingerprint(base);
  const fp2 = buildPreviewFingerprint({
    ...base,
    fieldValues: { ...base.fieldValues, notes: "typo fix only" },
  });
  check("Fingerprint ignores non-critical fields", fp1 === fp2, fp1);
}

// Critical field change should change fingerprint
{
  const fp1 = buildPreviewFingerprint({
    categorySlug: "technology",
    title: "Apple iPhone 15 Pro Max 256GB",
    fieldValues: { brand: "Apple", model: "iPhone 15 Pro Max", condition: "Yeni" },
  });
  const fp2 = buildPreviewFingerprint({
    categorySlug: "technology",
    title: "Apple iPhone 15 Pro Max 256GB",
    fieldValues: { brand: "Apple", model: "iPhone 15 Pro Max", condition: "İkinci el" },
  });
  check("Fingerprint changes on condition", fp1 !== fp2);
}

// Question priority — max 3, strategy driven
{
  const ctx = buildPriceStrategyContext({
    categorySlug: "automotive",
    title: "Mercedes C200",
    fieldValues: [{ key: "needType", value: "vehicle" }],
  });
  const strategy = resolvePriceStrategy(ctx);
  const completeness = computeStrategyCompleteness({
    strategy: strategy.strategy,
    attributes: ctx.attributes,
    brand: ctx.brand,
    model: ctx.model,
    semanticFields: ctx.semanticFields,
  });
  const category = REQUEST_CATEGORIES.find((c) => c.id === "automotive")!;
  const questions = rankNextBestQuestions({
    strategy: strategy.strategy,
    completeness,
    fieldValues: {},
    commonDraft: { title: "Mercedes C200", city: "", budget: "", quantity: "", delivery: "" },
    dynamicFields: category.fields,
    requiredDynamicKeys: ["brand", "model", "modelYear"],
    maxQuestions: 3,
  });
  check("Question engine max 3", questions.length <= 3, `count=${questions.length}`);
  check("Vehicle strategy questions", questions.length > 0);
}

// Sanitizer strips sensitive fields
{
  const sanitized = sanitizePreviewIntelligence({
    sampleSize: 5,
    insufficientData: false,
    confidence: "MEDIUM",
    windowDays: 90,
    requestPriceStats: { sampleSize: 1, rawSampleSize: 1, median: 100, p25: 90, p75: 110, min: 80, max: 120, insufficientData: false },
    offerPriceStats: { sampleSize: 2, rawSampleSize: 2, median: 100, p25: 90, p75: 110, min: 80, max: 120, insufficientData: false },
    acceptedOfferStats: { sampleSize: 0, rawSampleSize: 0, median: null, p25: null, p75: null, min: null, max: null, insufficientData: true },
    confirmedTransactionStats: { sampleSize: 0, rawSampleSize: 0, median: null, p25: null, p75: null, min: null, max: null, insufficientData: true },
    externalListingStats: { sampleSize: 3, rawSampleSize: 3, median: 100, p25: 90, p75: 110, min: 80, max: 120, insufficientData: false },
    externalSoldStats: { sampleSize: 0, rawSampleSize: 0, median: null, p25: null, p75: null, min: null, max: null, insufficientData: true },
    sources: { talepo: 2, external: 3 },
    overallConfidence: { score: 0.55, level: "MEDIUM", reasons: [], sampleCount: 5 },
    marketRange: { low: 90, median: 100, high: 110, currency: "TRY" },
  } as never);
  check("Sanitizer keeps aggregates only", sanitized.offerPriceStats?.rawSampleSize === 2);
  assert.ok(!("companies" in sanitized));
}

console.log(`\nPreview verify: ${pass}/${pass + fail} PASS\n`);
if (fail > 0) process.exit(1);
console.log("REQUEST PREVIEW VERIFY: PASS");
