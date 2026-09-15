import type { BillingSubjectRef } from "@/lib/billing/types";
import { createSubsystemLogger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";

import { assertCanMutateBilling } from "./assert-billing-permission";
import { getBillingProvider } from "./get-provider";

/**
 * ABONELİK İPTALİ — DÖNEM SONU (kurucu kararı, 2026-09-15).
 *
 * Ölçülen kusur: `cancelSubscription` sağlayıcı tarafında eksiksiz yazılmıştı
 * ama `src/` altında TEK BİR ÇAĞIRANI YOKTU — `/api/billing/` altında iptal
 * rotası yok, panelde iptal düğmesi yoktu. Ayda ödeme yapan kullanıcı
 * aboneliğini uygulama içinden iptal edemiyordu. Bu hem güven hem mevzuat
 * açığıydı.
 *
 * POLİTİKA (kurucu, 2026-09-15) — metinlerle birebir aynı olmalıdır:
 *   1. İptal, İÇİNDE BULUNULAN DÖNEMİN SONUNDA geçerli olur.
 *   2. Tahsil edilmiş dönem için İADE YAPILMAZ.
 *   3. Kullanıcı dönem sonuna kadar TÜM ücretli özelliklere erişmeye
 *      DEVAM EDER — iptal erişimi anında kesmez.
 *   4. Dönem sonunda plan ücretsize döner ve SONRAKİ DÖNEM TAHSİLAT YAPILMAZ.
 *
 * Bu yüzden burada plan düşürülmez ve `planExpiresAt` kısaltılmaz; yalnız
 * yenileme durdurulur. Düşürmeyi dönem sonunda sağlayıcı olayı yapar
 * (`apply-billing-event` → CANCELED/EXPIRED → STANDARD).
 *
 * SAĞLAYICI BAŞARISIZSA BAŞARI DÖNÜLMEZ. Yerel kaydı "iptal edildi" yapıp
 * sağlayıcıda aboneliği açık bırakmak, kullanıcıdan bir kez daha para
 * çekilmesi demektir. O yüzden sağlayıcı çağrısı başarısız olursa yerel kayıt
 * DEĞİŞMEZ ve çağıran hatayı görür.
 */

const log = createSubsystemLogger("billing.cancel");

export class SubscriptionCancelError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "SubscriptionCancelError";
  }
}

export type CancelOutcome = {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
};

async function loadSubscription(subject: BillingSubjectRef) {
  return prisma.billingSubscription.findUnique({
    where: {
      subjectType_subjectId: { subjectType: subject.type, subjectId: subject.id },
    },
    select: {
      id: true,
      status: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      provider: true,
      providerSubscriptionId: true,
    },
  });
}

