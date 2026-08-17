import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { DomainError, safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
  userKey,
} from "@/lib/observability/rate-limit";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { createDealReview } from "@/server/offer/deal-review-service";

export async function POST(request: Request) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "deal.review"),
      limit: 20,
      windowMs: 60_000,
    });
    const user = await requireUser();
    assertRateLimit({
      key: userKey("deal.review", user.id),
      limit: 12,
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      dealOutcomeId?: string;
      rating?: unknown;
      comment?: string | null;
      targetUserId?: string;
      targetCompanyId?: string;
    };

    if (!body.dealOutcomeId) {
      return NextResponse.json(
        { ok: false, message: "dealOutcomeId gerekli." },
        { status: 400 },
      );
    }

    const review = await createDealReview({
      userId: user.id,
      dealOutcomeId: body.dealOutcomeId,
      rating: body.rating,
      comment: body.comment,
    });

    revalidatePath("/panel/mesajlar");
    revalidatePath("/panel/profil");
    revalidatePath("/panel/gelen-teklifler");

    return NextResponse.json({ ok: true, review }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof DomainError) {
      return safeErrorResponse(error, {
        service: "deal",
        event: "deal.review.failed",
      });
    }
    return safeErrorResponse(error, {
      service: "deal",
      event: "deal.review.failed",
    });
  }
}
