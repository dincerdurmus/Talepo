import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { OfferInboxRole } from "@/lib/offer/offer-event-unread";
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
import {
  assertOfferSeenAuthority,
  markOfferNotificationsAsRead,
} from "@/server/notifications/mark-offer-notifications-read";

export const runtime = "nodejs";

function parseRole(value: unknown): OfferInboxRole | null {
  if (value === "buyer" || value === "seller") return value;
  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: offerId } = await context.params;
  const store = bindCorrelationFromRequest(request, {
    surface: "api.offers.seen",
  });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "offers.seen"),
        limit: 60,
        windowMs: 60_000,
      });

      const user = await requireUser();
      store.userId = user.id;
      assertRateLimit({
        key: userKey("offers.seen", user.id),
        limit: 40,
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

      const allowed = await assertOfferSeenAuthority({
        userId: user.id,
        offerId,
        role,
      });
      if (!allowed) {
        return NextResponse.json(
          { message: "Bu teklif için yetkiniz yok." },
          { status: 403 },
        );
      }

      const result = await markOfferNotificationsAsRead(
        user.id,
        offerId,
        role,
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
          event: "offers.seen.failed",
          correlationId: store.correlationId,
        });
      }

      return safeErrorResponse(error, {
        service: "offers",
        event: "offers.seen.failed",
        correlationId: store.correlationId,
      });
    }
  });
}
