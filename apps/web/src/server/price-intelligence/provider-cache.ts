import type { ExternalPriceObservation } from "@/lib/price-intelligence/types";

type CacheEntry = {
  expiresAt: number;
  results: ExternalPriceObservation[];
};

const cache = new Map<string, CacheEntry>();

export function buildProviderCacheKey(input: {
  providerId: string;
  queryFingerprint: string;
  location: string;
  currency: string;
}): string {
  return [input.providerId, input.queryFingerprint, input.location, input.currency].join("|");
}

export function getCachedProviderResults(key: string): ExternalPriceObservation[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.results;
}

export function setCachedProviderResults(
  key: string,
  results: ExternalPriceObservation[],
  ttlMs: number,
): void {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    results,
  });
}

/** Test helper */
export function clearProviderCache(): void {
  cache.clear();
}

export function providerCacheSize(): number {
  return cache.size;
}
