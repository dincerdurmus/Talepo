/**
 * Explainable score components — plan/entitlement never consulted.
 * Budget/timing points require supplier-side capability flags.
 */

import type {
  CandidateChannel,
  EvidenceItem,
  FollowEvidenceLevel,
  InventoryEvidenceLevel,
  MatchResult,
  RequestRoutingEnvelope,
  ScoreComponent,
  ScoreComponentId,
  SupplierCapabilityProfile,
} from "../types";
import {
  DEFAULT_THRESHOLD_CONFIG,
  SCORE_WEIGHTS,
  type ThresholdConfig,
} from "../thresholds";
import { deriveEffectiveTier } from "./tier-gates";
import {
  brandEquals,
  categoryDbIdsOverlap,
  categorySlugsOverlap,
  hasConflictingVerifiedModelPair,
  resolveBrandModelHits,
} from "../identity";
import { foldText, includesToken, productsCompatible } from "../text";
import { MATCHER_VERSION } from "../matcher-version";
import type { CapabilityCoverage } from "../types";

function coverageMissIsHard(
  coverage: CapabilityCoverage,
  requested: boolean,
  hit: boolean,
  listNonEmpty: boolean,
): boolean {
  // UNKNOWN/MISSING ≠ EXCLUDED. Only exhaustive lists can hard-conflict.
  return coverage === "exhaustive" && requested && listNonEmpty && !hit;
}

function component(
  id: ScoreComponentId,
  points: number,
  matched: boolean,
  reason: string | null,
  evidence: EvidenceItem[] = [],
): ScoreComponent {
  return {
    id,
    points: matched ? points : 0,
    matched,
    reason: matched ? reason : null,
    evidence,
  };
}

export function scoreLocation(
  envelope: RequestRoutingEnvelope,
  profile: SupplierCapabilityProfile,
  weights = SCORE_WEIGHTS,
): ScoreComponent {
  if (
    envelope.location.status === "nationwide" ||
    envelope.location.status === "remote"
  ) {
    if (profile.nationwide) {
      return component(
        "location",
        weights.location,
        true,
        "Talep nationwide/remote; tedarikçi Türkiye geneli kapsıyor",
        [{ signal: "location", detail: envelope.location.status }],
      );
    }
    return component("location", 0, false, null, [
      { signal: "location", detail: "request_soft_no_supplier_coverage" },
    ]);
  }

  if (envelope.location.status === "unknown") {
    // Unknown is never negative and never invents points.
    return component("location", 0, false, null, [
      { signal: "location", detail: "unknown_neutral" },
    ]);
  }

  const city = foldText(envelope.location.city);
  if (!city) {
    return component("location", 0, false, null);
  }

  if (profile.nationwide) {
    return component(
      "location",
      Math.round(weights.location * 0.7),
      true,
      "Şehirli talep; tedarikçi Türkiye geneli",
      [{ signal: "location", detail: `request:${city}` }],
    );
  }

  const cityHit = profile.cities.some(
    (c) => includesToken(c, city) || includesToken(city, c),
  );
  if (!cityHit) return component("location", 0, false, null);

  const district = foldText(envelope.location.district);
  const districtHit =
    district &&
    profile.districts.some(
      (d) => includesToken(d, district) || includesToken(district, d),
    );

  return component(
    "location",
    districtHit ? weights.location : Math.round(weights.location * 0.8),
    true,
    districtHit
      ? `İl/ilçe uyumu: ${envelope.location.city}/${envelope.location.district}`
      : `Şehir uyumu: ${envelope.location.city}`,
    [{ signal: "location", detail: city }],
  );
}

export function scoreBudget(
  envelope: RequestRoutingEnvelope,
  profile: SupplierCapabilityProfile,
  weights = SCORE_WEIGHTS,
): ScoreComponent {
  if (envelope.budget.status === "unknown") {
    return component("budget", 0, false, null, [
      { signal: "budget", detail: "unknown_neutral" },
    ]);
  }
  // Request having a budget must NOT score without supplier budget capability.
  if (!profile.budgetCapability) {
    return component("budget", 0, false, null, [
      { signal: "budget", detail: "supplier_budget_capability_absent" },
    ]);
  }
  return component(
    "budget",
    weights.budget,
    true,
    "Talep bütçesi + supplier bütçe yetkinliği",
    [{ signal: "budget", detail: envelope.budget.status }],
  );
}

