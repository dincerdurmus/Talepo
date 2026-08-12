/**
 * Static verify: iyzico sandbox catalog bootstrap checkpoint.
 * Does NOT call iyzico live APIs.
 *
 * Run: npx tsx scripts/verify-iyzico-sandbox-catalog-bootstrap-v1.ts
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveIyzicoAuthorizationPath } from "../src/lib/billing/iyzico/authorization-path";
import {
  CANONICAL_IYZICO_MONTHLY_PLANS,
  classifySubscriptionCatalogError,
  findCanonicalPlanByName,
  planMatchesCanonical,
  TALEPO_IYZICO_SUBSCRIPTION_PRODUCT_NAME,
  upsertIyzicoPlanRefsInEnvLocal,
} from "../src/lib/billing/iyzico/sandbox-subscription-catalog";
import { PLAN_PRICING } from "../src/lib/membership/pricing-config";
import { getIncludedSeats } from "../src/lib/membership/seat-policy";

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

check(
  "1 bootstrap script exists",
  existsSync(
    join(root, "scripts/bootstrap-iyzico-sandbox-subscription-catalog-v1.ts"),
  ),
);

const bootstrap = read(
  "scripts/bootstrap-iyzico-sandbox-subscription-catalog-v1.ts",
);
check(
  "2 sandbox hard gate (provider + env + base + NODE_ENV)",
  bootstrap.includes('provider !== "iyzico"') &&
    bootstrap.includes('environment !== "sandbox"') &&
    bootstrap.includes("sandbox-api.iyzipay.com") &&
    bootstrap.includes('NODE_ENV === "production"'),
);
check(
  "3 no second auth stack",
  bootstrap.includes('from "../src/lib/billing/iyzico/client"') &&
    !bootstrap.includes("buildIyzicoAuthorization") &&
    !bootstrap.includes("createHmac") &&
    bootstrap.includes("Phase 4D IYZWSv2 client"),
);
check(
  "4 no seat quantity to iyzico",
  !bootstrap.includes("includedSeats") &&
    bootstrap.includes("seats are Talepo-side only") &&
    getIncludedSeats("CORPORATE") === 5,
);
check(
  "5 no checkout/payment",
  !bootstrap.includes("createCheckoutSession") &&
    !bootstrap.includes("/checkoutform/initialize") &&
    bootstrap.includes("CHECKOUT INITIATED: no"),
);
check(
  "6 100001 → hard stop not create-retry",
  bootstrap.includes("explainAndExit") &&
    !bootstrap.includes("Attempting create to confirm") &&
    bootstrap.includes("PROVIDER_BLOCKED / CAPABILITY_UNCONFIRMED"),
);

check("7 product name", TALEPO_IYZICO_SUBSCRIPTION_PRODUCT_NAME === "Talepo Membership");
check(
  "8 canonical prices",
  CANONICAL_IYZICO_MONTHLY_PLANS[0].priceTry === 990 &&
    CANONICAL_IYZICO_MONTHLY_PLANS[1].priceTry === 2490 &&
    CANONICAL_IYZICO_MONTHLY_PLANS[2].priceTry === 5990 &&
    PLAN_PRICING.CORPORATE.priceTry === 5990,
);
check(
  "9 plan match requires monetary fields",
  planMatchesCanonical(
    {
      name: "Talepo Premium Monthly",
      price: 990,
      currencyCode: "TRY",
      paymentInterval: "MONTHLY",
      paymentIntervalCount: 1,
      planPaymentType: "RECURRING",
    },
    CANONICAL_IYZICO_MONTHLY_PLANS[0],
  ) &&
    !planMatchesCanonical(
      {
        name: "Talepo Premium Monthly",
        price: 1,
        currencyCode: "TRY",
        paymentInterval: "MONTHLY",
        paymentIntervalCount: 1,
        planPaymentType: "RECURRING",
      },
      CANONICAL_IYZICO_MONTHLY_PLANS[0],
    ),
);
check(
  "10 mismatch detection by name",
  findCanonicalPlanByName("Talepo Corporate Monthly")?.tier === "CORPORATE",
);

check(
  "11 auth path strips query by default",
  resolveIyzicoAuthorizationPath(
    "/v2/subscription/products?page=1&count=100",
  ) === "/v2/subscription/products",
);
check(
  "12 auth path unchanged without query (checkout compat)",
  resolveIyzicoAuthorizationPath(
    "/v2/subscription/checkoutform/initialize",
  ) === "/v2/subscription/checkoutform/initialize",
);
check(
  "13 auth path override respected",
  resolveIyzicoAuthorizationPath(
    "/v2/subscription/products?page=1",
    "/v2/subscription/products?page=1",
  ) === "/v2/subscription/products?page=1",
);

{
  const classified = classifySubscriptionCatalogError({
    errorCode: "100001",
    errorMessage: "Sistem hatası",
  });
  check(
    "14 100001 classification",
    classified.code === "IYZICO_SUBSCRIPTION_API_UNAVAILABLE" &&
      classified.classification === "PROVIDER_BLOCKED",
  );
  const authFail = classifySubscriptionCatalogError({
    errorCode: "8",
    httpStatus: 401,
    errorMessage: "Authentication token is not verified",
  });
  check(
    "15 auth failure distinct",
    authFail.classification === "AUTH_FAILED",
  );
}

{
  const dir = mkdtempSync(join(tmpdir(), "talepo-env-"));
  writeFileSync(
    join(dir, ".env.local"),
    "TALEPO_PAYMENT_PROVIDER=iyzico\nKEEP_ME=1\nTALEPO_IYZICO_PLAN_PREMIUM_MONTHLY=old\n",
    "utf8",
  );
  upsertIyzicoPlanRefsInEnvLocal(
    {
      TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY: "ref-prem",
      TALEPO_IYZICO_PLAN_PROFESSIONAL_MONTHLY: "ref-pro",
      TALEPO_IYZICO_PLAN_CORPORATE_MONTHLY: "ref-corp",
    },
    { cwd: dir },
  );
  const out = readFileSync(join(dir, ".env.local"), "utf8");
  check(
    "16 env.local upsert preserves unrelated + no duplicate premium",
    out.includes("KEEP_ME=1") &&
      out.includes("TALEPO_PAYMENT_PROVIDER=iyzico") &&
      out.includes("TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY=ref-prem") &&
      out.includes("TALEPO_IYZICO_PLAN_PROFESSIONAL_MONTHLY=ref-pro") &&
      out.includes("TALEPO_IYZICO_PLAN_CORPORATE_MONTHLY=ref-corp") &&
      (out.match(/TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY=/g) ?? []).length === 1,
  );
  check(
    "17 env.local gitignored",
    read(".gitignore").includes(".env*"),
  );
}

const client = read("src/lib/billing/iyzico/client.ts");
check(
  "18 client uses resolveIyzicoAuthorizationPath",
  client.includes("resolveIyzicoAuthorizationPath") &&
    client.includes("authorizationPath?"),
);
check(
  "19 provider checkout does not pass authorizationPath",
  !read("src/server/billing/iyzico-provider.ts").includes("authorizationPath"),
);
check(
  "20 webhook signature module untouched by bootstrap",
  existsSync(join(root, "src/lib/billing/iyzico/webhook-signature.ts")) &&
    !bootstrap.includes("webhook-signature"),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
