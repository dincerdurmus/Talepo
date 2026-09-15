import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
} from "@/lib/observability/rate-limit";
import { requireUser } from "@/server/auth/require-user";
import {
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
  SubscriptionCancelError,
} from "@/server/billing/cancel-subscription";
import { resolveBillingSubjectForUser } from "@/server/billing/resolve-billing-subject";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    assertRateLimit({
      key: clientKeyFromRequest(request, `billing.cancel.${user.id}`),
      limit: 5,
      windowMs: 60_000,
    });

    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
    };
    const action = body.action === "resume" ? "resume" : "cancel";

    const subject = await resolveBillingSubjectForUser(user.id);
    const outcome =
      action === "resume"
        ? await resumeSubscription(subject, user.id)
        : await cancelSubscriptionAtPeriodEnd(subject, user.id);

    return NextResponse.json({
      ok: true,
      action,
      subscription: outcome,
      message:
        action === "resume"
          ? "Aboneliğiniz devam edecek."
          : "Aboneliğiniz dönem sonunda sona erecek. Dönem sonuna kadar tüm özellikler açık kalır; sonraki dönem için tahsilat yapılmaz. Tahsil edilmiş dönem iade edilmez.",
    });
  } catch (error) {
    if (error instanceof SubscriptionCancelError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    return safeErrorResponse(error, {
      service: "billing",
      event: "billing.cancel.failed",
    });
  }
}
