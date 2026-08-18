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
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  assertOfferArchiveAuthority,
  unarchiveOfferForUser,
} from "@/server/offer/offer-archive-service";

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
    surface: "api.offers.unarchive",
  });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "offers.unarchive"),
        limit: 30,
        windowMs: 60_000,
      });

      const user = await requireUser();
      store.userId = user.id;
      assertRateLimit({
        key: userKey("offers.unarchive", user.id),
        limit: 20,
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

      const allowed = await assertOfferArchiveAuthority({
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

      const workspace =
        role === "seller" ? await getCompanyWorkspace(user.id) : null;

      await unarchiveOfferForUser({
        userId: user.id,
        offerId,
        companyId: workspace?.companyId ?? null,
      });

      revalidatePath("/panel");
      revalidatePath("/panel/gelen-teklifler");
      revalidatePath("/panel/teklifler");

      const res = NextResponse.json({ ok: true }, { status: 200 });
      for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
        res.headers.set(k, v);
      }
      return res;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return safeErrorResponse(error, {
          service: "offers",
          event: "offers.unarchive.failed",
          correlationId: store.correlationId,
        });
      }
      return safeErrorResponse(error, {
        service: "offers",
        event: "offers.unarchive.failed",
        correlationId: store.correlationId,
      });
    }
  });
}
