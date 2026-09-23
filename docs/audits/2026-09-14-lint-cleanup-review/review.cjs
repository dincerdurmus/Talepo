// Review only: proposed source is overlaid in memory, never written to apps/web.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");
const { execFile } = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const web = path.join(root, "apps/web");
const webRequire = createRequire(path.join(web, "package.json"));
const ts = webRequire("typescript");
const packaging = path.join(web, "src/lib/membership/product-packaging.ts");
const closure = path.join(web, "scripts/verify-p1-closed-beta-closure-v1.ts");
const originals = new Map([packaging, closure].map((p) => [p, fs.readFileSync(p, "utf8")]));
const norm = (p) => path.resolve(String(p)).toLowerCase();
const sha = (s) => createHash("sha256").update(s).digest("hex");
function replaceOnce(source, from, to) {
  assert.equal(source.split(from).length - 1, 1, "Candidate must match the inspected source exactly.");
  return source.replace(from, to);
}
function proposedSources(mode) {
  if (mode === "baseline") return new Map();
  let source = originals.get(packaging).replace(/\r\n/g, "\n");
  const functions = [["getPublicProduct", "PublicProduct"], ["getPublicProductLabel", "string"]];
  for (const [name, returnType] of functions) {
    const from = `export function ${name}(\n  tier: PlanTierId,\n  _context: ProductContext = "PERSONAL",\n)${name === "getPublicProduct" ? ": PublicProduct" : ""} {`;
    const implementation = `export function ${name}(tier: PlanTierId): ${returnType} {`;
    const contract = `// Keep the optional legacy context argument; public names depend only on tier.\nexport function ${name}(tier: PlanTierId, context?: ProductContext): ${returnType};\n`;
    source = replaceOnce(source, from, (mode === "naive" ? "" : contract) + implementation);
  }
  const test = replaceOnce(originals.get(closure).replace(/\r\n/g, "\n"), "  pinBrowseSemanticContext,\n", "");
  return new Map([[norm(packaging), source], [norm(closure), test]]);
}
function overlayFs(mode) {
  const sources = proposedSources(mode);
  return { ...fs, readFileSync(file, options) {
    const source = (typeof file === "string" || file instanceof URL) ? sources.get(norm(file instanceof URL ? require("node:url").fileURLToPath(file) : file)) : undefined;
    if (source === undefined) return fs.readFileSync(file, options);
    const encoding = typeof options === "string" ? options : options?.encoding;
    return encoding ? source : Buffer.from(source);
  } };
}
function loader(mode) {
  const loaderPath = path.join(web, "scripts/lib/isolated-typescript-loader.cjs");
  const localRequire = createRequire(loaderPath);
  const patchedFs = overlayFs(mode);
  const module = { exports: {} };
  vm.runInThisContext("(function(exports,require,module,__filename,__dirname){" + fs.readFileSync(loaderPath, "utf8") + "\n})", { filename: loaderPath })(
    module.exports, (id) => id === "node:fs" ? patchedFs : localRequire(id), module, loaderPath, path.dirname(loaderPath),
  );
  // CJS verifiers instantiate their own loaders. Supply this factory directly
  // so its literal import.meta.url replacement code is never re-transformed.
  const factory = (stubs = {}) => module.exports.createLoader({
    "node:fs": patchedFs,
    "./lib/isolated-typescript-loader.cjs": { createLoader: factory, web },
    ...stubs,
  });
  return factory();
}
function writeCandidatePatch() {
  let patch = "";
  const candidates = proposedSources("proposed");
  for (const [file, original] of originals) {
    const before = original.replace(/\r\n/g, "\n").split("\n");
    const after = candidates.get(norm(file)).split("\n");
    let prefix = 0, suffix = 0;
    while (before[prefix] === after[prefix] && prefix < Math.min(before.length, after.length)) prefix++;
    while (suffix < Math.min(before.length, after.length) - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
    const start = Math.max(0, prefix - 3);
    const oldChangeEnd = before.length - suffix, newChangeEnd = after.length - suffix;
    const contextEnd = Math.min(3, suffix);
    const relative = path.relative(root, file).replaceAll("\\", "/");
    patch += `diff --git a/${relative} b/${relative}\n--- a/${relative}\n+++ b/${relative}\n`;
    patch += `@@ -${start + 1},${oldChangeEnd + contextEnd - start} +${start + 1},${newChangeEnd + contextEnd - start} @@\n`;
    patch += before.slice(start, prefix).map((s) => " " + s + "\n").join("");
    patch += before.slice(prefix, oldChangeEnd).map((s) => "-" + s + "\n").join("");
    patch += after.slice(prefix, newChangeEnd).map((s) => "+" + s + "\n").join("");
    patch += before.slice(oldChangeEnd, oldChangeEnd + contextEnd).map((s) => " " + s + "\n").join("");
  }
  fs.writeFileSync(path.join(__dirname, "proposed-cleanup.patch"), patch);
}
async function inspect() {
  const { ESLint } = webRequire("eslint");
  const eslint = new ESLint({ cwd: web });
  const lint = {};
  for (const mode of ["baseline", "proposed"]) {
    const results = [];
    for (const file of originals.keys()) results.push(...await eslint.lintText(overlayFs(mode).readFileSync(file, "utf8"), { filePath: file }));
    lint[mode] = { errors: results.reduce((n, r) => n + r.errorCount, 0), warnings: results.reduce((n, r) => n + r.warningCount, 0) };
  }
  assert.deepEqual(lint.proposed, { errors: 0, warnings: 0 });
  const before = loader("baseline")("src/lib/membership/product-packaging.ts");
  const after = loader("proposed")("src/lib/membership/product-packaging.ts");
  assert.deepEqual(Object.keys(before).sort(), Object.keys(after).sort());
  let comparisons = 0;
  for (const name of ["getPublicProduct", "getPublicProductLabel"]) {
    assert.equal(before[name].length, after[name].length);
    for (const tier of ["STANDARD", "PREMIUM", "PROFESSIONAL", "CORPORATE"]) {
      for (const args of [[tier], [tier, undefined], [tier, "PERSONAL"], [tier, "WORKSPACE"]]) {
        assert.equal(after[name](...args), before[name](...args)); comparisons++;
      }
    }
  }
  const compile = (source) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  assert.equal(compile(originals.get(closure)), compile(proposedSources("proposed").get(norm(closure))), "Removing the unused import must preserve emitted test code.");
  const result = { lint, comparisons, exportsUnchanged: true, functionArityUnchanged: true, testEmittedJavaScriptIdentical: true };
  fs.writeFileSync(path.join(__dirname, "inspection.json"), JSON.stringify(result, null, 2) + "\n");
  writeCandidatePatch();
  console.log(JSON.stringify(result));
}
function typecheck(mode, applicationOnly = false) {
  const configPath = path.join(web, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, web);
  const options = { ...parsed.options, incremental: false, noEmit: true, types: ["node", "react", "next", "next/image-types/global"] };
  // Project tsc excludes scripts. Include the actual two-argument consumers too.
  const callers = ["verify-global-panel-visual-system-v1.ts", "verify-two-plan-packaging-v1.ts", "verify-standard-pro-packaging-v1.ts", "verify-p1-closed-beta-closure-v1.ts"].map((name) => path.join(web, "scripts", name));
  const sources = proposedSources(mode);
  const host = ts.createCompilerHost(options);
  const originalGet = host.getSourceFile;
  host.getSourceFile = (file, languageVersion, ...rest) => sources.has(norm(file))
    ? ts.createSourceFile(file, sources.get(norm(file)), languageVersion, true)
    : originalGet(file, languageVersion, ...rest);
  host.readFile = (file) => sources.get(norm(file)) ?? ts.sys.readFile(file);
  const program = ts.createProgram({ rootNames: [...new Set([...parsed.fileNames, ...(applicationOnly ? [] : callers)])], options, host });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const result = diagnostics.map((d) => ({ code: d.code, file: d.file ? path.relative(root, d.file.fileName).replaceAll("\\", "/") : null, line: d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") }));
  fs.writeFileSync(path.join(__dirname, mode + (applicationOnly ? "-app-types" : "-types") + ".json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ mode, errors: result.length, diagnostics: result }));
  process.exitCode = diagnostics.length ? 1 : 0;
}
function runChild(args, id) {
  return new Promise((resolve) => {
    execFile(process.execPath, [__filename, ...args], { cwd: web, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      fs.writeFileSync(path.join(__dirname, id + ".log"), stdout + stderr);
      const result = { id, exitCode: error ? error.code ?? 1 : 0 };
      console.log(id + ": " + (result.exitCode === 0 ? "PASS" : "FAIL")); resolve(result);
    });
  });
}
async function runAll() {
  await inspect();
  const results = [];
  for (const mode of ["baseline", "proposed", "naive"]) results.push(await runChild(["types", mode], mode + "-types"));
  for (const mode of ["baseline", "proposed"]) results.push(await runChild(["app-types", mode], mode + "-app-types"));
  const suites = [
    ...["company-4plus1", "company-analysis-access", "company-seat-lifecycle", "company-invite-api", "company-owner-management"].map((id) => [id, "scripts/verify-" + id + "-v1.cjs"]),
    ...["standard-pro-packaging", "two-plan-packaging", "global-panel-visual-system", "p1-closed-beta-closure", "corporate-workspace-isolation", "phase4c-billing", "pro-company-monetization", "corporate-pricing-seat-policy"].map((id) => [id, "scripts/verify-" + id + "-v1.ts"]),
  ];
  const jobs = ["baseline", "proposed"].flatMap((mode) => suites.map(([id, file]) => ({ id: mode + "-" + id, args: ["suite", mode, file] })));
  for (let i = 0; i < jobs.length; i += 4) results.push(...await Promise.all(jobs.slice(i, i + 4).map((job) => runChild(job.args, job.id))));
  const hashes = [...originals].map(([file, before]) => ({ file: path.relative(root, file), before: sha(before), after: sha(fs.readFileSync(file, "utf8")) }));
  assert.ok(hashes.every((p) => p.before === p.after));
  const diagnostics = (mode) => JSON.parse(fs.readFileSync(path.join(__dirname, mode + "-types.json"), "utf8"));
  const key = ({ file, code, message }) => JSON.stringify({ file, code, message });
  const beforeTypes = new Set(diagnostics("baseline").map(key));
  const addedTypeErrors = diagnostics("proposed").filter((d) => !beforeTypes.has(key(d)));
  const naiveAddedTypeErrors = diagnostics("naive").filter((d) => !beforeTypes.has(key(d)));
  const runtimeRegressions = suites.filter(([id]) => {
    const before = results.find((r) => r.id === "baseline-" + id);
    const after = results.find((r) => r.id === "proposed-" + id);
    if (before.exitCode !== after.exitCode) return true;
    if (after.exitCode === 0) return false;
    const failures = (mode) => fs.readFileSync(path.join(__dirname, mode + "-" + id + ".log"), "utf8").split(/\r?\n/).filter((line) => line.startsWith("FAIL — "));
    return JSON.stringify(failures("baseline")) !== JSON.stringify(failures("proposed"));
  }).map(([id]) => id);
  const summary = { createdAt: new Date().toISOString(), liveDatabaseUsed: false, productionFilesChanged: false, hashes, results, addedTypeErrors, naiveAddedTypeErrors, runtimeRegressions };
  fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary));
  process.exitCode = addedTypeErrors.length || runtimeRegressions.length || results.some((r) => r.id.endsWith("-app-types") && r.exitCode !== 0) ? 1 : 0;
}
const [action = "run", mode = "proposed", file] = process.argv.slice(2);
if (action === "suite") loader(mode)(file);
else if (action === "types") typecheck(mode);
else if (action === "app-types") typecheck(mode, true);
else if (action === "inspect") inspect().catch((e) => { console.error(e); process.exitCode = 1; });
else runAll().catch((e) => { console.error(e); process.exitCode = 1; });
