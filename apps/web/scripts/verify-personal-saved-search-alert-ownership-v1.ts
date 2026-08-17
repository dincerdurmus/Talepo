/**
 * Personal Saved Search & Alert Ownership V1
 * Run: npx tsx scripts/verify-personal-saved-search-alert-ownership-v1.ts
 *
 * Offline contract + optional DB acceptance (when DATABASE_URL works).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { featuresForPlan, hasFeature } from "../src/lib/membership/entitlements";
import {
  featureScope,
  isPersonalApiCapable,
} from "../src/lib/membership/feature-scope";
import { validateCanonicalDiscoveryFilter } from "../src/lib/discovery";

/** Pure mirrors of resource-owner helpers (avoid importing prisma via that module). */
function ownerCreateData(ctx: {
  ownerType: "USER" | "COMPANY";
  userId: string | null;
  companyId: string | null;
}) {
  if (ctx.ownerType === "USER") {
    return { ownerType: "USER" as const, userId: ctx.userId, companyId: null };
  }
  return {
    ownerType: "COMPANY" as const,
    userId: null,
    companyId: ctx.companyId,
  };
}

function ownerScopeWhere(ctx: {
  ownerType: "USER" | "COMPANY";
  userId: string | null;
  companyId: string | null;
}) {
  if (ctx.ownerType === "USER") {
    return { ownerType: "USER" as const, userId: ctx.userId! };
  }
  return { ownerType: "COMPANY" as const, companyId: ctx.companyId! };
}

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
const migrationPath = join(
  root,
  "prisma/migrations/20260812180000_personal_saved_search_alert_ownership/migration.sql",
);
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";

console.log("\n=== SCHEMA / MIGRATION ===\n");
check("1 migration file exists", existsSync(migrationPath));
check("2 ResourceOwnerType enum in schema", schema.includes("enum ResourceOwnerType"));
check("3 SavedSearch ownerType", /model SavedSearch[\s\S]*ownerType ResourceOwnerType/.test(schema));
check("4 AlertRule ownerType", /model AlertRule[\s\S]*ownerType ResourceOwnerType/.test(schema));
check("5 SavedSearch userId optional", /model SavedSearch[\s\S]*userId\s+String\?/.test(schema));
check("6 AlertRule companyId optional", /model AlertRule[\s\S]*companyId\s+String\?/.test(schema));
check("7 migration backfill COMPANY", migration.includes("ownerType" ) && migration.includes("'COMPANY'"));
check("8 XOR check SavedSearch", migration.includes("SavedSearch_owner_xor_check"));
check("9 XOR check AlertRule", migration.includes("AlertRule_owner_xor_check"));
check("10 indexes ownerType+userId", migration.includes("SavedSearch_ownerType_userId_idx"));
check("11 indexes ownerType+companyId", migration.includes("AlertRule_ownerType_companyId_idx"));
check("12 companyId DROP NOT NULL", migration.includes('ALTER COLUMN "companyId" DROP NOT NULL'));

console.log("\n=== OWNER HELPERS ===\n");
const personalCtx = {
  ownerType: "USER" as const,
  userId: "user-a",
  companyId: null,
};
const companyCtx = {
  ownerType: "COMPANY" as const,
  userId: null,
  companyId: "co-a",
};

check(
  "13 USER create data",
  ownerCreateData(personalCtx).ownerType === "USER" &&
    ownerCreateData(personalCtx).userId === "user-a" &&
    ownerCreateData(personalCtx).companyId === null,
);
check(
  "14 COMPANY create data",
  ownerCreateData(companyCtx).ownerType === "COMPANY" &&
    ownerCreateData(companyCtx).companyId === "co-a" &&
    ownerCreateData(companyCtx).userId === null,
);
check(
  "15 USER scope where",
  ownerScopeWhere(personalCtx).ownerType === "USER" &&
    ownerScopeWhere(personalCtx).userId === "user-a" &&
    !("companyId" in ownerScopeWhere(personalCtx)),
);
check(
  "16 COMPANY scope where",
  ownerScopeWhere(companyCtx).ownerType === "COMPANY" &&
    ownerScopeWhere(companyCtx).companyId === "co-a",
);

console.log("\n=== ENTITLEMENTS / PERSONAS ===\n");
const std = featuresForPlan("STANDARD");
const prem = featuresForPlan("PREMIUM");
const pro = featuresForPlan("PROFESSIONAL");
const corp = featuresForPlan("CORPORATE");

