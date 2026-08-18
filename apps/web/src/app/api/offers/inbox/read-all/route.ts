import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { OfferInboxRole } from "@/lib/offer/offer-event-unread";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import {
  bindCorrelationFromRequest,
  correlationResponseHeaders,
  runWithCorrelationAsync,
} from "@/lib/observability/correlation";
import { safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
  userKey,
} from "@/lib/observability/rate-limit";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { markAllOfferNotificationsAsRead } from "@/server/notifications/mark-offer-notifications-read";

export const runtime = "nodejs";

function parseRole(value: unknown): OfferInboxRole | null {
  if (value === "buyer" || value === "seller") return value;
  return null;
}

export async function POST(request: Request) {
  const store = bindCorrelationFromRequest(request, {
    surface: "api.offers.inbox.read-all",
  });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "offers.inbox.read-all"),
        limit: 20,
        windowMs: 60_000,
      });

      const user = await requireUser();
      store.userId = user.id;
      assertRateLimit({
        key: userKey("offers.inbox.read-all", user.id),
        limit: 10,
        windowMs: 60_000,
      });

      const body = (await request.json().catch(() => ({}))) as {
        role?: unknown;
      };
      const role = parseRole(body.role);
      if (!role) {
        return NextResponse.json(
          { message: "Geçersiz rol." },
          { status: 400 },
        );
      }

      const entitlements = await resolveEntitlements(
        user.id,
        await getCompanyContextOptions(),
      );
      const companyId =
        role === "seller" && entitlements.subject.type === "company"
          ? entitlements.subject.id
          : null;

      const result = await markAllOfferNotificationsAsRead(
        user.id,
        role,
        companyId,
      );

      revalidatePath("/panel");
      revalidatePath("/panel/gelen-teklifler");
      revalidatePath("/panel/teklifler");
      revalidatePath("/panel/bildirimler");

      const res = NextResponse.json(
        { ok: true, updated: result.count },
        { status: 200 },
      );
      for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
        res.headers.set(k, v);
      }
      return res;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return safeErrorResponse(error, {
          service: "offers",
          event: "offers.inbox.read-all.failed",
          correlationId: store.correlationId,
        });
      }

      return safeErrorResponse(error, {
        service: "offers",
        event: "offers.inbox.read-all.failed",
        correlationId: store.correlationId,
      });
    }
  });
}
