export type ProviderCacheKey = { fingerprint: string; market: string; condition: string; provider: string; strategy: string };
export type ProviderCachePolicy = { ttlMs: number; reuseWithinTtl: boolean; deduplicate: boolean; persistBackend: "NONE" | "DATABASE" | "REDIS" };
export const PRICE_PROVIDER_CACHE_POLICY: ProviderCachePolicy = { ttlMs: 6 * 60 * 60 * 1000, reuseWithinTtl: true, deduplicate: true, persistBackend: "NONE" };
export function buildProviderCacheKey(input: ProviderCacheKey) { return [input.provider, input.strategy, input.fingerprint, input.market, input.condition].map((part) => part.trim().toLowerCase()).join(":"); }
export function isProviderCacheEntryValid(createdAt: Date, now = new Date(), policy = PRICE_PROVIDER_CACHE_POLICY) { return policy.reuseWithinTtl && now.getTime() - createdAt.getTime() <= policy.ttlMs; }
