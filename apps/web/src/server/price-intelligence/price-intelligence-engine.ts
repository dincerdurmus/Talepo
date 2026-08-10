import { prisma } from "@/lib/prisma";
import {
  conditionsCompatible,
  normalizeCondition,
} from "@/lib/price-intelligence/condition-utils";
import { computeStrategyCompleteness } from "@/lib/price-intelligence/strategy-completeness";
import type {
  NormalizedProduct,
  PriceIntelligenceResult,
  PriceSignalType,
} from "@/lib/price-intelligence/types";

import {
  buildPriceStrategyContext,
  resolvePriceStrategy,
} from "@/lib/price-intelligence/strategy-resolver";

import {
  buildConfidenceV2,
  computeAggregateConfidence,
} from "./confidence-v2";
import { fetchExternalListings } from "./fetch-external-listings";
import { normalizeProductFromRequest } from "./normalize-product";
import { buildSignalGroupBundle } from "./signal-group-stats";
import { computePriceStatistics, MIN_AGGREGATE_SAMPLE } from "./statistics";
import {
  computeBudgetEvaluation,
  computeMarketRange,
  computeWeightedMarketReference,
  parseBudgetValue,
  shouldIncludeInMarketReference,
} from "./weighted-market-reference";

export type PriceIntelligenceQuery = {
  categoryId: string;
  categorySlug?: string;
  productFingerprint?: string | null;
  city?: string | null;
  district?: string | null;
  condition?: string | null;
  windowDays?: number;
  /** When set, enables live external fetch if suitability allows */
  normalizedProduct?: NormalizedProduct;
  title?: string;
  fieldValues?: { key: string; value: string | null }[];
  includeExternal?: boolean;
  userBudget?: number | null;
};

const WINDOW_OPTIONS = [7, 30, 90, 180, 365] as const;

function resolveWindowDays(days?: number): number {
  if (!days) return 90;
  const nearest = WINDOW_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - days) < Math.abs(prev - days) ? curr : prev,
  );
  return nearest;
}

function extractBudget(
  fieldValues?: { key: string; value: string | null }[],
  explicit?: number | null,
): number | null {
  if (explicit !== undefined && explicit !== null) return explicit;
  const budgetField = fieldValues?.find((f) => f.key === "budget");
  return parseBudgetValue(budgetField?.value);
}

function buildAttributes(fieldValues?: { key: string; value: string | null }[]): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const fv of fieldValues ?? []) {
    if (fv.value?.trim()) attrs[fv.key] = fv.value.trim();
  }
  return attrs;
}

