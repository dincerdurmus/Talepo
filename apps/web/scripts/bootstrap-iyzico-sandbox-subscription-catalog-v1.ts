/**
 * Sandbox-only: bootstrap iyzico Subscription Product + 3 monthly pricing plans.
 *
 * Uses Phase 4D IYZWSv2 client (no second auth stack).
 * Never logs API key/secret. Never commits .env.local.
 *
 * Hard gates: TALEPO_PAYMENT_PROVIDER=iyzico + TALEPO_IYZICO_ENVIRONMENT=sandbox
 * + sandbox-api.iyzipay.com. Production / non-sandbox hard-stop.
 *
 * Run: npx tsx scripts/bootstrap-iyzico-sandbox-subscription-catalog-v1.ts
 */
import { config as loadDotenv } from "dotenv";

import { iyzicoRequest } from "../src/lib/billing/iyzico/client";
import {
  loadIyzicoConfig,
  resolveIyzicoBaseUrl,
  resolveIyzicoEnvironment,
} from "../src/lib/billing/iyzico/config";
import { formatTryIntegerMajor } from "../src/lib/billing/iyzico/money";
import { getIyzicoPricingPlanReferenceCode } from "../src/lib/billing/iyzico/plan-mapping";
import {
  CANONICAL_IYZICO_MONTHLY_PLANS,
  classifySubscriptionCatalogError,
  findCanonicalPlanByName,
  planMatchesCanonical,
  TALEPO_IYZICO_SUBSCRIPTION_PRODUCT_NAME,
  upsertIyzicoPlanRefsInEnvLocal,
  type CanonicalIyzicoPlan,
} from "../src/lib/billing/iyzico/sandbox-subscription-catalog";
import { PLAN_PRICING } from "../src/lib/membership/pricing-config";

loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env" });

type ProductRow = {
  referenceCode?: string;
  name?: string;
  status?: string;
};

type PlanRow = {
  referenceCode?: string;
  name?: string;
  price?: number | string;
  currencyCode?: string;
  paymentInterval?: string;
  paymentIntervalCount?: number | string;
  planPaymentType?: string;
  trialPeriodDays?: number | string;
  status?: string;
  recurrenceCount?: number | string | null;
};

function fail(message: string): never {
  console.error(`BLOCKER — ${message}`);
  process.exit(1);
}

class CatalogApiError extends Error {
  errorCode: string;
  classification: "AUTH_FAILED" | "PROVIDER_BLOCKED" | "OTHER";
  constructor(
    label: string,
    result: { status?: string | number; errorCode?: string; errorMessage?: string },
  ) {
    const classified = classifySubscriptionCatalogError({
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      httpStatus:
        typeof result.status === "number" ? result.status : undefined,
    });
    super(
      `${label}: ${classified.code}` +
        (result.errorMessage ? ` (${result.errorMessage})` : ""),
    );
    this.name = "CatalogApiError";
    this.errorCode = classified.code;
    this.classification = classified.classification;
  }
}

function assertIyzicoOk(
  result: { status?: string | number; errorCode?: string; errorMessage?: string },
  label: string,
) {
  if (result.status === "success") return;
  throw new CatalogApiError(label, result);
}

function explainAndExit(error: unknown): never {
  if (error instanceof CatalogApiError) {
    if (error.classification === "PROVIDER_BLOCKED") {
      fail(
        `${error.errorCode} — CLASSIFICATION: PROVIDER_BLOCKED / CAPABILITY_UNCONFIRMED. ` +
          `Subscription Product/Plan API returned iyzico 100001. ` +
          `Do not treat as success. Root cause is unconfirmed until iyzico confirms merchant capability.`,
      );
    }
    if (error.classification === "AUTH_FAILED") {
      fail(`${error.errorCode} — CLASSIFICATION: AUTH_FAILED. ${error.message}`);
    }
    fail(`${error.errorCode} — CLASSIFICATION: OTHER. ${error.message}`);
  }
  if (error instanceof Error) fail(error.message);
  fail(String(error));
}

async function listAllProducts(
  config: NonNullable<ReturnType<typeof loadIyzicoConfig>>,
) {
  const items: ProductRow[] = [];
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount) {
    const path = `/v2/subscription/products?page=${page}&count=100`;
    const result = await iyzicoRequest<{
      data?: {
        items?: ProductRow[];
        pageCount?: number;
        totalCount?: number | string;
      };
    }>({
      config,
      method: "GET",
      path,
      operation: "subscription.products.list",
    });
    assertIyzicoOk(result, "list products");
    const batch = result.data?.items ?? [];
    items.push(...batch);
    pageCount = Math.max(1, Number(result.data?.pageCount ?? 1));
    page += 1;
    if (batch.length === 0) break;
  }
  return items;
}

