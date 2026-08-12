/**
 * Environment variable classification + production validation helpers.
 * Does not print secret values.
 */

export type EnvClass = "REQUIRED" | "OPTIONAL" | "DEVELOPMENT_ONLY";

export type EnvVarSpec = {
  name: string;
  classification: EnvClass;
  /** Server-only — must not be NEXT_PUBLIC_ */
  serverOnly?: boolean;
  description: string;
};

export const ENV_CATALOG: EnvVarSpec[] = [
  {
    name: "DATABASE_URL",
    classification: "REQUIRED",
    serverOnly: true,
    description: "Prisma/Postgres connection (pooler OK for some reads).",
  },
  {
    name: "DIRECT_URL",
    classification: "REQUIRED",
    serverOnly: true,
    description: "Session-mode URL for migrations and interactive transactions.",
  },
  {
    name: "NEXTAUTH_SECRET",
    classification: "REQUIRED",
    serverOnly: true,
    description: "NextAuth JWT/session secret.",
  },
  {
    name: "NEXTAUTH_URL",
    classification: "OPTIONAL",
    serverOnly: true,
    description: "Canonical app URL for auth callbacks.",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    classification: "OPTIONAL",
    serverOnly: true,
    description: "Google OAuth client id.",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    classification: "OPTIONAL",
    serverOnly: true,
    description: "Google OAuth client secret.",
  },
  {
    name: "DATAFORSEO_LOGIN",
    classification: "OPTIONAL",
    serverOnly: true,
    description: "Price provider credential.",
  },
  {
    name: "DATAFORSEO_PASSWORD",
    classification: "OPTIONAL",
    serverOnly: true,
    description: "Price provider credential.",
  },
  {
    name: "OPENAI_API_KEY",
    classification: "OPTIONAL",
    serverOnly: true,
    description: "Optional AI assistant provider.",
  },
  {
    name: "ALLOW_MOCK_UPGRADE",
    classification: "DEVELOPMENT_ONLY",
    serverOnly: true,
    description: "Enables mock plan upgrades — must be off in production.",
  },
  {
    name: "ALLOW_MOCK_CREDITS",
    classification: "DEVELOPMENT_ONLY",
    serverOnly: true,
    description: "Enables mock credit grants — must be off in production.",
  },
  {
    name: "ALLOW_MOCK_BILLING",
    classification: "DEVELOPMENT_ONLY",
    serverOnly: true,
    description: "Enables mock billing provider/webhooks — must be off in production.",
  },
  {
    name: "TALEPO_PAYMENT_PROVIDER",
    classification: "OPTIONAL",
    serverOnly: true,
    description: "Payment provider id (none|mock|stripe|iyzico|…). No silent vendor pick.",
  },
  {
    name: "TALEPO_PRODUCT_EVENTS_STDOUT",
    classification: "DEVELOPMENT_ONLY",
    serverOnly: true,
    description: "Print product events to stdout.",
  },
];

export type EnvValidationResult = {
  ok: boolean;
  missingRequired: string[];
  developmentOnlyEnabledInProduction: string[];
  clientLeakRisks: string[];
  presentOptional: string[];
};

function isPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

export function validateEnvironment(
  options?: { nodeEnv?: string },
): EnvValidationResult {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const isProd = nodeEnv === "production";

  const missingRequired: string[] = [];
  const developmentOnlyEnabledInProduction: string[] = [];
  const clientLeakRisks: string[] = [];
  const presentOptional: string[] = [];

  // Either DATABASE_URL or DIRECT_URL can satisfy DB at runtime (prisma helper).
  const hasDb = isPresent("DATABASE_URL") || isPresent("DIRECT_URL");
  if (!hasDb) {
    missingRequired.push("DATABASE_URL|DIRECT_URL");
  }
  if (isProd && !isPresent("DIRECT_URL")) {
    missingRequired.push("DIRECT_URL");
  }
  if (!isPresent("NEXTAUTH_SECRET") && isProd) {
    missingRequired.push("NEXTAUTH_SECRET");
  }
  // In non-prod, still recommend but don't hard-fail local tooling without secret
  // Hard gate below uses production-only for NEXTAUTH when assertProduction.

  if (!isPresent("NEXTAUTH_SECRET") && !isProd) {
    // soft — listed only when hardGateNonProdSecrets requested
  }

  for (const spec of ENV_CATALOG) {
    if (spec.serverOnly && spec.name.startsWith("NEXT_PUBLIC_")) {
      clientLeakRisks.push(spec.name);
    }
    if (spec.classification === "OPTIONAL" && isPresent(spec.name)) {
      presentOptional.push(spec.name);
    }
    if (
      isProd &&
      spec.classification === "DEVELOPMENT_ONLY" &&
      isPresent(spec.name) &&
      process.env[spec.name] === "true"
    ) {
      developmentOnlyEnabledInProduction.push(spec.name);
    }
  }

  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("NEXT_PUBLIC_") &&
      /(SECRET|PASSWORD|PRIVATE|TOKEN|API_KEY)/i.test(key)
    ) {
      clientLeakRisks.push(key);
    }
  }

  const ok =
    missingRequired.length === 0 &&
    clientLeakRisks.length === 0 &&
    (!isProd || developmentOnlyEnabledInProduction.length === 0);

  return {
    ok,
    missingRequired: [...new Set(missingRequired)],
    developmentOnlyEnabledInProduction: [
      ...new Set(developmentOnlyEnabledInProduction),
    ],
    clientLeakRisks: [...new Set(clientLeakRisks)],
    presentOptional,
  };
}

/**
 * Production hard gate — call from instrumentation / deploy:check.
 * Never logs secret values.
 */
export function assertProductionEnvironmentHardGate(options?: {
  nodeEnv?: string;
  /** When true, exit process on failure (server boot). */
  exitProcess?: boolean;
}): EnvValidationResult {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const result = validateEnvironment({ nodeEnv });

  if (nodeEnv !== "production") {
    return result;
  }

  // Always require NEXTAUTH_SECRET in production hard gate
  if (!isPresent("NEXTAUTH_SECRET")) {
    if (!result.missingRequired.includes("NEXTAUTH_SECRET")) {
      result.missingRequired.push("NEXTAUTH_SECRET");
    }
    result.ok = false;
  }

  if (
    result.missingRequired.length > 0 ||
    result.developmentOnlyEnabledInProduction.length > 0 ||
    result.clientLeakRisks.length > 0
  ) {
    result.ok = false;
    const lines = [
      "[talepo:env] PRODUCTION ENVIRONMENT HARD GATE FAILED",
      result.missingRequired.length
        ? `missing_required=${result.missingRequired.join(",")}`
        : null,
      result.developmentOnlyEnabledInProduction.length
        ? `dev_only_enabled=${result.developmentOnlyEnabledInProduction.join(",")}`
        : null,
      result.clientLeakRisks.length
        ? `client_leak_risks=${result.clientLeakRisks.join(",")}`
        : null,
    ].filter(Boolean);

    console.error(lines.join(" | "));

    if (options?.exitProcess) {
      process.exit(1);
    }
    throw new Error("Production environment hard gate failed");
  }

  return result;
}

/** Safe summary for readiness — never includes values. */
export function envValidationPublicSummary(result: EnvValidationResult) {
  return {
    ok: result.ok,
    missingRequiredCount: result.missingRequired.length,
    developmentOnlyRiskCount: result.developmentOnlyEnabledInProduction.length,
    clientLeakRiskCount: result.clientLeakRisks.length,
  };
}
