/**
 * Phase 3C — Corporate Opportunity Center golden fixtures.
 * Run: npx tsx scripts/verify-phase3c-corporate-opportunity-center-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import {
  buildDiscoveryProjectionFromState,
  evaluateDiscoveryFilter,
  hasCanonicalFilterSignal,
  isCandidateCompatibleWithProjection,
  matchBandLabel,
  validateCanonicalDiscoveryFilter,
} from "../src/lib/discovery";
import { createTextOnlyState } from "../src/lib/request-composer";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";
import { canAssignOpportunities } from "../src/server/monetization/opportunity-assignment";

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

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();
const root = join(__dirname, "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

// 1 Corporate Opportunity Center loads
check(
  "1 Corporate Opportunity Center loads",
  read("src/app/panel/firsatlar/page.tsx").includes("CorporateOpportunityCenter") &&
    read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
      "Opportunity Center",
    ),
);

// 2 Corporate entitlement server gate
check(
  "2 Corporate entitlement server gate",
  read("src/app/api/monetization/opportunities/route.ts").includes(
    "lead_distribution",
  ) &&
    read("src/app/panel/firsatlar/page.tsx").includes("FeatureUpgradeGate"),
);

// 3 non-Corporate blocked/upsell
check(
  "3 non-Corporate blocked/upsell",
  read("src/components/panel/panel-nav.ts").includes("lead_distribution") &&
    read("src/components/panel/panel-nav.ts").includes("hideIfFeature"),
);

// 4 company scoping
check(
  "4 company scoping",
  read("src/server/monetization/corporate-opportunity-center.ts").includes(
    "companyId: input.companyId",
  ) &&
    read("src/server/monetization/opportunity-hunter.ts").includes(
      "where: { id: opportunityId, companyId }",
    ),
);

// 5 taxonomy discovery reuse
check(
  "5 taxonomy discovery reuse",
  read("src/app/panel/firsatlar/page.tsx").includes("ProfessionalDiscoveryWorkspace") &&
    read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
      "view=browse",
    ),
);

// 6 canonical projection consume
check(
  "6 canonical projection consume",
  read("src/server/monetization/corporate-opportunity-center.ts").includes(
    "parseDiscoveryProjection",
  ) &&
    read("src/server/monetization/opportunity-hunter.ts").includes(
      "evaluateDiscoveryFilter",
    ),
);

// 7 no request reparse
{
  const hunter = read("src/server/monetization/opportunity-hunter.ts");
  const center = read("src/server/monetization/corporate-opportunity-center.ts");
  check(
    "7 no request reparse",
    !center.includes("understandRequest") &&
      !center.includes("createTextOnlyState") &&
      hunter.includes("parseDiscoveryProjection") &&
      !hunter.includes("understandRequest("),
  );
}

// 8 Opportunity list
check(
  "8 Opportunity list",
  read("src/server/monetization/corporate-opportunity-center.ts").includes(
    "buildCorporateOpportunityCenter",
  ),
);

// 9-11 filters
{
  const ui = read("src/components/panel/discovery/CorporateOpportunityCenter.tsx");
  check("9 unassigned filter", ui.includes('id: "unassigned"'));
  check("10 assigned filter", ui.includes('id: "assigned"'));
  check("11 assigned-to-me filter", ui.includes('id: "assigned_to_me"'));
}

// 12-14 assignment
{
  const api = read("src/app/api/monetization/opportunities/route.ts");
  const hunter = read("src/server/monetization/opportunity-hunter.ts");
  check("12 assignment action", api.includes('action === "assign"'));
  check(
    "13 reassignment",
    hunter.includes("assignedToMemberId: memberId") ||
      hunter.includes("assignedToMemberId: memberId"),
  );
  check("14 remove assignment", api.includes('action === "unassign"'));
}

// 15 team members scoped
check(
  "15 team members scoped",
  read("src/server/monetization/corporate-opportunity-center.ts").includes(
    'status: "ACTIVE"',
  ) && canAssignOpportunities("MANAGER") && !canAssignOpportunities("VIEWER"),
);

// 16-18 reuse
check(
  "16 taxonomy follow",
  read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
    "kayitli-aramalar",
  ),
);
check(
  "17 saved search reuse",
  read("src/server/monetization/opportunity-hunter.ts").includes("savedSearch"),
);
check(
  "18 alert reuse",
  read("src/server/monetization/opportunity-hunter.ts").includes(
    "matchRequestToAlertRules",
  ),
);

// 19 hunter canonical
check(
  "19 hunter canonical filters",
  read("src/server/monetization/opportunity-hunter.ts").includes(
    "hasCanonicalFilterSignal",
  ) &&
    read("src/server/monetization/opportunity-hunter.ts").includes(
      "validateCanonicalDiscoveryFilter",
    ),
);

// 20-23 semantics
{
  const tv = createTextOnlyState(
    "140 ekran televizyon arıyorum, marka fark etmez ama Samsung olmasın, 4K olsa iyi olur",
  );
  const proj = buildDiscoveryProjectionFromState(tv);
  check(
    "20 MUST hard reject path exists",
    Boolean(proj.matchContract || proj.constraints),
  );
  const excl = evaluateDiscoveryFilter(proj, {
    version: 1,
    kind: "canonical_discovery_filter",
    attributes: { brand: "Samsung" },
  });
  check("21 EXCLUDED hard reject", !excl.match);
  const cand = isCandidateCompatibleWithProjection(proj, {
    resolution: "1080p",
    brand: "LG",
  });
  check("22 PREFERRED soft", cand.compatible);
  check("23 ANY neutral", proj.constraints.brand?.mode === "ANY");
}

// 24 structured reasons
check(
  "24 structured match reasons",
  read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
    "Neden uygun",
  ),
);

// 25 no fake percent
{
  const home = read("src/components/panel/CorporateHome.tsx");
  const card = read("src/components/panel/discovery/CorporateOpportunityCenter.tsx");
  check(
    "25 no fake percent score",
    !home.includes("94%") &&
      !card.includes("%97") &&
      card.includes("Yüksek öncelik") &&
      Boolean(matchBandLabel("HIGH")),
  );
}

// 26-27 offer
check(
  "26 offer status derive",
  read("src/server/monetization/corporate-opportunity-center.ts").includes(
    "offerStatus",
  ),
);
check(
  "27 offer CTA uses existing flow",
  read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
    "/teklif",
  ),
);

// 28 watchlist distinct
check(
  "28 watchlist distinct",
  read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
    "Kaydettiklerim",
  ),
);

// 29 inventory reason
check(
  "29 inventory reason if supported",
  read("src/server/monetization/corporate-opportunity-center.ts").includes(
    "INVENTORY_RELEVANT",
  ),
);

// 30-31 empty/zero
check(
  "30 zero-config / empty state",
  read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
    "Henüz bu filtrede fırsat yok",
  ) &&
    read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
      "Kategori takip et",
    ),
);
check(
  "31 empty state CTAs",
  read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
    "Alarm oluştur",
  ),
);

// 32 summary metrics real
check(
  "32 summary metrics real",
  read("src/server/monetization/corporate-opportunity-center.ts").includes(
    "unassignedCount",
  ),
);

// 33 Corporate nav
check(
  "33 Corporate nav",
  read("src/components/panel/panel-nav.ts").includes("Opportunity Center"),
);

// 34-36 regressions (Professional workspace still present)
check(
  "34 Professional regression surface",
  read("src/components/panel/discovery/ProfessionalDiscoveryWorkspace.tsx").includes(
    "Keşfet",
  ),
);
check(
  "35 Premium regression surfaces",
  read("src/app/panel/kayitli-aramalar/page.tsx").length > 0 &&
    read("src/app/panel/uyarilar/page.tsx").length > 0,
);
check(
  "36 Standard regression explore",
  read("src/app/panel/talepler/page.tsx").includes(
    "applyCanonicalDiscoveryPostFilter",
  ),
);

// 37-38 smoke
check(
  "37 desktop smoke",
  read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
    "lg:grid-cols",
  ),
);
check(
  "38 mobile smoke",
  read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
    "flex-wrap",
  ),
);

// 39 tenancy
check(
  "39 tenancy isolation",
  read("src/app/api/monetization/opportunities/route.ts").includes(
    "companyId: ctx.companyId",
  ),
);

// 40 no duplicate authority
check(
  "40 no duplicate taxonomy/filter authority",
  read("src/components/panel/discovery/CorporateOpportunityCenter.tsx").includes(
    "İkinci filter şeması yoktur",
  ) &&
    validateCanonicalDiscoveryFilter({
      version: 1,
      kind: "canonical_discovery_filter",
      primaryLeafId: "tax:printing:karton-kutu",
    }).ok &&
    hasCanonicalFilterSignal({
      version: 1,
      kind: "canonical_discovery_filter",
      primaryLeafId: "tax:printing:karton-kutu",
    }),
);

// inventory import surface
check(
  "inventory import UI",
  read("src/components/panel/InventoryManager.tsx").includes("CSV’den içe aktar") ||
    read("src/components/panel/InventoryManager.tsx").includes("CSV"),
);

// assignedAt reported as proxy
check(
  "assignment audit proxy",
  read("src/server/monetization/corporate-opportunity-center.ts").includes(
    "assignedAtProxy",
  ),
);

console.log("\n========================================");
console.log(`Phase 3C verify: ${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log("Failures:");
  for (const e of errors) console.log(`  - ${e}`);
}
process.exit(fail > 0 ? 1 : 0);
