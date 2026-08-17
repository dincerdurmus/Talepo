import Link from "next/link";

import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { hasPlatformRequestSummary } from "@/lib/monetization/analiz-access";
import { requireUser } from "@/server/auth/require-user";
import { generateMarketInsight } from "@/server/monetization/talepo-insights";

import {
  AnalyticsDashboard,
  BasicMarketInsights,
} from "@/components/panel/AnalyticsDashboard";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const showPlatformSummary = hasPlatformRequestSummary(entitlements.features);

  const marketFrom = new Date(Date.now() - 30 * 86400000);
  const marketTo = new Date();
  const marketInsight = showPlatformSummary
    ? await generateMarketInsight({ from: marketFrom, to: marketTo })
    : null;

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">
          Performans
        </p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">Analiz</h1>
      </section>

      <AnalyticsDashboard />

      <div className="mt-10">
        {marketInsight ? (
          <BasicMarketInsights
            requestCount={marketInsight.requestCount}
            averageBudget={marketInsight.averageBudget}
            insufficientData={marketInsight.insufficientData}
          />
        ) : (
          <section className="rounded-[24px] border border-teal-900/8 bg-teal-50/40 p-6">
            <h2 className="text-lg font-semibold text-teal-950">Platform özeti</h2>
            <p className="mt-2 text-sm text-teal-950/55">
              Yayınlanan taleplerin anonim sayısı ve ortalama talep bütçesi
              Premium ile açılır. Kendi talep ve teklif analiziniz yukarıda
              açıktır.
            </p>
            <Link
              href="/panel/plan"
              className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline"
            >
              Planları incele
            </Link>
          </section>
        )}
      </div>
    </>
  );
}
