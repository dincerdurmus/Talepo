const fs = require("node:fs");
const path = require("node:path");
const { execFile, execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const web = path.join(root, "apps/web");
const checks = [
  ...["company-4plus1", "company-analysis-access", "company-seat-lifecycle", "company-invite-api", "company-owner-management"].map((id) => ({
    id, args: ["scripts/verify-" + id + "-v1.cjs"],
  })),
  ...[
    "corporate-pricing-seat-policy", "pro-company-monetization", "corporate-workspace-isolation",
    "hidden-inventory-addon", "offer-negotiation", "offer-media", "deal-review", "deal-completion",
    "request-publication-lifecycle",
    "phase3c-corporate-opportunity-center", "p1-closed-beta-closure",
  ].map((id) => ({ id, args: ["scripts/run-local-verifier.cjs", "scripts/verify-" + id + "-v1.ts"] })),
  { id: "typescript", args: ["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false", "--types", "node,react,next,next/image-types/global"] },
];
function run(check) {
  return new Promise((resolve) => {
    execFile(process.execPath, check.args, { cwd: web, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      const output = stdout + stderr;
      fs.writeFileSync(path.join(__dirname, check.id + ".log"), output);
      resolve({ id: check.id, exitCode: error ? error.code ?? 1 : 0, command: ["node", ...check.args].join(" ") });
    });
  });
}
async function lint() {
  const { ESLint } = require(path.join(web, "node_modules/eslint"));
  const tracked = execFileSync("git", ["-c", "core.safecrlf=false", "diff", "--name-only"], { cwd: root, encoding: "utf8" });
  const added = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  const selected = [...new Set((tracked + "\n" + added).split(/\r?\n/))]
    .filter((p) => p.startsWith("apps/web/") && /\.(ts|tsx|cjs)$/.test(p));
  const manifestPath = path.join(__dirname, "changed-code-files.json");
  // A recorded manifest also supports lint after these changes have been committed.
  const files = selected.length ? selected : JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2) + "\n");
  const eslint = new ESLint({ cwd: web });
  const results = await eslint.lintFiles(files.map((p) => path.join(root, p)));
  const errors = results.reduce((n, r) => n + r.errorCount, 0);
  const warnings = results.reduce((n, r) => n + r.warningCount, 0);
  const formatter = await eslint.loadFormatter("stylish");
  fs.writeFileSync(path.join(__dirname, "eslint.log"), formatter.format(results) + "\n" + files.length + " files; " + errors + " errors; " + warnings + " warnings.\n");
  return { id: "eslint", exitCode: errors ? 1 : 0, errors, warnings, files: files.length };
}
async function main() {
  const results = [];
  for (let offset = 0; offset < checks.length; offset += 4) {
    for (const result of await Promise.all(checks.slice(offset, offset + 4).map(run))) {
      results.push(result);
      console.log(result.id + ": " + (result.exitCode === 0 ? "PASS" : "FAIL"));
    }
  }
  results.push(await lint());
  try {
    const output = execFileSync("git", ["-c", "core.safecrlf=false", "diff", "--check"], { cwd: root, encoding: "utf8" });
    fs.writeFileSync(path.join(__dirname, "diff-check.log"), output);
    results.push({ id: "diff-check", exitCode: 0 });
  } catch (error) {
    results.push({ id: "diff-check", exitCode: error.status ?? 1 });
  }
  const summary = { createdAt: new Date().toISOString(), base: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), liveDatabaseUsed: false, results };
  fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary));
  process.exitCode = results.some((r) => r.exitCode !== 0) ? 1 : 0;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
