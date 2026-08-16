/**
 * Opportunity card title/CTA → canonical request detail routing.
 * Run: npx tsx scripts/verify-opportunity-card-detail-routing-v1.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { opportunityRequestDetailHref } from "../src/lib/panel/opportunity-request-detail-href";

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

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function listPageFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listPageFiles(full, acc);
    } else if (entry === "page.tsx") {
      acc.push(full);
    }
  }
  return acc;
}

const REQUEST_ID = "11111111-2222-3333-4444-555555555555";
const hub = read("src/components/panel/OpportunitiesHub.tsx");
const helper = read("src/lib/panel/opportunity-request-detail-href.ts");
const feed = read("src/server/monetization/opportunities-feed.ts");
const exploreDetail = read("src/app/panel/talepler/[id]/page.tsx");
const ownerDetail = read("src/app/panel/taleplerim/[id]/page.tsx");
const offerPage = read("src/app/panel/talepler/[id]/teklif/page.tsx");
const workspaceIsolation = read("src/lib/panel/company-workspace.ts");

const canonicalHref = opportunityRequestDetailHref(REQUEST_ID);

check(
  "A OpportunityCard with real request id → existing canonical detail route",
  canonicalHref === `/panel/talepler/${REQUEST_ID}` &&
    existsSync(join(root, "src/app/panel/talepler/[id]/page.tsx")) &&
    hub.includes("opportunityRequestDetailHref(item.requestId)"),
);

check(
  "B Title and Fırsatı incele use the same destination",
  (hub.match(/opportunityRequestDetailHref\(item\.requestId\)/g) ?? []).length === 1 &&
    hub.includes("detailHref") &&
    hub.includes("Fırsatı incele") &&
    !hub.includes("`/panel/talepler/${item.requestId}`") &&
    !hub.includes("`/panel/taleplerim/${item.requestId}`"),
);

const hubWithoutRequestId = hub.replaceAll("item.requestId", "");
check(
  "C No opportunity/match id used where request id is required",
  helper.includes("Uses Request.id only") &&
    hub.includes("opportunityRequestDetailHref(item.requestId)") &&
    !hub.includes("item.matchId") &&
    !hub.includes("item.opportunityId") &&
    !hubWithoutRequestId.includes("item.id") &&
    feed.includes("requestId: req.id"),
);

check(
  "D Personal opportunity detail href uses request id + personal-capable route",
  feed.includes('context: companyId ? "WORKSPACE" : "PERSONAL"') &&
    feed.includes("matchPersonalToRequest") &&
    exploreDetail.includes("requireUser") &&
    exploreDetail.includes("ExploreRequestDetailPage") &&
    existsSync(join(root, "src/app/panel/talepler/[id]/page.tsx")),
);

check(
  "E Workspace isolation/authorization of the detail page preserved",
  exploreDetail.includes("requireUser") &&
    exploreDetail.includes("canAccessRequest") &&
    exploreDetail.includes("notFound()") &&
    offerPage.includes("createdById: { not: user.id }") &&
    ownerDetail.includes("createdById: user.id") &&
    workspaceIsolation.includes("assertCompanyMembership") &&
    !exploreDetail.includes("redirect(\"/panel/firsatlar\")"),
);

check(
  "F Invalid/missing request → no unsafe fallback in OpportunityCard",
  opportunityRequestDetailHref("") === null &&
    opportunityRequestDetailHref("   ") === null &&
    opportunityRequestDetailHref(null) === null &&
    opportunityRequestDetailHref(undefined) === null &&
    !hub.includes('href="/panel/firsatlar"') &&
    hub.includes("{detailHref ? (") &&
    helper.includes("return null"),
);

const panelPages = listPageFiles(join(root, "src/app/panel"));
const knownPages = new Set(
  panelPages.map((p) => p.replace(/\\/g, "/")).map((p) => {
    const marker = "/src/app/panel/";
    return p.slice(p.indexOf(marker) + marker.length);
  }),
);
const allowedIdPages = new Set([
  "talepler/[id]/page.tsx",
  "talepler/[id]/teklif/page.tsx",
  "taleplerim/[id]/page.tsx",
  "taleplerim/[id]/duzenle/page.tsx",
  "mesajlar/[id]/page.tsx",
  "bildirimler/r/[id]/page.tsx",
]);
const idPages = [...knownPages].filter((p) => p.includes("[id]/page.tsx"));
check(
  "G No new route file created",
  knownPages.has("talepler/[id]/page.tsx") &&
    knownPages.has("taleplerim/[id]/page.tsx") &&
    !knownPages.has("firsatlar/[id]/page.tsx") &&
    idPages.every((p) => allowedIdPages.has(p)) &&
    !helper.includes("src/app/panel") &&
    !hub.includes("src/app/panel"),
);

check(
  "Explore detail view does not 404 solely because the viewer authored the request",
  !exploreDetail.includes("createdById: { not: user.id }") &&
    exploreDetail.includes("deletedAt: null"),
);

check(
  "Explore detail is Request.id param, not a catch-all to fırsatlar",
  exploreDetail.includes("params: Promise<{ id: string }>") &&
    !exploreDetail.includes("/panel/firsatlar") &&
    exploreDetail.includes('deletedAt: null'),
);

check(
  "Offer submission still rejects the request owner",
  offerPage.includes("createdById: { not: user.id }") &&
    offerPage.includes("notFound()"),
);

for (const [name, ok] of [
  ["canonical href is not taleplerim owner surface", canonicalHref !== `/panel/taleplerim/${REQUEST_ID}`],
] as Array<[string, boolean]>) {
  check(name, ok);
}

console.log(`Opportunity card detail routing: ${pass}/${pass + fail} PASS`);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
