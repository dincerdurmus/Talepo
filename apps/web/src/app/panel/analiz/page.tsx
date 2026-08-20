import Link from "next/link";
import type { ReactNode } from "react";

import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { hasPlatformRequestSummary } from "@/lib/monetization/analiz-access";
import { requireUser } from "@/server/auth/require-user";
import { generateMarketInsight } from "@/server/monetization/talepo-insights";

import {
  AnalyticsDashboard,
  BasicMarketInsights,
} from "@/components/panel/AnalyticsDashboard";

export const dynamic = "force-dynamic";

async function loadPlatformSummary(show: boolean) {
  if (!show) return null;
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  return generateMarketInsight({ from, to });
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const showPlatformSummary = hasPlatformRequestSummary(entitlements.features);
  const marketInsight = await loadPlatformSummary(showPlatformSummary);

  const platformSummary: ReactNode = marketInsight ? (
    <BasicMarketInsights
      requestCount={marketInsight.requestCount}
      averageBudget={marketInsight.averageBudget}
      insufficientData={marketInsight.insufficientData}
    />
  ) : (
    <section className="rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white px-5 py-6">
      <h2 className="text-lg font-semibold text-[#0f1f1d]">Platform özeti</h2>
      <p className="mt-2 text-sm leading-6 text-[#0f1f1d]/55">
        Yayınlanan taleplerin anonim sayısı ve ortalama talep bütçesi
        Profesyonel ile açılır. Kendi talep ve teklif analiziniz yukarıda
        açıktır.
      </p>
      <Link
        href="/panel/plan"
        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#0f766e] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40"
      >
        Planları incele
      </Link>
    </section>
  );

  return (
    <div className="talepo-analysis mx-auto w-full max-w-[64rem] pb-6 pt-1 sm:pb-8 sm:pt-2">
      <div className="talepo-beacon-shell relative overflow-hidden rounded-[1.75rem] sm:rounded-[2rem]">
        <h1 className="sr-only">Analiz</h1>
        <AnalyticsDashboard
          planLabel={entitlements.planLabel}
          workspaceKind={entitlements.subject.type}
        >
          {platformSummary}
        </AnalyticsDashboard>
      </div>
    </div>
  );
}
