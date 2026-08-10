import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { requireUser } from "@/server/auth/require-user";
import { generateMarketInsight } from "@/server/monetization/talepo-insights";

import {
  AnalyticsDashboard,
  BasicMarketInsights,
} from "@/components/panel/AnalyticsDashboard";
import { FeatureUpgradeGate } from "@/components/panel/FeatureUpgradeGate";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const hasProAnalytics = hasFeature(
    entitlements.features,
    "professional_analytics",
  );
  const hasBasicInsights = hasFeature(
    entitlements.features,
    "basic_market_insights",
  );

  const marketFrom = new Date(Date.now() - 30 * 86400000);
  const marketTo = new Date();
  const marketInsight =
    hasBasicInsights && !hasProAnalytics
      ? await generateMarketInsight({ from: marketFrom, to: marketTo })
      : null;

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">Profesyonel</p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">Analiz</h1>
      </section>

      {hasProAnalytics ? (
        <AnalyticsDashboard />
      ) : hasBasicInsights && marketInsight ? (
        <div className="space-y-6">
          <BasicMarketInsights
            requestCount={marketInsight.requestCount}
            averageBudget={marketInsight.averageBudget}
            trend={marketInsight.trend}
            insufficientData={marketInsight.insufficientData}
          />
          <FeatureUpgradeGate feature="professional_analytics" entitled={false} />
        </div>
      ) : (
        <FeatureUpgradeGate feature="professional_analytics" entitled={false} />
      )}
    </>
  );
}
