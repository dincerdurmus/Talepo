import type {
  BillingProviderId,
  BillingSubjectRef,
} from "@/lib/billing/types";
import { createSubsystemLogger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";

import { applyCanonicalBillingEvent } from "./apply-billing-event";
import { getBillingProvider } from "./get-provider";

/**
 * KAÇAN WEBHOOK'TAN KURTARMA (2026-09-15).
 *
 * Ölçülen kusur: plan YALNIZ imzalı webhook ile açılıyordu (doğru tasarım) ve
 * tarayıcı dönüşü bilinçli olarak `PENDING` bırakıyordu. Ama webhook kaçarsa
 * kurtarma yolu YOKTU: `reconcileBillingEntitlement` yalnız teşhis üretiyor,
 * üstelik `src/` altında hiç çağrılmıyordu. Parası çekilmiş ama planı
 * açılmamış kullanıcı için tek çare veritabanına elle müdahaleydi.
 *
 * ÇÖZÜM, İKİNCİ BİR YETKİ DEĞİL: burada plan AÇILMAZ. Sağlayıcıya "bu
 * abonelik gerçekte ne durumda" diye sorulur ve cevap, webhook'un ürettiği
 * KANONİK OLAY olarak aynı işlemciye verilir. Böylece yetki tek yerde kalır
 * (`applyCanonicalBillingEvent`), geçiş kuralları ve idempotens aynen çalışır.
 *
 * İDEMPOTENS: olay kimliği sağlayıcı abonelik kimliği + dönem sonundan
 * türetilir. Aynı dönem için ikinci kurtarma çağrısı `duplicate` döner ve
 * hiçbir şey iki kez uygulanmaz; webhook sonradan gelirse o da aynı kapıdan
 * geçer.
 *
 * SESSİZ ÇALIŞIR VE ASLA FIRLATMAZ: çağıran yüzey (plan sayfası) bu iş
 * yüzünden bozulamaz.
 */

const log = createSubsystemLogger("billing.recover");

/** Bu süreden eski bir PENDING kayıt, kaçmış webhook şüphesi doğurur. */
const PENDING_GRACE_MS = 2 * 60 * 1000;

const ACTIVE_PROVIDER_STATES = new Set([
  "ACTIVE",
  "LIVE",
  "SUCCESS",
  "SUCCEEDED",
]);

export async function recoverPendingSubscription(
  subject: BillingSubjectRef,
): Promise<{ recovered: boolean; reason: string }> {
  try {
    const sub = await prisma.billingSubscription.findUnique({
      where: {
        subjectType_subjectId: {
          subjectType: subject.type,
          subjectId: subject.id,
        },
      },
      select: {
        status: true,
        planTier: true,
        provider: true,
        providerSubscriptionId: true,
        providerCustomerId: true,
        updatedAt: true,
      },
    });

    if (!sub) return { recovered: false, reason: "no_subscription" };
    if (sub.status !== "PENDING") {
      return { recovered: false, reason: "not_pending" };
    }
    if (!sub.providerSubscriptionId) {
      return { recovered: false, reason: "no_provider_subscription" };
    }
    if (Date.now() - sub.updatedAt.getTime() < PENDING_GRACE_MS) {
      /* Webhook'a makul bir şans verilir; yarışıp gereksiz sorgu atılmaz. */
      return { recovered: false, reason: "within_grace" };
    }

    const provider = getBillingProvider();
    if (!provider.getSubscriptionStatus) {
      return { recovered: false, reason: "provider_lookup_unsupported" };
    }

    const remote = await provider.getSubscriptionStatus(
      sub.providerSubscriptionId,
    );
    if (!ACTIVE_PROVIDER_STATES.has(remote.status.toUpperCase())) {
      return { recovered: false, reason: `provider_status_${remote.status}` };
    }

    const periodEnd = remote.currentPeriodEnd ?? null;
    const result = await applyCanonicalBillingEvent({
      provider: (sub.provider as BillingProviderId) ?? "iyzico",
      /* Dönemden türeyen deterministik kimlik — aynı dönem iki kez uygulanmaz. */
      providerEventId: `recovery:${sub.providerSubscriptionId}:${
        periodEnd ? periodEnd.toISOString() : "nope"
      }`,
      eventType: "SUBSCRIPTION_ACTIVATED",
      occurredAt: new Date(),
      subject,
      planTier: sub.planTier,
      providerSubscriptionId: sub.providerSubscriptionId,
      providerCustomerId: sub.providerCustomerId ?? undefined,
      currentPeriodEnd: periodEnd ?? undefined,
      safeMetadata: { source: "recovery" },
    });

    const recovered = result.outcome === "processed";
    log.info("billing.recover.attempted", {
      outcome: recovered ? "success" : "skipped",
      context: { subjectType: subject.type, applyOutcome: result.outcome },
    });
    return { recovered, reason: result.outcome };
  } catch (error) {
    log.error("billing.recover.failed", {
      outcome: "failure",
      context: {
        subjectType: subject.type,
        errorName: error instanceof Error ? error.name : "unknown",
      },
    });
    return { recovered: false, reason: "error" };
  }
}
