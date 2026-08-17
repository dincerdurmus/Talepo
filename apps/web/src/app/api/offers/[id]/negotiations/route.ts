import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { DomainError, safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
  userKey,
} from "@/lib/observability/rate-limit";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  acceptPendingNegotiation,
  proposeOfferNegotiation,
  rejectPendingNegotiation,
} from "@/server/offer/offer-negotiation-service";
import { OfferValidationError } from "@/server/offer/offer-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "offer.negotiation"),
      limit: 40,
      windowMs: 60_000,
    });
    const user = await requireUser();
    assertRateLimit({
      key: userKey("offer.negotiation", user.id),
      limit: 20,
      windowMs: 60_000,
    });

    const { id } = await params;
    const body = (await request.json()) as {
      action?: string;
      amount?: number;
    };

    if (body.action === "propose") {
      const negotiation = await proposeOfferNegotiation(
        user.id,
        id,
        Number(body.amount),
      );
      revalidatePath("/panel/gelen-teklifler");
      revalidatePath("/panel/teklifler");
      revalidatePath("/panel/taleplerim");
      return NextResponse.json({ ok: true, negotiation }, { status: 201 });
    }

    if (body.action === "reject") {
      const negotiation = await rejectPendingNegotiation(user.id, id);
      revalidatePath("/panel/gelen-teklifler");
      revalidatePath("/panel/teklifler");
      revalidatePath("/panel/taleplerim");
      return NextResponse.json({ ok: true, negotiation });
    }

    if (body.action === "accept") {
      const result = await acceptPendingNegotiation(user.id, id);
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
      { ok: false, message: "Geçersiz pazarlık işlemi." },
      { status: 400 },
    );
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof OfferValidationError ||
      error instanceof DomainError
    ) {
      return safeErrorResponse(error, {
        service: "offer",
        event: "offer.negotiation.failed",
      });
    }
    return safeErrorResponse(error, {
      service: "offer",
      event: "offer.negotiation.failed",
    });
  }
}
