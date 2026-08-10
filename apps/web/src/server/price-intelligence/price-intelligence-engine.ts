import { prisma } from "@/lib/prisma";
import type {
  NormalizedProduct,
  PriceIntelligenceResult,
  PriceSignalType,
} from "@/lib/price-intelligence/types";

import {
  buildPriceStrategyContext,
  resolvePriceStrategy,
} from "@/lib/price-intelligence/strategy-resolver";

import { computeAggregateConfidence } from "./confidence";
import { fetchExternalListings } from "./fetch-external-listings";
import { normalizeProductFromRequest } from "./normalize-product";
import { computePriceStatistics, MIN_AGGREGATE_SAMPLE } from "./statistics";

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
};

const WINDOW_OPTIONS = [7, 30, 90, 180, 365] as const;

function resolveWindowDays(days?: number): number {
  if (!days) return 90;
  const nearest = WINDOW_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - days) < Math.abs(prev - days) ? curr : prev,
  );
  return nearest;
}

function statsFromPrices(values: number[]) {
  return computePriceStatistics(values);
}

export async function getPriceIntelligence(
  query: PriceIntelligenceQuery,
): Promise<PriceIntelligenceResult> {
  const windowDays = resolveWindowDays(query.windowDays);
  const since = new Date(Date.now() - windowDays * 86400000);

  // Phase 2 shadow mode — metadata only; does not gate or alter external fetch
  const strategy = resolvePriceStrategy(
    buildPriceStrategyContext({
      categorySlug: query.categorySlug,
      title: query.title,
      condition: query.condition,
      fieldValues: query.fieldValues,
      normalizedProduct: query.normalizedProduct,
    }),
  );

  const locationParts = [query.city, query.district].filter(Boolean);
  const locationFilter =
    locationParts.length > 0
      ? { contains: locationParts[0]!, mode: "insensitive" as const }
      : undefined;

  const observations = await prisma.priceObservation.findMany({
    where: {
      categoryId: query.categoryId,
      observedAt: { gte: since },
      ...(query.productFingerprint
        ? { productFingerprint: query.productFingerprint }
        : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(locationFilter ? { location: locationFilter } : {}),
    },
    select: {
      sourceType: true,
      price: true,
      currency: true,
    },
  });

  const byType = (type: PriceSignalType) =>
    observations
      .filter((o) => o.sourceType === type)
      .map((o) => o.price.toNumber());

  const requestPriceStats = statsFromPrices(byType("TALEPO_REQUEST"));
  const offerPriceStats = statsFromPrices(byType("TALEPO_OFFER"));
  const acceptedOfferStats = statsFromPrices(byType("TALEPO_ACCEPTED_OFFER"));
  const confirmedTransactionStats = statsFromPrices(byType("TALEPO_CONFIRMED_TRANSACTION"));
  let externalListingStats = statsFromPrices(byType("EXTERNAL_LISTING"));
  const externalSoldStats = statsFromPrices(byType("EXTERNAL_SOLD"));

  const internalSample =
    requestPriceStats.rawSampleSize +
    offerPriceStats.rawSampleSize +
    acceptedOfferStats.rawSampleSize +
    confirmedTransactionStats.rawSampleSize;

  let externalMeta: PriceIntelligenceResult["external"] = {
    attempted: false,
    providerId: null,
    providerStatus: "NOT_REQUESTED",
    suitabilityScore: 0,
    query: null,
    fetchedCount: 0,
    cached: false,
  };

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
      city: query.city,
      district: query.district,
    });

    externalMeta = {
      attempted: true,
      providerId: external.providerId,
      providerStatus: external.providerStatus,
      suitabilityScore: external.suitabilityScore,
      query: external.query,
      fetchedCount: external.observations.length,
      cached: external.cached,
      errorMessage: external.errorMessage,
    };

    if (external.observations.length > 0) {
      const tryPrices = external.observations
        .filter((o) => o.currency === "TRY" || o.currency === query.normalizedProduct?.attributes?.currency)
        .map((o) => o.price);

      const livePrices = tryPrices.length > 0
        ? tryPrices
        : external.observations.map((o) => o.price);

      const dbExternal = byType("EXTERNAL_LISTING");
      externalListingStats = statsFromPrices([...dbExternal, ...livePrices]);
    }
  }

  const totalSample =
    internalSample +
    externalListingStats.rawSampleSize +
    externalSoldStats.rawSampleSize;

  const confirmedSample = confirmedTransactionStats.rawSampleSize;

  // Confidence driven by internal signals — external alone cannot produce HIGH
  const confidence = computeAggregateConfidence({
    internalSample,
    confirmedSample,
  });

  const insufficientData = internalSample < MIN_AGGREGATE_SAMPLE;

  const sources = {
    talepoRequests: requestPriceStats.rawSampleSize,
    talepoOffers: offerPriceStats.rawSampleSize,
    acceptedOffers: acceptedOfferStats.rawSampleSize,
    confirmedTransactions: confirmedTransactionStats.rawSampleSize,
    externalListings: externalListingStats.rawSampleSize,
    externalSold: externalSoldStats.rawSampleSize,
  };

  return {
    sampleSize: totalSample,
    insufficientData,
    confidence,
    windowDays,
    requestPriceStats,
    offerPriceStats,
    acceptedOfferStats,
    confirmedTransactionStats,
    externalListingStats,
    externalSoldStats,
    sources,
    external: externalMeta,
    signalSummary: {
      talepoLabel: "Talepo verileri",
      externalLabel: "Dış piyasa ilanları",
      totalSignals: totalSample,
    },
    strategy,
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
