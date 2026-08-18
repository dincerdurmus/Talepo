import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import type { OfferInboxRole } from "@/lib/offer/offer-event-unread";
import {
  listUnreadIncomingOfferIds,
  listUnreadOutgoingOfferIds,
} from "@/lib/offer/offer-event-unread";
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
  archiveOfferForUser,
  assertOfferArchiveAuthority,
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
    surface: "api.offers.archive",
  });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "offers.archive"),
        limit: 30,
        windowMs: 60_000,
      });

      const user = await requireUser();
      store.userId = user.id;
      assertRateLimit({
        key: userKey("offers.archive", user.id),
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
      const unreadOfferIds =
        role === "buyer"
          ? await listUnreadIncomingOfferIds(user.id)
          : await listUnreadOutgoingOfferIds(user.id);

      const result = await archiveOfferForUser({
        userId: user.id,
        offerId,
        role,
        companyId: workspace?.companyId ?? null,
        unreadOfferIds,
      });

      if (!result.ok) {
        return NextResponse.json(
          { message: result.message },
          { status: result.status },
        );
      }

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
          event: "offers.archive.failed",
          correlationId: store.correlationId,
        });
      }
      return safeErrorResponse(error, {
        service: "offers",
        event: "offers.archive.failed",
        correlationId: store.correlationId,
      });
    }
  });
}