export async function cancelSubscriptionAtPeriodEnd(
  subject: BillingSubjectRef,
  actorUserId: string,
): Promise<CancelOutcome> {
  /**
   * ROL KAPISI — SUNUCUDA (eklendi 2026-09-15, kod incelemesinde yakalandı).
   *
   * İlk yazımda bu satır YOKTU ve kusur şuydu: `resolveBillingSubjectForUser`
   * özneyi firma bağlam çerezinden çözüyor ve yalnız ACTIVE üyelik arıyor,
   * ROLE bakmıyor. Yani firmadaki en düşük yetkili üye — hatta ayrılmış ama
   * üyeliği silinmemiş eski bir çalışan — çereze firma kimliğini koyup tek
   * istekle firmanın ödediği aboneliği iptal edebiliyordu. Sağlayıcı tarafında
   * iptal ANINDA olduğu için de uygulama içinden geri alınamıyordu.
   *
   * Panel düğmeyi `canMutateBilling` ile gizliyordu, ama o İSTEMCİ tarafıdır;
   * kapı değildir. Kardeş para mutasyonlarının hepsi (checkout, kredi
   * checkout, membership) zaten bu kapıdan geçiyordu — yalnız iptal unutulmuştu.
   */
  await assertCanMutateBilling({ actorUserId, subject });

  const sub = await loadSubscription(subject);
  if (!sub) {
    throw new SubscriptionCancelError("İptal edilecek bir aboneliğiniz yok.", 404);
  }

  /* İDEMPOTENT: zaten iptal edilmişse ikinci çağrı hata değildir. */
  if (sub.status === "CANCEL_AT_PERIOD_END") {
    return {
      status: sub.status,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  if (sub.status !== "ACTIVE" && sub.status !== "PAST_DUE") {
    throw new SubscriptionCancelError(
      "Bu abonelik zaten aktif değil; iptal edilecek bir yenileme yok.",
      409,
    );
  }

  if (sub.providerSubscriptionId) {
    const provider = getBillingProvider();
    if (!provider.cancelSubscription) {
      throw new SubscriptionCancelError(
        "Abonelik iptali şu anda otomatik yapılamıyor. Destek ekibiyle iletişime geçin.",
        503,
      );
    }
    const result = await provider.cancelSubscription({
      providerSubscriptionId: sub.providerSubscriptionId,
      atPeriodEnd: true,
    });
    if (!result.ok) {
      /* Yerel kayda DOKUNULMAZ: sağlayıcıda yenileme açık kaldıysa kullanıcıya
         "iptal edildi" demek, bir sonraki dönem tahsilatını sürpriz yapar. */
      log.error("billing.cancel.provider_rejected", {
        outcome: "failure",
        context: { subjectType: subject.type, provider: sub.provider ?? "?" },
      });
      throw new SubscriptionCancelError(
        "Abonelik iptali şu anda tamamlanamadı. Lütfen tekrar deneyin; sorun sürerse destek ekibiyle iletişime geçin.",
        502,
      );
    }
  }

  const updated = await prisma.billingSubscription.update({
    where: { id: sub.id },
    data: {
      status: "CANCEL_AT_PERIOD_END",
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
    },
    select: { status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
  });

  /* Plan ve planExpiresAt BİLEREK dokunulmadan bırakılır — politika 3. */
  log.info("billing.cancel.scheduled", {
    outcome: "success",
    context: {
      subjectType: subject.type,
      hasProviderSubscription: Boolean(sub.providerSubscriptionId),
    },
  });

  return {
    status: updated.status,
    cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
    currentPeriodEnd: updated.currentPeriodEnd,
  };
}

/**
 * İPTALDEN VAZGEÇME. Dönem sonu gelmeden kullanıcı fikrini değiştirebilir
 * (kullanım koşulları §5.6). Sağlayıcıda abonelik zaten iptal edildiği için
 * yenilemenin yeniden kurulması gerekir; bu otomatik yapılamıyorsa kullanıcı
 * açıkça yeni bir satın alma akışına yönlendirilir — sessizce "devam ediyor"
 * denmez.
 */
export async function resumeSubscription(
  subject: BillingSubjectRef,
  actorUserId: string,
): Promise<CancelOutcome> {
  /* İptali geri almak da bir para mutasyonudur; aynı kapıdan geçer. */
  await assertCanMutateBilling({ actorUserId, subject });

  const sub = await loadSubscription(subject);
  if (!sub) {
    throw new SubscriptionCancelError("Aboneliğiniz bulunamadı.", 404);
  }
  if (sub.status !== "CANCEL_AT_PERIOD_END") {
    throw new SubscriptionCancelError(
      "İptal edilmiş bir yenileme yok.",
      409,
    );
  }
  if (sub.providerSubscriptionId) {
    throw new SubscriptionCancelError(
      "İptali geri almak için yeniden abone olmanız gerekiyor. Dönem sonuna kadar mevcut erişiminiz devam eder.",
      409,
    );
  }

  const updated = await prisma.billingSubscription.update({
    where: { id: sub.id },
    data: { status: "ACTIVE", cancelAtPeriodEnd: false, canceledAt: null },
    select: { status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
  });

  return {
    status: updated.status,
    cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
    currentPeriodEnd: updated.currentPeriodEnd,
  };
}
