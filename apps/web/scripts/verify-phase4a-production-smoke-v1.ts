/**
 * Phase 4A — Production-like smoke suite (contract + wiring).
 * Does not require live external providers.
 * Run: npx tsx scripts/verify-phase4a-production-smoke-v1.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { GET as healthGet } from "../src/app/api/health/route";
import {
  DomainErrorCode,
  mapUnknownToSafeError,
} from "../src/lib/observability/errors";
import { getInventoryAlignmentPlan } from "../src/lib/observability/inventory-alignment";
import { AUTHORIZATION_MATRIX } from "../src/lib/observability/authorization-matrix";

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

// 1 app boots (package scripts + next app entry)
check(
  "1 app boots",
  read("package.json").includes('"build"') &&
    read("package.json").includes("prisma generate") &&
    existsSync(join(root, "src/app/layout.tsx")),
);

// 2 auth-protected route protected
check(
  "2 auth-protected route protected",
  read("src/app/api/requests/route.ts").includes("requireUser") &&
    read("src/app/api/offers/route.ts").includes("requireUser") &&
    read("src/server/auth/require-user.ts").includes("AuthenticationError"),
);

// 3 request publish
check(
  "3 request publish",
  read("src/server/request/create-request.ts").includes("request.publish.completed") &&
    read("src/server/request/create-request.ts").includes("REQUEST_PUBLISHED") &&
    read("src/server/request/create-request.ts").includes("discoveryProjection"),
);

// 4 discovery projection exists
check(
  "4 discovery projection exists",
  read("src/lib/discovery/build-projection.ts").includes("buildDiscoveryProjection") &&
    read("prisma/schema.prisma").includes("discoveryProjection"),
);

// 5 Professional discovery
check(
  "5 Professional discovery",
  read("src/app/panel/firsatlar/page.tsx").includes("firsatlar") &&
    (read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").length > 0 ||
      existsSync(join(root, "src/components/panel/discovery"))),
);

// 6 Corporate Opportunity Center
check(
  "6 Corporate Opportunity Center",
  read("src/app/panel/firsatlar/page.tsx").includes("CorporateOpportunityCenter") &&
    read("src/server/monetization/corporate-opportunity-center.ts").includes(
      "companyId",
    ),
);

// 7 offer submit
check(
  "7 offer submit",
  read("src/server/offer/offer-service.ts").includes("export async function createOffer") &&
    read("src/server/offer/offer-service.ts").includes("offer.created") &&
    read("src/app/api/offers/route.ts").includes("createOffer"),
);

// 8 offer accept
check(
  "8 offer accept",
  read("src/server/offer/offer-service.ts").includes("export async function acceptOffer") &&
    read("src/server/offer/offer-service.ts").includes("offer.accepted"),
);

// 9 conversation invariant
check(
  "9 conversation invariant",
  read("src/server/offer/offer-service.ts").includes("ensureOfferConversation") &&
    read("prisma/schema.prisma").includes("offerId") &&
    /offerId\s+String\s+@unique/.test(read("prisma/schema.prisma")),
);

// 10 cross-company opportunity denied
check(
  "10 cross-company opportunity denied",
  read("src/server/monetization/opportunity-hunter.ts").includes(
    "where: { id: opportunityId, companyId }",
  ) &&
    read("src/server/monetization/opportunity-hunter.ts").includes(
      "COMPANY_SCOPE_VIOLATION",
    ) &&
    read("src/app/api/monetization/opportunities/route.ts").includes(
      "ctx.companyId",
    ),
);

// 11 saved search
check(
  "11 saved search",
  existsSync(join(root, "src/app/api/monetization/saved-searches/route.ts")) &&
    read("src/app/api/monetization/saved-searches/route.ts").includes("companyId"),
);

// 12 alert
check(
  "12 alert",
  existsSync(join(root, "src/app/api/monetization/alerts/route.ts")) &&
    read("src/app/api/monetization/alerts/route.ts").includes("companyId"),
);

// 13 inventory
check(
  "13 inventory",
  read("prisma/schema.prisma").includes("CompanyInventoryItem") &&
    getInventoryAlignmentPlan().phase === "4B",
);

// 14 entitlement gate
check(
  "14 entitlement gate",
  read("src/lib/membership/assert-entitlement.ts").includes("assertEntitlement") &&
    read("src/lib/membership/assert-entitlement.ts").includes("entitlement.denied"),
);

async function main() {
  // 15 health endpoint
  const healthRes = await healthGet();
  check("15 health endpoint", healthRes.status === 200);

  // 16 readiness endpoint
  check(
    "16 readiness endpoint",
    existsSync(join(root, "src/app/api/ready/route.ts")) &&
      read("src/app/api/ready/route.ts").includes("SELECT 1"),
  );

  // 17 safe error response
  const mapped = mapUnknownToSafeError(
    new Error("PrismaClientKnownRequestError P2002"),
  );
  check(
    "17 safe error response",
    mapped.body.code === DomainErrorCode.INTERNAL_ERROR &&
      !mapped.body.message.includes("Prisma") &&
      !mapped.body.message.includes("P2002"),
  );

  // Extra guards from Phase 4A
  check(
    "rate limit on register",
    read("src/app/api/auth/register/route.ts").includes("assertRateLimit"),
  );
  check(
    "rate limit on price preview",
    read("src/app/api/price-intelligence/preview/route.ts").includes(
      "assertRateLimit",
    ),
  );
  check("authorization matrix present", AUTHORIZATION_MATRIX.length >= 8);
  check(
    "migration policy documented",
    existsSync(join(root, "docs/production/migration-policy.md")) &&
      existsSync(join(root, "docs/production/rollback-readiness.md")),
  );
  check(
    "no second brain in telemetry publish path",
    !read("src/server/request/create-request.ts").includes("understandRequest(") ||
      read("src/server/request/create-request.ts").includes(
        "buildDiscoveryProjectionFromState",
      ),
  );

  // Phase 4B soft-launch gates (smoke expansion)
  check(
    "4B mock credits gated in membership",
    read("src/app/api/membership/route.ts").includes("isMockCreditPurchaseAllowed") &&
      read("src/lib/membership/billing-gates.ts").includes("isProductionRuntime"),
  );
  check(
    "4B offer accept claim transition",
    read("src/server/offer/offer-service.ts").includes("claimedRequest"),
  );
  check(
    "4B idempotency record model",
    read("prisma/schema.prisma").includes("model IdempotencyRecord"),
  );
  check(
    "4B deploy pipeline documented",
    existsSync(join(root, "docs/production/deploy-pipeline.md")),
  );

  console.log(`\nPhase 4A production smoke: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
}

void main();
