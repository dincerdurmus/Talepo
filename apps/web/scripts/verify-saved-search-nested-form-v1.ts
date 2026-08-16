/**
 * Saved Search nested-form hydration fix V1
 * Run: npx tsx scripts/verify-saved-search-nested-form-v1.ts
 *
 * Static source checks only — no product-contract or API changes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const root = join(__dirname, "..");
const bar = readFileSync(
  join(root, "src/components/panel/ExploreCategoryFilterBar.tsx"),
  "utf8",
);
const save = readFileSync(
  join(root, "src/components/panel/SaveExploreSearchButton.tsx"),
  "utf8",
);

const barForms = bar.match(/<form\b/g) ?? [];
const formBlock = bar.match(/<form[\s\S]*?<\/form>/);
const buttons = [...save.matchAll(/<button[\s\S]*?<\/button>/g)].map((m) => m[0]);
const openBtn = buttons.find((b) => b.includes("Aramayı kaydet"));
const saveBtn = buttons.find((b) => />\s*Kaydet\s*</.test(b) || /animate-spin[\s\S]*Kaydet/.test(b));
const cancelBtn = buttons.find((b) => b.includes("İptal"));
const enterCallsStop =
  /key === ["']Enter["'][\s\S]{0,180}stopParentForm/.test(save) ||
  /key === ["']Enter["'][\s\S]{0,180}preventDefault[\s\S]{0,80}stopPropagation/.test(save);

console.log("\n=== OUTER FILTER FORM ===\n");
check("1 ExploreCategoryFilterBar has method=\"get\"", /method=["']get["']/.test(bar));
check("2 ExploreCategoryFilterBar has exactly one <form", barForms.length === 1, `found ${barForms.length}`);
check("3 Filtrele remains type=\"submit\"", /type=["']submit["'][\s\S]{0,240}Filtrele/.test(bar));
check("4 SaveExploreSearchButton imported", bar.includes('from "./SaveExploreSearchButton"'));
check(
  "5 SaveExploreSearchButton used inside the GET form",
  Boolean(formBlock?.[0].includes("<SaveExploreSearchButton")),
);

console.log("\n=== INNER FORM REMOVED ===\n");
check("6 SaveExploreSearchButton has no <form", !/<form\b/.test(save));
check("7 popup is a div panel", /role=["']dialog["']/.test(save) || /<div[\s\S]{0,200}absolute right-0 top-full/.test(save));
check("8 open toggle is type=\"button\"", Boolean(openBtn?.includes('type="button"')));
check("9 Kaydet is type=\"button\"", Boolean(saveBtn?.includes('type="button"')));
check("10 İptal is type=\"button\"", Boolean(cancelBtn?.includes('type="button"')));
check("11 no type=\"submit\" in save popup", !/type=["']submit["']/.test(save));

console.log("\n=== KEYBOARD / PARENT SUBMIT ===\n");
check(
  "12 Enter handler preventDefault+stopPropagation",
  enterCallsStop &&
    save.includes("preventDefault") &&
    save.includes("stopPropagation"),
);
check("13 handleSave still early-returns on empty name", /const trimmed = name\.trim\(\);\s*if \(!trimmed\) return;/.test(save));
check("14 Escape closes popup", /key === ["']Escape["']/.test(save) && /setOpen\(false\)/.test(save));
check("15 if (!enabled) return null", /if\s*\(!enabled\)\s*return null/.test(save));

console.log("\n=== SAVED SEARCH PAYLOAD ===\n");
check("16 exploreFiltersToSavedSearch used", save.includes("exploreFiltersToSavedSearch"));
check("17 POST /api/monetization/saved-searches", save.includes('"/api/monetization/saved-searches"'));
check("18 action: \"create\"", save.includes('action: "create"'));
check("19 name: trimmed in body", /name:\s*trimmed/.test(save));
check("20 filters: payload in body", /filters:\s*payload/.test(save));

console.log("\n=== NESTED FORM PATTERN ===\n");
check(
  "21 no nested form: used inside bar form AND save has no form",
  Boolean(formBlock?.[0].includes("<SaveExploreSearchButton")) && !/<form\b/.test(save),
);

console.log(`\n=== SUMMARY pass=${pass} fail=${fail} ===\n`);
if (errors.length) {
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
console.log("Saved search nested-form verifier passed.");
process.exit(0);
