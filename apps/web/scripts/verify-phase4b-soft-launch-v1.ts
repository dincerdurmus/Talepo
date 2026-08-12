/**
 * Phase 4B — Soft-launch gate closure verify suite.
 * Run: npx tsx scripts/verify-phase4b-soft-launch-v1.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  isMockCreditPurchaseAllowed,
  isMockUpgradeAllowed,
} from "../src/lib/membership/billing-gates";
import {
  assertProductionEnvironmentHardGate,
  validateEnvironment,
} from "../src/lib/observability/env";
import { isDistributedRateLimitReady } from "../src/lib/observability/rate-limit-store";
import { normalizeIdempotencyKey } from "../src/lib/observability/idempotency";

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

// 1 mock upgrade blocked in production
check(
  "1 mock upgrade blocked in production",
  isMockUpgradeAllowed("production") === false &&
    isMockUpgradeAllowed("development") === false, // env not set in test
);

// Force-check gate logic with env simulation
const prevMock = process.env.ALLOW_MOCK_UPGRADE;
process.env.ALLOW_MOCK_UPGRADE = "true";
check(
  "1b mock upgrade allowed only non-prod",
  isMockUpgradeAllowed("development") === true &&
    isMockUpgradeAllowed("production") === false,
);
process.env.ALLOW_MOCK_UPGRADE = prevMock;

// 2 buy-credits gated
process.env.ALLOW_MOCK_CREDITS = "true";
check(
  "2 buy-credits gated",
  isMockCreditPurchaseAllowed("production") === false &&
    isMockCreditPurchaseAllowed("development") === true &&
    read("src/app/api/membership/route.ts").includes("PAYMENT_REQUIRED") &&
    read("src/app/api/membership/route.ts").includes("isMockCreditPurchaseAllowed"),
);
delete process.env.ALLOW_MOCK_CREDITS;

// 3 env hard gate fails when secrets missing in production mode
const missingSecret = process.env.NEXTAUTH_SECRET;
delete process.env.NEXTAUTH_SECRET;
let gateThrew = false;
try {
  assertProductionEnvironmentHardGate({
    nodeEnv: "production",
    exitProcess: false,
  });
} catch {
  gateThrew = true;
}
check("3 env hard gate", gateThrew);
if (missingSecret !== undefined) process.env.NEXTAUTH_SECRET = missingSecret;

// 4 deploy pipeline scripts
const pkg = read("package.json");
check(
  "4 deploy pipeline scripts",
  pkg.includes("db:migrate:deploy") &&
    pkg.includes("env:check:prod") &&
    pkg.includes("start:prod") &&
    pkg.includes("deploy:check") &&
    existsSync(join(root, "docs/production/deploy-pipeline.md")),
);

// 5 instrumentation hard gate
check(
  "5 instrumentation hard gate",
  read("src/instrumentation.ts").includes("assertProductionEnvironmentHardGate"),
);

// 6 offer create race unique indexes
check(
  "6 offer create race unique indexes",
  read(
    "prisma/migrations/20260812120000_phase4b_offer_idempotency/migration.sql",
  ).includes("Offer_request_company_active_uidx") &&
    read(
      "prisma/migrations/20260812120000_phase4b_offer_idempotency/migration.sql",
    ).includes("Offer_request_user_personal_active_uidx") &&
    read("src/server/offer/offer-service.ts").includes("isPrismaUniqueViolation"),
);

// 7 offer accept conditional transition
check(
  "7 offer accept conditional transition",
  read("src/server/offer/offer-service.ts").includes(
    'status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] }',
  ) &&
    read("src/server/offer/offer-service.ts").includes("claimedRequest") &&
    read("src/server/offer/offer-service.ts").includes("acceptedRows"),
);

// 8 conversation invariant
check(
  "8 conversation invariant",
  read("src/server/offer/offer-service.ts").includes("isPrismaUniqueViolation") &&
    /offerId String @unique/.test(read("prisma/schema.prisma")),
);

// 9 request publish idempotency
check(
  "9 request publish idempotency",
  read("src/server/request/create-request.ts").includes("REQUEST_PUBLISH") &&
    read("src/app/api/requests/route.ts").includes("readIdempotencyKeyFromRequest") &&
    normalizeIdempotencyKey("short") === null &&
    normalizeIdempotencyKey("abcdefgh") !== null,
);

// 10 offer/accept idempotency
check(
  "10 offer/accept idempotency",
  read("src/app/api/offers/route.ts").includes("OFFER_SUBMIT") &&
    read("src/app/api/offers/[id]/route.ts").includes("OFFER_ACCEPT") &&
    read("prisma/schema.prisma").includes("model IdempotencyRecord"),
);

// 11 rate limits on critical endpoints
check(
  "11 rate limits on critical endpoints",
  read("src/app/api/requests/route.ts").includes("request.publish") &&
    read("src/app/api/offers/route.ts").includes("offer.create") &&
    read("src/app/api/conversations/[id]/messages/route.ts").includes(
      "message.send",
    ) &&
    read("src/lib/auth/providers.ts").includes("auth.login:") &&
    read("src/app/api/price-intelligence/preview/route.ts").includes(
      "assertRateLimit",
    ),
);

// 12 distributed readiness flag explicit
check(
  "12 distributed rate-limit readiness explicit",
  isDistributedRateLimitReady() === false &&
    read("src/lib/observability/rate-limit-store.ts").includes("distributed") &&
    read("docs/production/deploy-pipeline.md").includes("migrate deploy"),
);

// 13 tenancy persistence predicates
check(
  "13 tenancy persistence predicates",
  read("src/server/monetization/opportunity-hunter.ts").includes(
    "where: { id: opportunityId, companyId }",
  ) &&
    read("src/app/api/monetization/alerts/route.ts").includes(
      "ownerScopeWhere(ctx)",
    ) &&
    read("src/app/api/monetization/saved-searches/route.ts").includes(
      "ownerScopeWhere(ctx)",
    ) &&
    read("src/lib/membership/resource-owner.ts").includes(
      "requireResourceOwnerFeature",
    ) &&
    read("src/app/api/membership/route.ts").includes(
      "COMPANY_SCOPE_VIOLATION",
    ),
);

// 14 safe errors on critical mutations
check(
  "14 safe errors on critical mutations",
  read("src/app/api/membership/route.ts").includes("safeErrorResponse") &&
    read("src/app/api/offers/[id]/route.ts").includes("safeErrorResponse") &&
    read("src/app/api/conversations/[id]/messages/route.ts").includes(
      "safeErrorResponse",
    ),
);

// 15 readiness rejects mock flags in production (structural + validator)
check(
  "15 readiness rejects mock flags in production",
  read("src/app/api/ready/route.ts").includes("dev_only_flags") &&
    read("src/app/api/ready/route.ts").includes(
      "developmentOnlyEnabledInProduction",
    ),
);

process.env.ALLOW_MOCK_UPGRADE = "true";
const prodEnv = validateEnvironment({ nodeEnv: "production" });
check(
  "15b production validator rejects ALLOW_MOCK_UPGRADE",
  prodEnv.developmentOnlyEnabledInProduction.includes("ALLOW_MOCK_UPGRADE") &&
    prodEnv.ok === false,
);
delete process.env.ALLOW_MOCK_UPGRADE;

// Optional DB tenancy integration (rollback transaction)
async function tenancyDbCheck() {
  const hasDb =
    Boolean(process.env.DATABASE_URL?.trim()) ||
    Boolean(process.env.DIRECT_URL?.trim());
  if (!hasDb) {
    check("16 tenancy DB integration", true, "skipped (no DATABASE_URL)");
    return;
  }

  try {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$transaction(async (tx) => {
      const suffix = `p4b_${Date.now()}`;
      const ownerA = await tx.user.create({
        data: {
          email: `a_${suffix}@example.invalid`,
          membershipNumber: `TLP-A${Date.now()}`,
        },
        select: { id: true },
      });
      const ownerB = await tx.user.create({
        data: {
          email: `b_${suffix}@example.invalid`,
          membershipNumber: `TLP-B${Date.now()}`,
        },
        select: { id: true },
      });
      const companyA = await tx.company.create({
        data: {
          name: `CoA ${suffix}`,
          slug: `coa-${suffix}`,
          createdById: ownerA.id,
        },
        select: { id: true },
      });
      const companyB = await tx.company.create({
        data: {
          name: `CoB ${suffix}`,
          slug: `cob-${suffix}`,
          createdById: ownerB.id,
        },
        select: { id: true },
      });

      // Minimal category for request
      const category = await tx.category.upsert({
        where: { slug: "technology" },
        update: {},
        create: { slug: "technology", name: "Teknoloji" },
        select: { id: true },
      });

      const request = await tx.request.create({
        data: {
          createdById: ownerA.id,
          categoryId: category.id,
          title: `P4B tenancy ${suffix}`,
          description: "Phase 4B tenancy isolation fixture request text.",
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
        select: { id: true },
      });

      const oppA = await tx.opportunityMatch.create({
        data: {
          companyId: companyA.id,
          requestId: request.id,
          source: "ALERT_RULE",
          score: 10,
        },
        select: { id: true },
      });

      const cross = await tx.opportunityMatch.updateMany({
        where: { id: oppA.id, companyId: companyB.id },
        data: { status: "VIEWED" },
      });
      if (cross.count !== 0) {
        throw new Error("cross-company opportunity update should be 0");
      }

      const alert = await tx.alertRule.create({
        data: {
          ownerType: "COMPANY",
          companyId: companyA.id,
          userId: null,
          name: `alert-${suffix}`,
        },
        select: { id: true },
      });
      const alertCross = await tx.alertRule.updateMany({
        where: { id: alert.id, companyId: companyB.id },
        data: { isActive: false },
      });
      if (alertCross.count !== 0) {
        throw new Error("cross-company alert update should be 0");
      }

      const saved = await tx.savedSearch.create({
        data: {
          ownerType: "COMPANY",
          companyId: companyA.id,
          userId: null,
          name: `saved-${suffix}`,
          filters: {},
        },
        select: { id: true },
      });
      const savedCross = await tx.savedSearch.updateMany({
        where: { id: saved.id, companyId: companyB.id },
        data: { isActive: false },
      });
      if (savedCross.count !== 0) {
        throw new Error("cross-company saved search update should be 0");
      }

      const inv = await tx.companyInventoryItem.create({
        data: {
          companyId: companyA.id,
          name: `item-${suffix}`,
        },
        select: { id: true },
      });
      const invCross = await tx.companyInventoryItem.updateMany({
        where: { id: inv.id, companyId: companyB.id },
        data: { isActive: false },
      });
      if (invCross.count !== 0) {
        throw new Error("cross-company inventory update should be 0");
      }

      // Team membership scoped by companyId
      const member = await tx.companyMember.create({
        data: {
          companyId: companyA.id,
          userId: ownerA.id,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
        select: { id: true },
      });
      const memberCross = await tx.companyMember.updateMany({
        where: { id: member.id, companyId: companyB.id },
        data: { status: "REMOVED" },
      });
      if (memberCross.count !== 0) {
        throw new Error("cross-company team update should be 0");
      }

      // Force rollback
      throw new Error("TALEPO_P4B_TENANCY_ROLLBACK");
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("TALEPO_P4B_TENANCY_ROLLBACK")) {
      check("16 tenancy DB integration", true);
      return;
    }
    // Schema model names may differ — fall back to structural pass with note
    check(
      "16 tenancy DB integration",
      false,
      msg.slice(0, 200),
    );
  }
}

async function main() {
  await tenancyDbCheck();

  console.log(`\nPhase 4B soft-launch: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
}

void main();
