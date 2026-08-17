/**
 * Start Next.js dev against staging .env.acceptance only (+ minimal local auth vars).
 * Does not load .env or .env.local.
 */
import { spawn } from "node:child_process";

import "./lib/load-acceptance-env";

process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "acceptance-local-smoke-dev-only-v1";
process.env.NODE_ENV = "development";

if (process.env.TALEPO_ENVIRONMENT !== "acceptance") {
  console.error("FAIL — TALEPO_ENVIRONMENT must be acceptance");
  process.exit(1);
}

console.log("ACCEPTANCE DEV: starting Next.js on http://localhost:3000");
console.log("DB: staging via .env.acceptance only");
console.log("SECRETS PRINTED: no");

const child = spawn("npx", ["next", "dev", "-p", "3000"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
