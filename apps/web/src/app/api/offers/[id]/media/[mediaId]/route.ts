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
import { readOfferMediaBytes } from "@/server/offer/offer-media-service";
import { OfferValidationError } from "@/server/offer/offer-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const store = bindCorrelationFromRequest(request, {
    surface: "api.offer.media.read",
  });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "offer.media.read"),
        limit: 120,
        windowMs: 60_000,
      });

      const user = await requireUser();
      store.userId = user.id;
      assertRateLimit({
        key: userKey("offer.media.read", user.id),
        limit: 80,
        windowMs: 60_000,
      });

      const { id, mediaId } = await params;
      const file = await readOfferMediaBytes(user.id, id, mediaId);

      const res = new NextResponse(new Uint8Array(file.bytes), {
        status: 200,
        headers: {
          "Content-Type": file.mimeType,
          "Content-Length": String(file.byteLength),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": "inline",
          ...correlationResponseHeaders(store),
        },
      });
      return res;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof OfferValidationError ||
        error instanceof DomainError
      ) {
        return safeErrorResponse(error, {
          service: "offer",
          event: "offer.media.read.failed",
          correlationId: store.correlationId,
        });
      }

      return safeErrorResponse(error, {
        service: "offer",
        event: "offer.media.read.failed",
        correlationId: store.correlationId,
      });
    }
  });
}
