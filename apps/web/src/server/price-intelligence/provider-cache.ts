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

/** Returns cache age metadata without exposing provider payloads. */
export function getProviderCacheMetadata(key: string): { cacheHit: boolean; expiresAt: number | null } {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return { cacheHit: false, expiresAt: null };
  return { cacheHit: true, expiresAt: entry.expiresAt };
}

const inFlight = new Map<string, Promise<ExternalPriceObservation[]>>();
/** Process-local single-flight helper; it coalesces concurrent calls but is not a distributed cache. */
export async function coalesceProviderQuery(key: string, query: () => Promise<ExternalPriceObservation[]>): Promise<{ results: ExternalPriceObservation[]; dedupHit: boolean }> {
  const existing = inFlight.get(key);
  if (existing) return { results: await existing, dedupHit: true };
  const pending = query();
  inFlight.set(key, pending);
  try { return { results: await pending, dedupHit: false }; }
  finally { inFlight.delete(key); }
}
