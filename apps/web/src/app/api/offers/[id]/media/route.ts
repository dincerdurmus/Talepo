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
import { attachOfferMedia } from "@/server/offer/offer-media-service";
import { OfferValidationError } from "@/server/offer/offer-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = bindCorrelationFromRequest(request, {
    surface: "api.offer.media",
  });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "offer.media"),
        limit: 40,
        windowMs: 60_000,
      });

      const user = await requireUser();
      store.userId = user.id;
      assertRateLimit({
        key: userKey("offer.media", user.id),
        limit: 20,
        windowMs: 60_000,
      });

      const { id } = await params;
      const form = await request.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        throw new OfferValidationError(["Fotoğraf dosyası gerekli."]);
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const media = await attachOfferMedia(user.id, id, {
        bytes,
        claimedMime: file.type || null,
        originalName: file.name || null,
      });

      const res = NextResponse.json({ ok: true, media }, { status: 201 });
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
          event: "offer.media.attach.failed",
          correlationId: store.correlationId,
        });
      }

      return safeErrorResponse(error, {
        service: "offer",
        event: "offer.media.attach.failed",
        correlationId: store.correlationId,
      });
    }
  });
}
