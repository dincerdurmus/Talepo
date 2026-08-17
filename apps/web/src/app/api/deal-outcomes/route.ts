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
  assertCanAccessDealOutcome,
  confirmDealCompletion,
  getDealOutcomeForConversation,
} from "@/server/price-intelligence/deal-outcome";

function serializeDeal(deal: {
  agreedPrice: { toNumber(): number } | number | null;
  buyerConfirmedAt: Date | null;
  supplierConfirmedAt: Date | null;
  completedAt: Date | null;
  [key: string]: unknown;
}) {
  return {
    ...deal,
    agreedPrice:
      deal.agreedPrice == null
        ? null
        : typeof deal.agreedPrice === "number"
          ? deal.agreedPrice
          : deal.agreedPrice.toNumber(),
    buyerConfirmedAt: deal.buyerConfirmedAt?.toISOString() ?? null,
    supplierConfirmedAt: deal.supplierConfirmedAt?.toISOString() ?? null,
    completedAt: deal.completedAt?.toISOString() ?? null,
  };
}

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

    await assertCanAccessDealOutcome(user.id, deal);

    return NextResponse.json({
      ok: true,
      dealOutcome: serializeDeal(deal),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return safeErrorResponse(error, {
      service: "deal",
      event: "deal.outcome.read.failed",
    });
  }
}

export async function POST(request: Request) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "deal.completion"),
      limit: 30,
      windowMs: 60_000,
    });
    const user = await requireUser();
    assertRateLimit({
      key: userKey("deal.completion", user.id),
      limit: 20,
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      dealOutcomeId?: string;
      response?: string;
    };

    if (!body.dealOutcomeId) {
      return NextResponse.json(
        { ok: false, message: "dealOutcomeId gerekli." },
        { status: 400 },
      );
    }

    if (body.response && body.response !== "COMPLETED") {
      return NextResponse.json(
        {
          ok: false,
          message: "Bu sürümde yalnız işlemin tamamlandığını onaylayabilirsiniz.",
        },
        { status: 400 },
      );
    }

    const updated = await confirmDealCompletion(user.id, body.dealOutcomeId);
    revalidatePath("/panel/mesajlar");
    revalidatePath("/panel/profil");
    revalidatePath("/panel/analiz");

    return NextResponse.json({
      ok: true,
      dealOutcome: serializeDeal(updated),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof DomainError) {
      return safeErrorResponse(error, {
        service: "deal",
        event: "deal.completion.failed",
      });
    }
    return safeErrorResponse(error, {
      service: "deal",
      event: "deal.completion.failed",
    });
  }
}
