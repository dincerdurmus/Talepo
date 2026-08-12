/**
 * Deploy/startup env hard gate (no secret values printed).
 * Run: npx tsx scripts/check-production-env.ts
 * Exit 1 on failure when NODE_ENV=production (or --production).
 */
import {
  assertProductionEnvironmentHardGate,
  validateEnvironment,
} from "../src/lib/observability/env";

const forceProd =
  process.argv.includes("--production") ||
  process.env.TALEPO_ENV_CHECK_MODE === "production";

const nodeEnv = forceProd ? "production" : process.env.NODE_ENV ?? "development";

if (nodeEnv === "production") {
  try {
    assertProductionEnvironmentHardGate({ nodeEnv, exitProcess: false });
    console.log("PASS — production environment hard gate");
    process.exit(0);
  } catch {
    process.exit(1);
  }
} else {
  const result = validateEnvironment({ nodeEnv });
  console.log(
    JSON.stringify({
      mode: nodeEnv,
      ok: result.ok,
      missingRequired: result.missingRequired,
      developmentOnlyEnabledInProduction:
        result.developmentOnlyEnabledInProduction,
      clientLeakRiskCount: result.clientLeakRisks.length,
    }),
  );
  process.exit(0);
}