export function scoreTiming(
  envelope: RequestRoutingEnvelope,
  profile: SupplierCapabilityProfile,
  weights = SCORE_WEIGHTS,
): ScoreComponent {
  if (!envelope.timing.urgency) {
    return component("timing", 0, false, null);
  }
  if (!profile.availabilityCapability) {
    return component("timing", 0, false, null, [
      { signal: "timing", detail: "supplier_availability_absent" },
    ]);
  }
  return component(
    "timing",
    weights.timing,
    true,
    "Acil talep + supplier availability sinyali",
    [{ signal: "timing", detail: "urgency" }],
  );
}

export function classifyInventoryEvidence(
  envelope: RequestRoutingEnvelope,
  profile: SupplierCapabilityProfile,
): InventoryEvidenceLevel[] {
  const out = new Set<InventoryEvidenceLevel>();
  const product = foldText(envelope.product);
  const brand = foldText(envelope.brand);
  const model = foldText(envelope.model);
  const catDb = envelope.categoryResolution.primaryCategoryDbId;

  for (const inv of profile.inventorySignals) {
    if (
      brand &&
      model &&
      brandEquals(inv.brand, brand) &&
      modelEquals(inv.model, model)
    ) {
      out.add("inventory_brand_model_exact");
    }
    if (brand && brandEquals(inv.brand, brand)) out.add("inventory_brand");
    if (product && inv.product && productsCompatible(product, inv.product)) {
      out.add("inventory_product");
    }
    if (catDb && inv.categoryDbId === catDb) {
      out.add("inventory_category_only");
    }
    if (
      envelope.categoryResolution.primaryLeafId &&
      inv.taxonomyNodeId === envelope.categoryResolution.primaryLeafId &&
      !product &&
      !brand
    ) {
      out.add("inventory_category_only");
    }
  }
  return Array.from(out);
}

export function classifyFollowEvidence(
  envelope: RequestRoutingEnvelope,
  profile: SupplierCapabilityProfile,
): FollowEvidenceLevel[] {
  const out = new Set<FollowEvidenceLevel>();
  const product = foldText(envelope.product);
  const brand = foldText(envelope.brand);
  const dbId = envelope.categoryResolution.primaryCategoryDbId;
  const slugs = envelope.categoryResolution.candidateCategorySlugs;
  const leaf = envelope.categoryResolution.primaryLeafId;

  for (const s of [...profile.alertSignals, ...profile.savedSearchSignals]) {
    if (brand && s.brands?.some((b) => brandEquals(b, brand))) {
      out.add("follow_brand");
    }
    if (product && s.products?.some((p) => productsCompatible(p, product))) {
      out.add("follow_product");
    }
    if (leaf && s.taxonomyNodeIds?.includes(leaf)) {
      out.add("follow_taxonomy_leaf");
    }
    if (
      (dbId && s.categoryDbIds?.includes(dbId)) ||
      (s.categorySlugs && categorySlugsOverlap(slugs, s.categorySlugs))
    ) {
      out.add("follow_category");
    }
  }
  return Array.from(out);
}

function modelEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return brandEquals(a, b);
}