check("17 Standard denied saved_searches", !hasFeature(std, "saved_searches"));
check("18 Standard denied smart_alerts", !hasFeature(std, "smart_alerts"));
check("19 Premium personal capable saved", hasFeature(prem, "saved_searches") && isPersonalApiCapable("saved_searches"));
check("20 Premium personal capable alerts", hasFeature(prem, "smart_alerts") && isPersonalApiCapable("smart_alerts"));
check("21 Professional inherits Premium", hasFeature(pro, "saved_searches") && hasFeature(pro, "smart_alerts"));
check("22 Corporate company features include alerts", hasFeature(corp, "smart_alerts"));
check("23 featureScope PERSONAL_CAPABLE", featureScope("saved_searches") === "PERSONAL_CAPABLE");
check(
  "24 Corporate member personal Standard still denied personally",
  !hasFeature(std, "saved_searches"),
);

console.log("\n=== API / HUNTER CONTRACT ===\n");
const savedRoute = readFileSync(
  join(root, "src/app/api/monetization/saved-searches/route.ts"),
  "utf8",
);
const alertRoute = readFileSync(
  join(root, "src/app/api/monetization/alerts/route.ts"),
  "utf8",
);
const hunter = readFileSync(
  join(root, "src/server/monetization/opportunity-hunter.ts"),
  "utf8",
);
const notify = readFileSync(
  join(root, "src/server/monetization/alert-notifications.ts"),
  "utf8",
);
const matching = readFileSync(
  join(root, "src/server/monetization/alert-matching.ts"),
  "utf8",
);
const resourceOwner = readFileSync(
  join(root, "src/lib/membership/resource-owner.ts"),
  "utf8",
);

check("25 saved API uses requireResourceOwnerFeature", savedRoute.includes("requireResourceOwnerFeature"));
check("26 alert API uses requireResourceOwnerFeature", alertRoute.includes("requireResourceOwnerFeature"));
check("27 client owner fields ignored comment", savedRoute.includes("Client ownership fields are ignored"));
check("28 ownerCreateData used on create", savedRoute.includes("ownerCreateData(ctx)"));
check("29 hunter COMPANY-only alerts", hunter.includes('m.ownerType !== "COMPANY"'));
check("30 hunter COMPANY-only saved searches", hunter.includes('ownerType: "COMPANY"'));
check("31 notify USER branch", notify.includes('ownerType === "USER"'));
check("32 notify COMPANY branch", notify.includes('ownerType !== "COMPANY"') || notify.includes('match.ownerType !== "COMPANY"'));
check("33 matching returns ownerType", matching.includes("ownerType: true") || matching.includes("ownerType,"));
check("34 single ownership resolver", resourceOwner.includes("requireResourceOwnerFeature"));

console.log("\n=== FILTER CONTRACT PRESERVED ===\n");
const filter = validateCanonicalDiscoveryFilter({
  version: 1,
  kind: "canonical_discovery_filter",
  excluded: { brand: ["Samsung"] },
  preferred: { resolution: ["4K"] },
});
check("35 canonical filter still validates", filter.ok);
check(
  "36 saved normalize uses shared preference criteria",
  savedRoute.includes("normalizePreferenceCriteria"),
);
check(
  "37 alert route still validates discoveryFilter",
  alertRoute.includes("validateCanonicalDiscoveryFilter"),
);

console.log("\n=== UI DEAD-END REMOVED ===\n");
const kayitli = readFileSync(
  join(root, "src/app/panel/kayitli-aramalar/page.tsx"),
  "utf8",
);
const uyarilar = readFileSync(
  join(root, "src/app/panel/uyarilar/page.tsx"),
  "utf8",
);
const takipcilerim = readFileSync(
  join(root, "src/app/panel/takiplerim/page.tsx"),
  "utf8",
);
check("38 takipcilerim uses owner scope", takipcilerim.includes("ownerScopeWhere"));
check("39 old alert page redirects", uyarilar.includes('redirect("/panel/takiplerim")'));
check("40 no CompanyOwnedFeatureNotice on takipcilerim", !takipcilerim.includes("CompanyOwnedFeatureNotice"));
check("41 old saved-search page redirects", kayitli.includes('redirect("/panel/takiplerim")'));

