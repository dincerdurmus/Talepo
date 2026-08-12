/**
 * Precheck before applying personal SavedSearch/Alert ownership migration.
 * Run against a non-prod DB: npx tsx scripts/precheck-personal-resource-ownership-v1.ts
 *
 * Does NOT mutate data. Exit 1 if blockers found.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const blockers: string[] = [];

  const [savedTotal, alertTotal, savedNullCompany, alertNullCompany] =
    await Promise.all([
      prisma.savedSearch.count(),
      prisma.alertRule.count(),
      prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
        `SELECT COUNT(*)::bigint AS c FROM "SavedSearch" WHERE "companyId" IS NULL`,
      ).catch(() => [{ c: 0n }]),
      prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
        `SELECT COUNT(*)::bigint AS c FROM "AlertRule" WHERE "companyId" IS NULL`,
      ).catch(() => [{ c: 0n }]),
    ]);

  const nullSaved = Number(savedNullCompany[0]?.c ?? 0);
  const nullAlert = Number(alertNullCompany[0]?.c ?? 0);

  console.log("=== PRECHECK personal resource ownership ===");
  console.log(`SavedSearch total: ${savedTotal}`);
  console.log(`AlertRule total: ${alertTotal}`);
  console.log(`SavedSearch companyId NULL: ${nullSaved}`);
  console.log(`AlertRule companyId NULL: ${nullAlert}`);

  if (nullSaved > 0) {
    blockers.push(
      `SavedSearch has ${nullSaved} rows with NULL companyId — backfill/XOR will fail`,
    );
  }
  if (nullAlert > 0) {
    blockers.push(
      `AlertRule has ${nullAlert} rows with NULL companyId — backfill/XOR will fail`,
    );
  }

  // Column presence hint (pre-migration)
  const cols = await prisma.$queryRawUnsafe<
    Array<{ table_name: string; column_name: string }>
  >(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('SavedSearch', 'AlertRule')
       AND column_name IN ('ownerType', 'userId', 'companyId')
     ORDER BY table_name, column_name`,
  ).catch(() => []);

  console.log("Columns present:", cols);

  if (blockers.length) {
    console.log("\nBLOCKERS:");
    for (const b of blockers) console.log(" -", b);
    process.exit(1);
  }

  console.log("\nPRECHECK OK — safe to apply migration on this DB (not production).");
  process.exit(0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
