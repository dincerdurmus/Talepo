/**
 * İNCELEME KUYRUĞUNDAKİ TALEBİN ADMİN KARARI (D-0032).
 *
 * İki sonuç vardır ve ikisi de buradan geçer:
 *
 *   ONAY  — talep O AN yayınlanır. "Onay anı yayın anıdır": durum, yayın
 *           zamanı ve tedarikçi görünürlüğü aynı anda açılır, eşleştirme ve
 *           bildirim hemen tetiklenir. Sonradan çalışacak bir cron'a
 *           bırakılmaz; kullanıcı beklemişken bir kez daha bekletilmez.
 *   RET   — talep yayınlanmaz. Gerekçe ZORUNLUDUR ve kullanıcıya aynen
 *           gösterilir; gerekçesiz ret, kullanıcıya hiçbir şey öğretmez.
 *
 * Neden rotada değil de burada: rota HTTP'dir, bu bir ürün kararıdır. Admin
 * paneli, ileride eklenecek toplu işlem ya da bir test koşucusu aynı
 * fonksiyonu çağırır ve karar tek yerde kalır.
 */
import { prisma } from "@/lib/prisma";
import { createSubsystemLogger } from "@/lib/observability/logger";
import { REVIEW_HOLD_STATUS } from "@/lib/request/review-hold";

import { distributeRequestToCompanies } from "./distribute-request";

const log = createSubsystemLogger("request");

export type ReviewHoldOutcome = {
  requestId: string;
  applied: boolean;
  /** Onayda tetiklenen dağıtımın sonucu; rette her zaman sıfırdır. */
  distribution: { matchedCompanyCount: number; notifiedUserCount: number };
};

/** Kuyruktaki talebi onayla: yayına al ve eşleştirmeyi O AN tetikle. */
export async function approveHeldRequest(input: {
  requestId: string;
  adminUserId: string;
}): Promise<ReviewHoldOutcome> {
  const now = new Date();
  const updated = await prisma.request.updateMany({
    where: { id: input.requestId, status: REVIEW_HOLD_STATUS, deletedAt: null },
    data: {
      status: "PUBLISHED",
      publishedAt: now,
      visibleToSuppliersAt: now,
      isModerationHidden: false,
      moderationHiddenAt: null,
      moderationHiddenById: null,
      moderationReason: null,
    },
  });
  if (updated.count !== 1) {
    // Kuyrukta değilse hiçbir şey yapılmaz; iki admin aynı anda onaylarsa
    // ikincisi sessizce boşa düşer, talep iki kez yayınlanmaz.
    return { requestId: input.requestId, applied: false, distribution: { matchedCompanyCount: 0, notifiedUserCount: 0 } };
  }

  const request = await prisma.request.findUnique({
    where: { id: input.requestId },
    select: { id: true, title: true, createdById: true },
  });
  if (request) {
    await prisma.notification.create({
      data: {
        userId: request.createdById,
        type: "REQUEST_PUBLISHED",
        title: "Talebiniz yayınlandı",
        message: `“${request.title}” başlıklı talebiniz kontrolden geçti ve yayınlandı.`,
        actionUrl: `/panel/taleplerim/${request.id}`,
        requestId: request.id,
      },
    });
  }

  let distribution = { matchedCompanyCount: 0, notifiedUserCount: 0 };
  try {
    distribution = await distributeRequestToCompanies(input.requestId);
  } catch (error) {
    // Dağıtım yumuşak bir hata verirse onay geri alınmaz: talep yayındadır ve
    // eşleştirme backfill cron'uyla tamamlanır. Onayı geri almak, kullanıcıyı
    // ikinci kez kuyruğa sokmak olurdu.
    log.warn("request.review_hold.distribute_failed", {
      outcome: "fallback",
      requestId: input.requestId,
      context: { errorName: error instanceof Error ? error.name : "unknown" },
    });
  }

  log.info("request.review_hold.approved", {
    outcome: "success",
    requestId: input.requestId,
    context: { adminUserId: input.adminUserId },
  });
  return { requestId: input.requestId, applied: true, distribution };
}

/** Kuyruktaki talebi reddet: yayınlanmaz, gerekçe kullanıcıya gider. */
export async function rejectHeldRequest(input: {
  requestId: string;
  adminUserId: string;
  reason: string;
}): Promise<ReviewHoldOutcome> {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new Error("Ret gerekçesi en az 5 karakter olmalı.");
  }
  const now = new Date();
  const updated = await prisma.request.updateMany({
    where: { id: input.requestId, status: REVIEW_HOLD_STATUS, deletedAt: null },
    data: {
      isModerationHidden: true,
      moderationHiddenAt: now,
      moderationHiddenById: input.adminUserId,
      moderationReason: reason,
    },
  });
  if (updated.count !== 1) {
    return { requestId: input.requestId, applied: false, distribution: { matchedCompanyCount: 0, notifiedUserCount: 0 } };
  }

  const request = await prisma.request.findUnique({
    where: { id: input.requestId },
    select: { id: true, title: true, createdById: true },
  });
  if (request) {
    await prisma.notification.create({
      data: {
        userId: request.createdById,
        type: "GENERAL",
        title: "Talebiniz yayınlanamadı",
        message: `“${request.title}” başlıklı talebiniz yayınlanamadı. Gerekçe: ${reason}`,
        actionUrl: `/panel/taleplerim/${request.id}`,
        requestId: request.id,
      },
    });
  }

  log.info("request.review_hold.rejected", {
    outcome: "success",
    requestId: input.requestId,
    context: { adminUserId: input.adminUserId },
  });
  return { requestId: input.requestId, applied: true, distribution: { matchedCompanyCount: 0, notifiedUserCount: 0 } };
}