async function listPricingPlans(
  config: NonNullable<ReturnType<typeof loadIyzicoConfig>>,
  productReferenceCode: string,
) {
  const items: PlanRow[] = [];
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount) {
    const path = `/v2/subscription/products/${productReferenceCode}/pricing-plans?page=${page}&count=100`;
    const result = await iyzicoRequest<{
      data?: { items?: PlanRow[]; pageCount?: number };
    }>({
      config,
      method: "GET",
      path,
      operation: "subscription.pricing_plans.list",
    });
    assertIyzicoOk(result, "list pricing plans");
    const batch = result.data?.items ?? [];
    items.push(...batch);
    pageCount = Math.max(1, Number(result.data?.pageCount ?? 1));
    page += 1;
    if (batch.length === 0) break;
  }
  return items;
}

function assertSandboxHardGate() {
  if (process.env.NODE_ENV === "production") {
    fail("PRODUCTION EXECUTION BLOCKED (NODE_ENV=production)");
  }

  const provider = process.env.TALEPO_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (provider !== "iyzico") {
    fail(
      `TALEPO_PAYMENT_PROVIDER must be iyzico (got: ${provider || "empty"})`,
    );
  }

  const environment = resolveIyzicoEnvironment();
  if (environment !== "sandbox") {
    fail(
      `TALEPO_IYZICO_ENVIRONMENT must be sandbox (got: ${environment})`,
    );
  }

  const baseUrl = resolveIyzicoBaseUrl();
  if (!baseUrl.includes("sandbox-api.iyzipay.com")) {
    fail(`API base must be sandbox-api.iyzipay.com (got: ${baseUrl})`);
  }
}

