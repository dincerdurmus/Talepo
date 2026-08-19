import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  bindCorrelationFromRequest,
  correlationResponseHeaders,
  runWithCorrelationAsync,
} from "@/lib/observability/correlation";
import {
  mapUnknownToSafeError,
  safeErrorResponse,
} from "@/lib/observability/errors";
import {
  findIdempotentResource,
  IdempotencyScope,
  readIdempotencyKeyFromRequest,
  saveIdempotentResource,
} from "@/lib/observability/idempotency";
import {
  assertRateLimit,
  clientKeyFromRequest,
  userKey,
} from "@/lib/observability/rate-limit";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { assertUserCanAct } from "@/server/auth/assert-user-can-act";
import {
  createOffer,
  OfferQuotaExceededError,
  OfferValidationError,
} from "@/server/offer/offer-service";

export async function POST(request: Request) {
  const store = bindCorrelationFromRequest(request, { surface: "api.offers" });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "offer.create"),
        limit: 30,
        windowMs: 60_000,
      });

      const user = await requireUser();
      await assertUserCanAct(user.id);
      store.userId = user.id;

      assertRateLimit({
        key: userKey("offer.create", user.id),
        limit: 15,
        windowMs: 60_000,
      });

      const idempotencyKey = readIdempotencyKeyFromRequest(request);
      if (idempotencyKey) {
        const existing = await findIdempotentResource({
          userId: user.id,
          scope: IdempotencyScope.OFFER_SUBMIT,
          key: idempotencyKey,
        });
        if (existing) {
          const offer = await prisma.offer.findFirst({
            where: { id: existing.resourceId, submittedById: user.id },
            select: {
              id: true,
              requestId: true,
              amount: true,
              currency: true,
            },
          });
          if (offer) {
            return NextResponse.json(
              {
                ok: true,
                offer,
                replayed: true,
                redirectTo: `/panel/teklifler?gonderildi=1`,
              },
              {
                status: 200,
                headers: correlationResponseHeaders(store),
              },
            );
          }
        }
      }

      const body = (await request.json()) as Record<string, unknown>;

      const offer = await createOffer(user.id, {
        requestId: String(body.requestId ?? ""),
        description: String(body.description ?? ""),
        amount: Number(body.amount),
        deliveryDays: body.deliveryDays ? Number(body.deliveryDays) : undefined,
        title: body.title ? String(body.title) : undefined,
        deferMediaFinalize: body.deferMediaFinalize === true,
        attributionTouch:
          typeof body.attributionTouch === "string"
            ? body.attributionTouch
            : null,
      });

      if (idempotencyKey) {
        await saveIdempotentResource({
          userId: user.id,
          scope: IdempotencyScope.OFFER_SUBMIT,
          key: idempotencyKey,
          resourceId: offer.id,
        });
      }

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
