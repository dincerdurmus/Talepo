/**
 * Signal Analytics Experience V1 — Analiz surface contracts.
 * Run: npx tsx scripts/verify-analysis-signal-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { featuresForPlan } from "../src/lib/membership/entitlements";
import { hasAdvancedAnaliz } from "../src/lib/monetization/analiz-access";
import {
  ANALYSIS_ROLE_TABS,
  analysisHeadlineInsight,
  analysisWorkspaceCopy,
  buyerFlowSteps,
  displayEmptyMetric,
  resolveAnalysisNextStep,
  sellerFlowSteps,
} from "../src/lib/panel/analysis-signal";
import type { WorkspacePerformanceMetrics } from "../src/lib/monetization/types";

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

const page = read("src/app/panel/analiz/page.tsx");
const dash = read("src/components/panel/AnalyticsDashboard.tsx");
const route = read("src/app/api/monetization/analytics/route.ts");
const css = read("src/app/globals.css");
const helper = read("src/lib/panel/analysis-signal.ts");
const nav = read("src/components/panel/panel-nav.ts");
const shell = read("src/components/panel/PanelShell.tsx");

const forbiddenCopy = /[—–]|--/;

console.log("\n=== SIGNAL SURFACE ===\n");
check("eyebrow PERFORMANS MERKEZİ", dash.includes("PERFORMANS MERKEZİ"));
check("page H1 Analiz", page.includes(">Analiz<"));
check(
  "plan and workspace chips",
  dash.includes("planLabel") && dash.includes("workspaceLabel"),
);
check(
  "no oversized marketing hero title class",
  !page.includes("talepo-beacon-title") && !dash.includes("talepo-beacon-hero"),
);
check(
  "teal ink frost family",
  css.includes(".talepo-analysis-banner") &&
    dash.includes("talepo-analysis") &&
    page.includes("talepo-beacon-shell"),
);
check(
  "reduced motion for analysis motion",
  css.includes("prefers-reduced-motion") &&
    css.includes(".talepo-analysis-metric"),
);

console.log("\n=== BUYER SELLER SEPARATION ===\n");
check(
  "role tabs exist",
  ANALYSIS_ROLE_TABS.map((tab) => tab.label).join("|") ===
    "Genel|Alıcı olarak|Satıcı olarak" &&
    dash.includes("Alıcı olarak") &&
    dash.includes("Satıcı olarak"),
);
check(
  "overview does not invent a mixed win rate from requests plus offers",
  dash.includes("Alıcı olarak, yayın tarihine göre") &&
    dash.includes("Satıcı olarak, gönderim tarihine göre"),
);
{
  const personal: WorkspacePerformanceMetrics = {
    scope: "personal",
    companyName: null,
    requests: {
      published: 4,
      active: 2,
      withOffers: 1,
      withoutOffers: 3,
      totalOffersReceived: 5,
      averageOffersPerRequest: 1.2,
      acceptedOutcome: 1,
    },
    offers: {
      submitted: 8,
      accepted: 2,
      pending: 3,
      rejected: 1,
      unsuccessful: 2,
      winRate: 0.25,
      winRatePresentation: "percent",
      completedTransactions: 1,
      averageOfferLatencyHours: 4,
    },
  };
  const buyer = buyerFlowSteps(personal);
  const seller = sellerFlowSteps(personal);
  check(
    "buyer flow ignores seller submitted",
    Boolean(buyer) &&
      buyer?.[0].value === 4 &&
      buyer?.[1].value === 5 &&
      !buyer?.some((step) => step.value === 8),
  );
  check(
    "seller flow ignores buyer published",
    seller[0].value === 8 && seller[2].value === 1 && seller[0].value !== 4,
  );
}

console.log("\n=== NEXT STEP / EMPTY ===\n");
{
  const waiting: WorkspacePerformanceMetrics = {
    scope: "personal",
    companyName: null,
    requests: {
      published: 2,
      active: 2,
      withOffers: 0,
      withoutOffers: 2,
      totalOffersReceived: 0,
      averageOffersPerRequest: null,
      acceptedOutcome: 0,
    },
    offers: {
      submitted: 0,
      accepted: 0,
      pending: 0,
      rejected: 0,
      unsuccessful: 0,
      winRate: null,
      winRatePresentation: "empty",
      completedTransactions: 0,
      averageOfferLatencyHours: null,
    },
  };
  const step = resolveAnalysisNextStep(waiting);
  check(
    "single next step for waiting requests",
    step.href === "/panel/taleplerim" && step.cta === "Taleplerim",
  );
  check(
    "insight uses waiting requests",
    analysisHeadlineInsight(waiting, 30).includes("teklif bekliyor"),
  );
  check(
    "empty metric maps em dash without showing it as copy helper default",
    displayEmptyMetric("—") === "Veri yok",
  );
}

console.log("\n=== STANDARD / PROFESSIONAL ===\n");
check(
  "Standard still locked without fake blur numbers",
  dash.includes("ProfessionalLockedSection") &&
    dash.includes("ProfessionalChamber") &&
    dash.includes("Profesyonel ile Ticari Performans Zekâsı") &&
    dash.includes('href="/panel/plan"') &&
    !dash.includes("blur-sm") &&
    !dash.includes("Math.random"),
);
check(
  "Professional chamber presentation restored",
  dash.includes("talepo-analysis-pro") &&
    dash.includes("talepo-analysis-pro-banner") &&
    dash.includes("CommercialIntelligenceMark") &&
    css.includes(".talepo-analysis-pro-banner") &&
    css.includes("rgba(251, 191, 36") &&
    css.includes("rgba(251, 113, 133") &&
    css.includes("rgba(168, 85, 247"),
);
check(
  "Professional advanced remains gated by features not ADMIN",
  hasAdvancedAnaliz(featuresForPlan("PROFESSIONAL")) &&
    !hasAdvancedAnaliz(featuresForPlan("STANDARD")) &&
    !dash.includes("platformRole") &&
    !dash.includes("ADMIN"),
);
check(
  "page is not a Professional-only lock",
  page.includes("<AnalyticsDashboard") &&
    !page.includes("FeatureUpgradeGate") &&
    page.includes("Profesyonel ile açılır"),
);

console.log("\n=== WORKSPACE / CACHE ===\n");
check(
  "personal vs company copy",
  analysisWorkspaceCopy({ kind: "user", companyName: null }) ===
    "Kişisel çalışma alanı" &&
    analysisWorkspaceCopy({ kind: "company", companyName: "Demo" }) === "Demo",
);
check(
  "client does not send owner ids",
  !dash.includes("companyId=") && !dash.includes("userId=") && !dash.includes("plan="),
);
check(
  "analytics responses are private no-store",
  route.includes('"Cache-Control": "private, no-store"'),
);
check("dashboard fetch no-store", dash.includes('cache: "no-store"'));
check("page force-dynamic", page.includes('dynamic = "force-dynamic"'));
check(
  "company request metrics stay null-safe",
  dash.includes('metrics?.scope === "company"') &&
    helper.includes("Firma çalışma alanı"),
);

console.log("\n=== NAV / COPY HYGIENE ===\n");
check(
  "Signal Rail and page title stay Analiz",
  nav.includes('href: "/panel/analiz"') &&
    shell.includes('"/panel/analiz")) return "Analiz"'),
);
check(
  "user-facing helper copy has no dash glyphs",
  !forbiddenCopy.test(
    analysisHeadlineInsight(null, 30) +
      resolveAnalysisNextStep(null).body +
      ANALYSIS_ROLE_TABS.map((tab) => tab.label).join(""),
  ),
);
check(
  "page copy avoids dash glyphs",
  !page.includes("—") && !page.includes("–") && !page.includes("--"),
);

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}

console.log(`\nverify-analysis-signal-v1: ${pass} PASS`);
