import { NextResponse } from "next/server";

import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  getDealOutcomeForConversation,
  submitDealConfirmation,
  type DealConfirmationResponse,
} from "@/server/price-intelligence/deal-outcome";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { ok: false, message: "conversationId gerekli." },
        { status: 400 },
      );
    }

    const deal = await getDealOutcomeForConversation(conversationId);
    if (!deal) {
      return NextResponse.json({ ok: true, dealOutcome: null });
    }

    return NextResponse.json({
      ok: true,
      dealOutcome: {
        ...deal,
        agreedPrice: deal.agreedPrice?.toNumber() ?? null,
        buyerConfirmedAt: deal.buyerConfirmedAt?.toISOString() ?? null,
        supplierConfirmedAt: deal.supplierConfirmedAt?.toISOString() ?? null,
        completedAt: deal.completedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: "Kayıt alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const workspace = await getCompanyWorkspace(user.id);
    const body = await request.json();

    const dealOutcomeId = body.dealOutcomeId as string;
    const role = body.role as "buyer" | "supplier";
    const response = body.response as DealConfirmationResponse;
    const agreedPrice =
      body.agreedPrice != null ? Number(body.agreedPrice) : undefined;

    if (!dealOutcomeId || !role || !response) {
      return NextResponse.json(
        { ok: false, message: "Eksik alanlar." },
        { status: 400 },
      );
    }

    const updated = await submitDealConfirmation({
      dealOutcomeId,
      role,
      response,
      agreedPrice,
      userId: user.id,
      companyId: workspace?.companyId ?? null,
    });

    return NextResponse.json({
      ok: true,
      dealOutcome: {
        ...updated,
        agreedPrice: updated.agreedPrice?.toNumber() ?? null,
        buyerConfirmedAt: updated.buyerConfirmedAt?.toISOString() ?? null,
        supplierConfirmedAt: updated.supplierConfirmedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Kaydedilemedi.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
