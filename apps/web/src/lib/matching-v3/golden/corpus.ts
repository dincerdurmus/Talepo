/**
 * Golden match corpus — ≥78 scenarios with binding expectations.
 * DB id / slug / taxonomy stay distinct. No real PII.
 */

import { buildRequestRoutingEnvelope } from "../routing-envelope";
import type { MatchTier, RequestRoutingEnvelope } from "../types";
import { buildUnderstandingSnapshot } from "@/lib/request/understanding-snapshot";
import { CAT } from "./ids";

export type GoldenScenario = {
  id: string;
  categoryBucket: string;
  description: string;
  envelope: RequestRoutingEnvelope;
  expectedCompanyIds: string[];
  unexpectedCompanyIds: string[];
  /** Inclusive allowed tiers per company — company MUST appear when listed. */
  allowedTiersByCompany?: Record<string, MatchTier[]>;
  /** @deprecated use requiredReasonsByCompany — never union across candidates. */
  requiredReasonsIncludes?: string[];
  requiredReasonsByCompany?: Record<string, string[]>;
  expectedEnvelope?: {
    product?: string | null;
    brand?: string | null;
    model?: string | null;
    primaryCategoryDbId?: string | null;
    primaryCategorySlug?: string | null;
  };
  expectedCandidateEvidenceByCompany?: Record<string, string[]>;
  expectedMatchedSignalsByCompany?: Record<string, string[]>;
  expectedChannelsByCompany?: Record<string, string[]>;
  expectedInventoryEvidenceByCompany?: Record<string, string[]>;
  expectedFollowEvidenceByCompany?: Record<string, string[]>;
  expectedReviewOutcome?: {
    reviewRequired?: boolean;
    zeroMatch?: boolean;
    replayRecommended?: boolean;
  };
  /**
   * Legacy narrative label — NEVER asserted by searching itself into the blob.
   * Prefer structured expected* fields.
   */
  mustKeepSignal?: string;
  allowZeroMatchReview?: boolean;
  expectReviewRequired?: boolean;
};

type EnvelopePartial = {
  id: string;
  rawInput: string;
  categoryDbId?: string | null;
  categorySlug?: string | null;
  status?: "resolved" | "user_confirmed" | "ambiguous" | "unresolved" | "user_deferred";
  userSelected?: boolean;
  candidates?: string[];
  product?: string;
  brand?: string;
  model?: string;
  family?: string;
  series?: string;
  city?: string | null;
  district?: string | null;
  locationMode?: "city" | "nationwide" | "remote" | "no_preference" | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  attributes?: Record<string, string>;
  taxonomyNodeIds?: string[];
  primaryLeafId?: string | null;
  isUrgent?: boolean;
};

function envelopeFrom(partial: EnvelopePartial): RequestRoutingEnvelope {
  const candidates = (partial.candidates ?? []).map((slug) => ({
    slug,
    confidence: 0.55,
    source: "ai" as const,
  }));
  const primarySlug = partial.categorySlug ?? null;
  const snap = buildUnderstandingSnapshot({
    categoryResolution: {
      status: partial.status ?? (primarySlug || partial.categoryDbId ? "resolved" : "unresolved"),
      userSelected: partial.userSelected ?? false,
      userChoice: partial.userSelected ? "picked_candidate" : null,
      primary: primarySlug
        ? { slug: primarySlug, confidence: 0.8, source: "ai" }
        : null,
      candidates,
    },
    entities: {
      ...(partial.product ? { product: { value: partial.product } } : {}),
      ...(partial.brand ? { brand: { value: partial.brand } } : {}),
      ...(partial.model ? { model: { value: partial.model } } : {}),
      ...(partial.family ? { family: { value: partial.family } } : {}),
      ...(partial.series ? { series: { value: partial.series } } : {}),
    },
    attributes: Object.fromEntries(
      Object.entries(partial.attributes ?? {}).map(([k, v]) => [k, { value: v }]),
    ),
    unresolvedExpressions: partial.status === "unresolved" ? [partial.rawInput] : [],
  });

  const taxIds = (partial.taxonomyNodeIds ?? []).filter((id) => id.startsWith("tax:"));

  return buildRequestRoutingEnvelope({
    requestId: partial.id,
    rawInput: partial.rawInput,
    categoryDbId: partial.categoryDbId,
    categorySlug: primarySlug,
    city: partial.city,
    district: partial.district,
    locationMode: partial.locationMode,
    budgetMin: partial.budgetMin,
    budgetMax: partial.budgetMax,
    isUrgent: partial.isUrgent,
    candidateCategorySlugs: partial.candidates,
    taxonomyNodeIds: taxIds,
    primaryLeafId: partial.primaryLeafId ?? null,
    discoveryProjection: {
      version: 1,
      kind: "discovery_projection",
      taxonomyNodeIds: taxIds,
      primaryLeafId: partial.primaryLeafId ?? null,
      // Intentionally NOT equal to slug — opaque db id when present.
      categoryId: partial.categoryDbId ?? null,
      subcategorySlug: null,
      attributes: partial.attributes ?? {},
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
      understanding: snap,
    },
    understandingSnapshot: snap,
  });
}

function s(
  partial: Omit<GoldenScenario, "envelope"> & { envelope: EnvelopePartial },
): GoldenScenario {
  return { ...partial, envelope: envelopeFrom(partial.envelope) };
}

const nearOnly = ["NEAR", "REVIEW"] as MatchTier[];
const strongMax = ["NEAR", "STRONG", "REVIEW"] as MatchTier[];
const exactOk = ["NEAR", "STRONG", "EXACT", "REVIEW"] as MatchTier[];

