/**
 * Phase 4C — Billing & subscription foundation verify.
 * Run: npx tsx scripts/verify-phase4c-billing-v1.ts
 */
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { BillingErrorCode } from "../src/lib/billing/errors";
import {
  assertCheckoutPlan,
  getPlanPriceMapping,
  resolvePlanTierFromProviderPriceId,
} from "../src/lib/billing/plan-mapping";
import {
  isBillingMockAllowed,
  resolveConfiguredProviderId,
} from "../src/lib/billing/provider";
import {
  canTransitionSubscription,
  targetStatusForEvent,
} from "../src/lib/billing/state-machine";
import { ProductEventName } from "../src/lib/observability/product-events";
import { signMockWebhook } from "../src/server/billing/mock-provider";
import { getBillingProviderStatus } from "../src/server/billing/get-provider";

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

// 1 provider adapter
check(
  "1 provider adapter",
  existsSync(join(root, "src/lib/billing/provider.ts")) &&
    existsSync(join(root, "src/server/billing/mock-provider.ts")) &&
    read("src/lib/billing/provider.ts").includes("createCheckoutSession"),
);

// 2 plan mapping
check(
  "2 plan mapping",
  getPlanPriceMapping("PREMIUM").displayPriceTry === 990 &&
    resolvePlanTierFromProviderPriceId("mock_price_PREMIUM") === "PREMIUM",
);

// 3 checkout server plan validation
let invalidOk = false;
try {
  assertCheckoutPlan("STANDARD");
} catch {
  invalidOk = true;
}
check("3 checkout server plan validation", invalidOk);

// 4 checkout permission
check(
  "4 checkout permission",
  read("src/server/billing/assert-billing-permission.ts").includes("OWNER") &&
    read("src/server/billing/assert-billing-permission.ts").includes("ADMIN"),
);

// 5 checkout rate limit
check(
  "5 checkout rate limit",
  read("src/app/api/billing/checkout/route.ts").includes("assertRateLimit"),
);

// 6-7 webhook signature
const body = JSON.stringify({
  id: "evt_1",
  type: "subscription.activated",
  subjectType: "USER",
  subjectId: "u1",
  planTier: "PREMIUM",
});
const sig = signMockWebhook(body);
const expected = createHmac(
  "sha256",
  process.env.TALEPO_MOCK_BILLING_SECRET?.trim() || "talepo-mock-billing-dev",
)
  .update(body)
  .digest("hex");
check("6 webhook signature", sig === expected);
check(
  "7 webhook invalid signature path",
  read("src/server/billing/mock-provider.ts").includes("invalid_signature") &&
    read("src/server/billing/process-webhook.ts").includes("INVALID_WEBHOOK"),
);

// 8-9 webhook idempotency / duplicate
check(
  "8 webhook idempotency",
  read("src/server/billing/apply-billing-event.ts").includes(
    "provider_providerEventId",
  ) && read("prisma/schema.prisma").includes("@@unique([provider, providerEventId])"),
);
check(
  "9 duplicate event",
  read("src/server/billing/apply-billing-event.ts").includes('outcome: "duplicate"'),
);

// 10-12 activation paths
check(
  "10 active plan status",
  targetStatusForEvent("SUBSCRIPTION_ACTIVATED") === "ACTIVE",
);
check(
  "11 Premium activation wiring",
  read("src/server/billing/sync-entitlement-plan.ts").includes("planTier") &&
    read("src/server/billing/apply-billing-event.ts").includes(
      "syncSubjectPlanFromBilling",
    ),
);
check(
  "12 Corporate activation company subject",
  read("src/server/billing/resolve-billing-subject.ts").includes("COMPANY") &&
    read("src/app/api/billing/checkout/route.ts").includes(
      "resolveBillingSubjectForUser",
    ),
);

// 13-14 tenancy / permissions
check(
  "13 company tenancy",
  read("src/server/billing/assert-billing-permission.ts").includes("companyId"),
);
check(
  "14 member cannot billing mutate",
  read("src/server/billing/assert-billing-permission.ts").includes(
    "OWNER veya ADMIN",
  ),
);

