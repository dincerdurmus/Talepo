import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  createOffer,
  OfferQuotaExceededError,
  OfferValidationError,
} from "@/server/offer/offer-service";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
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

    return NextResponse.json(
      {
        ok: true,
        offer,
        redirectTo: `/panel/teklifler?gonderildi=1`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }

    if (error instanceof OfferQuotaExceededError) {
      return NextResponse.json(
        {
          ok: false,
          code: "OFFER_QUOTA_EXCEEDED",
          message: error.message,
          upgradeUrl: "/panel/plan",
        },
        { status: 402 },
      );
    }

    if (error instanceof OfferValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[POST /api/offers] Teklif oluşturulamadı:", error);
    return NextResponse.json(
      { ok: false, message: "Teklif kaydedilirken beklenmeyen bir hata oluştu." },
      { status: 500 },
    );
  }
}
