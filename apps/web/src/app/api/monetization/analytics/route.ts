import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { requireCompanyFeature } from "@/lib/membership/require-company-feature";
import { hasAdvancedAnaliz } from "@/lib/monetization/analiz-access";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { getCommercialPerformance } from "@/server/monetization/commercial-performance";
import { getDemandIntelligence } from "@/server/monetization/corporate-intelligence";
import {
  getWorkspacePerformance,
  resolveAnalyticsOwner,
} from "@/server/monetization/professional-analytics";
import { generateMarketInsight } from "@/server/monetization/talepo-insights";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "performance";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const toDate = to ? new Date(to) : new Date();

    if (type === "performance") {
      const owner = await resolveAnalyticsOwner(user.id);
      const metrics = await getWorkspacePerformance(owner, fromDate, toDate);

      const entitlements = await resolveEntitlements(
        user.id,
        await getCompanyContextOptions(),
      );
      const advancedAvailable = hasAdvancedAnaliz(entitlements.features);
      const advanced = advancedAvailable
        ? await getCommercialPerformance(owner, fromDate, toDate)
        : null;

      return NextResponse.json({
        ok: true,
        metrics,
        advanced,
        advancedAvailable,
      });
    }

    if (type === "demand") {
      const ctx = await requireCompanyFeature(user.id, "corporate_intelligence");
      const data = await getDemandIntelligence(ctx.companyId, fromDate, toDate);
      return NextResponse.json({ ok: true, data });
    }

    if (type === "market") {
      await requireCompanyFeature(user.id, "talepo_insights");
      const categoryId = searchParams.get("categoryId") ?? undefined;
      const city = searchParams.get("city") ?? undefined;
      const insight = await generateMarketInsight({
        categoryId,
        city,
        from: fromDate,
        to: toDate,
      });
      return NextResponse.json({ ok: true, insight });
    }

    return NextResponse.json({ ok: false, message: "Geçersiz analiz tipi." }, { status: 400 });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: "Analiz alınamadı." }, { status: 500 });
  }
}
