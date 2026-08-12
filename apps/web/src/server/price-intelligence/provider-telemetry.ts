import { recordProviderOperationalMetric } from "@/lib/observability/provider-health";

export type ProviderTelemetryEntry = {
  provider: string;
  queryFingerprint: string;
  requestedAt: Date;
  durationMs: number;
  resultCount: number;
  success: boolean;
  cached: boolean;
  errorCode?: string;
};

const telemetryLog: ProviderTelemetryEntry[] = [];
const MAX_TELEMETRY = 500;

export function recordProviderTelemetry(entry: ProviderTelemetryEntry): void {
  telemetryLog.push(entry);
  if (telemetryLog.length > MAX_TELEMETRY) {
    telemetryLog.splice(0, telemetryLog.length - MAX_TELEMETRY);
  }

  recordProviderOperationalMetric({
    provider: entry.provider,
    operation: "price_lookup",
    durationMs: entry.durationMs,
    success: entry.success,
    failureCategory: entry.errorCode,
    resultCount: entry.resultCount,
    fallback: entry.cached,
  });
}

export function getProviderTelemetry(limit = 50): ProviderTelemetryEntry[] {
  return telemetryLog.slice(-limit);
}

/** Test helper */
export function clearProviderTelemetry(): void {
  telemetryLog.length = 0;
}
