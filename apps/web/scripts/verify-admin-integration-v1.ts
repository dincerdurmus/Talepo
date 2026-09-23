/** Database-free admin and 4+1 acceptance gates, each in an isolated process. */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const gates = [
  "company-4plus1", "company-analysis-access", "company-invite-api",
  "company-owner-management", "company-seat-lifecycle", "admin-imza-access",
  "admin-review-hold",
];
let failed = 0;
for (const gate of gates) {
  const result = spawnSync(process.execPath, [join(__dirname, `verify-${gate}-v1.cjs`)], { stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0 || result.error) failed++;
}
console.log(`Admin integration gates: ${gates.length - failed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
