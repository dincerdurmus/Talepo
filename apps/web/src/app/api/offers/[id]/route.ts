import { NextResponse } from "next/server";

import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  acceptOffer,
  OfferValidationError,
  rejectOffer,
} from "@/server/offer/offer-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as { action?: string };

    if (body.action === "accept") {
      const result = await acceptOffer(user.id, id);
      return NextResponse.json({
        ok: true,
        conversationId: result.conversationId,
        redirectTo: `/panel/mesajlar/${result.conversationId}`,
      });
    }

    if (body.action === "reject") {
      await rejectOffer(user.id, id);
      return NextResponse.json({ ok: true });
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
