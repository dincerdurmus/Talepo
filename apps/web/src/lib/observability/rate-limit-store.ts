/**
 * Provider-neutral rate limit store.
 * Default: in-process (NOT safe alone for multi-instance production).
 * Swap via setRateLimitStore(redisAdapter) when available.
 */

import type { RateLimitOptions, RateLimitResult } from "./rate-limit";

export type RateLimitStore = {
  /** Backend identifier for readiness/reporting */
  kind: "memory" | "distributed";
  consume(options: RateLimitOptions): RateLimitResult | Promise<RateLimitResult>;
};

type Bucket = { tokens: number; updatedAt: number };

function createMemoryStore(): RateLimitStore {
  const buckets = new Map<string, Bucket>();
  return {
    kind: "memory",
    consume(options) {
      const now = Date.now();
      const existing = buckets.get(options.key);
      if (!existing || now - existing.updatedAt >= options.windowMs) {
        buckets.set(options.key, {
          tokens: options.limit - 1,
          updatedAt: now,
        });
        return {
          allowed: true,
          remaining: options.limit - 1,
          retryAfterMs: 0,
        };
      }
      if (existing.tokens <= 0) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: options.windowMs - (now - existing.updatedAt),
        };
      }
      existing.tokens -= 1;
      buckets.set(options.key, existing);
      return {
        allowed: true,
        remaining: existing.tokens,
        retryAfterMs: 0,
      };
    },
  };
}

let store: RateLimitStore = createMemoryStore();

export function getRateLimitStore(): RateLimitStore {
  return store;
}

export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export function resetRateLimitStoreForTests(): void {
  store = createMemoryStore();
}

export function isDistributedRateLimitReady(): boolean {
  return getRateLimitStore().kind === "distributed";
}
