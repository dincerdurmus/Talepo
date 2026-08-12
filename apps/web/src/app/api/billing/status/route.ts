import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
import { requireUser } from "@/server/auth/require-user";
import { getBillingSnapshot } from "@/server/billing/get-billing-snapshot";
import { getBillingProviderStatus } from "@/server/billing/get-provider";
import { resolveBillingSubjectForUser } from "@/server/billing/resolve-billing-subject";

export async function GET() {
  try {
    const user = await requireUser();
    const subject = await resolveBillingSubjectForUser(user.id);
    const snapshot = await getBillingSnapshot(subject);
    const provider = getBillingProviderStatus();

    return NextResponse.json({
      ok: true,
      provider,
      billing: snapshot,
    });
  } catch (error) {
    return safeErrorResponse(error, {
      service: "billing",
      event: "billing.status.failed",
    });
  }
}