export async function getPriceIntelligence(
  query: PriceIntelligenceQuery,
): Promise<PriceIntelligenceResult> {
  const windowDays = resolveWindowDays(query.windowDays);
  const since = new Date(Date.now() - windowDays * 86400000);
  const requestCondition = normalizeCondition(query.condition);

  const strategy = resolvePriceStrategy(
    buildPriceStrategyContext({
      categorySlug: query.categorySlug,
      title: query.title,
      condition: query.condition,
      fieldValues: query.fieldValues,
      normalizedProduct: query.normalizedProduct,
    }),
  );

  const attributes = {
    ...buildAttributes(query.fieldValues),
    ...(query.normalizedProduct?.attributes ?? {}),
  };

  const completeness = computeStrategyCompleteness({
    strategy: strategy.strategy,
    attributes,
    brand: query.normalizedProduct?.brand,
    model: query.normalizedProduct?.model,
    semanticFields: query.normalizedProduct?.semanticFields,
  });

  const locationParts = [query.city, query.district].filter(Boolean);
  const locationFilter =
    locationParts.length > 0
      ? { contains: locationParts[0]!, mode: "insensitive" as const }
      : undefined;

  const rawObservations = await prisma.priceObservation.findMany({
    where: {
      categoryId: query.categoryId,
      observedAt: { gte: since },
      ...(query.productFingerprint
        ? { productFingerprint: query.productFingerprint }
        : {}),
      ...(locationFilter ? { location: locationFilter } : {}),
    },
    select: {
      sourceType: true,
      price: true,
      currency: true,
      observedAt: true,
      condition: true,
    },
  });

  type ObsRow = {
    price: number;
    sourceType: PriceSignalType;
    observedAt: Date;
    condition: string | null;
    currency: string;
  };

  let observations: ObsRow[] = rawObservations.map((o) => ({
    price: o.price.toNumber(),
    sourceType: o.sourceType as PriceSignalType,
    observedAt: o.observedAt,
    condition: o.condition,
    currency: o.currency,
  }));

  if (requestCondition !== "UNKNOWN") {
    observations = observations.filter((o) =>
      conditionsCompatible(requestCondition, normalizeCondition(o.condition)),
    );
  }

  let externalMeta: PriceIntelligenceResult["external"] = {
    attempted: false,
    providerId: null,
    providerStatus: "NOT_REQUESTED",
    suitabilityScore: 0,
    query: null,
    fetchedCount: 0,
    cached: false,
  };

  let externalMatchedCount = observations.filter((o) => o.sourceType === "EXTERNAL_LISTING").length;
  let averageMatchQuality: number | null = null;
  let providerSuitability = 0;

  if (query.includeExternal && query.categorySlug && query.title) {
    const normalized =
      query.normalizedProduct ??
      normalizeProductFromRequest({
        categoryId: query.categoryId,
        categorySlug: query.categorySlug,
        title: query.title,
        fieldValues: query.fieldValues,
        city: query.city,
        district: query.district,
      });

    externalMeta = { ...externalMeta, attempted: true };

    const external = await fetchExternalListings({
      categorySlug: query.categorySlug,
      categoryId: query.categoryId,
      title: query.title,
      normalized,
      strategy: strategy.strategy,
      city: query.city,
      district: query.district,
    });

    providerSuitability = external.suitabilityScore;

    externalMeta = {
      attempted: true,
      providerId: external.providerId,
      providerStatus: external.providerStatus,
      suitabilityScore: external.suitabilityScore,
      query: external.query,
      fetchedCount: external.observations.length,
      cached: external.cached,
      errorMessage: external.errorMessage,
      externalProviderAttempted: external.externalProviderAttempted,
      externalProviderUsed: external.externalProviderUsed,
      externalRoutingReason: external.routingReason,
      providerCandidates: external.providerCandidates,
    };

    if (external.observations.length > 0) {
      externalMatchedCount = external.matchedCount;
      averageMatchQuality =
        external.matchedCount > 0 && external.rawCount > 0
          ? external.matchedCount / external.rawCount
          : 0.7;

      const liveObs: ObsRow[] = external.observations
        .filter((o) => o.currency === "TRY" || o.currency === "TRY")
        .map((o) => ({
          price: o.price,
          sourceType: "EXTERNAL_LISTING" as const,
          observedAt: o.observedAt,
          condition: o.condition,
          currency: o.currency,
        }));

      observations = [
        ...observations.filter((o) => o.sourceType !== "EXTERNAL_LISTING"),
        ...liveObs,
      ];
    }
  }

  const signalBundle = buildSignalGroupBundle({
    observations,
    strategy: strategy.strategy,
  });

  const identityConfidence = query.normalizedProduct?.confidence ?? 0.5;

  const confidenceV2 = buildConfidenceV2({
    signalGroups: signalBundle,
    strategy: strategy.strategy,
    completeness,
    externalMatchedCount,
    averageMatchQuality,
    providerSuitability,
    identityConfidence,
  });

  const weightedReference = computeWeightedMarketReference({
    groups: [
      { signalType: "TALEPO_OFFER", stats: signalBundle.offerStats, includeInReference: shouldIncludeInMarketReference("TALEPO_OFFER") },
      { signalType: "TALEPO_ACCEPTED_OFFER", stats: signalBundle.acceptedStats, includeInReference: shouldIncludeInMarketReference("TALEPO_ACCEPTED_OFFER") },
      { signalType: "TALEPO_CONFIRMED_TRANSACTION", stats: signalBundle.confirmedStats, includeInReference: shouldIncludeInMarketReference("TALEPO_CONFIRMED_TRANSACTION") },
      { signalType: "EXTERNAL_LISTING", stats: signalBundle.externalListingStats, includeInReference: shouldIncludeInMarketReference("EXTERNAL_LISTING") },
      { signalType: "EXTERNAL_SOLD", stats: signalBundle.externalSoldStats, includeInReference: shouldIncludeInMarketReference("EXTERNAL_SOLD") },
    ],
    weightedObservations: signalBundle.weightedObservations.filter(
      (o) => shouldIncludeInMarketReference(o.sourceType),
    ),
  });

  const marketRange = computeMarketRange({
    weightedReference,
    overallConfidence: confidenceV2.overallConfidence,
    currency: "TRY",
  });

  const userBudget = extractBudget(query.fieldValues, query.userBudget);
  const budgetEvaluation = computeBudgetEvaluation({
    userBudget,
    marketRange,
    overallConfidence: confidenceV2.overallConfidence,
  });

  const internalSample =
    signalBundle.requestStats.rawSampleSize +
    signalBundle.offerStats.rawSampleSize +
    signalBundle.acceptedStats.rawSampleSize +
    signalBundle.confirmedStats.rawSampleSize;

  const totalSample =
    internalSample +
    signalBundle.externalListingStats.rawSampleSize +
    signalBundle.externalSoldStats.rawSampleSize;

  const insufficientData =
    weightedReference.insufficientData &&
    confidenceV2.overallConfidence.level === "NONE";

  const confidence = computeAggregateConfidence({
    internalSample,
    confirmedSample: signalBundle.confirmedStats.rawSampleSize,
    externalListingSample: signalBundle.externalListingStats.rawSampleSize,
    overallScore: confidenceV2.overallConfidence.score,
  });

  const sources = {
    talepoRequests: signalBundle.requestStats.rawSampleSize,
    talepoOffers: signalBundle.offerStats.rawSampleSize,
    acceptedOffers: signalBundle.acceptedStats.rawSampleSize,
    confirmedTransactions: signalBundle.confirmedStats.rawSampleSize,
    externalListings: signalBundle.externalListingStats.rawSampleSize,
    externalSold: signalBundle.externalSoldStats.rawSampleSize,
  };

  return {
    sampleSize: totalSample,
    insufficientData,
    confidence,
    windowDays,
    requestPriceStats: signalBundle.requestStats,
    offerPriceStats: signalBundle.offerStats,
    acceptedOfferStats: signalBundle.acceptedStats,
    confirmedTransactionStats: signalBundle.confirmedStats,
    externalListingStats: signalBundle.externalListingStats,
    externalSoldStats: signalBundle.externalSoldStats,
    sources,
    external: externalMeta,
    signalSummary: {
      talepoLabel: "Talepo verileri",
      externalLabel: "Dış piyasa ilanları",
      totalSignals: totalSample,
    },
    strategy,
    internalConfidence: confidenceV2.internalConfidence,
    externalConfidence: confidenceV2.externalConfidence,
    overallConfidence: confidenceV2.overallConfidence,
    confidenceReasons: confidenceV2.confidenceReasons,
    completeness,
    weightedReference,
    marketRange,
    budgetEvaluation,
    condition: requestCondition,
    conditionAmbiguity: signalBundle.conditionAmbiguity || requestCondition === "UNKNOWN",
  };
}