export function scoreAllComponents(
  envelope: RequestRoutingEnvelope,
  profile: SupplierCapabilityProfile,
  channels: CandidateChannel[],
  config: ThresholdConfig = DEFAULT_THRESHOLD_CONFIG,
): ScoreComponent[] {
  const w = config.weights;
  const dbId = envelope.categoryResolution.primaryCategoryDbId;
  const slug = envelope.categoryResolution.primaryCategorySlug;
  const leaf = envelope.categoryResolution.primaryLeafId;
  const ancestors = new Set(envelope.categoryResolution.ancestors);
  const product = foldText(envelope.product);
  const bm = resolveBrandModelHits(envelope, profile);

  const categoryExact =
    (Boolean(dbId) && categoryDbIdsOverlap(dbId, profile.categoryDbIds)) ||
    (Boolean(slug) && categorySlugsOverlap([slug!], profile.categorySlugs));

  const categoryCandidate =
    !categoryExact &&
    categorySlugsOverlap(
      envelope.categoryResolution.candidateCategorySlugs,
      profile.categorySlugs,
    );

  const categoryAncestor =
    !categoryExact &&
    profile.taxonomyNodeIds.some((id) => ancestors.has(id));

  const taxonomyLeaf =
    Boolean(leaf) && profile.taxonomyNodeIds.includes(leaf!);

  const productHit =
    Boolean(product) &&
    (profile.products.some((p) => productsCompatible(product, p)) ||
      profile.inventorySignals.some(
        (inv) => inv.product && productsCompatible(product, inv.product),
      ));

  const brandHit = bm.brandHit;

  const attrKeys = Object.keys(envelope.attributes);
  /**
   * KANONİK TİPLİ VARLIK TÜKETİMİ (Wave L). Zarfın `resolvedEntities`
   * kanalı okunur — yeniden çıkarım yok, rol karışımı yok. Kürasyon
   * sözleşmesi (domain-entities.ts): yalnız CURATOR_APPROVED kayıt kanıt
   * üretebilir; PENDING_CURATION/REJECTED/DEPRECATED aday olarak taşınsa
   * da skor ÜRETMEZ. Düşük güven exact sayılmaz (eşik 0.5 üstü).
   */
  const canonicalEntityHit = (envelope.resolvedEntities ?? []).some((e) => {
    if (e.verificationStatus !== "CURATOR_APPROVED") return false;
    if (!(e.confidence > 0.5)) return false;
    const v = foldText(e.canonicalLabel);
    if (!v || v.length < 2) return false;
    return (
      includesToken(profile.keywords.join(" "), v) ||
      includesToken(profile.aliases.join(" "), v) ||
      profile.products.some((p) => includesToken(p, v))
    );
  });
  const attributeHit =
    canonicalEntityHit ||
    attrKeys.some((k) => {
      const v = foldText(envelope.attributes[k]);
      if (!v || v.length < 2) return false;
      return (
        includesToken(profile.keywords.join(" "), v) ||
        includesToken(profile.aliases.join(" "), v) ||
        profile.products.some((p) => includesToken(p, v))
      );
    });

  const inventoryEvidence = classifyInventoryEvidence(envelope, profile);
  const followEvidence = classifyFollowEvidence(envelope, profile);

  const inventoryScored =
    inventoryEvidence.includes("inventory_brand_model_exact") ||
    inventoryEvidence.includes("inventory_product") ||
    inventoryEvidence.includes("inventory_brand") ||
    (inventoryEvidence.includes("inventory_category_only") &&
      channels.includes("inventory"));

  const followScored = followEvidence.length > 0;

  const lexicalHit =
    channels.includes("lexical_semantic") || channels.includes("alias_keyword");

  const conflicts: ScoreComponent[] = [];
  const brand = foldText(envelope.brand);
  const negBrand = brand && profile.excluded.brands?.includes(brand);
  const negProduct =
    product &&
    profile.excluded.products?.some(
      (p) => includesToken(p, product) || includesToken(product, p),
    );
  const negCat =
    (dbId && profile.excluded.categoryDbIds?.includes(dbId)) ||
    (slug && profile.excluded.categorySlugs?.includes(slug));
  if (negBrand || negProduct || negCat) {
    conflicts.push(
      component(
        "negative_conflict",
        w.negative_conflict,
        true,
        "Açık negative preference çakışması",
        [{ signal: "negative", detail: "explicit_exclude" }],
      ),
    );
  }

  // Unverified brand+model is a soft gap (tier gate), not a hard conflict component.
  if (brand && foldText(envelope.model) && !bm.verifiedBrandModelPair) {
    // no negative_conflict points — evidence recorded in scoreCandidate softGapReasons
  }

  return [
    component(
      "category_exact",
      w.category_exact,
      categoryExact,
      categoryExact
        ? `Primary kategori db/slug: ${dbId ?? "-"}/${slug ?? "-"}`
        : null,
      categoryExact
        ? [
            { signal: "categoryDbId", detail: dbId ?? "" },
            { signal: "categorySlug", detail: slug ?? "" },
          ]
        : [],
    ),
    component(
      "category_candidate",
      w.category_candidate,
      categoryCandidate,
      categoryCandidate ? "Aday kategori slug eşleşmesi" : null,
    ),
    component(
      "category_ancestor",
      w.category_ancestor,
      categoryAncestor,
      categoryAncestor ? "Taxonomy ancestor eşleşmesi" : null,
    ),
    component(
      "taxonomy_leaf",
      w.taxonomy_leaf,
      taxonomyLeaf,
      taxonomyLeaf ? `Leaf: ${leaf}` : null,
    ),
    component(
      "product",
      w.product,
      productHit,
      productHit ? `Ürün: ${envelope.product}` : null,
      productHit ? [{ signal: "product", detail: product }] : [],
    ),
    component(
      "brand",
      w.brand,
      brandHit,
      brandHit ? `Marka: ${envelope.brand}` : null,
      brandHit ? [{ signal: "brand", detail: brand }] : [],
    ),
    component(
      "family_model",
      w.family_model,
      foldText(envelope.model)
        ? Boolean(bm.verifiedBrandModelPair || (!brand && bm.modelHit))
        : bm.familyHit,
      bm.verifiedBrandModelPair
        ? `Verified model pair: ${envelope.brand} ${envelope.model}`
        : bm.familyHit
          ? `Family/series: ${envelope.family || envelope.series}`
          : null,
    ),
    component(
      "attribute",
      w.attribute,
      attributeHit,
      attributeHit
        ? canonicalEntityHit
          ? "Kanonik varlık uyumu (CURATOR_APPROVED)"
          : "Özellik/alias uyumu"
        : null,
    ),
    component(
      "inventory",
      inventoryEvidence.includes("inventory_category_only") &&
        !inventoryEvidence.some((e) => e !== "inventory_category_only")
        ? Math.round(w.inventory * 0.4)
        : w.inventory,
      inventoryScored,
      inventoryScored
        ? `Envanter: ${inventoryEvidence.join(",")}`
        : null,
      inventoryEvidence.map((e) => ({ signal: "inventory", detail: e })),
    ),
    component(
      "explicit_follow",
      followEvidence.every((e) => e === "follow_category") &&
        followEvidence.length > 0
        ? Math.round(w.explicit_follow * 0.4)
        : w.explicit_follow,
      followScored,
      followScored ? `Follow: ${followEvidence.join(",")}` : null,
      followEvidence.map((e) => ({ signal: "follow", detail: e })),
    ),
    scoreLocation(envelope, profile, w),
    scoreBudget(envelope, profile, w),
    scoreTiming(envelope, profile, w),
    component(
      "lexical",
      w.lexical,
      lexicalHit,
      lexicalHit ? "Lexical/alias benzerliği" : null,
    ),
    ...conflicts,
  ];
}

