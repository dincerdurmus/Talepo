import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import {
  bindCorrelationFromRequest,
  correlationResponseHeaders,
  runWithCorrelationAsync,
} from "@/lib/observability/correlation";
import { createSubsystemLogger } from "@/lib/observability/logger";
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

const logger = createSubsystemLogger("monetization.analytics");

function firstApplicationFrame(error: unknown): string | undefined {
  const stack = error instanceof Error ? error.stack : undefined;
  return stack
    ?.split("\n")
    .map((line) => line.trim())
    .find((line) => /(?:src[\\/]|app[\\/]|server[\\/])/.test(line));
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown runtime error";
  return error.message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-db-url]")
    .replace(/(?:password|secret|token|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]")
    .slice(0, 240);
}

export async function GET(request: Request) {
  const store = bindCorrelationFromRequest(request, { surface: "panel.analiz" });
  return runWithCorrelationAsync(store, async () => {
    let stage = "authentication";
    const respond = (body: unknown, init?: ResponseInit) => {
      const response = NextResponse.json(body, init);
      for (const [key, value] of Object.entries(correlationResponseHeaders(store))) {
        response.headers.set(key, value);
      }
      return response;
    };

    try {
    const user = await requireUser();
    store.userId = user.id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "performance";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    stage = "date parsing";
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const toDate = to ? new Date(to) : new Date();
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      return respond({ ok: false, message: "Geçersiz tarih aralığı." }, { status: 400 });
    }

    if (type === "performance") {
      stage = "user/workspace resolution";
      const owner = await resolveAnalyticsOwner(user.id);
      if (owner.scope === "company") store.companyId = owner.companyId;
      stage = "request metrics";
      const metrics = await getWorkspacePerformance(owner, fromDate, toDate);

      stage = "user/workspace resolution";
      const entitlements = await resolveEntitlements(
        user.id,
        await getCompanyContextOptions(),
      );
      const advancedAvailable = hasAdvancedAnaliz(entitlements.features);
      const advanced = advancedAvailable
        ? await (async () => {
            stage = "attribution/agreedPrice aggregation";
            return getCommercialPerformance(owner, fromDate, toDate);
          })()
        : null;

      stage = "response serialization";
      return respond({
        ok: true,
        metrics,
        advanced,
        advancedAvailable,
      });
    }

    if (type === "demand") {
      stage = "user/workspace resolution";
      const ctx = await requireCompanyFeature(user.id, "corporate_intelligence");
      store.companyId = ctx.companyId;
      stage = "request metrics";
      const data = await getDemandIntelligence(ctx.companyId, fromDate, toDate);
      return respond({ ok: true, data });
    }

    if (type === "market") {
      stage = "user/workspace resolution";
      await requireCompanyFeature(user.id, "talepo_insights");
      const categoryId = searchParams.get("categoryId") ?? undefined;
      const city = searchParams.get("city") ?? undefined;
      stage = "request metrics";
      const insight = await generateMarketInsight({
        categoryId,
        city,
        from: fromDate,
        to: toDate,
      });
      return respond({ ok: true, insight });
    }

    return respond({ ok: false, message: "Geçersiz analiz tipi." }, { status: 400 });
    } catch (error) {
      logger.error("analytics.request.failed", {
        context: {
          stage,
          errorName: error instanceof Error ? error.name : "UnknownError",
          safeMessage: safeErrorMessage(error),
          firstApplicationFrame: firstApplicationFrame(error),
          httpStatus: error instanceof AuthenticationError ? 401 : 500,
        },
      });
    const ent = entitlementErrorResponse(error);
    if (ent) {
      for (const [key, value] of Object.entries(correlationResponseHeaders(store))) ent.headers.set(key, value);
      return ent;
    }
    if (error instanceof AuthenticationError) {
      return respond({ ok: false, message: error.message }, { status: 401 });
    }
    return respond({ ok: false, message: "Analiz alınamadı." }, { status: 500 });
    }
  });
}