/** Admin/debug visibility — aggregate counts only, no individual prices */
export async function getProductSignalDebug(input: {
  categoryId: string;
  productFingerprint?: string | null;
}) {
  const grouped = await prisma.priceObservation.groupBy({
    by: ["sourceType"],
    where: {
      categoryId: input.categoryId,
      ...(input.productFingerprint
        ? { productFingerprint: input.productFingerprint }
        : {}),
    },
    _count: { id: true },
    _avg: { price: true },
  });

  const medians: Record<string, number | null> = {};

  for (const row of grouped) {
    const prices = await prisma.priceObservation.findMany({
      where: {
        categoryId: input.categoryId,
        sourceType: row.sourceType,
        ...(input.productFingerprint
          ? { productFingerprint: input.productFingerprint }
          : {}),
      },
      select: { price: true },
      orderBy: { price: "asc" },
    });

    const values = prices.map((p) => p.price.toNumber());
    const stats = computePriceStatistics(values, 1);
    medians[row.sourceType] = stats.median;
  }

  return {
    signals: grouped.map((g) => ({
      sourceType: g.sourceType,
      count: g._count.id,
      avgPrice: g._avg.price?.toNumber() ?? null,
      medianPrice: medians[g.sourceType] ?? null,
    })),
  };
}

export { MIN_AGGREGATE_SAMPLE, WINDOW_OPTIONS };
