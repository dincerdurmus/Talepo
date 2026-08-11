/**
 * Catalog ingestion CLI (foundation).
 *
 * Examples:
 *   npx tsx scripts/catalog-ingest.ts automotive --dry-run
 *   npx tsx scripts/catalog-ingest.ts appliances --dry-run
 *   npx tsx scripts/catalog-ingest.ts all --dry-run
 *   npx tsx scripts/catalog-ingest.ts automotive --apply
 *
 * --apply requires omitting --dry-run (explicit apply intent).
 * V1: no real source adapters; dry-run exercises policy + pipeline only.
 */
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import {
  EMPTY_ADAPTERS,
  runCatalogIngestion,
} from "../src/lib/knowledge";

async function main() {
  const args = process.argv.slice(2);
  const domain = args.find((a) => !a.startsWith("--")) ?? "all";
  const dryRun = args.includes("--dry-run") || !args.includes("--apply");
  const apply = args.includes("--apply");
  const writeArtifacts = args.includes("--write-artifacts") || apply;

  const categoryIds =
    domain === "all"
      ? REQUEST_CATEGORIES.map((c) => c.id)
      : [domain === "appliances" ? "appliances" : domain];

  if (apply && dryRun) {
    console.error(
      "Apply guard: use `catalog-ingest <domain> --apply` without --dry-run.",
    );
    process.exit(2);
  }

  const result = await runCatalogIngestion({
    categoryIds,
    dryRun: apply ? false : true,
    apply,
    adapters: EMPTY_ADAPTERS,
    writeArtifacts,
  });

  console.log(JSON.stringify(result.report, null, 2));
  if (result.artifactDir) {
    console.log(`artifacts: ${result.artifactDir}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
