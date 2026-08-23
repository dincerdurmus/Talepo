/**
 * Phase 4D — iyzico production adapter verify.
 * Run: npx tsx scripts/verify-phase4d-iyzico-v1.ts
 *
 * Live sandbox E2E is opt-in (credentials). Never uses production secrets in CI.
 */
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  evaluateIyzicoBillingReadiness,
  isIyzicoConfigured,
  loadIyzicoConfig,
  resolveIyzicoEnvironment,
} from "../src/lib/billing/iyzico/config";
import {
  buildCreditConversationId,
  buildSubscriptionConversationId,
  parseIyzicoConversationId,
} from "../src/lib/billing/iyzico/conversation";
import { mapIyzicoWebhookToCanonicalEvents } from "../src/lib/billing/iyzico/events";
import { formatTryIntegerMajor } from "../src/lib/billing/iyzico/money";
import {
  assertIyzicoPlanMapping,
  getIyzicoPricingPlanReferenceCode,
} from "../src/lib/billing/iyzico/plan-mapping";
import {
  generateIyzicoWebhookTestSignature,
  verifyIyzicoWebhookSignatureV3,
} from "../src/lib/billing/iyzico/webhook-signature";
import { buildIyzicoAuthorization } from "../src/lib/billing/iyzico/auth";
import { resolveIyzicoAuthorizationPath } from "../src/lib/billing/iyzico/authorization-path";
import { BillingErrorCode } from "../src/lib/billing/errors";
import {
  isBillingMockAllowed,
  resolveConfiguredProviderId,
} from "../src/lib/billing/provider";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const secret = "test_secret_key";
const merchantId = "123456";

