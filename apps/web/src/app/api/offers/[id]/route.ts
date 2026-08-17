import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
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
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  acceptOffer,
  negotiateOffer,
  OfferValidationError,
  rejectOffer,
  updateOffer,
} from "@/server/offer/offer-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "offer.action"),
      limit: 40,
      windowMs: 60_000,
    });

    const user = await requireUser();
    assertRateLimit({
      key: userKey("offer.action", user.id),
      limit: 20,
      windowMs: 60_000,
    });

    const { id } = await params;
    const body = (await request.json()) as {
      action?: string;
      note?: string;
    };

    if (body.action === "accept") {
      const idempotencyKey = readIdempotencyKeyFromRequest(request);
      if (idempotencyKey) {
        const existing = await findIdempotentResource({
          userId: user.id,
          scope: IdempotencyScope.OFFER_ACCEPT,
          key: idempotencyKey,
        });
        if (existing) {
          return NextResponse.json({
            ok: true,
            conversationId: existing.resourceId,
            replayed: true,
            redirectTo: `/panel/mesajlar/${existing.resourceId}`,
          });
        }
      }

      const result = await acceptOffer(user.id, id);

      if (idempotencyKey) {
        await saveIdempotentResource({
          userId: user.id,
          scope: IdempotencyScope.OFFER_ACCEPT,
          key: idempotencyKey,
          resourceId: result.conversationId,
        });
      }

      revalidatePath("/panel/gelen-teklifler");
      revalidatePath("/panel/mesajlar");
      revalidatePath("/panel/teklifler");
      revalidatePath("/panel/taleplerim");
      return NextResponse.json({
        ok: true,
        conversationId: result.conversationId,
        redirectTo: `/panel/mesajlar/${result.conversationId}`,
      });
    }

    if (body.action === "reject") {
      await rejectOffer(user.id, id);
      revalidatePath("/panel/gelen-teklifler");
      revalidatePath("/panel/teklifler");
      revalidatePath("/panel/taleplerim");
      return NextResponse.json({ ok: true });
    }

    if (body.action === "negotiate") {
      const result = await negotiateOffer(user.id, id, body.note);
      revalidatePath("/panel/gelen-teklifler");
      revalidatePath("/panel/mesajlar");
      revalidatePath("/panel/teklifler");
      revalidatePath("/panel/taleplerim");
      return NextResponse.json({
        ok: true,
        conversationId: result.conversationId,
        redirectTo: `/panel/mesajlar/${result.conversationId}`,
      });
    }

    return NextResponse.json(
      { ok: false, message: "Geçersiz işlem." },
      { status: 400 },
    );
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof OfferValidationError
    ) {
      return safeErrorResponse(error, {
        service: "offer",
        event: "offer.action.failed",
      });
    }

    return safeErrorResponse(error, {
      service: "offer",
      event: "offer.action.failed",
    });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const amountProvided = Object.prototype.hasOwnProperty.call(body, "amount");
    const deliveryDaysProvided = Object.prototype.hasOwnProperty.call(
      body,
      "deliveryDays",
    );

    const offer = await updateOffer(user.id, id, {
      description: String(body.description ?? ""),
      amount: amountProvided ? Number(body.amount) : undefined,
      amountProvided,
      deliveryDays: deliveryDaysProvided
        ? body.deliveryDays === null || body.deliveryDays === ""
          ? null
          : Number(body.deliveryDays)
        : undefined,
      deliveryDaysProvided,
      title: body.title ? String(body.title) : undefined,
    });

    revalidatePath("/panel/teklifler");
    revalidatePath("/panel/talepler");
    revalidatePath(`/panel/talepler/${offer.requestId}`);
    revalidatePath(`/panel/talepler/${offer.requestId}/teklif`);
    revalidatePath("/panel/taleplerim");
    revalidatePath(`/panel/taleplerim/${offer.requestId}`);
    revalidatePath("/panel/gelen-teklifler");

    return NextResponse.json({
      ok: true,
      offer,
      redirectTo: `/panel/teklifler?guncellendi=1`,
    });
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof OfferValidationError
    ) {
      return safeErrorResponse(error, {
        service: "offer",
        event: "offer.update.failed",
      });
    }

    return safeErrorResponse(error, {
      service: "offer",
      event: "offer.update.failed",
    });
  }
}