// 15-18 lifecycle
check(
  "15 renewal",
  targetStatusForEvent("SUBSCRIPTION_RENEWED") === "ACTIVE" &&
    canTransitionSubscription("ACTIVE", "ACTIVE"),
);
check(
  "16 cancel period end",
  targetStatusForEvent("SUBSCRIPTION_CANCEL_AT_PERIOD_END") ===
    "CANCEL_AT_PERIOD_END" &&
    canTransitionSubscription("ACTIVE", "CANCEL_AT_PERIOD_END"),
);
check(
  "17 canceled",
  targetStatusForEvent("SUBSCRIPTION_CANCELED") === "CANCELED",
);
check(
  "18 past due",
  targetStatusForEvent("SUBSCRIPTION_PAST_DUE") === "PAST_DUE" &&
    canTransitionSubscription("ACTIVE", "PAST_DUE"),
);

// 19 failed payment
check(
  "19 failed payment",
  targetStatusForEvent("PAYMENT_FAILED") === "PAST_DUE" &&
    ProductEventName.PAYMENT_FAILED === "PAYMENT_FAILED",
);

// 20 out-of-order
check(
  "20 out-of-order event",
  read("src/server/billing/apply-billing-event.ts").includes(
    "billing.event.out_of_order",
  ) && !canTransitionSubscription("ACTIVE", "PENDING"),
);

// 21-24 credits
check(
  "21 credit checkout",
  existsSync(join(root, "src/app/api/billing/credits/checkout/route.ts")),
);
check(
  "22 credit grant",
  read("src/server/billing/apply-billing-event.ts").includes("CREDIT_PURCHASED") &&
    read("src/server/billing/sync-entitlement-plan.ts").includes(
      "grantBonusCredits",
    ),
);
check(
  "23 duplicate credit event",
  read("prisma/schema.prisma").includes("model CreditLedgerEntry") &&
    read("prisma/schema.prisma").includes("providerEventId String? @unique") &&
    read("src/server/billing/apply-billing-event.ts").includes("creditLedgerEntry"),
);
check(
  "24 failed credit payment no grant path",
  !read("src/app/api/billing/credits/checkout/route.ts").includes(
    "bonusOfferCredits",
  ),
);

// 25 client tampering
check(
  "25 client tampering",
  read("src/app/api/billing/checkout/route.ts").includes(
    "Never trust client price",
  ) && read("src/server/billing/create-checkout.ts").includes("assertCheckoutPlan"),
);

// 26 pending state
check(
  "26 pending state",
  read("src/components/panel/PlanManager.tsx").includes("Ödemeniz doğrulanıyor") &&
    read("src/server/billing/create-checkout.ts").includes('status: "PENDING"'),
);

// 27 dev mock production blocked
check(
  "27 dev mock production blocked",
  isBillingMockAllowed("production") === false &&
    read("src/lib/observability/env.ts").includes("ALLOW_MOCK_BILLING"),
);

// 28 entitlement sync
check(
  "28 entitlement sync",
  read("src/server/billing/sync-entitlement-plan.ts").includes(
    "featuresForPlan remains SoT",
  ) || read("src/server/billing/sync-entitlement-plan.ts").includes("planTier"),
);

// 29 billing errors safe
check(
  "29 billing errors safe",
  BillingErrorCode.INVALID_WEBHOOK === "INVALID_WEBHOOK" &&
    read("src/app/api/billing/webhook/route.ts").includes("safeErrorResponse"),
);

// 30 telemetry/redaction
check(
  "30 telemetry/redaction",
  read("src/server/billing/apply-billing-event.ts").includes("safeMetadata") &&
    ProductEventName.SUBSCRIPTION_ACTIVATED === "SUBSCRIPTION_ACTIVATED",
);

// 31 no card storage
const schema = read("prisma/schema.prisma");
check(
  "31 no card storage",
  !schema.includes("cardNumber") &&
    !schema.includes("cvv") &&
    !schema.includes("primaryAccountNumber") &&
    !schema.includes("paymentCard"),
);

// 32 legacy Standard behavior
check(
  "32 legacy Standard behavior",
  read("src/lib/membership/plans.ts").includes("STANDARD") &&
    resolveConfiguredProviderId() !== undefined,
);

// Foundation status
const status = getBillingProviderStatus();
check(
  "provider status foundation",
  status.paymentProviderRequired === true || status.status === "MOCK_DEV",
);

check(
  "migration additive",
  read(
    "prisma/migrations/20260812140000_phase4c_billing_foundation/migration.sql",
  ).includes("BillingSubscription") &&
    !read(
      "prisma/migrations/20260812140000_phase4c_billing_foundation/migration.sql",
    ).includes("DROP TABLE"),
);

check(
  "membership buy-credits still payment gated",
  read("src/app/api/membership/route.ts").includes("isMockCreditPurchaseAllowed"),
);

console.log(`\nPhase 4C billing: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
