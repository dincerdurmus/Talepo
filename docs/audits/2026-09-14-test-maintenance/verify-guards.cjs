// Deliberate, in-memory faults must be rejected by the repaired verifiers.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const web = path.resolve(__dirname, "../../../apps/web");
const { createLoader } = require(path.join(web, "scripts/lib/isolated-typescript-loader.cjs"));
const cases = [
  { id: "owner-denied", script: "verify-phase4c-billing-v1.ts", expected: "FAIL — 4 OWNER can mutate company billing" },
  { id: "legacy-admin-allowed", script: "verify-phase4c-billing-v1.ts", expected: "FAIL — 14 members, analysts and legacy managers cannot mutate company billing" },
  { id: "copilot-standard", script: "verify-standard-pro-packaging-v1.ts", label: "Offer Copilot", expected: '!featureLabels.includes("Offer Copilot")' },
  { id: "copilot-two-plan", script: "verify-two-plan-packaging-v1.ts", label: "Offer Copilot", expected: '!featureLabels.includes("Offer Copilot")' },
  { id: "price-intelligence", script: "verify-two-plan-packaging-v1.ts", label: "Price Intelligence", expected: '!featureLabels.includes("Price Intelligence")' },
  { id: "missing-category", script: "verify-p1-closed-beta-closure-v1.ts", expected: "Automotive category fixture is missing." },
];
function runFault(id) {
  const entry = cases.find((c) => c.id === id);
  assert.ok(entry, "Unknown fault scenario.");
  const actual = createLoader();
  const stubs = {};
  if (id === "owner-denied" || id === "legacy-admin-allowed") {
    const billing = actual("src/lib/billing/billing-authority.ts");
    stubs["../src/lib/billing/billing-authority"] = {
      ...billing,
      canMutateCompanyBilling: id === "owner-denied" ? () => false
        : (role) => role === "ADMIN" || billing.canMutateCompanyBilling(role),
    };
  } else if (entry.label) {
    const packaging = actual("src/lib/membership/product-packaging.ts");
    stubs["../src/lib/membership/product-packaging"] = {
      ...packaging,
      PUBLIC_FEATURE_MATRIX: [...packaging.PUBLIC_FEATURE_MATRIX, { label: entry.label, standard: "—", professional: "Dahil" }],
    };
  } else {
    const categories = actual("src/lib/request-category-engine.ts");
    stubs["../src/lib/request-category-engine"] = { ...categories, getCategoryById: () => null };
  }
  createLoader(stubs)("scripts/" + entry.script);
}
async function main() {
  const results = [];
  for (let i = 0; i < cases.length; i += 3) {
    results.push(...await Promise.all(cases.slice(i, i + 3).map((entry) => new Promise((resolve) => {
      execFile(process.execPath, [__filename, entry.id], { cwd: web, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        const output = stdout + stderr;
        fs.writeFileSync(path.join(__dirname, "guard-" + entry.id + ".log"), output);
        const detected = Boolean(error && error.code === 1 && output.includes(entry.expected));
        resolve({ id: entry.id, detected, expectedFailure: entry.expected });
      });
    }))));
  }
  fs.writeFileSync(path.join(__dirname, "guards.json"), JSON.stringify(results, null, 2) + "\n");
  for (const result of results) console.log((result.detected ? "PASS" : "FAIL") + " — " + result.id + " detected");
  process.exitCode = results.every((r) => r.detected) ? 0 : 1;
}
if (process.argv[2]) runFault(process.argv[2]);
else main().catch((error) => { console.error(error); process.exitCode = 1; });
