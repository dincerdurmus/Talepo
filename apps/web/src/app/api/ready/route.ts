import { NextResponse } from "next/server";

import {
  envValidationPublicSummary,
  validateEnvironment,
} from "@/lib/observability/env";
import { evaluateProviderHealth } from "@/lib/observability/provider-health";

/**
 * Readiness — critical dependencies only.
 * External price providers are optional and never force DOWN alone.
 */
export async function GET() {
  const env = validateEnvironment();
  const checks: Record<
    string,
    { critical: boolean; ok: boolean; detail?: string }
  > = {
    env: {
      critical: true,
      ok: env.missingRequired.length === 0,
      detail:
        env.missingRequired.length > 0
          ? `missing:${env.missingRequired.length}`
          : "ok",
    },
  };

  let dbOk = false;
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  checks.database = {
    critical: true,
    ok: dbOk,
    detail: dbOk ? "ok" : "unreachable",
  };

  // Optional — informational only (in-memory telemetry window)
  let providerSamples: { provider: string; durationMs: number; success: boolean; errorCode?: string }[] =
    [];
  try {
    const { getProviderTelemetry } = await import(
      "@/server/price-intelligence/provider-telemetry"
    );
    providerSamples = getProviderTelemetry(50);
  } catch {
    providerSamples = [];
  }
  const provider = evaluateProviderHealth("dataforseo", providerSamples);
  checks.price_provider = {
    critical: false,
    ok: provider.state !== "UNAVAILABLE",
    detail: provider.state,
  };

  const criticalFailed = Object.values(checks).some((c) => c.critical && !c.ok);
  const status = criticalFailed ? "not_ready" : "ready";

  return NextResponse.json(
    {
      ok: !criticalFailed,
      status,
      timestamp: new Date().toISOString(),
      env: envValidationPublicSummary(env),
      checks,
    },
    { status: criticalFailed ? 503 : 200 },
  );
}
