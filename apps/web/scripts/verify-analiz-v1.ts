/**
 * Analiz V1 — personal/company performance analytics.
 * Run: npx tsx scripts/verify-analiz-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ANALIZ_MIN_WIN_RATE_SAMPLE,
  cohortWinRate,
  formatWinRateHint,
  formatWinRateValue,
  summarizeOfferCohort,
} from "../src/lib/monetization/performance-metrics";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import { isPersonalApiCapable } from "../src/lib/membership/feature-scope";
import { FEATURE_META } from "../src/lib/membership/feature-meta";
import { PRO_FEATURE_PRESENTATION } from "../src/lib/membership/feature-presentation";
import { UPGRADE_COPY } from "../src/lib/membership/upgrade-copy";
import {
  hasAdvancedAnaliz,
  hasPlatformRequestSummary,
} from "../src/lib/monetization/analiz-access";
import {
  filterPanelNavItems,
  PANEL_NAV_ITEMS,
} from "../src/components/panel/panel-nav";

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

console.log("\n=== WIN RATE AUTHORITY ===\n");
{
  const provider = summarizeOfferCohort({
    ACCEPTED: 3,
    REJECTED: 2,
    SUBMITTED: 4,
    VIEWED: 1,
  });
  check("2 sent 10", provider.submitted === 10);
  check("2 accepted 3", provider.accepted === 3);
  check("2 pending 5", provider.pending === 5);
  check("2 rejected 2", provider.rejected === 2);
  check("2 win rate 30%", provider.winRate === 0.3);
  check("2 presentation percent", provider.winRatePresentation === "percent");
  check("2 format %30", formatWinRateValue(provider) === "%30");

  const mixedWindowWouldBeWrong = cohortWinRate(3, 0);
  check(
    "3 prior-period accepted is not current denom",
    mixedWindowWouldBeWrong.rate === null &&
      mixedWindowWouldBeWrong.presentation === "empty",
  );

  const empty = cohortWinRate(0, 0);
  check("4 denom 0 rate null", empty.rate === null);
  check("4 denom 0 empty presentation", empty.presentation === "empty");
  check("4 format em dash", formatWinRateValue(empty) === "—");
  check("4 not NaN", Number.isNaN(empty.rate as number) === false);

  const low = summarizeOfferCohort({ ACCEPTED: 1 });
  check("5 low-n submitted 1 accepted 1", low.submitted === 1 && low.accepted === 1);
  check("5 low-n presentation counts", low.presentation === "counts" || low.winRatePresentation === "counts");
  check("5 low-n value is 1 / 1 not %100", formatWinRateValue(low) === "1 / 1");
  check(
    "5 low-n hint count-first",
    formatWinRateHint(low) === "1 / 1 teklif kabul edildi",
  );
  check("5 min sample is 3", ANALIZ_MIN_WIN_RATE_SAMPLE === 3);

  const withdrawn = summarizeOfferCohort({
    ACCEPTED: 1,
    WITHDRAWN: 1,
    EXPIRED: 1,
  });
  check("unsuccessful = expired+withdrawn", withdrawn.unsuccessful === 2);
  check("draft excluded from submitted", summarizeOfferCohort({ DRAFT: 9, ACCEPTED: 1 }).submitted === 1);
}

console.log("\n=== ENTITLEMENT / SCOPE ===\n");
{
  const route = read("src/app/api/monetization/analytics/route.ts");
  const server = read("src/server/monetization/professional-analytics.ts");
  const page = read("src/app/panel/analiz/page.tsx");
  const dash = read("src/components/panel/AnalyticsDashboard.tsx");

  check(
    "7 performance API is auth+owner, not professional_analytics",
    (() => {
      const start = route.indexOf('if (type === "performance")');
      const demand = route.indexOf('if (type === "demand")');
      const perfBlock =
        start >= 0 && demand > start ? route.slice(start, demand) : "";
      return (
        route.includes("requireUser()") &&
        perfBlock.includes("resolveAnalyticsOwner(user.id)") &&
        !perfBlock.includes("requireEntitledFeature") &&
        !perfBlock.includes("professional_analytics") &&
        !perfBlock.includes("requireCompanyFeature")
      );
    })(),
  );
  check(
    "professional_analytics remains a plan key, not page access",
    isPersonalApiCapable("professional_analytics") &&
      hasAdvancedAnaliz(featuresForPlan("PROFESSIONAL")) &&
      !hasAdvancedAnaliz(featuresForPlan("STANDARD")) &&
      hasPlatformRequestSummary(featuresForPlan("PREMIUM")) &&
      !hasPlatformRequestSummary(featuresForPlan("STANDARD")),
  );
  check(
    "page always renders AnalyticsDashboard, no upgrade wall",
    page.includes("<AnalyticsDashboard") &&
      !page.includes("FeatureUpgradeGate") &&
      !page.includes('"professional_analytics"'),
  );
  const analizNav = PANEL_NAV_ITEMS.find((item) => item.href === "/panel/analiz");
  check(
    "single Analiz nav item without feature gate",
    Boolean(analizNav) &&
      analizNav?.label === "Analiz" &&
      analizNav?.requiresFeature === undefined &&
      PANEL_NAV_ITEMS.filter((item) => item.href === "/panel/analiz").length === 1,
  );
  const standardNav = filterPanelNavItems(
    PANEL_NAV_ITEMS,
    featuresForPlan("STANDARD"),
    "personal",
  );
  check(
    "STANDARD PERSONAL nav includes Analiz",
    standardNav.some((item) => item.href === "/panel/analiz" && item.label === "Analiz"),
  );
  check(
    "personal offer owner companyId null",
    server.includes("submittedById: owner.userId") &&
      server.includes("companyId: null"),
  );
  check(
    "company offer owner companyId",
    server.includes("return { companyId: owner.companyId }"),
  );
  check(
    "9 request analytics createdById",
    server.includes("createdById: userId"),
  );
  check(
    "company requests not aggregated this milestone",
    server.includes('owner.scope === "personal"') &&
      server.includes("getPersonalRequestPerformance"),
  );
  check(
    "8 isolation: client does not send owner id",
    !dash.includes("companyId=") && !dash.includes("userId="),
  );
  check(
    "16 from/to query params",
    dash.includes("type=performance&from=") && dash.includes("rangeDates"),
  );
  check(
    "plan matrix unchanged: Pro has professional_analytics, Standard does not",
    featuresForPlan("PROFESSIONAL").professional_analytics === true &&
      featuresForPlan("STANDARD").professional_analytics === false &&
      featuresForPlan("PREMIUM").professional_analytics === false &&
      featuresForPlan("PREMIUM").basic_market_insights === true,
  );
}

console.log("\n=== REMOVED / HONEST UI ===\n");
{
  const dash = read("src/components/panel/AnalyticsDashboard.tsx");
  const server = read("src/server/monetization/professional-analytics.ts");
  const insights = read("src/server/monetization/talepo-insights.ts");
  const page = read("src/app/panel/analiz/page.tsx");

  check(
    "10 no create→submit response time",
    !server.includes("createdAt.getTime()") &&
      !dash.includes("Ort. yanıt süresi") &&
      !dash.includes("averageResponseTimeHours"),
  );
  check(
    "latency uses publishedAt → submittedAt",
    server.includes('o."submittedAt" - r."publishedAt"') &&
      dash.includes("Ort. teklif verme süresi"),
  );
  check("10 no RequestMatch card", !server.includes("requestMatch") && !dash.includes("Eşleşen talep"));
  check(
    "14 watchlist not Takiplerim",
    !dash.includes("Takiplerim") &&
      !server.includes("opportunityWatchlistItem") &&
      !dash.includes("Aktif takip listesi") &&
      !dash.includes("takibe alınan"),
  );
  check(
    "premium insight uses count/aggregate not take 1000 sample",
    insights.includes("prisma.request.count") &&
      insights.includes("prisma.request.aggregate") &&
      !insights.includes("take: 1000"),
  );
  check(
    "11 fake premium trend removed",
    insights.includes('trend: "UNKNOWN"') &&
      !insights.includes("firstHalf") &&
      !page.includes("trend=") &&
      !dash.includes("Yükseliş") &&
      !dash.includes("trendLabel"),
  );
  check(
    "12 no PI claim as product",
    dash.includes("Platform özeti") &&
      dash.includes("Talep bütçesi") &&
      !dash.includes("fiyat avantajı") &&
      !dash.includes("piyasanın üzerinde"),
  );
  check(
    "13 no opportunity attribution",
    !server.includes("OpportunityMatch") &&
      !dash.includes("önerilen fırsat"),
  );
  check(
    "15 empty CTAs",
    dash.includes('href="/talep"') &&
      dash.includes('href="/panel/talepler"') &&
      dash.includes('href="/panel/taleplerim"'),
  );
  check("personal sections", dash.includes("Talep performansı") && dash.includes("Teklif performansı"));
  check("company section", dash.includes("Şirket teklif performansı"));
  check(
    "premium platform summary is additive on same page",
    page.includes("<AnalyticsDashboard") &&
      page.includes("hasPlatformRequestSummary") &&
      page.includes("BasicMarketInsights") &&
      page.includes("Premium ile açılır"),
  );
  check(
    "page is not branded as Profesyonel lock",
    !page.includes("Profesyonel") && page.includes(">Analiz<"),
  );
}

console.log("\n=== COPY ===\n");
{
  const analyticsCopy = `${FEATURE_META.professional_analytics.label} ${FEATURE_META.professional_analytics.description} ${PRO_FEATURE_PRESENTATION.professional_analytics?.label} ${UPGRADE_COPY.professional_analytics?.title}`;
  check(
    "professional_analytics is not Analiz page-access copy",
    FEATURE_META.professional_analytics.description.includes("tüm planlarda"),
  );
  check(
    "analytics copy does not sell yanıt süresi",
    !analyticsCopy.includes("yanıt süresi"),
  );
  check(
    "basic insights not labeled Price Intelligence",
    PRO_FEATURE_PRESENTATION.basic_market_insights?.label !== "Price Intelligence",
  );
  check(
    "basic insights disclaims market price",
    FEATURE_META.basic_market_insights.description.includes("Piyasa fiyatı değildir") &&
      (PRO_FEATURE_PRESENTATION.basic_market_insights?.howItWorks ?? "").includes(
        "fiyat trendi üretmez",
      ),
  );
}

console.log("\n=== COHORT QUERY SHAPE ===\n");
{
  const server = read("src/server/monetization/professional-analytics.ts");
  check(
    "win rate cohort is submittedAt window not acceptedAt window",
    server.includes("submittedAt: { gte: from, lte: to }") &&
      !server.includes("acceptedAt:"),
  );
  check("groupBy status", server.includes('by: ["status"]'));
  check("no take 500 JS response average", !server.includes("take: 500"));
  check(
    "owner resolver ignores professional_analytics",
    server.includes("export async function resolveAnalyticsOwner") &&
      !server.includes("professional_analytics"),
  );
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}

console.log(`\nverify-analiz-v1: ${pass} PASS`);
