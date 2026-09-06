/** Run the offline audit using the project's existing TypeScript dependency. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  return originalResolve.call(this,
    request.startsWith("@/") ? path.join(root, "src", request.slice(2)) : request,
    parent, ...args);
};
require.extensions[".ts"] = (loaded, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } });
  loaded._compile(output.outputText, filename);
};
const suite = process.argv[2] || "all";
const suites = {
  families: "verify-category-real-scenarios-v1.ts",
  edits: "verify-category-edit-scenarios-v1.ts",
  answers: "verify-category-answer-retention-v1.ts",
  targets: "verify-request-target-regressions-v1.ts",
};
if (suite !== "all" && !Object.hasOwn(suites, suite)) throw new Error("Choose all, families, edits, answers or targets");
for (const [name, script] of Object.entries(suites)) {
  if (suite === "all" || suite === name) require(path.join(root, "scripts", script));
}
