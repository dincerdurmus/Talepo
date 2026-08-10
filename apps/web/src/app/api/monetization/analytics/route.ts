import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { requireCompanyFeature } from "@/lib/membership/require-company-feature";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { getCompanyPerformance } from "@/server/monetization/professional-analytics";
import { getDemandIntelligence } from "@/server/monetization/corporate-intelligence";
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
      const ctx = await requireCompanyFeature(user.id, "professional_analytics");
      const metrics = await getCompanyPerformance(ctx.companyId, fromDate, toDate);
      return NextResponse.json({ ok: true, metrics });
    }

    if (type === "demand") {
      const ctx = await requireCompanyFeature(user.id, "corporate_intelligence");
      const data = await getDemandIntelligence(ctx.companyId, fromDate, toDate);
      return NextResponse.json({ ok: true, data });
    }

    if (type === "market") {
      const ctx = await requireCompanyFeature(user.id, "talepo_insights");
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
