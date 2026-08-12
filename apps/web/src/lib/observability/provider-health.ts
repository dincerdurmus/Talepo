import { createSubsystemLogger } from "./logger";

export type ProviderHealthState = "HEALTHY" | "DEGRADED" | "UNAVAILABLE";

export type ProviderSample = {
  provider: string;
  durationMs: number;
  success: boolean;
  errorCode?: string;
};

export type ProviderHealthSnapshot = {
  provider: string;
  state: ProviderHealthState;
  sampleSize: number;
  successRate: number;
  avgLatencyMs: number | null;
  lastErrorCode?: string;
};

const log = createSubsystemLogger("provider");

/**
 * Derive coarse provider health from a telemetry sample window.
 * Optional dependency — never used alone to mark app readiness DOWN.
 */
export function evaluateProviderHealth(
  provider: string,
  samplesInput: ProviderSample[],
  options?: { window?: number; degradedBelow?: number; unavailableBelow?: number },
): ProviderHealthSnapshot {
  const window = options?.window ?? 20;
  const degradedBelow = options?.degradedBelow ?? 0.85;
  const unavailableBelow = options?.unavailableBelow ?? 0.2;

  const samples = samplesInput
    .filter((e) => e.provider === provider)
    .slice(-window);

  if (samples.length === 0) {
    return {
      provider,
      state: "HEALTHY",
      sampleSize: 0,
      successRate: 1,
      avgLatencyMs: null,
    };
  }

  const successCount = samples.filter((s) => s.success).length;
  const successRate = successCount / samples.length;
  const avgLatencyMs =
    samples.reduce((sum, s) => sum + s.durationMs, 0) / samples.length;
  const lastFailure = [...samples].reverse().find((s) => !s.success);

  let state: ProviderHealthState = "HEALTHY";
  if (successRate < unavailableBelow) state = "UNAVAILABLE";
  else if (successRate < degradedBelow) state = "DEGRADED";

  return {
    provider,
    state,
    sampleSize: samples.length,
    successRate,
    avgLatencyMs,
    lastErrorCode: lastFailure?.errorCode,
  };
}

export function recordProviderOperationalMetric(input: {
  provider: string;
  operation: string;
  durationMs: number;
  success: boolean;
  failureCategory?: string;
  timedOut?: boolean;
  fallback?: boolean;
  resultCount?: number;
}): void {
  log.info(
    input.success ? "provider.price.completed" : "provider.price.failed",
    {
      outcome: input.success
        ? input.fallback
          ? "fallback"
          : "success"
        : "failure",
      durationMs: input.durationMs,
      errorCode: input.failureCategory,
      context: {
        provider: input.provider,
        operation: input.operation,
        timedOut: Boolean(input.timedOut),
        fallback: Boolean(input.fallback),
        resultCount: input.resultCount ?? 0,
      },
    },
  );
}
