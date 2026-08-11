/**
 * Catalog ingestion CLI — SourceAdapters V2.
 *
 * Default: LIVE dry-run (network enabled). Prefer real external sources.
 * --offline / --no-network: CI path using curated fixtures only (never counts as LIVE).
 *
 * Examples:
 *   npx tsx scripts/catalog-ingest.ts automotive --dry-run --write-artifacts --limit=30
 *   npx tsx scripts/catalog-ingest.ts appliances --dry-run --write-artifacts --limit=30
 *   npx tsx scripts/catalog-ingest.ts technology --dry-run --write-artifacts --limit=30
 *   npx tsx scripts/catalog-ingest.ts machinery --dry-run --write-artifacts --limit=20
 *   npx tsx scripts/catalog-ingest.ts all --dry-run --write-artifacts --limit=20
 *   npx tsx scripts/catalog-ingest.ts all --dry-run --offline --write-artifacts
 *   npx tsx scripts/catalog-ingest.ts appliances --dry-run --source=appliances-discovery --limit=20
 *
 * Flags:
 *   --source=ADAPTER_ID     filter adapter
 *   --category=CATEGORY_ID  filter category within domain
 *   --entity=transmission|engine  automotive entity filter (V2C)
 *   --limit=N               cap discovery volume
 *   --write-artifacts       write run artifacts under data/catalog-ingestion/runs/
 *   --offline               fixtures/CI only (allowNetwork=false)
 *   --mode=FULL_DISCOVERY|INCREMENTAL|DETAIL_REFRESH
 *
 * --apply is blocked from mutating production catalogs in V2.
 */
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import {
  adaptersForDomain,
  runCatalogIngestion,
} from "../src/lib/knowledge/ingestion";
import type { DiscoveryMode } from "../src/lib/knowledge/ingestion/types";

function argValue(args: string[], name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const domain = args.find((a) => !a.startsWith("--")) ?? "all";
  const dryRun = args.includes("--dry-run") || !args.includes("--apply");
  const apply = args.includes("--apply");
  const writeArtifacts = args.includes("--write-artifacts") || apply;
  const offline = args.includes("--offline") || args.includes("--no-network");
  const sourceFilter = argValue(args, "--source") ?? null;
  const entityRaw = argValue(args, "--entity");
  const entityFilter =
    entityRaw === "transmission" || entityRaw === "engine"
      ? entityRaw
      : null;
  const limitRaw = argValue(args, "--limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const categoryFilter = argValue(args, "--category");
  const modeRaw = argValue(args, "--mode") ?? "FULL_DISCOVERY";
  const discoveryMode = (
    ["FULL_DISCOVERY", "INCREMENTAL", "DETAIL_REFRESH"].includes(modeRaw)
      ? modeRaw
      : "FULL_DISCOVERY"
  ) as DiscoveryMode;

  const normalizedDomain =
    domain === "beyaz-esya" || domain === "beyaz-eşya" ? "appliances" : domain;

  let categoryIds =
    normalizedDomain === "all"
      ? REQUEST_CATEGORIES.map((c) => c.id)
      : [normalizedDomain];

  if (categoryFilter) {
    categoryIds = categoryIds.filter((id) => id === categoryFilter);
  }

  if (apply && dryRun) {
    console.error(
      "Apply guard: use `catalog-ingest <domain> --apply` without --dry-run.",
    );
    process.exit(2);
  }

  if (apply) {
    console.error(
      "SourceAdapters V2: --apply does not mutate data/catalogs/**; use dry-run artifacts only.",
    );
  }

  console.error(
    offline
      ? "[catalog-ingest] mode=OFFLINE fixtures (CI) — LIVE_SOURCE_RECORDS expected 0"
      : "[catalog-ingest] mode=LIVE dry-run (network) — fixtures excluded from LIVE metrics",
  );
  console.error(`[catalog-ingest] discoveryMode=${discoveryMode}`);

  const adapters = adaptersForDomain(
    normalizedDomain === "all" ? "all" : categoryIds[0] ?? normalizedDomain,
  ).filter((a) => {
    if (!sourceFilter) return true;
    return a.adapterId === sourceFilter || a.id === sourceFilter;
  });

  if (entityFilter) {
    console.error(`[catalog-ingest] entityFilter=${entityFilter}`);
  }

  const result = await runCatalogIngestion({
    categoryIds,
    dryRun: true,
    apply: false,
    adapters,
    writeArtifacts,
    limit: Number.isFinite(limit) ? limit : undefined,
    sourceFilter,
    entityFilter,
    allowNetwork: !offline,
    discoveryMode,
  });

  console.log(JSON.stringify(result.report, null, 2));
  if (result.artifactDir) {
    console.log(`artifacts: ${result.artifactDir}`);
  }
  console.log(
    `status=${result.status} adapters=${result.adapterStats.length} ` +
      `LIVE=${result.report.counts.LIVE_SOURCE_RECORDS ?? 0} ` +
      `FIXTURE=${result.report.counts.FIXTURE_RECORDS ?? 0} ` +
      `CACHE=${result.report.counts.CACHE_RECORDS ?? 0} ` +
      `LIVE_TX=${result.report.counts.LIVE_TRANSMISSION_RECORDS ?? 0} ` +
      `LIVE_ENG=${result.report.counts.LIVE_ENGINE_RECORDS ?? 0} ` +
      `fetchAttempts=${result.report.counts.fetchAttempts ?? 0}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
