import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  bindCorrelationFromRequest,
  correlationResponseHeaders,
  runWithCorrelationAsync,
} from "@/lib/observability/correlation";
import { mapUnknownToSafeError, safeErrorResponse } from "@/lib/observability/errors";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  createOffer,
  OfferQuotaExceededError,
  OfferValidationError,
} from "@/server/offer/offer-service";

export async function POST(request: Request) {
  const store = bindCorrelationFromRequest(request, { surface: "api.offers" });

  return runWithCorrelationAsync(store, async () => {
    try {
      const user = await requireUser();
      store.userId = user.id;
      const body = (await request.json()) as Record<string, unknown>;

      const offer = await createOffer(user.id, {
        requestId: String(body.requestId ?? ""),
        description: String(body.description ?? ""),
        amount: Number(body.amount),
        deliveryDays: body.deliveryDays ? Number(body.deliveryDays) : undefined,
        title: body.title ? String(body.title) : undefined,
      });

      revalidatePath("/panel/taleplerim");
      revalidatePath(`/panel/taleplerim/${offer.requestId}`);
      revalidatePath("/panel/talepler");
      revalidatePath(`/panel/talepler/${offer.requestId}`);
      revalidatePath("/panel/gelen-teklifler");
      revalidatePath("/panel/teklifler");

      const res = NextResponse.json(
        {
          ok: true,
          offer,
          redirectTo: `/panel/teklifler?gonderildi=1`,
        },
        { status: 201 },
      );
      for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
        res.headers.set(k, v);
      }
      return res;
    } catch (error) {
      if (error instanceof OfferQuotaExceededError) {
        const mapped = mapUnknownToSafeError(error, store.correlationId);
        return NextResponse.json(
          { ...mapped.body, upgradeUrl: "/panel/plan" },
          {
            status: mapped.status,
            headers: correlationResponseHeaders(store),
          },
        );
      }

      if (
        error instanceof AuthenticationError ||
        error instanceof OfferValidationError
      ) {
        const res = safeErrorResponse(error, {
          service: "offer",
          event: "offer.create.failed",
          correlationId: store.correlationId,
        });
        for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
          res.headers.set(k, v);
        }
        return res;
      }

      const res = safeErrorResponse(error, {
        service: "offer",
        event: "offer.create.failed",
        correlationId: store.correlationId,
      });
      for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
        res.headers.set(k, v);
      }
      return res;
    }
  });
}
