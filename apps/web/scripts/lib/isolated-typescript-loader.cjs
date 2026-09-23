/* eslint-disable @typescript-eslint/no-require-imports -- Database-free CommonJS verification runner. */
// Local, database-free verifier loader. External services must be explicitly stubbed.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const web = path.resolve(__dirname, "../..");
const ts = require(path.join(web, "node_modules/typescript"));

function createLoader(stubs = {}) {
  const cache = new Map();
  const defaults = {
    "@/lib/prisma": { prisma: new Proxy({}, { get() { throw new Error("Database access is disabled in local verifiers."); } }) },
    "server-only": {},
  };
  const modules = { ...defaults, ...stubs };
  function load(filename) {
    // Relative imports must obey the same database boundary as the @/ alias.
    if (path.resolve(filename) === path.join(web, "src/lib/prisma.ts")) return modules["@/lib/prisma"];
    if (cache.has(filename)) return cache.get(filename).exports;
    if (filename.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
    const record = { exports: {} };
    cache.set(filename, record);
    const nativeRequire = createRequire(filename);
    function localRequire(id) {
      if (Object.hasOwn(modules, id)) return modules[id];
      let target;
      if (id.startsWith("@/")) target = path.join(web, "src", id.slice(2));
      else if (id.startsWith("@talepo-data/")) target = path.join(web, "../../data", id.slice(13));
      else if (id.startsWith(".")) target = path.resolve(path.dirname(filename), id);
      else return nativeRequire(id);
      const candidates = [target, ...[".ts", ".tsx", ".mts", ".js", ".json", "/index.ts", "/index.tsx"].map((ext) => target + ext)];
      const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!resolved) return nativeRequire(id);
      return load(resolved);
    }
    localRequire.resolve = (id) => nativeRequire.resolve(id);
    let source = fs.readFileSync(filename, "utf8").replaceAll("import.meta.url", JSON.stringify(pathToFileURL(filename).href));
    if (/\.(ts|tsx|mts)$/.test(filename)) {
      source = ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      }).outputText;
    }
    const execute = vm.runInThisContext("(function(exports,require,module,__filename,__dirname){" + source + "\n})", { filename });
    execute(record.exports, localRequire, record, filename, path.dirname(filename));
    return record.exports;
  }
  return (relative) => load(path.resolve(web, relative));
}
module.exports = { createLoader, web };