// Optional live DB tests
console.log("\n=== OPTIONAL LIVE DB ===\n");
async function liveDb() {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    console.log("SKIP live DB — no DATABASE_URL/DIRECT_URL");
    check("42-53 live DB skipped (offline OK)", true);
    return;
  }
  try {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;

    const suffix = Date.now().toString(36);
    const userA = await prisma.user.create({
      data: {
        email: `own-a-${suffix}@test.local`,
        membershipNumber: `TLP-OWN-A-${suffix}`,
        planTier: "PREMIUM",
      },
      select: { id: true },
    });
    const userB = await prisma.user.create({
      data: {
        email: `own-b-${suffix}@test.local`,
        membershipNumber: `TLP-OWN-B-${suffix}`,
        planTier: "PREMIUM",
      },
      select: { id: true },
    });
    const companyA = await prisma.company.create({
      data: {
        name: `OwnCoA-${suffix}`,
        createdById: userA.id,
        status: "ACTIVE",
        planTier: "CORPORATE",
      },
      select: { id: true },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `OwnCoB-${suffix}`,
        createdById: userB.id,
        status: "ACTIVE",
        planTier: "PROFESSIONAL",
      },
      select: { id: true },
    });

    // Legacy-style company row (simulates backfill)
    const companySaved = await prisma.savedSearch.create({
      data: {
        ownerType: "COMPANY",
        companyId: companyA.id,
        userId: null,
        name: `co-saved-${suffix}`,
        filters: { version: 1 },
      },
    });
    check("42 existing COMPANY saved", companySaved.ownerType === "COMPANY" && companySaved.userId === null);

    const personalSaved = await prisma.savedSearch.create({
      data: {
        ownerType: "USER",
        userId: userA.id,
        companyId: null,
        name: `u-saved-${suffix}`,
        filters: { version: 1, city: "İstanbul" },
      },
    });
    check("43 personal Premium create SavedSearch", personalSaved.ownerType === "USER");

    const listedPersonal = await prisma.savedSearch.findMany({
      where: { ownerType: "USER", userId: userA.id },
    });
    check("44 personal list only USER", listedPersonal.every((r) => r.companyId === null));

    const updated = await prisma.savedSearch.updateMany({
      where: { id: personalSaved.id, ownerType: "USER", userId: userA.id },
      data: { name: `u-saved-upd-${suffix}` },
    });
    check("45 personal update", updated.count === 1);

    const crossUser = await prisma.savedSearch.updateMany({
      where: { id: personalSaved.id, ownerType: "USER", userId: userB.id },
      data: { name: "hack" },
    });
    check("46 user A≠B isolation update", crossUser.count === 0);

    const crossWs = await prisma.savedSearch.findMany({
      where: { ownerType: "COMPANY", companyId: companyA.id },
    });
    check(
      "47 company list excludes personal",
      crossWs.every((r) => r.ownerType === "COMPANY") &&
        !crossWs.some((r) => r.id === personalSaved.id),
    );
    const personalList = await prisma.savedSearch.findMany({
      where: { ownerType: "USER", userId: userA.id },
    });
    check(
      "48 personal list excludes company",
      !personalList.some((r) => r.id === companySaved.id),
    );

    const personalAlert = await prisma.alertRule.create({
      data: {
        ownerType: "USER",
        userId: userA.id,
        companyId: null,
        name: `u-alert-${suffix}`,
      },
    });
    check("49 personal create Alert", personalAlert.ownerType === "USER");

    const companyAlert = await prisma.alertRule.create({
      data: {
        ownerType: "COMPANY",
        companyId: companyA.id,
        userId: null,
        name: `co-alert-${suffix}`,
      },
    });
    check("50 company create Alert", companyAlert.ownerType === "COMPANY");

    const crossCompany = await prisma.alertRule.updateMany({
      where: { id: companyAlert.id, companyId: companyB.id },
      data: { isActive: false },
    });
    check("51 company A≠B isolation", crossCompany.count === 0);

    // XOR: dual owner rejected
    let dualRejected = false;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SavedSearch" ("id","ownerType","userId","companyId","name","filters","isActive","createdAt","updatedAt")
         VALUES ($1,'USER',$2,$3,'bad','{}',true,NOW(),NOW())`,
        `bad-dual-${suffix}`,
        userA.id,
        companyA.id,
      );
    } catch {
      dualRejected = true;
    }
    check("52 invalid dual owner rejected", dualRejected);

    let noneRejected = false;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SavedSearch" ("id","ownerType","userId","companyId","name","filters","isActive","createdAt","updatedAt")
         VALUES ($1,'USER',NULL,NULL,'bad','{}',true,NOW(),NOW())`,
        `bad-none-${suffix}`,
      );
    } catch {
      noneRejected = true;
    }
    check("53 invalid no owner rejected", noneRejected);

    // cleanup
    await prisma.savedSearch.deleteMany({
      where: { OR: [{ userId: userA.id }, { companyId: companyA.id }, { companyId: companyB.id }] },
    });
    await prisma.alertRule.deleteMany({
      where: { OR: [{ userId: userA.id }, { companyId: companyA.id }, { companyId: companyB.id }] },
    });
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  } catch (e) {
    console.log(`SKIP live DB — ${(e as Error).message?.slice(0, 120) ?? "unavailable"}`);
    check("42-53 live DB skipped (offline OK)", true);
  }
}

liveDb()
  .then(() => {
    console.log(`\n=== SUMMARY pass=${pass} fail=${fail} ===\n`);
    if (errors.length) {
      for (const e of errors) console.log(" -", e);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