async function main() {
  console.log("=== iyzico Sandbox Subscription Catalog Bootstrap ===");
  console.log("CREDENTIALS PRINTED: no");
  console.log("CHECKOUT INITIATED: no");
  console.log("PAYMENT ATTEMPTED: no");

  assertSandboxHardGate();

  const config = loadIyzicoConfig();
  if (!config) {
    fail("API credentials missing (presence check only; values not printed)");
  }
  if (config.environment !== "sandbox") {
    fail("Loaded config environment is not sandbox");
  }
  if (!config.baseUrl.includes("sandbox-api.iyzipay.com")) {
    fail(`Loaded config baseUrl is not sandbox: ${config.baseUrl}`);
  }

  console.log(`IYZICO ENVIRONMENT: ${config.environment}`);
  console.log(`API BASE: ${config.baseUrl}`);
  console.log("CREDENTIALS PRESENT: yes");

  if (
    PLAN_PRICING.PREMIUM.priceTry !== 990 ||
    PLAN_PRICING.PROFESSIONAL.priceTry !== 2490 ||
    PLAN_PRICING.CORPORATE.priceTry !== 5990
  ) {
    fail("pricing-config SoT drift vs expected 990/2490/5990");
  }

  // List first. On PROVIDER_BLOCKED (100001): hard-stop — do not create/retry.
  let products: ProductRow[];
  try {
    products = await listAllProducts(config);
  } catch (error) {
    explainAndExit(error);
  }
  console.log(`Listed products: ${products.length}`);

  let product = products.find(
    (p) => (p.name ?? "").trim() === TALEPO_IYZICO_SUBSCRIPTION_PRODUCT_NAME,
  );
  let productAction: "reused" | "created" = "reused";

  if (!product?.referenceCode) {
    const created = await iyzicoRequest<{ data?: ProductRow }>({
      config,
      method: "POST",
      path: "/v2/subscription/products",
      operation: "subscription.products.create",
      body: {
        locale: "tr",
        conversationId: `talepo-product-${Date.now()}`,
        name: TALEPO_IYZICO_SUBSCRIPTION_PRODUCT_NAME,
        description: "Talepo membership subscription product (sandbox)",
      },
    });
    assertIyzicoOk(created, "create product");
    if (!created.data?.referenceCode) {
      fail("create product returned success without referenceCode");
    }
    product = created.data;
    productAction = "created";
  }

  const productReferenceCode = product.referenceCode!;
  console.log(
    `PRODUCT: ${TALEPO_IYZICO_SUBSCRIPTION_PRODUCT_NAME} (${productAction})`,
  );
  console.log(`PRODUCT STATUS: ${product.status ?? "UNKNOWN"}`);
  console.log(`PRODUCT REFERENCE CODE: ${productReferenceCode}`);

  let plans = await listPricingPlans(config, productReferenceCode);
  console.log(`Listed pricing plans: ${plans.length}`);

  for (const plan of plans) {
    const name = (plan.name ?? "").trim();
    const canonical = findCanonicalPlanByName(name);
    if (!canonical) continue;
    if (!planMatchesCanonical(plan, canonical)) {
      fail(
        `MONETARY_MISMATCH plan "${name}" exists with non-canonical terms ` +
          `(price=${plan.price}, currency=${plan.currencyCode}, interval=${plan.paymentInterval}, ` +
          `count=${plan.paymentIntervalCount}, type=${plan.planPaymentType}). Refusing silent mutate.`,
      );
    }
  }

  const resolved = {} as Record<CanonicalIyzicoPlan["tier"], PlanRow>;

  for (const canonical of CANONICAL_IYZICO_MONTHLY_PLANS) {
    const existing = plans.find((p) => planMatchesCanonical(p, canonical));
    if (existing?.referenceCode) {
      console.log(`PLAN ${canonical.tier}: reused ${existing.referenceCode}`);
      resolved[canonical.tier] = existing;
      continue;
    }

    const created = await iyzicoRequest<{ data?: PlanRow }>({
      config,
      method: "POST",
      path: `/v2/subscription/products/${productReferenceCode}/pricing-plans`,
      operation: "subscription.pricing_plans.create",
      body: {
        locale: "tr",
        conversationId: `talepo-plan-${canonical.tier}-${Date.now()}`,
        name: canonical.name,
        price: formatTryIntegerMajor(canonical.priceTry),
        currencyCode: canonical.currencyCode,
        paymentInterval: canonical.paymentInterval,
        paymentIntervalCount: canonical.paymentIntervalCount,
        planPaymentType: canonical.planPaymentType,
        trialPeriodDays: canonical.trialPeriodDays,
        // recurrenceCount omitted → ongoing until cancel
        // seats are Talepo-side only — never sent to iyzico
      },
    });

    assertIyzicoOk(created, `create plan ${canonical.tier}`);
    if (!created.data?.referenceCode) {
      fail(`create plan ${canonical.tier} returned success without referenceCode`);
    }

    console.log(`PLAN ${canonical.tier}: created ${created.data.referenceCode}`);
    resolved[canonical.tier] = created.data;
  }

  plans = await listPricingPlans(config, productReferenceCode);
  for (const canonical of CANONICAL_IYZICO_MONTHLY_PLANS) {
    const found = plans.find(
      (p) => p.referenceCode === resolved[canonical.tier].referenceCode,
    );
    if (!found) fail(`read-back missing plan ${canonical.tier}`);
    if (!planMatchesCanonical(found, canonical)) {
      fail(`read-back mismatch for ${canonical.tier}`);
    }
    if ((found.status ?? "").toUpperCase() !== "ACTIVE") {
      fail(`read-back status not ACTIVE for ${canonical.tier}: ${found.status}`);
    }
    resolved[canonical.tier] = found;
  }

  const envEntries = {
    TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY: resolved.PREMIUM.referenceCode!,
    TALEPO_IYZICO_PLAN_PROFESSIONAL_MONTHLY:
      resolved.PROFESSIONAL.referenceCode!,
    TALEPO_IYZICO_PLAN_CORPORATE_MONTHLY: resolved.CORPORATE.referenceCode!,
  };
  upsertIyzicoPlanRefsInEnvLocal(envEntries);
  for (const [k, v] of Object.entries(envEntries)) {
    process.env[k] = v;
  }

  const mappingOk =
    getIyzicoPricingPlanReferenceCode("PREMIUM") ===
      envEntries.TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY &&
    getIyzicoPricingPlanReferenceCode("PROFESSIONAL") ===
      envEntries.TALEPO_IYZICO_PLAN_PROFESSIONAL_MONTHLY &&
    getIyzicoPricingPlanReferenceCode("CORPORATE") ===
      envEntries.TALEPO_IYZICO_PLAN_CORPORATE_MONTHLY;

  if (!mappingOk) fail("server plan mapping resolve failed after env update");

  console.log("\n=== REPORT ===");
  console.log(`IYZICO ENVIRONMENT: ${config.environment}`);
  console.log(`API BASE: ${config.baseUrl}`);
  console.log("CREDENTIALS PRESENT: yes");
  console.log("CREDENTIALS PRINTED: no");
  console.log(`PRODUCT: ${TALEPO_IYZICO_SUBSCRIPTION_PRODUCT_NAME}`);
  console.log(`PRODUCT STATUS: ${product.status ?? "ACTIVE"}`);
  console.log(`PRODUCT REFERENCE CODE: ${productReferenceCode}`);
  for (const canonical of CANONICAL_IYZICO_MONTHLY_PLANS) {
    const p = resolved[canonical.tier];
    console.log(`${canonical.tier} PLAN: ${p.name}`);
    console.log(`${canonical.tier} PRICE: ${p.price} ${p.currencyCode}`);
    console.log(`${canonical.tier} STATUS: ${p.status}`);
    console.log(`${canonical.tier} REFERENCE: ${p.referenceCode}`);
  }
  console.log("RECURRENCE: ongoing monthly (recurrenceCount omitted)");
  console.log("TRIAL: 0");
  console.log("CURRENCY: TRY");
  console.log("SEAT LOGIC SENT TO IYZICO: no");
  console.log("ENV.LOCAL UPDATED: yes (plan refs only)");
  console.log("ENV COMMITTED: no");
  console.log("SERVER PLAN MAPPING: PASS");
  console.log("SANDBOX READ-BACK VERIFY: PASS");
  console.log("CHECKOUT INITIATED: no");
  console.log("PAYMENT ATTEMPTED: no");
  console.log("DB CHANGED: no");
  console.log("MIGRATION: no");
  console.log("COMMIT: no");
  console.log("PUSH: no");
  console.log("ERRORS / BLOCKERS: none");
}

main().catch((error) => {
  explainAndExit(error);
});
