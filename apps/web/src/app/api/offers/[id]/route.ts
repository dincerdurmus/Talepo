import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

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
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as {
      action?: string;
      note?: string;
    };

    if (body.action === "accept") {
      const result = await acceptOffer(user.id, id);
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
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }

    if (error instanceof OfferValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 400 },
      );
    }

    console.error("Teklif işlemi başarısız:", error);
    return NextResponse.json(
      { ok: false, message: "Teklif işlenirken bir hata oluştu." },
      { status: 500 },
    );
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

    const offer = await updateOffer(user.id, id, {
      description: String(body.description ?? ""),
      amount: Number(body.amount),
      deliveryDays:
        body.deliveryDays === undefined || body.deliveryDays === null
          ? null
          : Number(body.deliveryDays),
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
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }

    if (error instanceof OfferValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[PATCH /api/offers/:id] Teklif güncellenemedi:", error);
    return NextResponse.json(
      { ok: false, message: "Teklif güncellenirken bir hata oluştu." },
      { status: 500 },
    );
  }
}
