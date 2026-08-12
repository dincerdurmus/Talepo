import { NextResponse } from "next/server";

import { BillingError } from "@/lib/billing/errors";
import type { PlanTierId } from "@/lib/membership/plans";
import { safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
  userKey,
} from "@/lib/observability/rate-limit";
import { requireUser } from "@/server/auth/require-user";
import { createPlanCheckout } from "@/server/billing/create-checkout";
import { resolveBillingSubjectForUser } from "@/server/billing/resolve-billing-subject";

export async function POST(request: Request) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "billing.checkout"),
      limit: 10,
      windowMs: 60_000,
    });

    const user = await requireUser();
    assertRateLimit({
      key: userKey("billing.checkout", user.id),
      limit: 5,
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      planTier?: PlanTierId;
      successUrl?: string;
      cancelUrl?: string;
    };

    // Never trust client price — only planTier enum
    const planTier = body.planTier;
    if (
      planTier !== "PREMIUM" &&
      planTier !== "PROFESSIONAL" &&
      planTier !== "CORPORATE"
    ) {
      return NextResponse.json(
        { ok: false, code: "PLAN_MAPPING_INVALID", message: "Geçersiz plan." },
        { status: 400 },
      );
    }

    const origin = new URL(request.url).origin;
    const subject = await resolveBillingSubjectForUser(user.id);
    const session = await createPlanCheckout({
      actorUserId: user.id,
      subject,
      planTier,
      successUrl:
        body.successUrl?.startsWith(origin)
          ? body.successUrl
          : `${origin}/panel/plan?billing=pending`,
      cancelUrl:
        body.cancelUrl?.startsWith(origin)
          ? body.cancelUrl
          : `${origin}/panel/plan?billing=cancel`,
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: session.checkoutUrl,
      providerSessionId: session.providerSessionId,
      checkoutFormContent: session.checkoutFormContent,
      token: session.token,
      status: "PENDING",
      message: "Ödeme oturumu oluşturuldu. Plan webhook doğrulanana kadar açılmaz.",
    });
  } catch (error) {
    if (error instanceof BillingError) {
      return safeErrorResponse(error, {
        service: "billing",
        event: "billing.checkout.failed",
      });
    }
    return safeErrorResponse(error, {
      service: "billing",
      event: "billing.checkout.failed",
    });
  }
}
