const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFile, execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const web = path.join(root, "apps/web");
const repaired = [
  "phase4c-billing", "p1-closed-beta-closure", "standard-pro-packaging", "two-plan-packaging",
];
const checks = [
  ...[...repaired, "global-panel-visual-system"].map((id) => ({
    id, args: ["scripts/run-local-verifier.cjs", "scripts/verify-" + id + "-v1.ts"],
  })),
  { id: "company-owner-management", args: ["scripts/verify-company-owner-management-v1.cjs"] },
  { id: "test-types", args: ["node_modules/typescript/bin/tsc", "-p", "scripts/tsconfig.company-tests.json"] },
  { id: "application-types", args: ["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false", "--types", "node,react,next,next/image-types/global"] },
  { id: "deliberate-faults", args: [path.join(__dirname, "verify-guards.cjs")] },
];
function run(check) {
  return new Promise((resolve) => {
    execFile(process.execPath, check.args, { cwd: web, timeout: 120000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      fs.writeFileSync(path.join(__dirname, check.id + ".log"), stdout + stderr);
      resolve({ id: check.id, exitCode: error ? error.code ?? 1 : 0, command: ["node", ...check.args].join(" ") });
    });
  });
}
async function lint() {
  const { ESLint } = require(path.join(web, "node_modules/eslint"));
  const eslint = new ESLint({ cwd: web });
  const files = repaired.map((id) => path.join(web, "scripts/verify-" + id + "-v1.ts"));
  const results = await eslint.lintFiles(files);
  const errors = results.reduce((n, r) => n + r.errorCount, 0);
  const warnings = results.reduce((n, r) => n + r.warningCount, 0);
  const formatter = await eslint.loadFormatter("stylish");
  fs.writeFileSync(path.join(__dirname, "eslint.log"), formatter.format(results) + "\n" + files.length + " files; " + errors + " errors; " + warnings + " warnings.\n");
  return { id: "repaired-test-eslint", exitCode: errors || warnings ? 1 : 0, errors, warnings, files: files.length };
}
function productionScope() {
  const before = JSON.parse(fs.readFileSync(path.join(__dirname, "before.json"), "utf8"));
  const previous = new Map(before.productionHashes.map((entry) => [entry.file, entry.sha256]));
  const current = new Set(execFileSync("git", ["ls-files", "-co", "--exclude-standard", "--", "apps/web/src", "apps/web/prisma"], {
    cwd: root, encoding: "utf8",
  }).split(/\r?\n/).filter(Boolean));
  const changes = [];
  for (const file of new Set([...previous.keys(), ...current])) {
    if (!current.has(file) || !fs.existsSync(path.join(root, file))) changes.push({ file, reason: "removed" });
    else if (!previous.has(file)) changes.push({ file, reason: "added" });
    else if (createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") !== previous.get(file)) {
      changes.push({ file, reason: "modified" });
    }
  }
  const result = { id: "production-scope", exitCode: changes.length ? 1 : 0, files: previous.size, changes };
  fs.writeFileSync(path.join(__dirname, "production-scope.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}
function diffCheck() {
  try {
    const output = execFileSync("git", ["-c", "core.safecrlf=false", "diff", "--check"], { cwd: root, encoding: "utf8" });
    fs.writeFileSync(path.join(__dirname, "diff-check.log"), output);
    return { id: "diff-check", exitCode: 0 };
  } catch (error) {
    fs.writeFileSync(path.join(__dirname, "diff-check.log"), String(error.stdout ?? "") + String(error.stderr ?? ""));
    return { id: "diff-check", exitCode: error.status ?? 1 };
  }
}
async function main() {
  const results = [];
  for (let offset = 0; offset < checks.length; offset += 3) {
    for (const result of await Promise.all(checks.slice(offset, offset + 3).map(run))) {
      results.push(result);
      console.log(result.id + ": " + (result.exitCode === 0 ? "PASS" : "FAIL"));
    }
  }
  results.push(await lint(), productionScope(), diffCheck());
  const summary = {
    createdAt: new Date().toISOString(),
    base: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    liveDatabaseUsed: false,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary));
  process.exitCode = results.some((result) => result.exitCode !== 0) ? 1 : 0;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
