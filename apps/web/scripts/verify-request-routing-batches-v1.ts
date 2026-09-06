/**
 * Tam katalog routing matrisi için deterministik kategori koşucusu.
 *
 * verify-request-routing-matrix-v1.ts tek parça çalıştırıldığında geniş
 * katalogda uzun süre sessiz kalabilir. Bu koşucu aynı doğrulayıcıyı kategori
 * dilimleriyle ayrı süreçlerde çalıştırır; her dilimin sonucu görünür kalır
 * ve bir dilim başarısız olursa toplam koşum başarısız olur.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

type Batch = {
  name: string;
  categories: readonly string[];
};

const batches: readonly Batch[] = [
  { name: "services-health", categories: ["services", "health"] },
  { name: "real-estate", categories: ["real-estate"] },
  { name: "automotive", categories: ["automotive"] },
  {
    name: "appliances-home-kitchen-furniture",
    categories: ["appliances", "home-kitchen", "furniture"],
  },
  { name: "machinery", categories: ["machinery"] },
  {
    name: "technology-baby-printing",
    categories: ["technology", "baby", "printing"],
  },
];

const cwd = process.cwd();
const matrixScript = resolve(cwd, "scripts/verify-request-routing-matrix-v1.ts");
const directJitiCli = resolve(cwd, "node_modules/jiti/lib/jiti-cli.mjs");
const pnpmJitiClis = existsSync(resolve(cwd, "node_modules/.pnpm"))
  ? readdirSync(resolve(cwd, "node_modules/.pnpm"))
      .filter((entry) => entry.startsWith("jiti@"))
      .map((entry) =>
        resolve(cwd, "node_modules/.pnpm", entry, "node_modules/jiti/lib/jiti-cli.mjs"),
      )
  : [];
const jitiCli = [directJitiCli, ...pnpmJitiClis].find(existsSync);

if (!jitiCli) {
  throw new Error(
    "Bu koşucu jiti üzerinden çalıştırılmalı: jiti scripts/verify-request-routing-batches-v1.ts",
  );
}

let failed = false;
for (const batch of batches) {
  const categoryFilter = batch.categories.join(",");
  console.log(`\n=== BATCH ${batch.name}: ${categoryFilter} ===`);
  const result = spawnSync(process.execPath, [jitiCli, matrixScript], {
    cwd,
    env: {
      ...process.env,
      TALEPO_ROUTING_CATEGORIES: categoryFilter,
    },
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error || result.status !== 0) {
    failed = true;
    console.error(
      `BATCH FAILED ${batch.name}: ${result.error?.message ?? `exit=${result.status}`}`,
    );
  } else {
    console.log(`BATCH PASSED ${batch.name}`);
  }
}

console.log(failed ? "\nBATCH_RESULT=FAILED" : "\nBATCH_RESULT=PASSED");
process.exit(failed ? 1 : 0);
