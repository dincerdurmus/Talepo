export type IyzicoEnvironment = "sandbox" | "production";

export const IYZICO_SANDBOX_BASE_URL = "https://sandbox-api.iyzipay.com";
export const IYZICO_PRODUCTION_BASE_URL = "https://api.iyzipay.com";

export type IyzicoConfig = {
  apiKey: string;
  secretKey: string;
  merchantId: string;
  baseUrl: string;
  environment: IyzicoEnvironment;
  callbackBaseUrl: string | null;
};

export function resolveIyzicoEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): IyzicoEnvironment {
  const explicit = env.TALEPO_IYZICO_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "production" || explicit === "prod") return "production";
  if (explicit === "sandbox" || explicit === "test") return "sandbox";
  // Do not infer production from NODE_ENV alone for payment credentials.
  const base = env.TALEPO_IYZICO_BASE_URL?.trim().toLowerCase() ?? "";
  if (base.includes("sandbox")) return "sandbox";
  if (base.includes("api.iyzipay.com") && !base.includes("sandbox")) {
    return "production";
  }
  return "sandbox";
}

export function resolveIyzicoBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.TALEPO_IYZICO_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return resolveIyzicoEnvironment(env) === "production"
    ? IYZICO_PRODUCTION_BASE_URL
    : IYZICO_SANDBOX_BASE_URL;
}

export function loadIyzicoConfig(
  env: NodeJS.ProcessEnv = process.env,
): IyzicoConfig | null {
  const apiKey = env.TALEPO_IYZICO_API_KEY?.trim() || env.IYZICO_API_KEY?.trim();
  const secretKey =
    env.TALEPO_IYZICO_SECRET_KEY?.trim() || env.IYZICO_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) return null;

  const environment = resolveIyzicoEnvironment(env);
  return {
    apiKey,
    secretKey,
    merchantId:
      env.TALEPO_IYZICO_MERCHANT_ID?.trim() ||
      env.IYZICO_MERCHANT_ID?.trim() ||
      "",
    baseUrl: resolveIyzicoBaseUrl(env),
    environment,
    callbackBaseUrl:
      env.TALEPO_BILLING_CALLBACK_BASE_URL?.trim() ||
      env.NEXTAUTH_URL?.trim() ||
      null,
  };
}

export function isIyzicoConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return loadIyzicoConfig(env) != null;
}

/** @deprecated alias — prefer isIyzicoConfigured */
export const hasIyzicoCredentials = isIyzicoConfigured;

/**
 * Production paid billing is READY only with production iyzico environment + keys + plan maps.
 * Sandbox credentials in NODE_ENV=production ⇒ not READY for live money.
 */
export function evaluateIyzicoBillingReadiness(
  env: NodeJS.ProcessEnv = process.env,
  options?: { nodeEnv?: string },
): {
  ready: boolean;
  reasons: string[];
  environment: IyzicoEnvironment | null;
} {
  const nodeEnv = options?.nodeEnv ?? env.NODE_ENV ?? "development";
  const reasons: string[] = [];
  const provider = env.TALEPO_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (provider !== "iyzico") {
    return { ready: false, reasons: ["provider_not_iyzico"], environment: null };
  }

  const config = loadIyzicoConfig(env);
  if (!config) {
    return {
      ready: false,
      reasons: ["missing_api_or_secret"],
      environment: null,
    };
  }

  if (!config.merchantId) reasons.push("missing_merchant_id");
  if (!config.callbackBaseUrl) reasons.push("missing_callback_base_url");

  const premium =
    env.TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY?.trim() ||
    env.TALEPO_PRICE_PREMIUM?.trim();
  const professional =
    env.TALEPO_IYZICO_PLAN_PROFESSIONAL_MONTHLY?.trim() ||
    env.TALEPO_PRICE_PROFESSIONAL?.trim();
  if (!premium) reasons.push("missing_plan_premium");
  if (!professional) reasons.push("missing_plan_professional");

  if (nodeEnv === "production" && config.environment !== "production") {
    reasons.push("sandbox_credentials_in_production");
  }
  if (
    config.environment === "production" &&
    config.baseUrl.includes("sandbox")
  ) {
    reasons.push("production_env_points_to_sandbox_base");
  }

  return {
    ready: reasons.length === 0,
    reasons,
    environment: config.environment,
  };
}
