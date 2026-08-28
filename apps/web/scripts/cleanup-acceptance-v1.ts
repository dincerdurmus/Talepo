/**
 * Remove the synthetic acceptance data this harness created.
 *
 * Dry run by default — it prints the plan and deletes nothing. Deleting needs an
 * explicit `--apply`. The target guard runs first (via the acceptance env
 * loader), so this can only ever act on the one allowed acceptance project.
 *
 * Run from apps/web:
 *   npx --yes tsx scripts/cleanup-acceptance-v1.ts            # plan only
 *   npx --yes tsx scripts/cleanup-acceptance-v1.ts --apply    # delete
 */
import "./lib/load-acceptance-env";

import { prisma } from "../src/lib/prisma";
import {
  executeAcceptanceCleanup,
  type CleanupDb,
} from "./lib/acceptance-cleanup-core-v1";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const db = prisma as unknown as CleanupDb;

  console.log("=== cleanup-acceptance-v1 ===");
  console.log(`MODE: ${apply ? "APPLY (rows will be deleted)" : "DRY RUN (nothing is deleted)"}`);

  const plan = await executeAcceptanceCleanup(db, { dryRun: true });
  console.log(
    `SCOPE: users=${plan.scope.userIds.length} companies=${plan.scope.companyIds.length} ` +
      `requests=${plan.scope.requestIds.length} offers=${plan.scope.offerIds.length} ` +
      `conversations=${plan.scope.conversationIds.length}`,
  );
  if (plan.steps.length === 0) {
    console.log("PLAN: empty — no acceptance-owned rows found");
  } else {
    for (const step of plan.steps) {
      console.log(`  plan ${step.model}: ${step.count}`);
    }
  }

  if (!apply) {
    console.log("DELETED: 0 (dry run)");
    console.log("PASS — cleanup plan produced; rerun with --apply to delete");
    return;
  }

  const result = await executeAcceptanceCleanup(db, { dryRun: false });
  for (const step of result.steps) {
    console.log(`  deleted ${step.model}: ${step.count}`);
  }
  console.log(`DELETED: ${result.deleted}`);
  console.log("PASS — acceptance-owned rows removed");
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL — ${message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-uri]")}`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