const priorityBaby: GoldenScenario[] = [
  s({
    id: "baby-stroller-no-user-cat",
    categoryBucket: "baby",
    description: "bebek arabası — kategori kullanıcı seçmedi",
    envelope: {
      id: "baby-stroller-no-user-cat",
      rawInput: "bebek arabası arıyorum",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      status: "ambiguous",
      userSelected: false,
      candidates: [CAT.baby.slug, CAT.homeKitchen.slug],
      product: "bebek arabası",
      taxonomyNodeIds: [CAT.baby.taxStroller],
      primaryLeafId: CAT.baby.taxStroller,
    },
    expectedCompanyIds: ["sup-baby-stroller", "sup-baby-general"],
    unexpectedCompanyIds: ["sup-auto-clio", "sup-print-brochure", "sup-alias-collision-auto"],
    allowedTiersByCompany: {
      "sup-baby-stroller": strongMax,
      "sup-baby-general": strongMax,
    },
    requiredReasonsByCompany: {
      "sup-baby-stroller": ["Ürün"],
    },
    expectedEnvelope: { product: "bebek arabası" },
    expectedMatchedSignalsByCompany: {
      "sup-baby-stroller": ["product"],
    },
    mustKeepSignal: "product:bebek arabası",
  }),
  s({
    id: "baby-chicco",
    categoryBucket: "baby",
    description: "Chicco marka talebi",
    envelope: {
      id: "baby-chicco",
      rawInput: "Chicco bebek arabası",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
      brand: "Chicco",
    },
    expectedCompanyIds: ["sup-chicco-dealer", "sup-baby-stroller"],
    unexpectedCompanyIds: [
      "sup-cybex-dealer",
      "sup-exhaustive-brand-only",
      "sup-explicit-exclude-chicco",
    ],
    allowedTiersByCompany: { "sup-chicco-dealer": exactOk },
    expectedEnvelope: { brand: "chicco", product: "bebek arabası" },
    expectedMatchedSignalsByCompany: {
      "sup-chicco-dealer": ["brand", "product"],
    },
    mustKeepSignal: "brand:chicco",
  }),
  s({
    id: "baby-cybex",
    categoryBucket: "baby",
    description: "Cybex marka talebi",
    envelope: {
      id: "baby-cybex",
      rawInput: "Cybex puset",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
      brand: "Cybex",
    },
    expectedCompanyIds: ["sup-cybex-dealer", "sup-baby-stroller"],
    unexpectedCompanyIds: ["sup-chicco-dealer"],
    mustKeepSignal: "brand:cybex",
  }),
  s({
    id: "baby-wrong-primary",
    categoryBucket: "baby",
    description: "Yanlış primary (services) ama ürün doğru",
    envelope: {
      id: "baby-wrong-primary",
      rawInput: "bebek arabası lazım",
      categoryDbId: CAT.services.dbId,
      categorySlug: CAT.services.slug,
      status: "user_confirmed",
      userSelected: true,
      product: "bebek arabası",
      candidates: [CAT.services.slug, CAT.baby.slug],
    },
    expectedCompanyIds: ["sup-baby-stroller"],
    unexpectedCompanyIds: ["sup-wrong-cat-only"],
    mustKeepSignal: "product_rescues_wrong_category",
  }),
  s({
    id: "baby-nationwide",
    categoryBucket: "baby",
    description: "Türkiye geneli bebek talebi",
    envelope: {
      id: "baby-nationwide",
      rawInput: "bebek arabası",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
      locationMode: "nationwide",
    },
    expectedCompanyIds: ["sup-baby-stroller"],
    unexpectedCompanyIds: ["sup-re-istanbul"],
    mustKeepSignal: "nationwide_not_city_filtered",
  }),
  s({
    id: "baby-no-budget",
    categoryBucket: "baby",
    description: "Bütçesiz bebek talebi",
    envelope: {
      id: "baby-no-budget",
      rawInput: "bebek arabası arıyorum bütçem yok henüz",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
    },
    expectedCompanyIds: ["sup-baby-stroller"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "unknown_budget_not_hard_filter",
  }),
  s({
    id: "baby-unresolved-product",
    categoryBucket: "baby",
    description: "Tamamen unresolved ürün ifadesi",
    envelope: {
      id: "baby-unresolved-product",
      rawInput: "şey arıyorum bilmiyorum adı",
      status: "unresolved",
      categoryDbId: null,
      categorySlug: null,
    },
    expectedCompanyIds: [],
    unexpectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "zero_match_review",
  }),
  s({
    id: "baby-alias-puset",
    categoryBucket: "baby",
    description: "Puset alias",
    envelope: {
      id: "baby-alias-puset",
      rawInput: "puset bakıyorum",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
    },
    expectedCompanyIds: ["sup-baby-stroller"],
    unexpectedCompanyIds: ["sup-print-parts"],
    mustKeepSignal: "alias:puset",
  }),
];

const priorityTech: GoldenScenario[] = [
  s({
    id: "tech-arcelik-55",
    categoryBucket: "technology",
    description: "Arçelik 55 inç televizyon",
    envelope: {
      id: "tech-arcelik-55",
      rawInput: "Arçelik 55 inç televizyon",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      candidates: [CAT.appliances.slug, CAT.technology.slug],
      product: "televizyon",
      brand: "Arçelik",
      attributes: { screenSize: "55", screenUnit: "inç" },
      taxonomyNodeIds: [CAT.appliances.taxTv],
      primaryLeafId: CAT.appliances.taxTv,
    },
    expectedCompanyIds: ["sup-tv-arcelik"],
    unexpectedCompanyIds: ["sup-auto-clio", "sup-arcelik-appliance"],
    allowedTiersByCompany: { "sup-tv-arcelik": exactOk },
    mustKeepSignal: "brand+product:arcelik tv",
  }),
  s({
    id: "tech-uncatalogued",
    categoryBucket: "technology",
    description: "Katalog dışı teknoloji ürünü",
    envelope: {
      id: "tech-uncatalogued",
      rawInput: "quantum flux router arıyorum",
      categoryDbId: CAT.technology.dbId,
      categorySlug: CAT.technology.slug,
      status: "ambiguous",
    },
    expectedCompanyIds: ["sup-tech-catalog-gap"],
    unexpectedCompanyIds: ["sup-baby-stroller"],
    allowedTiersByCompany: { "sup-tech-catalog-gap": nearOnly },
    mustKeepSignal: "category_fallback_for_uncatalogued",
  }),
  s({
    id: "tech-wrong-cat-tv",
    categoryBucket: "technology",
    description: "Yanlış kategori services, TV ürünü",
    envelope: {
      id: "tech-wrong-cat-tv",
      rawInput: "televizyon istiyorum",
      categoryDbId: CAT.services.dbId,
      categorySlug: CAT.services.slug,
      userSelected: true,
      status: "user_confirmed",
      product: "televizyon",
      brand: "Arçelik",
      candidates: [CAT.services.slug, CAT.appliances.slug],
    },
    expectedCompanyIds: ["sup-tv-arcelik"],
    unexpectedCompanyIds: ["sup-services-logo"],
    mustKeepSignal: "entity_rescues_wrong_primary",
  }),
  s({
    id: "tech-no-brand",
    categoryBucket: "technology",
    description: "Markasız TV",
    envelope: {
      id: "tech-no-brand",
      rawInput: "televizyon arıyorum",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      product: "televizyon",
    },
    expectedCompanyIds: ["sup-tv-arcelik"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "missing_brand_keeps_product_experts",
  }),
  s({
    id: "tech-nationwide",
    categoryBucket: "technology",
    description: "Türkiye geneli teknoloji",
    envelope: {
      id: "tech-nationwide",
      rawInput: "laptop",
      categoryDbId: CAT.technology.dbId,
      categorySlug: CAT.technology.slug,
      locationMode: "nationwide",
    },
    expectedCompanyIds: ["sup-tech-catalog-gap"],
    unexpectedCompanyIds: ["sup-re-istanbul"],
    allowedTiersByCompany: { "sup-tech-catalog-gap": nearOnly },
    mustKeepSignal: "nationwide",
  }),
  s({
    id: "tech-no-budget",
    categoryBucket: "technology",
    description: "Bütçesiz teknoloji",
    envelope: {
      id: "tech-no-budget",
      rawInput: "tablet lazım",
      categoryDbId: CAT.technology.dbId,
      categorySlug: CAT.technology.slug,
    },
    expectedCompanyIds: ["sup-tech-catalog-gap"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "unknown_budget",
  }),
  s({
    id: "tech-unresolved",
    categoryBucket: "technology",
    description: "Unresolved tech",
    envelope: {
      id: "tech-unresolved",
      rawInput: "elektronik bir şey",
      status: "unresolved",
    },
    expectedCompanyIds: [],
    unexpectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "review_not_silent",
  }),
  s({
    id: "tech-alias",
    categoryBucket: "technology",
    description: "TV alias",
    envelope: {
      id: "tech-alias",
      rawInput: "tv bakıyorum",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      product: "tv",
    },
    expectedCompanyIds: ["sup-tv-arcelik"],
    unexpectedCompanyIds: ["sup-furniture"],
    mustKeepSignal: "alias:tv",
  }),
];

const priorityPrinting: GoldenScenario[] = [
  s({
    id: "print-heidelberg-pump",
    categoryBucket: "printing",
    description: "Heidelberg SM 74 nemlendirme pompası",
    envelope: {
      id: "print-heidelberg-pump",
      rawInput: "Heidelberg SM 74 nemlendirme pompası",
      categoryDbId: CAT.printing.dbId,
      categorySlug: CAT.printing.slug,
      candidates: [CAT.printing.slug, CAT.machinery.slug],
      product: "nemlendirme pompası",
      brand: "Heidelberg",
      model: "SM 74",
      taxonomyNodeIds: [CAT.printing.taxParts],
      primaryLeafId: CAT.printing.taxParts,
    },
    expectedCompanyIds: ["sup-print-parts", "sup-print-press"],
    unexpectedCompanyIds: ["sup-alias-collision-auto", "sup-water-pump"],
    allowedTiersByCompany: { "sup-print-parts": exactOk },
    mustKeepSignal: "parts_and_machine_signals",
  }),
  s({
    id: "print-brochure-5000",
    categoryBucket: "printing",
    description: "5000 broşür",
    envelope: {
      id: "print-brochure-5000",
      rawInput: "5000 broşür bastırmak istiyorum",
      categoryDbId: CAT.printing.dbId,
      categorySlug: CAT.printing.slug,
      product: "broşür",
      attributes: { quantity: "5000" },
    },
    expectedCompanyIds: ["sup-print-brochure"],
    unexpectedCompanyIds: ["sup-print-parts"],
    mustKeepSignal: "product:broşür",
  }),
  s({
    id: "print-wrong-cat",
    categoryBucket: "printing",
    description: "Yanlış kategori automotive, matbaa parçası",
    envelope: {
      id: "print-wrong-cat",
      rawInput: "Heidelberg nemlendirme pompası",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      userSelected: true,
      status: "user_confirmed",
      product: "nemlendirme pompası",
      brand: "Heidelberg",
      model: "SM 74",
      candidates: [CAT.automotive.slug, CAT.printing.slug],
    },
    expectedCompanyIds: ["sup-print-parts"],
    unexpectedCompanyIds: ["sup-alias-collision-auto", "sup-water-pump"],
    mustKeepSignal: "brand_model_rescues",
  }),
  s({
    id: "print-alias-collision",
    categoryBucket: "printing",
    description: "Pompa alias çakışması — matbaa bağlamı",
    envelope: {
      id: "print-alias-collision",
      rawInput: "matbaa nemlendirme pompası",
      categoryDbId: CAT.printing.dbId,
      categorySlug: CAT.printing.slug,
      product: "nemlendirme pompası",
      brand: "Heidelberg",
    },
    expectedCompanyIds: ["sup-print-parts"],
    unexpectedCompanyIds: ["sup-alias-collision-auto", "sup-water-pump"],
    mustKeepSignal: "context_beats_generic_alias",
  }),
  s({
    id: "print-nationwide",
    categoryBucket: "printing",
    description: "Türkiye geneli broşür",
    envelope: {
      id: "print-nationwide",
      rawInput: "broşür baskı",
      categoryDbId: CAT.printing.dbId,
      categorySlug: CAT.printing.slug,
      product: "broşür",
      locationMode: "nationwide",
    },
    expectedCompanyIds: ["sup-print-brochure"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "nationwide",
  }),
  s({
    id: "print-no-budget",
    categoryBucket: "printing",
    description: "Bütçesiz baskı",
    envelope: {
      id: "print-no-budget",
      rawInput: "katalog baskısı",
      categoryDbId: CAT.printing.dbId,
      categorySlug: CAT.printing.slug,
      product: "katalog",
    },
    expectedCompanyIds: ["sup-print-brochure"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "unknown_budget",
  }),
  s({
    id: "print-unresolved",
    categoryBucket: "printing",
    description: "Unresolved print",
    envelope: {
      id: "print-unresolved",
      rawInput: "bir baskı işi",
      status: "unresolved",
    },
    expectedCompanyIds: [],
    unexpectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "review",
  }),
  s({
    id: "print-machine-only",
    categoryBucket: "printing",
    description: "Heidelberg makine sinyali",
    envelope: {
      id: "print-machine-only",
      rawInput: "Heidelberg SM 74 makine",
      categoryDbId: CAT.machinery.dbId,
      categorySlug: CAT.machinery.slug,
      product: "baskı makinesi",
      brand: "Heidelberg",
      model: "SM 74",
    },
    expectedCompanyIds: ["sup-print-press", "sup-print-parts"],
    unexpectedCompanyIds: ["sup-furniture"],
    mustKeepSignal: "machine_capability",
  }),
];

const priorityAuto: GoldenScenario[] = [
  s({
    id: "auto-clio",
    categoryBucket: "automotive",
    description: "Renault Clio",
    envelope: {
      id: "auto-clio",
      rawInput: "Renault Clio arıyorum",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      product: "otomobil",
      brand: "Renault",
      model: "Clio",
      taxonomyNodeIds: [CAT.automotive.taxCar],
      primaryLeafId: CAT.automotive.taxCar,
    },
    expectedCompanyIds: ["sup-auto-clio"],
    unexpectedCompanyIds: ["sup-print-parts"],
    allowedTiersByCompany: { "sup-auto-clio": exactOk },
    mustKeepSignal: "brand+model:renault clio",
  }),
  s({
    id: "auto-wrong-cat",
    categoryBucket: "automotive",
    description: "Yanlış kategori furniture, Clio",
    envelope: {
      id: "auto-wrong-cat",
      rawInput: "Renault Clio",
      categoryDbId: CAT.furniture.dbId,
      categorySlug: CAT.furniture.slug,
      userSelected: true,
      status: "user_confirmed",
      brand: "Renault",
      model: "Clio",
      product: "otomobil",
      candidates: [CAT.furniture.slug, CAT.automotive.slug],
    },
    expectedCompanyIds: ["sup-auto-clio"],
    unexpectedCompanyIds: ["sup-furniture"],
    mustKeepSignal: "entity_rescue",
  }),
  s({
    id: "auto-no-model",
    categoryBucket: "automotive",
    description: "Marka var model yok",
    envelope: {
      id: "auto-no-model",
      rawInput: "Renault araç",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      brand: "Renault",
      product: "otomobil",
    },
    expectedCompanyIds: ["sup-auto-clio"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "missing_model_keeps_brand_expert",
  }),
  s({
    id: "auto-nationwide",
    categoryBucket: "automotive",
    description: "Türkiye geneli araç",
    envelope: {
      id: "auto-nationwide",
      rawInput: "Clio",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      brand: "Renault",
      model: "Clio",
      locationMode: "nationwide",
    },
    expectedCompanyIds: ["sup-auto-clio"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "nationwide",
  }),
  s({
    id: "auto-no-budget",
    categoryBucket: "automotive",
    description: "Bütçesiz araç",
    envelope: {
      id: "auto-no-budget",
      rawInput: "ikinci el Clio",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      brand: "Renault",
      model: "Clio",
    },
    expectedCompanyIds: ["sup-auto-clio"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "unknown_budget",
  }),
  s({
    id: "auto-unresolved",
    categoryBucket: "automotive",
    description: "Unresolved auto",
    envelope: {
      id: "auto-unresolved",
      rawInput: "araba gibi bir şey",
      status: "unresolved",
    },
    expectedCompanyIds: [],
    unexpectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "review",
  }),
  s({
    id: "auto-pump-collision",
    categoryBucket: "automotive",
    description: "Yakıt pompası — otomotiv alias",
    envelope: {
      id: "auto-pump-collision",
      rawInput: "otomotiv yakıt pompası",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      product: "yakıt pompası",
    },
    expectedCompanyIds: ["sup-alias-collision-auto"],
    unexpectedCompanyIds: ["sup-print-parts", "sup-water-pump"],
    mustKeepSignal: "alias_collision_auto_context",
  }),
  s({
    id: "auto-city",
    categoryBucket: "automotive",
    description: "Şehirli otomotiv (soft)",
    envelope: {
      id: "auto-city",
      rawInput: "Renault Clio İstanbul",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      brand: "Renault",
      model: "Clio",
      city: "İstanbul",
      locationMode: "city",
    },
    expectedCompanyIds: ["sup-auto-clio"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "city_soft",
  }),
];

const priorityRE: GoldenScenario[] = [
  s({
    id: "re-city",
    categoryBucket: "real-estate",
    description: "Konumlu emlak",
    envelope: {
      id: "re-city",
      rawInput: "Kadıköy kiralık daire",
      categoryDbId: CAT.realEstate.dbId,
      categorySlug: CAT.realEstate.slug,
      product: "daire",
      city: "İstanbul",
      district: "Kadıköy",
      locationMode: "city",
    },
    expectedCompanyIds: ["sup-re-istanbul", "sup-re-nationwide"],
    unexpectedCompanyIds: ["sup-baby-stroller"],
    mustKeepSignal: "city_district",
  }),
  s({
    id: "re-nationwide",
    categoryBucket: "real-estate",
    description: "Türkiye geneli emlak",
    envelope: {
      id: "re-nationwide",
      rawInput: "satılık daire arıyorum",
      categoryDbId: CAT.realEstate.dbId,
      categorySlug: CAT.realEstate.slug,
      product: "daire",
      locationMode: "nationwide",
    },
    expectedCompanyIds: ["sup-re-nationwide"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "nationwide_not_lost",
  }),
  s({
    id: "re-no-budget",
    categoryBucket: "real-estate",
    description: "Bütçesiz emlak",
    envelope: {
      id: "re-no-budget",
      rawInput: "daire bakıyorum",
      categoryDbId: CAT.realEstate.dbId,
      categorySlug: CAT.realEstate.slug,
      product: "daire",
      city: "İstanbul",
    },
    expectedCompanyIds: ["sup-re-istanbul", "sup-re-nationwide"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "unknown_budget",
  }),
  s({
    id: "re-wrong-cat",
    categoryBucket: "real-estate",
    description: "Yanlış kategori services, daire",
    envelope: {
      id: "re-wrong-cat",
      rawInput: "kiralık daire",
      categoryDbId: CAT.services.dbId,
      categorySlug: CAT.services.slug,
      userSelected: true,
      status: "user_confirmed",
      product: "daire",
      candidates: [CAT.services.slug, CAT.realEstate.slug],
    },
    expectedCompanyIds: ["sup-re-nationwide", "sup-re-istanbul"],
    unexpectedCompanyIds: ["sup-services-logo"],
    mustKeepSignal: "product_rescue",
  }),
  s({
    id: "re-unresolved",
    categoryBucket: "real-estate",
    description: "Unresolved RE",
    envelope: {
      id: "re-unresolved",
      rawInput: "yer bakıyorum",
      status: "unresolved",
    },
    expectedCompanyIds: [],
    unexpectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "review",
  }),
  s({
    id: "re-remote",
    categoryBucket: "real-estate",
    description: "Remote mode soft",
    envelope: {
      id: "re-remote",
      rawInput: "yatırım amaçlı daire",
      categoryDbId: CAT.realEstate.dbId,
      categorySlug: CAT.realEstate.slug,
      product: "daire",
      locationMode: "remote",
    },
    expectedCompanyIds: ["sup-re-nationwide"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "remote_not_city_hard_filter",
  }),
  s({
    id: "re-villa",
    categoryBucket: "real-estate",
    description: "Villa",
    envelope: {
      id: "re-villa",
      rawInput: "satılık villa",
      categoryDbId: CAT.realEstate.dbId,
      categorySlug: CAT.realEstate.slug,
      product: "villa",
      locationMode: "nationwide",
    },
    expectedCompanyIds: ["sup-re-nationwide"],
    unexpectedCompanyIds: ["sup-furniture"],
    mustKeepSignal: "product:villa",
  }),
  s({
    id: "re-budget-range",
    categoryBucket: "real-estate",
    description: "Bütçeli emlak — hard filter olmamalı",
    envelope: {
      id: "re-budget-range",
      rawInput: "daire 2 milyon",
      categoryDbId: CAT.realEstate.dbId,
      categorySlug: CAT.realEstate.slug,
      product: "daire",
      city: "İstanbul",
      budgetMin: 1000000,
      budgetMax: 2000000,
    },
    expectedCompanyIds: ["sup-re-istanbul"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "budget_soft_only",
  }),
];

function padCategory(
  bucket: string,
  seeds: Array<{
    id?: string;
    description?: string;
    envelope: EnvelopePartial;
    expectedCompanyIds: string[];
    unexpectedCompanyIds?: string[];
    allowedTiersByCompany?: Record<string, MatchTier[]>;
    requiredReasonsIncludes?: string[];
    mustKeepSignal: string;
    allowZeroMatchReview?: boolean;
  }>,
): GoldenScenario[] {
  return seeds.map((row, i) =>
    s({
      id: row.id ?? `${bucket}-${i + 1}`,
      categoryBucket: bucket,
      description: row.description ?? `${bucket} scenario ${i + 1}`,
      envelope: row.envelope,
      expectedCompanyIds: row.expectedCompanyIds,
      unexpectedCompanyIds: row.unexpectedCompanyIds ?? [],
      allowedTiersByCompany: row.allowedTiersByCompany,
      requiredReasonsIncludes: row.requiredReasonsIncludes,
      mustKeepSignal: row.mustKeepSignal,
      allowZeroMatchReview: row.allowZeroMatchReview,
    }),
  );
}

const otherMachinery = padCategory("machinery", [
  {
    id: "machinery-1",
    description: "CNC",
    envelope: {
      id: "machinery-1",
      rawInput: "CNC tezgah",
      categoryDbId: CAT.machinery.dbId,
      categorySlug: CAT.machinery.slug,
      product: "cnc",
    },
    expectedCompanyIds: ["sup-machinery-general"],
    mustKeepSignal: "product:cnc",
  },
  {
    id: "machinery-2",
    description: "Nationwide machinery",
    envelope: {
      id: "machinery-2",
      rawInput: "pres makinesi",
      categoryDbId: CAT.machinery.dbId,
      categorySlug: CAT.machinery.slug,
      product: "pres",
      locationMode: "nationwide",
    },
    expectedCompanyIds: ["sup-machinery-general"],
    mustKeepSignal: "nationwide",
  },
  {
    id: "machinery-3",
    description: "Unresolved machinery",
    envelope: { id: "machinery-3", rawInput: "makine işi", status: "unresolved" },
    expectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "review",
  },
]);

const otherAppliances = padCategory("appliances", [
  {
    id: "appliances-bosch-serie6",
    description: "Bosch Serie 6",
    envelope: {
      id: "appliances-bosch-serie6",
      rawInput: "Bosch Serie 6 çamaşır makinesi",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      brand: "Bosch",
      family: "Serie 6",
      product: "çamaşır makinesi",
    },
    expectedCompanyIds: ["sup-bosch-appliance"],
    unexpectedCompanyIds: ["sup-bosch-auto-service"],
    allowedTiersByCompany: {
      "sup-bosch-appliance": exactOk,
      "sup-tv-arcelik": nearOnly,
    },
    mustKeepSignal: "family:serie 6",
  },
  {
    id: "appliances-2",
    description: "No budget appliances",
    envelope: {
      id: "appliances-2",
      rawInput: "bulaşık makinesi",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      product: "bulaşık makinesi",
    },
    expectedCompanyIds: ["sup-bosch-appliance"],
    mustKeepSignal: "unknown_budget",
  },
  {
    id: "appliances-3",
    description: "Wrong cat appliances",
    envelope: {
      id: "appliances-3",
      rawInput: "Bosch Serie 6",
      categoryDbId: CAT.services.dbId,
      categorySlug: CAT.services.slug,
      userSelected: true,
      status: "user_confirmed",
      brand: "Bosch",
      family: "Serie 6",
      product: "çamaşır makinesi",
      candidates: [CAT.services.slug, CAT.appliances.slug],
    },
    expectedCompanyIds: ["sup-bosch-appliance"],
    unexpectedCompanyIds: ["sup-bosch-auto-service"],
    mustKeepSignal: "entity_rescue",
  },
]);

const otherFurniture = padCategory("furniture", [
  {
    id: "furniture-1",
    description: "Masa",
    envelope: {
      id: "furniture-1",
      rawInput: "yemek masası",
      categoryDbId: CAT.furniture.dbId,
      categorySlug: CAT.furniture.slug,
      product: "masa",
      city: "Ankara",
    },
    expectedCompanyIds: ["sup-furniture"],
    mustKeepSignal: "product:masa",
  },
  {
    id: "furniture-2",
    description: "Nationwide furniture soft",
    envelope: {
      id: "furniture-2",
      rawInput: "koltuk takımı",
      categoryDbId: CAT.furniture.dbId,
      categorySlug: CAT.furniture.slug,
      product: "koltuk",
      locationMode: "nationwide",
    },
    expectedCompanyIds: ["sup-furniture"],
    mustKeepSignal: "nationwide_soft",
  },
  {
    id: "furniture-3",
    description: "Unresolved furniture",
    envelope: { id: "furniture-3", rawInput: "ev eşyası", status: "unresolved" },
    expectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "review",
  },
]);

const otherServices = padCategory("services", [
  {
    id: "services-logo-remote",
    description: "Uzaktan logo tasarımı",
    envelope: {
      id: "services-logo-remote",
      rawInput: "uzaktan logo tasarımı",
      categoryDbId: CAT.services.dbId,
      categorySlug: CAT.services.slug,
      product: "logo tasarımı",
      locationMode: "remote",
    },
    expectedCompanyIds: ["sup-services-logo"],
    unexpectedCompanyIds: ["sup-baby-stroller"],
    mustKeepSignal: "remote_logo",
  },
  {
    id: "services-2",
    description: "Logo no budget",
    envelope: {
      id: "services-2",
      rawInput: "logo lazım",
      categoryDbId: CAT.services.dbId,
      categorySlug: CAT.services.slug,
      product: "logo",
    },
    expectedCompanyIds: ["sup-services-logo"],
    mustKeepSignal: "unknown_budget",
  },
  {
    id: "services-3",
    description: "Unresolved services",
    envelope: { id: "services-3", rawInput: "bir hizmet", status: "unresolved" },
    expectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "review",
  },
]);

const otherHome = padCategory("home-kitchen", [
  {
    id: "home-1",
    description: "Tencere",
    envelope: {
      id: "home-1",
      rawInput: "Tefal tencere",
      categoryDbId: CAT.homeKitchen.dbId,
      categorySlug: CAT.homeKitchen.slug,
      brand: "Tefal",
      product: "tencere",
    },
    expectedCompanyIds: ["sup-home-kitchen"],
    mustKeepSignal: "brand+product",
  },
  {
    id: "home-2",
    description: "No budget home",
    envelope: {
      id: "home-2",
      rawInput: "tava",
      categoryDbId: CAT.homeKitchen.dbId,
      categorySlug: CAT.homeKitchen.slug,
      product: "tava",
    },
    expectedCompanyIds: ["sup-home-kitchen"],
    mustKeepSignal: "unknown_budget",
  },
  {
    id: "home-3",
    description: "Unresolved home",
    envelope: { id: "home-3", rawInput: "mutfaklık", status: "unresolved" },
    expectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "review",
  },
]);

const otherHealth = padCategory("health", [
  {
    id: "health-1",
    description: "Tansiyon aleti",
    envelope: {
      id: "health-1",
      rawInput: "tansiyon aleti",
      categoryDbId: CAT.health.dbId,
      categorySlug: CAT.health.slug,
      product: "tansiyon aleti",
    },
    expectedCompanyIds: ["sup-health"],
    mustKeepSignal: "product",
  },
  {
    id: "health-2",
    description: "Nationwide health",
    envelope: {
      id: "health-2",
      rawInput: "sağlık ürünü",
      categoryDbId: CAT.health.dbId,
      categorySlug: CAT.health.slug,
      locationMode: "nationwide",
    },
    expectedCompanyIds: ["sup-health"],
    allowedTiersByCompany: { "sup-health": nearOnly },
    mustKeepSignal: "nationwide",
  },
  {
    id: "health-3",
    description: "Unresolved health",
    envelope: { id: "health-3", rawInput: "sağlıkla ilgili", status: "unresolved" },
    expectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "review",
  },
]);

/** Adversarial / boundary corpus — ≥20 */
const adversarial: GoldenScenario[] = [
  s({
    id: "adv-stroller-not-auto",
    categoryBucket: "adversarial",
    description: "Bebek arabası → otomotiv olmamalı",
    envelope: {
      id: "adv-stroller-not-auto",
      rawInput: "bebek arabası",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
    },
    expectedCompanyIds: ["sup-baby-stroller"],
    unexpectedCompanyIds: ["sup-auto-clio", "sup-alias-collision-auto"],
    mustKeepSignal: "no_auto_for_stroller",
  }),
  s({
    id: "adv-arcelik-tv-not-appliance-washer",
    categoryBucket: "adversarial",
    description: "Arçelik TV → beyaz eşya uzmanı STRONG/EXACT olmamalı",
    envelope: {
      id: "adv-arcelik-tv-not-appliance-washer",
      rawInput: "Arçelik televizyon",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      product: "televizyon",
      brand: "Arçelik",
    },
    expectedCompanyIds: ["sup-tv-arcelik"],
    unexpectedCompanyIds: ["sup-arcelik-appliance"],
    mustKeepSignal: "product_context_blocks_wrong_arcelik",
  }),
  s({
    id: "adv-bosch-washer-not-auto",
    categoryBucket: "adversarial",
    description: "Bosch çamaşır → Bosch otomotiv STRONG/EXACT olamaz",
    envelope: {
      id: "adv-bosch-washer-not-auto",
      rawInput: "Bosch Serie 6 çamaşır makinesi",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      brand: "Bosch",
      family: "Serie 6",
      product: "çamaşır makinesi",
    },
    expectedCompanyIds: ["sup-bosch-appliance"],
    unexpectedCompanyIds: ["sup-bosch-auto-service"],
    mustKeepSignal: "bosch_domain_split",
  }),
  s({
    id: "adv-heidelberg-not-water-pump",
    categoryBucket: "adversarial",
    description: "Heidelberg nemlendirme → genel su pompası yok",
    envelope: {
      id: "adv-heidelberg-not-water-pump",
      rawInput: "Heidelberg SM 74 nemlendirme pompası",
      categoryDbId: CAT.printing.dbId,
      categorySlug: CAT.printing.slug,
      brand: "Heidelberg",
      model: "SM 74",
      product: "nemlendirme pompası",
    },
    expectedCompanyIds: ["sup-print-parts"],
    unexpectedCompanyIds: ["sup-water-pump"],
    mustKeepSignal: "no_generic_pump",
  }),
  s({
    id: "adv-a55-cross-brand",
    categoryBucket: "adversarial",
    description: "Arçelik A55 ≠ Samsung Galaxy A55",
    envelope: {
      id: "adv-a55-cross-brand",
      rawInput: "Arçelik A55 televizyon",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      brand: "Arçelik",
      model: "A55",
      product: "televizyon",
    },
    expectedCompanyIds: ["sup-tv-arcelik"],
    unexpectedCompanyIds: ["sup-samsung-phone"],
    allowedTiersByCompany: {
      "sup-tv-arcelik": exactOk,
    },
    expectedInventoryEvidenceByCompany: {
      "sup-tv-arcelik": ["inventory_brand_model_exact"],
    },
    mustKeepSignal: "brand_model_AND",
  }),
  s({
    id: "adv-category-only-max-near",
    categoryBucket: "adversarial",
    description: "Yalnız kategori → max NEAR",
    envelope: {
      id: "adv-category-only-max-near",
      rawInput: "bebek kategorisinde bir şey",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
    },
    expectedCompanyIds: ["sup-category-follow-only"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: {
      "sup-baby-stroller": nearOnly,
      "sup-baby-general": nearOnly,
      "sup-category-follow-only": nearOnly,
      "sup-chicco-dealer": nearOnly,
      "sup-cybex-dealer": nearOnly,
      "sup-multi-channel-same": nearOnly,
    },
    mustKeepSignal: "category_only_max_NEAR",
  }),
  s({
    id: "adv-follow-category-only",
    categoryBucket: "adversarial",
    description: "Yalnız category follow → max NEAR",
    envelope: {
      id: "adv-follow-category-only",
      rawInput: "bebek kategorisi takibi",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
    },
    expectedCompanyIds: ["sup-category-follow-only"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: { "sup-category-follow-only": nearOnly },
    mustKeepSignal: "follow_category_only",
  }),
  s({
    id: "adv-inventory-category-only",
    categoryBucket: "adversarial",
    description: "Yalnız category inventory → max NEAR",
    envelope: {
      id: "adv-inventory-category-only",
      rawInput: "matbaa kategorisi envanter",
      categoryDbId: CAT.printing.dbId,
      categorySlug: CAT.printing.slug,
    },
    expectedCompanyIds: ["sup-category-inventory-only"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: { "sup-category-inventory-only": nearOnly },
    mustKeepSignal: "inventory_category_only",
  }),
  s({
    id: "adv-lexical-generic",
    categoryBucket: "adversarial",
    description: "Yalnız genel lexical → EXACT/STRONG olamaz",
    envelope: {
      id: "adv-lexical-generic",
      rawInput: "makine ürün servis",
      status: "ambiguous",
      categoryDbId: CAT.services.dbId,
      categorySlug: CAT.services.slug,
    },
    expectedCompanyIds: ["sup-lexical-generic"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: { "sup-lexical-generic": nearOnly },
    mustKeepSignal: "lexical_not_exact",
  }),
  s({
    id: "adv-generic-words",
    categoryBucket: "adversarial",
    description: "pompa/makine/servis/ürün/araba generic",
    envelope: {
      id: "adv-generic-words",
      rawInput: "pompa makine servis ürün araba",
      status: "unresolved",
    },
    expectedCompanyIds: [],
    unexpectedCompanyIds: ["sup-water-pump", "sup-print-parts", "sup-auto-clio"],
    allowZeroMatchReview: true,
    mustKeepSignal: "generic_unresolved_zero",
  }),
  s({
    id: "adv-wrong-cat-right-product",
    categoryBucket: "adversarial",
    description: "Yanlış kullanıcı kategorisi + doğru ürün",
    envelope: {
      id: "adv-wrong-cat-right-product",
      rawInput: "bebek arabası",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      userSelected: true,
      status: "user_confirmed",
      product: "bebek arabası",
      candidates: [CAT.automotive.slug, CAT.baby.slug],
    },
    expectedCompanyIds: ["sup-baby-stroller"],
    unexpectedCompanyIds: ["sup-auto-clio"],
    mustKeepSignal: "wrong_cat_product_rescue",
  }),
  s({
    id: "adv-unresolved-strong-entity",
    categoryBucket: "adversarial",
    description: "Unresolved + güçlü ürün/marka → aday var, EXACT yok",
    envelope: {
      id: "adv-unresolved-strong-entity",
      rawInput: "Chicco bebek arabası",
      status: "unresolved",
      product: "bebek arabası",
      brand: "Chicco",
    },
    expectedCompanyIds: ["sup-chicco-dealer"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: { "sup-chicco-dealer": nearOnly },
    expectReviewRequired: true,
    mustKeepSignal: "unresolved_entity_capped",
  }),
  s({
    id: "adv-unresolved-nonsense",
    categoryBucket: "adversarial",
    description: "Unresolved + anlamsız metin",
    envelope: {
      id: "adv-unresolved-nonsense",
      rawInput: "asdf qwer zxcv",
      status: "unresolved",
    },
    expectedCompanyIds: [],
    unexpectedCompanyIds: [],
    allowZeroMatchReview: true,
    mustKeepSignal: "nonsense_zero_review",
  }),
  s({
    id: "adv-brand-no-model",
    categoryBucket: "adversarial",
    description: "Marka var model yok",
    envelope: {
      id: "adv-brand-no-model",
      rawInput: "Chicco ürün",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      brand: "Chicco",
      product: "bebek arabası",
    },
    expectedCompanyIds: ["sup-chicco-dealer"],
    unexpectedCompanyIds: ["sup-cybex-dealer"],
    mustKeepSignal: "brand_without_model",
  }),
  s({
    id: "adv-model-no-brand",
    categoryBucket: "adversarial",
    description: "Model var marka yok — kontrollü tier",
    envelope: {
      id: "adv-model-no-brand",
      rawInput: "Clio arıyorum",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      model: "Clio",
      product: "otomobil",
    },
    expectedCompanyIds: ["sup-auto-clio"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: { "sup-auto-clio": nearOnly },
    mustKeepSignal: "model_without_brand_controlled",
  }),
  s({
    id: "adv-brand-model-conflict",
    categoryBucket: "adversarial",
    description: "Marka-model çelişkisi (Samsung + Clio)",
    envelope: {
      id: "adv-brand-model-conflict",
      rawInput: "Samsung Clio",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      brand: "Samsung",
      model: "Clio",
      product: "otomobil",
    },
    expectedCompanyIds: [],
    unexpectedCompanyIds: ["sup-auto-clio", "sup-samsung-phone"],
    mustKeepSignal: "brand_model_conflict",
  }),
  s({
    id: "adv-location-unknown",
    categoryBucket: "adversarial",
    description: "Konum bilinmiyor — negatif yok",
    envelope: {
      id: "adv-location-unknown",
      rawInput: "bebek arabası",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
      locationMode: "no_preference",
    },
    expectedCompanyIds: ["sup-baby-stroller"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "location_unknown_neutral",
  }),
  s({
    id: "adv-budget-unknown",
    categoryBucket: "adversarial",
    description: "Bütçe bilinmiyor",
    envelope: {
      id: "adv-budget-unknown",
      rawInput: "bebek arabası",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
    },
    expectedCompanyIds: ["sup-baby-stroller"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "budget_unknown_neutral",
  }),
  s({
    id: "adv-dedupe-multichannel",
    categoryBucket: "adversarial",
    description: "Çok kanaldan aynı şirket tekilleşir",
    envelope: {
      id: "adv-dedupe-multichannel",
      rawInput: "Joie bebek arabası",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
      brand: "Joie",
      taxonomyNodeIds: [CAT.baby.taxStroller],
      primaryLeafId: CAT.baby.taxStroller,
    },
    expectedCompanyIds: ["sup-multi-channel-same"],
    unexpectedCompanyIds: [],
    mustKeepSignal: "dedupe_single_candidate",
  }),
  s({
    id: "adv-alias-klima",
    categoryBucket: "adversarial",
    description: "klima alias",
    envelope: {
      id: "adv-alias-klima",
      rawInput: "klima arıyorum",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      product: "klima",
    },
    expectedCompanyIds: ["sup-ac-hvac"],
    unexpectedCompanyIds: ["sup-furniture"],
    mustKeepSignal: "alias:klima",
  }),
  s({
    id: "adv-alias-koltuk",
    categoryBucket: "adversarial",
    description: "koltuk alias",
    envelope: {
      id: "adv-alias-koltuk",
      rawInput: "koltuk takımı",
      categoryDbId: CAT.furniture.dbId,
      categorySlug: CAT.furniture.slug,
      product: "koltuk",
    },
    expectedCompanyIds: ["sup-furniture"],
    unexpectedCompanyIds: ["sup-ac-hvac"],
    mustKeepSignal: "alias:koltuk",
  }),
  s({
    id: "adv-alias-yedek-parca",
    categoryBucket: "adversarial",
    description: "yedek parça alias",
    envelope: {
      id: "adv-alias-yedek-parca",
      rawInput: "otomobil yedek parça",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      product: "yedek parça",
    },
    expectedCompanyIds: ["sup-auto-spare"],
    unexpectedCompanyIds: ["sup-print-parts"],
    mustKeepSignal: "alias:yedek_parca",
  }),
  s({
    id: "adv-cartesian-brand-model-not-exact",
    categoryBucket: "adversarial",
    description: "Ayrı brands[]+models[] cartesian EXACT olamaz",
    envelope: {
      id: "adv-cartesian-brand-model-not-exact",
      rawInput: "Arçelik A55 televizyon",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      brand: "Arçelik",
      model: "A55",
      product: "televizyon",
    },
    expectedCompanyIds: ["sup-cartesian-a55"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: {
      "sup-cartesian-a55": nearOnly,
    },
    requiredReasonsByCompany: {
      "sup-cartesian-a55": ["evidence:cartesian_brand_model_unverified"],
    },
  }),
  s({
    id: "adv-partial-brand-miss-kept",
    categoryBucket: "adversarial",
    description: "Partial brand list miss → silinmez, EXACT/STRONG olamaz",
    envelope: {
      id: "adv-partial-brand-miss-kept",
      rawInput: "Chicco bebek arabası",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      brand: "Chicco",
      product: "bebek arabası",
    },
    expectedCompanyIds: ["sup-partial-brand-generalist"],
    unexpectedCompanyIds: ["sup-exhaustive-brand-only", "sup-explicit-exclude-chicco"],
    allowedTiersByCompany: {
      "sup-partial-brand-generalist": nearOnly,
    },
    requiredReasonsByCompany: {
      "sup-partial-brand-generalist": ["evidence:partial_brand_miss"],
    },
  }),
  s({
    id: "adv-exhaustive-brand-conflict",
    categoryBucket: "adversarial",
    description: "Exhaustive brand conflict → NO_MATCH",
    envelope: {
      id: "adv-exhaustive-brand-conflict",
      rawInput: "Chicco bebek arabası",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      brand: "Chicco",
      product: "bebek arabası",
    },
    expectedCompanyIds: ["sup-chicco-dealer"],
    unexpectedCompanyIds: ["sup-exhaustive-brand-only"],
    allowedTiersByCompany: {
      "sup-chicco-dealer": exactOk,
    },
  }),
  s({
    id: "adv-explicit-brand-exclude",
    categoryBucket: "adversarial",
    description: "Explicit brand exclude → NO_MATCH",
    envelope: {
      id: "adv-explicit-brand-exclude",
      rawInput: "Chicco bebek arabası",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      brand: "Chicco",
      product: "bebek arabası",
    },
    expectedCompanyIds: ["sup-chicco-dealer"],
    unexpectedCompanyIds: ["sup-explicit-exclude-chicco"],
  }),
  s({
    id: "adv-model-unknown-product-expert-kept",
    categoryBucket: "adversarial",
    description: "Brand+model isteniyor, supplier model yok → ürün uzmanı NEAR/REVIEW",
    envelope: {
      id: "adv-model-unknown-product-expert-kept",
      rawInput: "Renault Clio otomobil",
      categoryDbId: CAT.automotive.dbId,
      categorySlug: CAT.automotive.slug,
      brand: "Renault",
      model: "Clio",
      product: "otomobil",
    },
    expectedCompanyIds: ["sup-model-unknown-product-expert"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: {
      "sup-model-unknown-product-expert": nearOnly,
    },
  }),
  s({
    id: "adv-inventory-pair-strong",
    categoryBucket: "adversarial",
    description: "Aynı inventory satırı brand+model → güçlü kanıt",
    envelope: {
      id: "adv-inventory-pair-strong",
      rawInput: "Arçelik A55 televizyon",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      brand: "Arçelik",
      model: "A55",
      product: "televizyon",
    },
    expectedCompanyIds: ["sup-tv-arcelik", "sup-cartesian-a55"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: {
      "sup-tv-arcelik": exactOk,
      "sup-cartesian-a55": nearOnly,
    },
    expectedInventoryEvidenceByCompany: {
      "sup-tv-arcelik": ["inventory_brand_model_exact"],
    },
  }),
  s({
    id: "adv-declared-brand-model-pair",
    categoryBucket: "adversarial",
    description: "brandModelPairs doğru pair → güçlü kanıt",
    envelope: {
      id: "adv-declared-brand-model-pair",
      rawInput: "Heidelberg SM 74",
      categoryDbId: CAT.printing.dbId,
      categorySlug: CAT.printing.slug,
      brand: "Heidelberg",
      model: "SM 74",
      product: "baskı makinesi",
    },
    expectedCompanyIds: ["sup-print-press"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: {
      "sup-print-press": exactOk,
    },
    expectedMatchedSignalsByCompany: {
      "sup-print-press": ["brand", "family_model"],
    },
  }),
  s({
    id: "adv-samsung-a55-not-arcelik-exact",
    categoryBucket: "adversarial",
    description: "Arçelik+A55, yalnız Samsung A55 pair → EXACT/STRONG değil",
    envelope: {
      id: "adv-samsung-a55-not-arcelik-exact",
      rawInput: "Arçelik A55 televizyon",
      categoryDbId: CAT.appliances.dbId,
      categorySlug: CAT.appliances.slug,
      brand: "Arçelik",
      model: "A55",
      product: "televizyon",
    },
    expectedCompanyIds: ["sup-tv-arcelik"],
    unexpectedCompanyIds: ["sup-samsung-phone"],
    allowedTiersByCompany: {
      "sup-tv-arcelik": exactOk,
    },
  }),
  s({
    id: "adv-partial-product-miss-kept",
    categoryBucket: "adversarial",
    description: "Partial product list miss → aday tamamen silinmiyor",
    envelope: {
      id: "adv-partial-product-miss-kept",
      rawInput: "bebek arabası arıyorum",
      categoryDbId: CAT.baby.dbId,
      categorySlug: CAT.baby.slug,
      product: "bebek arabası",
    },
    expectedCompanyIds: ["sup-partial-product-catalog"],
    unexpectedCompanyIds: [],
    allowedTiersByCompany: {
      "sup-partial-product-catalog": nearOnly,
    },
    requiredReasonsByCompany: {
      "sup-partial-product-catalog": ["evidence:partial_product_miss"],
    },
  }),
];

export const GOLDEN_MATCH_CORPUS: GoldenScenario[] = [
  ...priorityBaby,
  ...priorityTech,
  ...priorityPrinting,
  ...priorityAuto,
  ...priorityRE,
  ...otherMachinery,
  ...otherAppliances,
  ...otherFurniture,
  ...otherServices,
  ...otherHome,
  ...otherHealth,
  ...adversarial,
];

export function corpusStats() {
  const byBucket = new Map<string, number>();
  for (const row of GOLDEN_MATCH_CORPUS) {
    byBucket.set(row.categoryBucket, (byBucket.get(row.categoryBucket) ?? 0) + 1);
  }
  return {
    total: GOLDEN_MATCH_CORPUS.length,
    byBucket: Object.fromEntries(byBucket),
  };
}
