/**
 * Dry-run inventory projection audit — NO writes.
 * Run: npx tsx scripts/audit-inventory-projection-dry-run-v1.ts
 *
 * Requires DATABASE_URL. Does not mutate CompanyInventoryItem rows.
 */
import { buildInventoryDiscoveryProjection } from "../src/lib/inventory";
import { readInventoryProjection } from "../src/lib/inventory/attributes-envelope";
import { prisma } from "../src/lib/prisma";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";

ensureTaxonomyLoaded();

async function main() {
  const items = await prisma.companyInventoryItem.findMany({
    where: { isActive: true },
    select: {
      id: true,
      companyId: true,
      name: true,
      title: true,
      brand: true,
      model: true,
      categoryLabel: true,
      attributes: true,
    },
    take: 200,
  });

  let withProjection = 0;
  let wouldDerive = 0;
  let legacyEmpty = 0;
  const bySubject: Record<string, number> = {};

  for (const item of items) {
    const stored = readInventoryProjection(item.attributes);
    if (stored) {
      withProjection += 1;
      bySubject[stored.semanticSubject] =
        (bySubject[stored.semanticSubject] ?? 0) + 1;
      continue;
    }
    const derived = buildInventoryDiscoveryProjection({
      name: item.name || item.title || "",
      brand: item.brand,
      model: item.model,
      categoryLabel: item.categoryLabel,
    });
    if (derived.provenance === "LEGACY_EMPTY") legacyEmpty += 1;
    else wouldDerive += 1;
    bySubject[derived.semanticSubject] =
      (bySubject[derived.semanticSubject] ?? 0) + 1;
  }

  console.log(
    JSON.stringify(
      {
        dryRun: true,
        scanned: items.length,
        withStoredProjection: withProjection,
        wouldDeriveOnMatch: wouldDerive,
        legacyEmpty,
        bySubject,
        note: "No rows mutated",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
