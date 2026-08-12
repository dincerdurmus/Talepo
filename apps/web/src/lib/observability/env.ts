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
    // Soft: interactive tx / migrate need DIRECT_URL
    missingRequired.push("DIRECT_URL");
  }
  if (!isPresent("NEXTAUTH_SECRET")) {
    missingRequired.push("NEXTAUTH_SECRET");
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

  // Known secret names must never be public-prefixed if someone adds aliases.
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("NEXT_PUBLIC_") &&
      /(SECRET|PASSWORD|PRIVATE|TOKEN|API_KEY)/i.test(key)
    ) {
      clientLeakRisks.push(key);
    }
  }

  return {
    ok: missingRequired.length === 0 && clientLeakRisks.length === 0,
    missingRequired: [...new Set(missingRequired)],
    developmentOnlyEnabledInProduction,
    clientLeakRisks: [...new Set(clientLeakRisks)],
    presentOptional,
  };
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
