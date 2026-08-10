/**
 * Central config for external price provider routing.
 * Thresholds are config-driven — do not scatter magic numbers in call sites.
 */
export const PROVIDER_SUITABILITY_THRESHOLDS = {
  /** Below this: never call external provider */
  skip: Number(process.env.PROVIDER_SUITABILITY_SKIP ?? 0.29),
  /** 0.30–0.59: optional / low priority */
  optionalMax: Number(process.env.PROVIDER_SUITABILITY_OPTIONAL_MAX ?? 0.59),
  /** At or above this: provider may be used */
  use: Number(process.env.PROVIDER_SUITABILITY_USE ?? 0.6),
} as const;

export const EXTERNAL_MATCH_QUALITY = {
  /** Results below this are excluded from aggregate */
  minAggregate: Number(process.env.EXTERNAL_MATCH_QUALITY_MIN ?? 0.4),
} as const;

export const DATAFORSEO_CONFIG = {
  login: process.env.DATAFORSEO_LOGIN ?? "",
  password: process.env.DATAFORSEO_PASSWORD ?? "",
  cacheTtlMs: Number(process.env.DATAFORSEO_CACHE_TTL_MS ?? 3_600_000),
  requestTimeoutMs: Number(process.env.DATAFORSEO_TIMEOUT_MS ?? 25_000),
  pollIntervalMs: Number(process.env.DATAFORSEO_POLL_INTERVAL_MS ?? 1_500),
  maxPollAttempts: Number(process.env.DATAFORSEO_MAX_POLL_ATTEMPTS ?? 12),
  /** Primary — DataForSEO Merchant Google Shopping location for Türkiye */
  locationCode: Number(process.env.DATAFORSEO_LOCATION_CODE ?? 2792),
  /** Fallback when location_code is unavailable */
  locationName: process.env.DATAFORSEO_LOCATION_NAME ?? "Turkiye",
  languageCode: process.env.DATAFORSEO_LANGUAGE_CODE ?? "tr",
  currency: process.env.DATAFORSEO_CURRENCY ?? "TRY",
  apiBase: "https://api.dataforseo.com/v3",
} as const;

export function isDataForSeoConfigured(): boolean {
  return Boolean(DATAFORSEO_CONFIG.login && DATAFORSEO_CONFIG.password);
}

export type SuitabilityBand = "skip" | "optional" | "use";

export function getSuitabilityBand(score: number): SuitabilityBand {
  if (score <= PROVIDER_SUITABILITY_THRESHOLDS.skip) return "skip";
  if (score < PROVIDER_SUITABILITY_THRESHOLDS.use) return "optional";
  return "use";
}

export function shouldCallExternalProvider(score: number): boolean {
  return score >= PROVIDER_SUITABILITY_THRESHOLDS.use;
}
