import { DomainError, DomainErrorCode } from "./errors";
import {
  getRateLimitStore,
  resetRateLimitStoreForTests,
} from "./rate-limit-store";

/**
 * Minimal rate limiter for high-cost / abuse-prone endpoints.
 *
 * IMPORTANT: default store is in-process memory.
 * Multi-instance / serverless production needs a distributed RateLimitStore.
 */

export type RateLimitOptions = {
  key: string;
  /** Max tokens in window */
  limit: number;
  /** Window length in ms */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const result = getRateLimitStore().consume(options);
  if (result instanceof Promise) {
    throw new Error(
      "Async rate limit store requires checkRateLimitAsync — use assertRateLimitAsync",
    );
  }
  return result;
}

export async function checkRateLimitAsync(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  return getRateLimitStore().consume(options);
}

export function assertRateLimit(options: RateLimitOptions): void {
  const result = checkRateLimit(options);
  if (!result.allowed) {
    throw new DomainError({
      code: DomainErrorCode.RATE_LIMITED,
      userMessage:
        "Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.",
      status: 429,
      diagnostic: `rate_limit key=${options.key}`,
    });
  }
}

export async function assertRateLimitAsync(
  options: RateLimitOptions,
): Promise<void> {
  const result = await checkRateLimitAsync(options);
  if (!result.allowed) {
    throw new DomainError({
      code: DomainErrorCode.RATE_LIMITED,
      userMessage:
        "Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.",
      status: 429,
      diagnostic: `rate_limit key=${options.key}`,
    });
  }
}

/** Test helper */
export function clearRateLimitBuckets(): void {
  resetRateLimitStoreForTests();
}

export function clientKeyFromRequest(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${prefix}:${ip}`;
}

export function userKey(prefix: string, userId: string): string {
  return `${prefix}:user:${userId}`;
}
