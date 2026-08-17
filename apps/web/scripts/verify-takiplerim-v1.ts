/**
 * Takiplerim product unification.
 * Run: npx tsx scripts/verify-takiplerim-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { projectFollowTracks } from "../src/lib/monetization/follow-tracks";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";
import { matchPersonalAgainstPreferences } from "../src/server/monetization/personal-matching-core";
import type { RequestDiscoveryProjection } from "../src/lib/discovery";

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

ensureTaxonomyLoaded();
const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const furniture = {
  version: 1 as const,
  categorySlug: "furniture",
  city: "İstanbul",
  budgetMin: 10000,
  budgetMax: 50000,
};

console.log("\n=== PROJECTION ===\n");
{
  const savedOnly = projectFollowTracks(
    [{ id: "s1", name: "İstanbul koltuk", filters: furniture }],
    [],
  );
  check("1 saved-only one card notifications off", savedOnly.length === 1 && savedOnly[0]!.notificationsOn === false && savedOnly[0]!.savedSearchId === "s1");

  const both = projectFollowTracks(
    [{ id: "s1", name: "İstanbul koltuk", filters: furniture }],
    [{ id: "a1", name: "Alarm adı", isActive: true, criteria: furniture }],
  );
  check("5 saved+alert one card notifications on", both.length === 1 && both[0]!.notificationsOn && both[0]!.alertRuleId === "a1");

  const inactive = projectFollowTracks(
    [{ id: "s1", name: "İstanbul koltuk", filters: furniture }],
    [{ id: "a1", name: "Alarm adı", isActive: false, criteria: furniture }],
  );
  check("12 inactive alert stays one card off", inactive.length === 1 && inactive[0]!.notificationsOn === false && inactive[0]!.alertRuleId === "a1");

  const legacy = projectFollowTracks(
    [],
    [{ id: "a9", name: "Eski takip", isActive: true, criteria: furniture }],
  );
  check("6 legacy alert-only not dropped", legacy.length === 1 && legacy[0]!.savedSearchId === null && legacy[0]!.notificationsOn);
  check("6 legacy has no technical copy", !legacy[0]!.name.toLowerCase().includes("legacy") && !legacy[0]!.summary.toLowerCase().includes("alertrule"));
}

console.log("\n=== ROUTES / NAV ===\n");
{
  const nav = read("src/components/panel/panel-nav.ts");
  const shell = read("src/components/panel/PanelShell.tsx");
  const kayitli = read("src/app/panel/kayitli-aramalar/page.tsx");
  const uyarilar = read("src/app/panel/uyarilar/page.tsx");
  const page = read("src/app/panel/takiplerim/page.tsx");
  const manager = read("src/components/panel/FollowTracksManager.tsx");
  check("canonical route page exists", page.includes("Takiplerim") && page.includes("projectFollowTracks"));
  check("7 uyarilar redirect", uyarilar.includes('redirect("/panel/takiplerim")'));
  check("8 kayitli-aramalar redirect", kayitli.includes('redirect("/panel/takiplerim")'));
  check("14 nav has Takiplerim only", nav.includes('label: "Takiplerim"') && !nav.includes('label: "Alarmlar"') && !nav.includes('label: "Kayıtlı aramalar"'));
  check("14 sidebar groups Takiplerim", shell.includes("/panel/takiplerim") && !shell.includes('"/panel/uyarilar", "/panel/kayitli-aramalar"'));
  check("9 Aramayı aç", manager.includes("Aramayı aç") && manager.includes("track.runUrl"));
  check("4 toggle uses setFromSavedSearch", manager.includes("setFromSavedSearch"));
  check("10 locked notifications when no alert entitlement", manager.includes("alertsEnabled") && manager.includes("/panel/plan"));
  check("16 rename is not fake criteria edit", manager.includes("Yeniden adlandır") && !manager.includes(">Düzenle<"));
  check("18 empty state", manager.includes("Henüz bir takibiniz yok.") && manager.includes("Talepleri keşfet"));
}

console.log("\n=== OPPORTUNITY REASON DEDUPE ===\n");
{
  const projection: RequestDiscoveryProjection = {
    version: 1,
    kind: "discovery_projection",
    taxonomyNodeIds: ["tax:furniture"],
    primaryLeafId: "tax:furniture",
    categoryId: "furniture",
    attributes: {},
    constraints: {},
    matchContract: { must: [], preferred: [], excluded: [], anyFields: [], ranges: [] },
    filterContract: { include: {}, exclude: {}, preferred: {}, range: {}, any: [] },
    builtAt: "2026-08-17T00:00:00.000Z",
  };
  const hit = matchPersonalAgainstPreferences(
    projection,
    [
      { kind: "saved_search", name: "İstanbul Yönetici Koltuğu", criteria: furniture, fingerprint: "same" },
      { kind: "alert_rule", name: "İstanbul Yönetici Koltuğu", criteria: furniture, fingerprint: "same" },
    ],
    { title: "Koltuk", city: "İstanbul", budgetMin: 20000, budgetMax: 20000 },
  );
  check(
    "13 duplicate follow reason collapsed",
    hit.reasons.length === 1 && hit.reasons[0] === "Takibinizle eşleşiyor: İstanbul Yönetici Koltuğu",
  );
}

console.log("\n=== AUTHORITY PRESERVED ===\n");
{
  const criteria = read("src/lib/monetization/preference-criteria.ts");
  const matcher = read("src/server/monetization/alert-matching.ts");
  const alerts = read("src/app/api/monetization/alerts/route.ts");
  check("criteria authority unchanged", criteria.includes("evaluatePreferenceCriteria") && criteria.includes("evaluateDiscoveryFilter"));
  check("alert matching still shared evaluator", matcher.includes("evaluatePreferenceCriteria"));
  check("reactivate rather than duplicate", alerts.includes("setFromSavedSearch") && alerts.includes("reactivated"));
}

console.log(`\n=== SUMMARY pass=${pass} fail=${fail} ===\n`);
if (errors.length) {
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
console.log("Takiplerim verifier passed.");
process.exit(0);
