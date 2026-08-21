/**
 * Phase 1 — request authority: rawInput, understanding snapshot, getCategoryById.
 */

import assert from "node:assert/strict";

import {
  getCategoryById,
  resolveRequestCategory,
  REQUEST_CATEGORIES,
  UNKNOWN_REQUEST_CATEGORY,
} from "../src/lib/request-category-engine";
import {
  sanitizeRawInput,
  UNRESOLVED_CATEGORY_SLUG,
  excludeSystemCategories,
  isSystemCategorySlug,
} from "../src/lib/request/raw-input";
import {
  buildUnderstandingSnapshot,
  deriveCategoryResolutionStatus,
  parseUnderstandingSnapshot,
} from "../src/lib/request/understanding-snapshot";
import {
  buildPublishUnderstandingSnapshot,
  withUnderstandingSnapshot,
} from "../src/lib/request/publish-understanding";
import {
  parseCreateRequestInput,
  resolvePersistCategorySlug,
} from "../src/server/request/request-schema";
import { DISCOVERY_PROJECTION_VERSION } from "../src/lib/discovery/types";
import type { RequestDiscoveryProjection } from "../src/lib/discovery/types";
import type { RequestUnderstandingResult } from "../src/lib/request-understanding/types";

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

check("sanitizeRawInput strips controls without rewriting meaning", () => {
  const input = "iPhone 15 Pro arıyorum\u0000\u0007";
  assert.equal(sanitizeRawInput(input), "iPhone 15 Pro arıyorum");
});

check("getCategoryById never falls back to last category", () => {
  const last = REQUEST_CATEGORIES[REQUEST_CATEGORIES.length - 1];
  const hit = getCategoryById("this-category-does-not-exist-xyz");
  assert.equal(hit, null);
  assert.notEqual(last.id, "this-category-does-not-exist-xyz");
});

check("getCategoryById unknown shell for empty/unknown/unresolved", () => {
  assert.equal(getCategoryById("")?.id, UNKNOWN_REQUEST_CATEGORY.id);
  assert.equal(getCategoryById("unknown")?.id, UNKNOWN_REQUEST_CATEGORY.id);
  assert.equal(getCategoryById("unresolved")?.id, UNKNOWN_REQUEST_CATEGORY.id);
  assert.equal(getCategoryById("automotive")?.id, "automotive");
});

check("resolveRequestCategory maps bogus id to UNKNOWN shell", () => {
  const cat = resolveRequestCategory("not-a-real-slug");
  assert.equal(cat.id, "");
  assert.equal(cat.label, "Talep");
});

check("persist slug maps unknown to unresolved soft category", () => {
  const resolved = resolvePersistCategorySlug({
    slug: "totally-fake",
    name: "Özel alan",
  });
  assert.equal(resolved.slug, UNRESOLVED_CATEGORY_SLUG);
  assert.equal(resolved.name, "Belirsiz kategori (sistem)");
});

check("parseCreateRequestInput keeps rawInput distinct from professionalDescription", () => {
  const parsed = parseCreateRequestInput({
    title: "iPhone 15 Pro talebi",
    description:
      "Profesyonel açıklama: Kullanıcı Apple iPhone 15 Pro arıyor ve hızlı teslim bekliyor.",
    rawInput: "iphone 15 pro istiyorum acil",
    professionalDescription:
      "Profesyonel açıklama: Kullanıcı Apple iPhone 15 Pro arıyor ve hızlı teslim bekliyor.",
    category: { slug: "technology", name: "Teknoloji" },
    publishVersion: "ai",
    fields: [],
  });
  assert.equal(parsed.rawInput, "iphone 15 pro istiyorum acil");
  assert.notEqual(parsed.rawInput, parsed.professionalDescription);
  assert.match(parsed.description, /Profesyonel açıklama/);
});

check("legacy payload without rawInput leaves rawInput undefined (update-safe)", () => {
  const parsed = parseCreateRequestInput({
    title: "Eski talep başlığı",
    description: "Bu eski istemci gövdesidir ve on karakterden uzundur.",
    category: { slug: "services", name: "Hizmetler" },
    publishVersion: "manual",
    fields: [],
  });
  assert.equal(parsed.rawInput, undefined);
  assert.match(parsed.description, /eski istemci/);
});

check("empty rawInput does not fall back to AI description on parse", () => {
  const parsed = parseCreateRequestInput({
    title: "Koruma testi başlığı",
    description:
      "Profesyonel AI metni burada duruyor ve on karakterden uzun olmalı.",
    rawInput: "   ",
    professionalDescription:
      "Profesyonel AI metni burada duruyor ve on karakterden uzun olmalı.",
    category: { slug: "technology", name: "Teknoloji" },
    publishVersion: "ai",
    fields: [],
  });
  assert.equal(parsed.rawInput, undefined);
});

check("catalog-out-of-tree product can publish under unresolved soft category", () => {
  const parsed = parseCreateRequestInput({
    title: "Özel lazer kesim parçası",
    description: "Katalogda olmayan özel imalat parçası talep ediyorum.",
    rawInput: "özel lazer kesim flanş parçası lazım",
    category: { slug: "", name: "Talep" },
    publishVersion: "ai",
    fields: [],
  });
  assert.equal(parsed.category.slug, UNRESOLVED_CATEGORY_SLUG);
  assert.equal(parsed.rawInput, "özel lazer kesim flanş parçası lazım");
  assert.ok(isSystemCategorySlug(parsed.category.slug));
});

