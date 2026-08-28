/**
 * One answer to "is this file the process the user actually started?".
 *
 * Every acceptance CLI must be inert when imported. Without a gate, importing a
 * script to read one exported helper starts that script: a verifier that only
 * wanted `buildAcceptanceRequestTitle` from the core-commerce runner would run
 * the whole end-to-end scenario against the real database instead.
 *
 * Pure module: no filesystem, no network, no process.env mutation.
 */

import { realpathSync } from "node:fs";
import { resolve } from "node:path";

/**
 * True only for the module that node/tsx was told to execute.
 *
 * Callers pass their own `module`, so the decision is made about the caller and
 * not about this file. Paths are compared after `realpath` because a symlinked
 * or differently-cased invocation on Windows would otherwise look like a
 * different file and leave the CLI silently inert.
 *
 * This harness is CommonJS: `apps/web/package.json` declares no `"type"`, and
 * these scripts already use `__dirname`. If it is ever moved to ESM, `module`
 * stops existing at the CALL SITE, so every call site changes with it — the
 * `argv[1]` comparison below is a second reading for odd launchers, not an ESM
 * fallback, and claiming otherwise would describe a defence that is not there.
 */
export function isAcceptanceCliEntrypoint(callerModule: NodeModule | undefined): boolean {
  if (callerModule && require.main === callerModule) return true;

  // Secondary reading for launchers that leave `require.main` unset: compare the
  // path node was given with the caller's own. This whole function is wrapped
  // because a THROW here would escape the CLI's own catch boundary and print a
  // raw stack with absolute paths — the one output shape this harness forbids.
  try {
    const invoked = canonical(process.argv[1]);
    const self = canonical(callerModule?.filename);
    return invoked !== null && invoked === self;
  } catch {
    return false;
  }
}

/** Resolve, follow symlinks, and normalise so two spellings of one file match. */
function canonical(path: string | undefined): string | null {
  if (typeof path !== "string" || path === "") return null;
  const absolute = resolve(path);
  let real = absolute;
  try {
    real = realpathSync.native ? realpathSync.native(absolute) : realpathSync(absolute);
  } catch {
    // A path that cannot be resolved is compared as written rather than thrown on;
    // a wrong answer here must not crash a CLI before its own guards run.
  }
  const normalised = real.replace(/\\/g, "/");
  // Case-folding is correct on Windows and WRONG elsewhere, where `Foo.ts` and
  // `foo.ts` are two files and folding would call an imported module the entry.
  return stripExtension(process.platform === "win32" ? normalised.toLowerCase() : normalised);
}

/**
 * `tsx a.ts` and a compiled `a.js` are the same entrypoint. Only the known
 * script extensions are stripped, so `a.ts` and `a.tsx` stay distinct files.
 */
function stripExtension(path: string): string {
  return path.replace(/\.(?:m|c)?[jt]s$/, "");
}