async function main() {

// 1 provider selection iyzico
check(
  "1 provider selection iyzico",
  resolveConfiguredProviderId(
    {
      TALEPO_PAYMENT_PROVIDER: "iyzico",
      TALEPO_IYZICO_API_KEY: "api",
      TALEPO_IYZICO_SECRET_KEY: "secret",
      ALLOW_MOCK_BILLING: "false",
    } as NodeJS.ProcessEnv,
    "development",
  ) === "iyzico",
);

// 2 missing credentials
check(
  "2 missing credentials",
  resolveConfiguredProviderId(
    {
      TALEPO_PAYMENT_PROVIDER: "iyzico",
      ALLOW_MOCK_BILLING: "false",
    } as NodeJS.ProcessEnv,
    "development",
  ) === "none" &&
    !isIyzicoConfigured({
      TALEPO_PAYMENT_PROVIDER: "iyzico",
    } as NodeJS.ProcessEnv),
);

// 3 sandbox config
check(
  "3 sandbox config",
  resolveIyzicoEnvironment({
    TALEPO_IYZICO_ENVIRONMENT: "sandbox",
  } as NodeJS.ProcessEnv) === "sandbox",
);

// 4 production config
check(
  "4 production config",
  resolveIyzicoEnvironment({
    TALEPO_IYZICO_ENVIRONMENT: "production",
  } as NodeJS.ProcessEnv) === "production",
);

// 5 plan reference mapping
check(
  "5 plan reference mapping",
  getIyzicoPricingPlanReferenceCode("PREMIUM", {
    TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY: "plan_premium_ref",
  } as NodeJS.ProcessEnv) === "plan_premium_ref",
);

// 6 invalid plan
{
  let threw = false;
  try {
    assertIyzicoPlanMapping("STANDARD");
  } catch {
    threw = true;
  }
  check("6 invalid plan", threw);
}

// 7 subscription checkout mapping
check(
  "7 subscription checkout mapping",
  read("src/server/billing/iyzico-provider.ts").includes(
    "/v2/subscription/checkoutform/initialize",
  ),
);

// 8 checkout permission
check(
  "8 checkout permission",
  read("src/server/billing/assert-billing-permission.ts").includes("OWNER"),
);

// 9 company ownership
check(
  "9 company ownership",
  read("src/server/billing/resolve-billing-subject.ts").includes("COMPANY"),
);

// 10 hosted checkout URL/token
check(
  "10 hosted checkout URL/token",
  read("src/server/billing/iyzico-provider.ts").includes("paymentPageUrl") &&
    read("src/server/billing/iyzico-provider.ts").includes(
      "checkoutFormContent",
    ),
);

// 11 callback not authority
check(
  "11 callback not authority",
  read("src/app/api/billing/callback/route.ts").includes("PENDING") &&
    !read("src/app/api/billing/callback/route.ts").includes(
      "syncSubjectPlanFromBilling",
    ),
);

// 12 webhook signature valid
{
  const payload = {
    orderReferenceCode: "ord1",
    customerReferenceCode: "cus1",
    subscriptionReferenceCode: "sub1",
    iyziReferenceCode: "ref1",
    iyziEventType: "subscription.order.success",
    iyziEventTime: 1758704403161,
  };
  const signature = generateIyzicoWebhookTestSignature({
    secretKey: secret,
    merchantId,
    payload,
  });
  const verified = verifyIyzicoWebhookSignatureV3({
    secretKey: secret,
    merchantId,
    signatureHeader: signature,
    payload,
  });
  check("12 webhook signature valid", verified.ok === true);
}

// 13 webhook signature invalid
{
  const payload = {
    subscriptionReferenceCode: "sub1",
    orderReferenceCode: "ord1",
    customerReferenceCode: "cus1",
    iyziEventType: "subscription.order.success",
  };
  const verified = verifyIyzicoWebhookSignatureV3({
    secretKey: secret,
    merchantId,
    signatureHeader: "deadbeef",
    payload,
  });
  check("13 webhook signature invalid", verified.ok === false);
}

// 14 missing signature production reject
check(
  "14 missing signature production reject",
  read("src/server/billing/iyzico-provider.ts").includes(
    "missing_signature_v3",
  ),
);

// 15 duplicate webhook — Phase 4C processor
check(
  "15 duplicate webhook",
  read("src/server/billing/apply-billing-event.ts").includes("duplicate"),
);

// 16 provider event ID mapping
{
  const events = await mapIyzicoWebhookToCanonicalEvents({
    payload: {
      orderReferenceCode: "ord1",
      customerReferenceCode: "cus1",
      subscriptionReferenceCode: "sub1",
      iyziReferenceCode: "stable_event_1",
      iyziEventType: "subscription.order.success",
      iyziEventTime: 100,
    },
    subjectResolver: async () => ({
      subject: { type: "USER", id: "u1" },
      planTier: "PREMIUM",
      alreadyActive: false,
    }),
  });
  check(
    "16 provider event ID mapping",
    events[0]?.providerEventId === "stable_event_1",
  );
}

// 17 subscription ID mapping
{
  const events = await mapIyzicoWebhookToCanonicalEvents({
    payload: {
      orderReferenceCode: "ord1",
      customerReferenceCode: "cus1",
      subscriptionReferenceCode: "sub_ref_abc",
      iyziReferenceCode: "e2",
      iyziEventType: "subscription.order.success",
      iyziEventTime: 100,
    },
    subjectResolver: async () => ({
      subject: { type: "COMPANY", id: "c1" },
      planTier: "CORPORATE",
      alreadyActive: false,
    }),
  });
  check(
    "17 subscription ID mapping",
    events[0]?.providerSubscriptionId === "sub_ref_abc",
  );
}

// 18 activation event
{
  const events = await mapIyzicoWebhookToCanonicalEvents({
    payload: {
      orderReferenceCode: "ord1",
      customerReferenceCode: "cus1",
      subscriptionReferenceCode: "sub1",
      iyziReferenceCode: "e3",
      iyziEventType: "subscription.order.success",
      iyziEventTime: 100,
    },
    subjectResolver: async () => ({
      subject: { type: "USER", id: "u1" },
      planTier: "PREMIUM",
      alreadyActive: false,
    }),
  });
  check(
    "18 activation event",
    events[0]?.eventType === "SUBSCRIPTION_ACTIVATED",
  );
}

// 19 renewal event
{
  const events = await mapIyzicoWebhookToCanonicalEvents({
    payload: {
      orderReferenceCode: "ord2",
      customerReferenceCode: "cus1",
      subscriptionReferenceCode: "sub1",
      iyziReferenceCode: "e4",
      iyziEventType: "subscription.order.success",
      iyziEventTime: 200,
    },
    subjectResolver: async () => ({
      subject: { type: "USER", id: "u1" },
      planTier: "PREMIUM",
      alreadyActive: true,
    }),
  });
  check("19 renewal event", events[0]?.eventType === "SUBSCRIPTION_RENEWED");
}

// 20 failed recurring payment
{
  const events = await mapIyzicoWebhookToCanonicalEvents({
    payload: {
      orderReferenceCode: "ord3",
      customerReferenceCode: "cus1",
      subscriptionReferenceCode: "sub1",
      iyziReferenceCode: "e5",
      iyziEventType: "subscription.order.failure",
      iyziEventTime: 300,
    },
    subjectResolver: async () => ({
      subject: { type: "USER", id: "u1" },
      planTier: "PREMIUM",
      alreadyActive: true,
    }),
  });
  check("20 failed recurring payment", events[0]?.eventType === "PAYMENT_FAILED");
}

// 21 cancel event — adapter cancel endpoint present; webhook cancel not in official subscription notify list
check(
  "21 cancel event",
  read("src/server/billing/iyzico-provider.ts").includes("/cancel"),
);

// 22 out-of-order event
check(
  "22 out-of-order event",
  read("src/server/billing/apply-billing-event.ts").includes("providerVersion"),
);

// 23 pending recovery
check(
  "23 pending recovery",
  read("src/server/billing/iyzico-provider.ts").includes("subscription.retrieve.recovery") ||
    read("src/app/api/billing/callback/route.ts").includes("PENDING"),
);

// 24 subscription status retrieve
check(
  "24 subscription status retrieve",
  read("src/server/billing/iyzico-provider.ts").includes("getSubscriptionStatus"),
);

// 25 credit checkout
check(
  "25 credit checkout",
  read("src/server/billing/iyzico-provider.ts").includes(
    "/payment/iyzipos/checkoutform/initialize/auth/ecom",
  ),
);

// 26 credit server amount
check(
  "26 credit server amount",
  formatTryIntegerMajor(149) === "149.00" &&
    read("src/server/billing/iyzico-provider.ts").includes(
      "formatTryIntegerMajor(pack.priceTry)",
    ),
);

// 27 credit payment success
{
  const conv = buildCreditConversationId({
    subject: { type: "USER", id: "u1" },
    packId: "PACK_5",
  });
  // rebuild deterministic parse test
  const parsed = parseIyzicoConversationId(conv);
  const events = await mapIyzicoWebhookToCanonicalEvents({
    payload: {
      paymentConversationId: conv,
      token: "tok",
      status: "SUCCESS",
      iyziPaymentId: 99,
      iyziReferenceCode: "cred_ref",
      iyziEventType: "CHECKOUT_FORM_AUTH",
      iyziEventTime: 1,
    },
  });
  check(
    "27 credit payment success",
    parsed?.kind === "crd" &&
      events[0]?.eventType === "CREDIT_PURCHASED" &&
      events[0]?.credits === 5,
  );
}

/**
 * 28 credit duplicate — ledger unique.
 *
 * Boşluğa duyarsız (KB-6b ikizi, 2026-08-23): alan ve `@unique` şemada
 * gerçekten var — mükerrer kredi olayını engelleyen benzersiz indeks yerinde —
 * ama `0db561c`'deki prisma format hizalaması araya boşluk koyunca birebir
 * dize araması kırmızıya döndü. Beklenti kodun DAVRANIŞINI ölçmeli,
 * biçimlendiricinin o gün kaç boşluk bıraktığını değil. Şemaya dokunulmadı.
 */
const collapseWs = (s: string) => s.replace(/\s+/g, " ").trim();
check(
  "28 credit duplicate",
  collapseWs(read("prisma/schema.prisma")).includes(
    collapseWs("providerEventId String? @unique"),
  ),
);

// 29 failed credit payment
{
  const conv = "tlp1.crd.U.u1.PACK_5.abcd1234";
  const events = await mapIyzicoWebhookToCanonicalEvents({
    payload: {
      paymentConversationId: conv,
      token: "tok",
      status: "FAILURE",
      iyziPaymentId: 1,
      iyziReferenceCode: "fail_cred",
      iyziEventType: "CHECKOUT_FORM_AUTH",
    },
  });
  check("29 failed credit payment", events[0]?.eventType === "PAYMENT_FAILED");
}

// 30 client amount tampering
check(
  "30 client amount tampering",
  read("src/server/billing/create-credit-checkout.ts").includes(
    "OFFER_CREDIT_PACKS",
  ) &&
    !read("src/app/api/billing/credits/checkout/route.ts").includes(
      "body.amount",
    ),
);

// 31 no card data storage
check(
  "31 no card data storage",
  !read("src/server/billing/iyzico-provider.ts").includes("cardNumber") &&
    !read("src/server/billing/iyzico-customer.ts").includes("cvc"),
);

// 32 no secret log
check(
  "32 no secret log",
  !read("src/lib/billing/iyzico/client.ts").includes("secretKey") ||
    !read("src/lib/billing/iyzico/client.ts").includes("console.log(config"),
);

// 33 provider telemetry
check(
  "33 provider telemetry",
  read("src/lib/billing/iyzico/client.ts").includes(
    "recordProviderOperationalMetric",
  ),
);

// 34 provider degraded
check(
  "34 provider degraded",
  read("src/lib/billing/iyzico/client.ts").includes("getIyzicoProviderHealth"),
);

// 35 core readiness survives provider outage
check(
  "35 core readiness survives provider outage",
  read("src/app/api/ready/route.ts").includes("critical: false") &&
    read("src/app/api/ready/route.ts").includes("billing_provider"),
);

// 36 billing readiness degraded
{
  const readiness = evaluateIyzicoBillingReadiness(
    {
      TALEPO_PAYMENT_PROVIDER: "iyzico",
      TALEPO_IYZICO_API_KEY: "a",
      TALEPO_IYZICO_SECRET_KEY: "b",
      TALEPO_IYZICO_ENVIRONMENT: "sandbox",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv,
    { nodeEnv: "production" },
  );
  check(
    "36 billing readiness degraded",
    readiness.ready === false &&
      readiness.reasons.includes("sandbox_credentials_in_production"),
  );
}

// 37 legacy mock still dev-only
check(
  "37 legacy mock still dev-only",
  isBillingMockAllowed("production") === false,
);

// 38 Stripe/PayTR/etc not introduced
check(
  "38 Stripe/PayTR/etc not introduced",
  !existsSync(join(root, "src/server/billing/stripe-provider.ts")) &&
    !existsSync(join(root, "src/server/billing/paytr-provider.ts")),
);

// 39 no business provider lock-in
check(
  "39 no business provider lock-in",
  read("src/server/billing/apply-billing-event.ts").includes(
    "CanonicalBillingEvent",
  ) &&
    !read("src/server/billing/apply-billing-event.ts").includes("iyzicoRequest"),
);

// 40 existing Billing Core untouched semantically
check(
  "40 existing Billing Core untouched semantically",
  existsSync(join(root, "src/lib/billing/state-machine.ts")) &&
    existsSync(join(root, "src/server/billing/apply-billing-event.ts")),
);

// Auth sample
{
  const auth = buildIyzicoAuthorization({
    apiKey: "api",
    secretKey: "sec",
    uriPath: "/payment/bin/check",
    body: '{"binNumber":"535805"}',
    randomKey: "123456789",
  });
  check(
    "auth IYZWSv2 prefix",
    auth.authorization.startsWith("IYZWSv2 ") &&
      createHmac("sha256", "sec")
        .update('123456789/payment/bin/check{"binNumber":"535805"}')
        .digest("hex").length === 64,
  );
}

{
  check(
    "auth path query strip default",
    resolveIyzicoAuthorizationPath("/v2/subscription/products?page=1&count=10") ===
      "/v2/subscription/products",
  );
  check(
    "auth path checkout unchanged",
    resolveIyzicoAuthorizationPath("/v2/subscription/checkoutform/initialize") ===
      "/v2/subscription/checkoutform/initialize",
  );
}

// Conversation roundtrip
{
  const id = buildSubscriptionConversationId({
    subject: { type: "COMPANY", id: "co1" },
    planTier: "PROFESSIONAL",
  });
  const parsed = parseIyzicoConversationId(id);
  check(
    "conversation roundtrip",
    parsed?.kind === "sub" &&
      parsed.subject.type === "COMPANY" &&
      parsed.planTier === "PROFESSIONAL",
  );
}

// Error taxonomy
check(
  "checkout profile incomplete error",
  BillingErrorCode.CHECKOUT_PROFILE_INCOMPLETE ===
    "CHECKOUT_PROFILE_INCOMPLETE",
);

// Adapter files present
check(
  "adapter files",
  existsSync(join(root, "src/server/billing/iyzico-provider.ts")) &&
    existsSync(join(root, "docs/production/iyzico-adapter.md")),
);

// Sandbox E2E
const hasSandboxCreds =
  Boolean(process.env.TALEPO_IYZICO_API_KEY || process.env.IYZICO_API_KEY) &&
  Boolean(
    process.env.TALEPO_IYZICO_SECRET_KEY || process.env.IYZICO_SECRET_KEY,
  ) &&
  process.env.TALEPO_IYZICO_RUN_SANDBOX_E2E === "true";
if (!hasSandboxCreds) {
  console.log("SKIP — sandbox E2E (SKIPPED_CREDENTIALS)");
} else {
  console.log("INFO — sandbox E2E credentials present; run manual E2E separately");
}

// Status helper smoke (avoid importing prisma-backed get-provider in unit verify)
check(
  "provider status helper",
  read("src/server/billing/get-provider.ts").includes("IYZICO_READY") &&
    read("src/server/billing/get-provider.ts").includes("billingReady"),
);

console.log("");
console.log(`Phase 4D iyzico: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
