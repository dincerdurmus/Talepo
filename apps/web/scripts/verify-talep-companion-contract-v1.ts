/**
 * Static /talep companion contract: page.tsx ↔ TalepoAiPanel ↔ EnrichmentChips.
 * Run from apps/web: npx tsx scripts/verify-talep-companion-contract-v1.ts
 *
 * Proves the recovered UI companions satisfy HEAD page props without
 * depending on Explore filter WIP.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const pagePath = join(root, "src/app/talep/page.tsx");
const panelPath = join(root, "src/components/request/TalepoAiPanel.tsx");
const chipsPath = join(root, "src/components/request/EnrichmentChips.tsx");

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

function extractInterfaceProps(
  src: string,
  typeName: string,
): Map<string, { optional: boolean }> {
  const start = src.indexOf(`export type ${typeName}`);
  if (start < 0) throw new Error(`type ${typeName} not found`);
  const brace = src.indexOf("{", start);
  const props = new Map<string, { optional: boolean }>();
  let depth = 0;
  let token = "";
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      if (depth === 1) {
        const line = token.replace(/\/\*.*?\*\//g, "").trim();
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:/);
        if (m) props.set(m[1], { optional: Boolean(m[2]) });
      }
      depth += 1;
      token = "";
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      token = "";
      if (depth === 0) break;
      continue;
    }
    if (depth !== 1) continue;
    if (ch === "\n" || ch === ";") {
      const line = token.replace(/\/\*.*?\*\//g, "").trim();
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:/);
      if (m) props.set(m[1], { optional: Boolean(m[2]) });
      token = "";
      continue;
    }
    token += ch;
  }
  return props;
}

function skipBraces(src: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\" ) {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return src.length;
}

function extractJsxPropNames(src: string, tag: string): string[] {
  /**
   * YORUMLAR ÖNCE SOYULUR (2026-08-31). skipBraces tek tırnağı dize
   * açılışı sayar; prop gövdesindeki Türkçe kesme işaretli YORUM
   * ("Talepo'nun") sahte bir dize açıp süslü parantezleri yutuyor ve
   * kapı, sayfa GERÇEKTE geçirdiği prop'ları görmeden kırmızıya
   * düşüyordu (tabanda da aynı — tarihsel doğrulayıcı kusuru). Ölçülen
   * şey üretim JSX'idir; yorum metni ölçüme giremez.
   */
  src = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const start = src.search(new RegExp(`<${tag}\\b`));
  if (start < 0) throw new Error(`<${tag} not found`);
  const names: string[] = [];
  let i = start + tag.length + 1;
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i += 1;
    if (src.startsWith("/>", i)) break;
    if (src[i] === ">") break;
    const ident = src.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (!ident) {
      i += 1;
      continue;
    }
    i += ident[1].length;
    while (i < src.length && /\s/.test(src[i])) i += 1;
    if (src[i] === "=") {
      names.push(ident[1]);
      i += 1;
      while (i < src.length && /\s/.test(src[i])) i += 1;
      if (src[i] === "{") i = skipBraces(src, i);
      else if (src[i] === '"' || src[i] === "'") {
        const q = src[i];
        i += 1;
        while (i < src.length && src[i] !== q) i += 1;
        i += 1;
      }
    }
  }
  return names;
}

const page = readFileSync(pagePath, "utf8");
const panel = readFileSync(panelPath, "utf8");
const chips = readFileSync(chipsPath, "utf8");

check(
  "page imports TalepoAiPanel",
  /from ["']@\/components\/request\/TalepoAiPanel["']/.test(page),
);
const filters = readFileSync(
  join(root, "src/lib/explore/category-filters.ts"),
  "utf8",
).replace(/\s+/g, " ");
check(
  "page does not import ExploreCategoryFilterBar",
  !page.includes("ExploreCategoryFilterBar"),
);
check(
  "HEAD page already calls getExploreFilterDefs with 2 args",
  /getExploreFilterDefs\s*\(\s*activeCategoryId\s*,\s*dynamicValues\s*\)/.test(
    page,
  ),
);
check(
  "getExploreFilterDefs 2nd arg is optional (TSC companion, not Explore bar)",
  /export function getExploreFilterDefs\s*\(\s*categorySlug: string, context:/.test(
    filters,
  ),
);
check(
  "panel imports EnrichmentChips",
  /from ["']@\/components\/request\/EnrichmentChips["']/.test(panel),
);
check(
  "panel uses EnrichmentChips variant dark",
  /<EnrichmentChips[\s\S]*?variant=["']dark["']/.test(panel),
);
check(
  "EnrichmentChips accepts variant",
  /variant\?\s*:\s*"light"\s*\|\s*"dark"/.test(chips),
);

const panelProps = extractInterfaceProps(panel, "TalepoAiPanelProps");
const passed = extractJsxPropNames(page, "TalepoAiPanel");
const required = [...panelProps.entries()]
  .filter(([, v]) => !v.optional)
  .map(([k]) => k);
const unknownPassed = passed.filter((k) => !panelProps.has(k));
const missingRequired = required.filter((k) => !passed.includes(k));

check(
  "page passes enrichmentCandidates",
  passed.includes("enrichmentCandidates"),
);
check(
  "panel requires enrichmentCandidates",
  panelProps.get("enrichmentCandidates")?.optional === false,
);
check(
  "humanQuestions is optional on panel (HEAD compat)",
  panelProps.get("humanQuestions")?.optional === true,
);
check(
  "page does not depend on required humanQuestions",
  !passed.includes("humanQuestions"),
);
check(
  "no unknown props passed to TalepoAiPanel",
  unknownPassed.length === 0,
  unknownPassed.join(", "),
);
check(
  "all required TalepoAiPanel props are passed by page",
  missingRequired.length === 0,
  missingRequired.join(", "),
);

for (const key of [
  "enrichmentFieldKey",
  "enrichmentDraft",
  "onEnrichmentSelect",
  "onEnrichmentDraftChange",
  "onEnrichmentApply",
  "onEnrichmentCancel",
]) {
  check(`page passes ${key}`, passed.includes(key));
}

console.log(`\nCompanion contract: ${pass} PASS / ${fail} FAIL`);
if (errors.length) {
  console.log("Failures:");
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
