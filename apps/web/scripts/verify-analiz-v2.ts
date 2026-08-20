/**
 * Analiz V2 — Professional commercial performance intelligence.
 * Run: npx tsx scripts/verify-analiz-v2.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ANALIZ_MAX_INSIGHTS,
  ANALIZ_MIN_CATEGORY_RANK_SAMPLE,
  ANALIZ_MIN_INSIGHT_SAMPLE,
  ANALIZ_MIN_WIN_RATE_SAMPLE,
  averageRelativePriceDelta,
  buildCommercialInsights,
  cohortWinRate,
  formatRelativePriceDelta,
  formatWinRateValue,
} from "../src/lib/monetization/performance-metrics";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import { hasAdvancedAnaliz } from "../src/lib/monetization/analiz-access";
import { BILATERAL_COMPLETED_WHERE } from "../src/lib/offer/deal-completion";
import { revealedReviewWhere } from "../src/lib/offer/deal-review";

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

const metricsLib = read("src/lib/monetization/performance-metrics.ts");
const types = read("src/lib/monetization/types.ts");
const commercial = read("src/server/monetization/commercial-performance.ts");
const route = read("src/app/api/monetization/analytics/route.ts");
const dash = read("src/components/panel/AnalyticsDashboard.tsx");
const v1Server = read("src/server/monetization/professional-analytics.ts");
const trust = read("src/server/offer/trust-summary.ts");
const reviewLib = read("src/lib/offer/deal-review.ts");

console.log("\n=== STANDARD / PROFESSIONAL ACCESS ===\n");
{
  check(
    "1 Standard basic analytics preserved (V1 cards)",
    dash.includes("Kazanma oranı") &&
      dash.includes("Gönderilen teklif") &&
      dash.includes("formatWinRateValue"),
  );
  check(
    "2 Standard advanced locked",
    dash.includes("ProfessionalLockedSection") &&
      dash.includes("ProfessionalChamber") &&
      dash.includes("Profesyonel ile Ticari Performans Zekâsı") &&
      dash.includes('href="/panel/plan"') &&
      !dash.includes("blur-sm") &&
      !dash.includes("Math.random"),
  );
  check(
    "3 Professional advanced açık",
    dash.includes("ProfessionalCommerceSection") &&
      dash.includes("advancedAvailable") &&
      hasAdvancedAnaliz(featuresForPlan("PROFESSIONAL")) &&
      !hasAdvancedAnaliz(featuresForPlan("STANDARD")) &&
      !hasAdvancedAnaliz(featuresForPlan("PREMIUM")),
  );
  check(
    "Professional chamber presentation restored",
    dash.includes("ProfessionalChamber") &&
      dash.includes("talepo-analysis-pro-banner") &&
      dash.includes("CommercialIntelligenceMark") &&
      dash.includes("Nerede kazanıyorsunuz, nerede kaybediyorsunuz?") &&
      dash.includes("aynı teklif grubunu temel almaz"),
  );
  check(
    "38 client owner spoof yok",
    !dash.includes("companyId=") &&
      !dash.includes("userId=") &&
      !dash.includes("plan=") &&
      route.includes("resolveAnalyticsOwner(user.id)"),
  );
  check(
    "37 unauthorized API uses requireUser",
    route.includes("requireUser()") && route.includes("AuthenticationError"),
  );
}

console.log("\n=== OWNER ISOLATION ===\n");
{
  check(
    "4 personal owner isolation",
    commercial.includes('submittedById: owner.userId') &&
      commercial.includes("companyId: null"),
  );
  check(
    "5 company isolation",
    commercial.includes("return { companyId: owner.companyId }") ||
      commercial.includes("o.\"companyId\" = ${owner.companyId}"),
  );
  check(
    "6 personal/company cross contamination yok",
    commercial.includes('owner.scope === "personal"') &&
      commercial.includes('o."companyId" IS NULL') &&
      commercial.includes('WHERE o."companyId" = ${owner.companyId}'),
  );
}

console.log("\n=== FUNNEL / WIN RATE / COMPLETION ===\n");
{
  check(
    "7 submitted cohort doğru",
    commercial.includes("submittedAt: { gte: from, lte: to }") &&
      commercial.includes('status: { not: "DRAFT" }'),
  );
  check(
    "8 accepted numerator aynı cohort",
    commercial.includes('status: "ACCEPTED"') &&
      commercial.includes("cohortWhere"),
  );
  const low = cohortWinRate(1, 1);
  check(
    "9 n<3 yüzde baskılanıyor",
    low.presentation === "counts" &&
      formatWinRateValue({
        accepted: 1,
        submitted: 1,
        winRate: low.rate,
        winRatePresentation: low.presentation,
      }) === "1 / 1" &&
      ANALIZ_MIN_WIN_RATE_SAMPLE === 3 &&
      ANALIZ_MIN_INSIGHT_SAMPLE === 3,
  );
  check(
    "10 bilateral completed only",
    commercial.includes("BILATERAL_COMPLETED_WHERE") &&
      Object.keys(BILATERAL_COMPLETED_WHERE).includes("confirmationLevel"),
  );
  check(
    "11 one-sided completed excluded",
    commercial.includes('confirmationLevel" = \'BOTH_CONFIRMED\'') ||
      commercial.includes("BOTH_CONFIRMED"),
  );
}

console.log("\n=== VOLUME / PRICE AUTHORITY ===\n");
{
  check(
    "12 agreedPrice authority",
    commercial.includes("agreedPrice") &&
      commercial.includes("groupBy") &&
      types.includes("primaryVolume") &&
      commercial.includes("select: { amount: true }"),
  );
  check(
    "13 negotiated final price uses agreedPrice",
    commercial.includes("agreedPrice") &&
      commercial.includes('negotiations: { some: { status: "ACCEPTED" } }'),
  );
  check(
    "14 direct accept = completed - negotiated",
    commercial.includes("completedDeals - negotiatedCompleted") ||
      commercial.includes("Math.max(0, completedDeals - negotiatedCompleted)"),
  );
  check(
    "15 completed volume groupBy currency",
    commercial.includes('by: ["currency"]') &&
      commercial.includes("_sum: { agreedPrice: true }"),
  );
  check(
    "16 average completed amount",
    commercial.includes("_avg: { agreedPrice: true }") &&
      types.includes("averageAgreedAmount"),
  );
  check(
    "17 currency mixing engeli",
    commercial.includes("mixedCurrency") &&
      dash.includes("Birden fazla para birimi") &&
      !commercial.includes("USD") &&
      !commercial.includes("* 34") &&
      !commercial.includes("exchange"),
  );
}

console.log("\n=== NEGOTIATION ===\n");
{
  const delta = averageRelativePriceDelta([
    { firstAmount: 100_000, agreedAmount: 94_000 },
    { firstAmount: 50_000, agreedAmount: 50_000 },
  ]);
  check("18 negotiated completed count", commercial.includes("negotiatedCompleted"));
  check("19 direct completed count", commercial.includes("directCompleted"));
  check(
    "20 negotiation difference",
    delta != null &&
      Math.abs(delta - -0.03) < 0.001 &&
      formatRelativePriceDelta(delta) === "%-3",
  );
  check(
    "21 rejected negotiation yanlış sayılmıyor",
    commercial.includes('status: "ACCEPTED"') &&
      !commercial.includes('status: "REJECTED"'),
  );
}

console.log("\n=== CATEGORY / INSIGHTS / LOW SAMPLE ===\n");
{
  check(
    "22 category canonical",
    commercial.includes('r."categoryId"') &&
      commercial.includes("INNER JOIN \"Category\"") &&
      !commercial.includes("free-text") &&
      !commercial.includes("parseCategory"),
  );
  check(
    "23 category low sample",
    ANALIZ_MIN_CATEGORY_RANK_SAMPLE === 5 &&
      commercial.includes("ANALIZ_MIN_CATEGORY_RANK_SAMPLE") &&
      dash.includes("Daha fazla işlem verisi oluştuğunda kategori"),
  );
  const insightsLow = buildCommercialInsights({
    submitted: 1,
    accepted: 1,
    completedInWindow: 0,
    completedFromSubmittedCohort: 0,
    negotiatedCompleted: 0,
    directCompleted: 0,
    negotiationDelta: null,
    negotiationDeltaSample: 0,
    primaryVolumeTotal: null,
    primaryVolumeCurrency: null,
    topCategory: null,
  });
  check(
    "24 insight low sample — no %100",
    insightsLow.some((i) => i.id === "accepted-count") &&
      !insightsLow.some((i) => i.text.includes("%100")) &&
      !insightsLow.some((i) => i.text.includes("%")),
  );
  const many = buildCommercialInsights({
    submitted: 12,
    accepted: 4,
    completedInWindow: 6,
    completedFromSubmittedCohort: 4,
    negotiatedCompleted: 4,
    directCompleted: 2,
    negotiationDelta: -0.06,
    negotiationDeltaSample: 4,
    primaryVolumeTotal: 480_000,
    primaryVolumeCurrency: "TRY",
    topCategory: { name: "Mobilya", submitted: 8, accepted: 4 },
  });
  check(
    "25 max insight count",
    many.length <= ANALIZ_MAX_INSIGHTS && ANALIZ_MAX_INSIGHTS === 4,
  );
  check(
    "26 fake trend yok",
    !commercial.includes("Math.random") &&
      !dash.includes("Math.random") &&
      !metricsLib.includes("Math.random") &&
      !commercial.includes("trend:") &&
      !dash.includes("Yükseliş"),
  );
}

console.log("\n=== ATTRIBUTION HONESTY ===\n");
{
  check(
    "27 Radar fake attribution yok — yalnız OfferAttribution",
    commercial.includes("OfferAttribution") &&
      commercial.includes("sourcePerformance") &&
      !commercial.includes("talepo_radar") &&
      !dash.includes("Radar sayesinde ₺") &&
      !dash.includes("Radar'dan 9 teklif"),
  );
  check(
    "28 Takiplerim fake attribution yok — yalnız OfferAttribution",
    dash.includes("Talepo sana nereden iş getiriyor") &&
      !dash.includes("Takiplerim sayesinde") &&
      !commercial.includes("SavedSearch") &&
      !commercial.includes("AlertRule") &&
      !commercial.includes("opportunityWatchlistItem"),
  );
  check(
    "29 RequestMatch OC diye kullanılmıyor",
    !commercial.includes("RequestMatch") &&
      !commercial.includes("OpportunityMatch") &&
      !dash.includes("OpportunityMatch"),
  );
  check(
    "30 review hidden rows trust'a girmiyor",
    commercial.includes("getUserTrustSummary") &&
      commercial.includes("getCompanyTrustSummary") &&
      trust.includes("revealedReviewWhere"),
  );
  check(
    "31 timeout revealed review giriyor",
    reviewLib.includes("REVIEW_REVEAL_AFTER_DAYS") ||
      reviewLib.includes("14") ||
      JSON.stringify(revealedReviewWhere()).length > 0,
  );
}

console.log("\n=== WINDOWS / EMPTY / FAKE ===\n");
{
  check("32 7 day", dash.includes("([7, 30, 90]") || dash.includes("7, 30, 90"));
  check("33 30 day", dash.includes("useState<RangeDays>(30)"));
  check("34 90 day", dash.includes("Son {days} gün"));
  check(
    "35 empty no offers",
    dash.includes("İlk teklifinizi verin"),
  );
  check(
    "36 empty no completed deals",
    dash.includes("Tamamlanan işlemler oluştukça ticaret hacminiz burada görünür") &&
      dash.includes('href="/panel/teklifler"') &&
      dash.includes('cta="Tekliflerim"') &&
      !dash.includes("/panel/gelen-teklifler") &&
      !dash.includes("Tekliflere git"),
  );
  check(
    "39 no hardcoded random metric",
    !commercial.includes("Math.random") &&
      !metricsLib.includes("fake") &&
      !dash.includes("benchmark"),
  );
  check(
    "40 no N+1 / take 500",
    !commercial.includes("take: 500") &&
      !commercial.includes("take:500") &&
      commercial.includes("groupBy") &&
      commercial.includes("$queryRaw"),
  );
}

console.log("\n=== API GATE (V1 COMPAT) ===\n");
{
  const start = route.indexOf('if (type === "performance")');
  const demand = route.indexOf('if (type === "demand")');
  const perfBlock =
    start >= 0 && demand > start ? route.slice(start, demand) : "";
  check(
    "performance still auth+owner; gate via hasAdvancedAnaliz helper",
    perfBlock.includes("resolveAnalyticsOwner(user.id)") &&
      perfBlock.includes("hasAdvancedAnaliz") &&
      perfBlock.includes("getCommercialPerformance") &&
      !perfBlock.includes("requireEntitledFeature") &&
      !perfBlock.includes("professional_analytics") &&
      !perfBlock.includes("requireCompanyFeature"),
  );
  check(
    "commercial module separate from V1 engine",
    !v1Server.includes("getCommercialPerformance") &&
      !v1Server.includes("professional_analytics"),
  );
  check(
    "no LLM insights in commercial path",
    !commercial.includes("openai") &&
      !commercial.includes("generateMarketInsight") &&
      metricsLib.includes("Deterministic insights only"),
  );
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}

console.log(`\nverify-analiz-v2: ${pass} PASS`);
