/**
 * Guard against corrupted Next.js dev route types that drop nested app routes.
 * Run automatically before `next dev` via package.json.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const routesFile = join(root, ".next", "dev", "types", "routes.d.ts");
const devCache = join(root, ".next", "dev");

function isCorruptedRoutesFile(content: string): boolean {
  const appRouteCount = (content.match(/type AppRoutes =/g) ?? []).length;
  if (appRouteCount > 1) return true;

  const trimmed = content.trimEnd();
  if (!trimmed.endsWith("}")) return true;

  const offerRoute = '"/panel/talepler/[id]/teklif"';
  if (content.includes("type AppRoutes =") && !content.includes(offerRoute)) {
    return true;
  }

  // Mid-file truncation leaves dangling route fragments (observed in prod builds).
  if (/^\s*etization\//m.test(content)) return true;

  return false;
}

if (!existsSync(routesFile)) {
  process.exit(0);
}

const content = readFileSync(routesFile, "utf8");
if (!isCorruptedRoutesFile(content)) {
  process.exit(0);
}

console.warn(
  "[talepo] Corrupted .next/dev route types detected — clearing dev cache so offer routes register.",
);
rmSync(devCache, { recursive: true, force: true });
