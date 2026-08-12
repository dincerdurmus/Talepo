import { NextResponse } from "next/server";

import { BillingError } from "@/lib/billing/errors";
import { OFFER_CREDIT_PACKS } from "@/lib/membership/plans";
import { safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
  userKey,
} from "@/lib/observability/rate-limit";
import { requireUser } from "@/server/auth/require-user";
import { createCreditCheckout } from "@/server/billing/create-credit-checkout";
import { resolveBillingSubjectForUser } from "@/server/billing/resolve-billing-subject";

export async function POST(request: Request) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "billing.credits"),
      limit: 10,
      windowMs: 60_000,
    });

    const user = await requireUser();
    assertRateLimit({
      key: userKey("billing.credits", user.id),
      limit: 5,
      windowMs: 60_000,
    });

    const body = (await request.json()) as { packId?: string };
    const packId = body.packId as keyof typeof OFFER_CREDIT_PACKS | undefined;
    if (!packId || !OFFER_CREDIT_PACKS[packId]) {
      return NextResponse.json(
        { ok: false, message: "Geçersiz paket." },
        { status: 400 },
      );
    }

    const origin = new URL(request.url).origin;
    const subject = await resolveBillingSubjectForUser(user.id);
    const session = await createCreditCheckout({
      actorUserId: user.id,
      subject,
      packId,
      successUrl: `${origin}/panel/plan?billing=pending&credits=1`,
      cancelUrl: `${origin}/panel/plan?billing=cancel`,
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: session.checkoutUrl,
      providerSessionId: session.providerSessionId,
      status: "PENDING",
      credits: session.credits,
      message:
        "Kredi ödemesi doğrulanana kadar (webhook) kotaya eklenmez.",
    });
  } catch (error) {
    if (error instanceof BillingError) {
      return safeErrorResponse(error, {
        service: "billing",
        event: "billing.credit.checkout.failed",
      });
    }
    return safeErrorResponse(error, {
      service: "billing",
      event: "billing.credit.checkout.failed",
    });
  }
}
