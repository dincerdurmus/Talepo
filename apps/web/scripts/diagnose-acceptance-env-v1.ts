/**
 * Safe structural diagnostic for .env.acceptance — never prints secrets.
 * Run: npx --yes tsx scripts/diagnose-acceptance-env-v1.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ACCEPTANCE_ENV_PATH = join(__dirname, "..", ".env.acceptance");

function redactUrl(url: string): string {
  return url
    .replace(/:([^:@/]+)@/, ":***@")
    .replace(/^([^:]+:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
}

function diagnoseValue(key: string, value: string) {
  const issues: string[] = [];
  const trimmed = value.trim();

  if (value !== trimmed) issues.push("leading/trailing whitespace on value");
  if (value.includes("<") || value.includes(">")) issues.push("contains angle brackets");
  if (value.includes("[YOUR-PASSWORD]") || value.includes("[PASSWORD]"))
    issues.push("contains password placeholder");
  if (
    (value.startsWith('"') && !value.endsWith('"')) ||
    (value.startsWith("'") && !value.endsWith("'")) ||
    (value.endsWith('"') && !value.startsWith('"')) ||
    (value.endsWith("'") && !value.startsWith("'"))
  ) {
    issues.push("unbalanced quotes");
  }
  if (value.includes(" ")) issues.push("contains spaces");
  if (key.includes("URL") && !/^postgres(?:ql)?:\/\//i.test(trimmed)) {
    issues.push("does not start with postgres:// or postgresql://");
  }

  try {
    const normalized = trimmed
      .replace(/^postgresql:/i, "http:")
      .replace(/^postgres:/i, "http:");
    new URL(normalized);
  } catch (e) {
    issues.push(`URL parse fail: ${e instanceof Error ? e.message : String(e)}`);
    if (!trimmed.includes("://")) issues.push("missing ://");
    const atCount = (trimmed.match(/@/g) || []).length;
    if (atCount !== 1) issues.push(`at-sign count: ${atCount} (expected 1)`);
    const match = trimmed.match(/^postgres(?:ql)?:\/\/([^@]+)@/);
    if (match) {
      const userPass = match[1]!;
      if (userPass.includes("#")) issues.push("password may contain unencoded #");
      if (userPass.includes("?")) issues.push("password may contain unencoded ?");
      if (userPass.includes("&")) issues.push("password may contain unencoded &");
      if (userPass.includes("/")) issues.push("userinfo may contain unencoded /");
    } else if (/^postgres(?:ql)?:\/\//i.test(trimmed)) {
      issues.push("missing @ separator in authority");
    }
  }

  return {
    issues,
    safePreview: key.includes("URL")
      ? redactUrl(trimmed.slice(0, 100) + (trimmed.length > 100 ? "..." : ""))
      : trimmed,
  };
}

function main() {
  if (!existsSync(ACCEPTANCE_ENV_PATH)) {
    console.log("FILE EXISTS: no");
    process.exit(1);
  }

  const raw = readFileSync(ACCEPTANCE_ENV_PATH, "utf8");
  const lines = raw.split(/\r?\n/);
  const keyLines: Record<string, number> = {};
  const results: Array<{
    key: string;
    lineNum: number;
    hadQuotes: boolean;
    issues: string[];
    safePreview: string;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    const rawValue = value;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (keyLines[key]) {
      results.push({
        key,
        lineNum: i + 1,
        hadQuotes: false,
        issues: [`DUPLICATE KEY (first at line ${keyLines[key]})`],
        safePreview: "(duplicate)",
      });
    } else {
      keyLines[key] = i + 1;
    }

    if (key === "DATABASE_URL" || key === "DIRECT_URL" || key === "TALEPO_ENVIRONMENT") {
      const { issues, safePreview } = diagnoseValue(key, value);
      results.push({
        key,
        lineNum: i + 1,
        hadQuotes: rawValue !== value,
        issues,
        safePreview,
      });
    }
  }

  console.log("=== SAFE ENV DIAGNOSTIC (no secrets) ===");
  console.log("FILE EXISTS: yes");
  console.log("LINE COUNT:", lines.length);
  console.log("BOM:", raw.charCodeAt(0) === 0xfeff ? "yes" : "no");
  console.log("CRLF:", raw.includes("\r\n") ? "yes" : "no");
  console.log("ALL KEYS:", Object.keys(keyLines).join(", "));

  for (const r of results) {
    console.log("");
    console.log(`KEY: ${r.key} LINE: ${r.lineNum}`);
    if (r.hadQuotes) console.log("QUOTES STRIPPED: yes");
    console.log("SAFE PREVIEW:", r.safePreview);
    console.log("ISSUES:", r.issues.length ? r.issues.join("; ") : "none detected");
  }
}

main();