check("system category excluded from picker lists", () => {
  const rows = excludeSystemCategories([
    { slug: "technology", name: "Teknoloji" },
    { slug: "unresolved", name: "Belirsiz kategori (sistem)" },
    { slug: "automotive", name: "Otomotiv" },
  ]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.slug !== "unresolved"));
});

check("persist unresolved uses system display name", () => {
  const resolved = resolvePersistCategorySlug({
    slug: "totally-fake",
    name: "Özel alan",
  });
  assert.equal(resolved.slug, UNRESOLVED_CATEGORY_SLUG);
  assert.equal(resolved.name, "Belirsiz kategori (sistem)");
});

check("understanding snapshot stores user vs ai category distinctly", () => {
  const snap = buildUnderstandingSnapshot({
    categoryResolution: {
      status: "user_confirmed",
      userSelected: true,
      userChoice: "picked_candidate",
      primary: {
        slug: "automotive",
        confidence: 0.91,
        source: "user",
      },
      candidates: [
        { slug: "automotive", confidence: 0.91, source: "user" },
        { slug: "machinery", confidence: 0.42, source: "ai" },
      ],
    },
    unresolvedExpressions: ["nesil belirsiz"],
    confirmedFieldKeys: ["brand"],
  });
  assert.equal(snap.categoryResolution.userSelected, true);
  assert.equal(snap.categoryResolution.primary?.source, "user");
  assert.equal(snap.categoryResolution.candidates.length, 2);
  assert.ok(parseUnderstandingSnapshot(snap));
});

check("multiple candidates keep normalized confidence", () => {
  const fakeUnderstanding = {
    version: "v1",
    rawInput: "klima",
    normalizedInput: "klima",
    intent: { value: "BUY", confidence: 0.8, status: "CONFIDENT" },
    subject: { kind: { value: "PRODUCT", confidence: 0.7, status: "TENTATIVE" } },
    requestSubject: {
      kind: { value: "PRODUCT", confidence: 0.7, provenance: "INFERRED", source: "CATEGORY_INFERENCE" },
    },
    category: {
      value: "appliances",
      confidence: 0.55,
      status: "TENTATIVE",
      alternatives: [
        { value: "home-kitchen", confidence: 0.4 },
        { value: "services", confidence: 0.2 },
      ],
    },
    strategy: { value: null, confidence: 0, status: "UNKNOWN" },
    identity: {},
    attributes: {},
    preferences: {},
    explicitFacts: [],
    inferredFacts: [],
    unknownFields: ["model"],
    ambiguities: [{ kind: "category", message: "klima ürün mü hizmet mi" }],
    contradictions: [],
    understandingConfidence: 0.5,
    publishReadiness: { status: "ENRICHABLE", reasons: [] },
    priceAnalysisReadiness: { status: "LIMITED", reasons: [] },
    recommendedQuestions: [],
  } as unknown as RequestUnderstandingResult;

  const snap = buildPublishUnderstandingSnapshot({
    understanding: fakeUnderstanding,
    userSelected: false,
    primarySlug: "appliances",
  });
  assert.ok(snap.categoryResolution.candidates.length >= 2);
  assert.ok(
    snap.categoryResolution.candidates.every(
      (c) => c.confidence >= 0 && c.confidence <= 1,
    ),
  );
  assert.ok(
    snap.unresolvedExpressions.some((u) => u.includes("klima") || u.includes("unknown_field")),
  );
  assert.equal(
    deriveCategoryResolutionStatus({
      userSelected: false,
      userChoice: null,
      primarySlug: "appliances",
      primaryConfidence: 0.55,
      candidateCount: 3,
    }),
    "ambiguous",
  );
});

check("discovery projection can carry understanding without inventing match fields", () => {
  const base: RequestDiscoveryProjection = {
    version: DISCOVERY_PROJECTION_VERSION,
    kind: "discovery_projection",
    taxonomyNodeIds: ["tax:technology"],
    primaryLeafId: null,
    categoryId: "technology",
    subcategorySlug: null,
    attributes: {},
    constraints: {},
    matchContract: {
      must: [],
      preferred: [],
      excluded: [],
      anyFields: [],
      ranges: [],
    },
    filterContract: {
      include: {},
      exclude: {},
      preferred: {},
      range: {},
      any: [],
    },
    builtAt: new Date().toISOString(),
  };
  const understanding = buildUnderstandingSnapshot({
    categoryResolution: {
      status: "resolved",
      userSelected: false,
      userChoice: null,
      primary: { slug: "technology", confidence: 0.88, source: "ai" },
      candidates: [{ slug: "technology", confidence: 0.88, source: "ai" }],
    },
    unresolvedExpressions: [],
  });
  const merged = withUnderstandingSnapshot(base, understanding);
  assert.ok(merged?.understanding);
  assert.equal(merged?.categoryId, "technology");
  assert.equal(merged?.understanding?.rawInputRef, "request.rawInput");
});

console.log(`\nverify-request-authority-v1: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
