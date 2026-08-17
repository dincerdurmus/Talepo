import { NextResponse } from "next/server";

import {
  bindCorrelationFromRequest,
  correlationResponseHeaders,
  runWithCorrelationAsync,
} from "@/lib/observability/correlation";
import { DomainError, safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
  userKey,
} from "@/lib/observability/rate-limit";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { finalizeOfferMedia } from "@/server/offer/offer-media-service";
import { OfferValidationError } from "@/server/offer/offer-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = bindCorrelationFromRequest(request, {
    surface: "api.offer.media.finalize",
  });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "offer.media.finalize"),
        limit: 30,
        windowMs: 60_000,
      });

      const user = await requireUser();
      store.userId = user.id;
      assertRateLimit({
        key: userKey("offer.media.finalize", user.id),
        limit: 15,
        windowMs: 60_000,
      });

      const { id } = await params;
      const result = await finalizeOfferMedia(user.id, id);

      const res = NextResponse.json({ ok: true, offer: result }, { status: 200 });
      for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
        res.headers.set(k, v);
      }
      return res;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof OfferValidationError ||
        error instanceof DomainError
      ) {
        return safeErrorResponse(error, {
          service: "offer",
          event: "offer.media.finalize.failed",
          correlationId: store.correlationId,
        });
      }

      return safeErrorResponse(error, {
        service: "offer",
        event: "offer.media.finalize.failed",
        correlationId: store.correlationId,
      });
    }
  });
}
