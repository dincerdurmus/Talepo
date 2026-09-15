import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
import { requireUser } from "@/server/auth/require-user";
import { getBillingSnapshot } from "@/server/billing/get-billing-snapshot";
import { getBillingProviderStatus } from "@/server/billing/get-provider";
import { recoverPendingSubscription } from "@/server/billing/recover-pending-subscription";
import { resolveBillingSubjectForUser } from "@/server/billing/resolve-billing-subject";

export async function GET() {
  try {
    const user = await requireUser();
    const subject = await resolveBillingSubjectForUser(user.id);

    /**
     * KAÇAN WEBHOOK KENDİLİĞİNDEN TOPARLANIR (2026-09-15).
     *
     * Kullanıcı "planım neden açılmadı" diye plan sayfasını açtığında bu
     * sorgu zaten koşuyor. Kayıt `PENDING`'de takılı kaldıysa sağlayıcıya
     * gerçek durum sorulur ve cevap kanonik olay kapısından geçirilir.
     * Fırlatmaz, plan açmaz, yetki üretmez: yalnız kaçan olayı geri getirir.
     */
    await recoverPendingSubscription(subject);

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