export function scoreCandidate(input: {
  envelope: RequestRoutingEnvelope;
  profile: SupplierCapabilityProfile;
  channels: CandidateChannel[];
  config?: ThresholdConfig;
}): MatchResult {
  const config = input.config ?? DEFAULT_THRESHOLD_CONFIG;
  const components = scoreAllComponents(
    input.envelope,
    input.profile,
    input.channels,
    config,
  );
  const rawScore = components.reduce((sum, c) => sum + c.points, 0);
  const conflictComponents = components.filter(
    (c) => c.id === "negative_conflict" && c.matched,
  );
  const conflicts = conflictComponents
    .map((c) => c.reason!)
    .filter(Boolean);
  const matchedSignals = components
    .filter((c) => c.matched && c.points !== 0)
    .map((c) => c.id)
    // include zero-point conflict markers for gates
    .concat(
      conflictComponents.filter((c) => c.points === 0).map((c) => c.id),
    );
  const uniqueSignals = Array.from(new Set(matchedSignals));
  const reasons = components
    .filter((c) => c.matched && c.reason)
    .map((c) => c.reason!);
  const evidence = components.flatMap((c) => c.evidence);

  const bm = resolveBrandModelHits(input.envelope, input.profile);
  const inventoryEvidence = classifyInventoryEvidence(
    input.envelope,
    input.profile,
  );
  const followEvidence = classifyFollowEvidence(input.envelope, input.profile);

  const brand = foldText(input.envelope.brand);
  const model = foldText(input.envelope.model);
  const product = foldText(input.envelope.product);
  const productHit = uniqueSignals.includes("product");
  const brandHit = uniqueSignals.includes("brand") || bm.brandHit;
  const familyHit = uniqueSignals.includes("family_model");

  const partialBrandMiss = Boolean(
    brand &&
      input.profile.brands.length > 0 &&
      !bm.brandHit &&
      input.profile.brandCoverage !== "exhaustive",
  );
  const partialProductMiss = Boolean(
    product &&
      input.profile.products.length > 0 &&
      !productHit &&
      input.profile.productCoverage !== "exhaustive",
  );
  const partialModelMiss = Boolean(
    model &&
      input.profile.models.length > 0 &&
      !bm.modelHit &&
      input.profile.modelCoverage !== "exhaustive",
  );

  const exhaustiveBrandConflict = coverageMissIsHard(
    input.profile.brandCoverage,
    Boolean(brand),
    bm.brandHit,
    input.profile.brands.length > 0,
  );
  const exhaustiveProductConflict = coverageMissIsHard(
    input.profile.productCoverage,
    Boolean(product),
    productHit,
    input.profile.products.length > 0,
  );
  const exhaustiveModelConflict = coverageMissIsHard(
    input.profile.modelCoverage,
    Boolean(model),
    bm.modelHit,
    input.profile.models.length > 0,
  );

  const verifiedModelPairConflict = hasConflictingVerifiedModelPair(
    input.envelope,
    input.profile,
  );

  let adjustedScore = rawScore;
  const softGapReasons: string[] = [];

  // Hard NO_MATCH only for explicit exclude (already in conflicts) or exhaustive/verified conflicts.
  if (exhaustiveBrandConflict && !bm.verifiedBrandModelPair) {
    adjustedScore = Math.min(adjustedScore, config.tiers.NO_MATCH);
    conflicts.push("Exhaustive brand coverage conflict");
  }
  if (exhaustiveProductConflict && !bm.verifiedBrandModelPair) {
    adjustedScore = Math.min(adjustedScore, config.tiers.NO_MATCH);
    conflicts.push("Exhaustive product coverage conflict");
  }
  if (exhaustiveModelConflict && brand && model && !bm.verifiedBrandModelPair) {
    adjustedScore = Math.min(adjustedScore, config.tiers.NO_MATCH);
    conflicts.push("Exhaustive model coverage conflict");
  }
  if (verifiedModelPairConflict && brand && model && !bm.verifiedBrandModelPair) {
    // Real verified pair under a different brand for the same model → hard conflict.
    adjustedScore = Math.min(adjustedScore, config.tiers.NO_MATCH);
    conflicts.push("Verified brand-model pair conflict");
  }

  if (partialBrandMiss) softGapReasons.push("evidence:partial_brand_miss");
  if (partialProductMiss) softGapReasons.push("evidence:partial_product_miss");
  if (partialModelMiss) softGapReasons.push("evidence:partial_model_miss");
  if (bm.cartesianListHit) softGapReasons.push("evidence:cartesian_brand_model_unverified");
  if (brand && model && !bm.verifiedBrandModelPair) {
    softGapReasons.push("evidence:brand_model_pair_unverified");
  }

  const strongInventory = inventoryEvidence.filter(
    (e) => e !== "inventory_category_only",
  );

  // Wrong user primary + category-only without entity → drop noise.
  if (
    input.envelope.categoryResolution.userSelected &&
    (product || brand) &&
    !productHit &&
    !brandHit &&
    !familyHit &&
    strongInventory.length === 0 &&
    uniqueSignals.includes("category_exact") &&
    !bm.verifiedBrandModelPair
  ) {
    adjustedScore = Math.min(adjustedScore, config.tiers.NO_MATCH);
  }

  const gate = deriveEffectiveTier({
    rawScore: adjustedScore,
    hasConflict: conflicts.length > 0,
    matchedSignals: uniqueSignals.filter((s) => s !== "negative_conflict"),
    inventoryEvidence,
    followEvidence,
    brandSpecified: Boolean(brand),
    modelSpecified: Boolean(model),
    brandHit: bm.brandHit,
    modelHit: bm.modelHit,
    brandModelOk: bm.verifiedBrandModelPair,
    brandSpecialistMismatch: false,
    partialBrandMiss,
    partialProductMiss,
    partialModelMiss,
    cartesianListHit: bm.cartesianListHit,
    verifiedBrandModelPair: bm.verifiedBrandModelPair,
    productHit,
    taxonomyLeafHit: uniqueSignals.includes("taxonomy_leaf"),
    inventoryBrandModelExact: bm.inventoryBrandModelExact,
    config,
  });

  return {
    companyId: input.profile.companyId,
    rawScore: adjustedScore,
    scoreBand: gate.scoreBand,
    effectiveTier: gate.effectiveTier,
    tier: gate.effectiveTier,
    totalScore: adjustedScore,
    tierGateReasons: [...gate.tierGateReasons, ...softGapReasons],
    matchedSignals: uniqueSignals.filter((s) => s !== "negative_conflict"),
    inventoryEvidence,
    followEvidence,
    reasons: [...reasons, ...softGapReasons.filter((r) => r.startsWith("evidence:"))],
    conflicts,
    evidence,
    channels: input.channels,
    components,
    matcherVersion: MATCHER_VERSION,
  };
}
