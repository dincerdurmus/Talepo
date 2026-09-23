/* eslint-disable @typescript-eslint/no-require-imports -- Database-free CommonJS verification runner. */
const { createLoader } = require("./lib/isolated-typescript-loader.cjs");
const script = process.argv[2];
if (!script) throw new Error("Usage: node scripts/run-local-verifier.cjs scripts/verify-....ts");
createLoader()(script);
