import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

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
import { markAllNotificationsAsRead } from "@/server/notifications/mark-notifications-read";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = bindCorrelationFromRequest(request, {
    surface: "api.notifications.readAll",
  });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "notifications.readAll"),
        limit: 30,
        windowMs: 60_000,
      });

      const user = await requireUser();
      store.userId = user.id;
      assertRateLimit({
        key: userKey("notifications.readAll", user.id),
        limit: 20,
        windowMs: 60_000,
      });

      const result = await markAllNotificationsAsRead(user.id);

      revalidatePath("/panel");
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
          service: "notifications",
          event: "notifications.readAll.failed",
          correlationId: store.correlationId,
        });
      }

      return safeErrorResponse(error, {
        service: "notifications",
        event: "notifications.readAll.failed",
        correlationId: store.correlationId,
      });
    }
  });
}
