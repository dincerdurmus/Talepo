import { DomainError, DomainErrorCode } from "./errors";

/**
 * Minimal in-process rate limiter for high-cost / abuse-prone endpoints.
 * Not a distributed limiter — replace with Redis/edge later if needed.
 */

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

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
  const now = Date.now();
  const existing = buckets.get(options.key);
  if (!existing || now - existing.updatedAt >= options.windowMs) {
    buckets.set(options.key, { tokens: options.limit - 1, updatedAt: now });
    return { allowed: true, remaining: options.limit - 1, retryAfterMs: 0 };
  }

  if (existing.tokens <= 0) {
    const retryAfterMs = options.windowMs - (now - existing.updatedAt);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  existing.tokens -= 1;
  buckets.set(options.key, existing);
  return { allowed: true, remaining: existing.tokens, retryAfterMs: 0 };
}

export function assertRateLimit(options: RateLimitOptions): void {
  const result = checkRateLimit(options);
  if (!result.allowed) {
    throw new DomainError({
      code: DomainErrorCode.RATE_LIMITED,
      userMessage: "Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.",
      status: 429,
      diagnostic: `rate_limit key=${options.key}`,
    });
  }
}

/** Test helper */
export function clearRateLimitBuckets(): void {
  buckets.clear();
}

export function clientKeyFromRequest(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${prefix}:${ip}`;
}
