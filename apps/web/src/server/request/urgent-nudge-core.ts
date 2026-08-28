/**
 * ACİL NUDGE İŞİNİN SAF ÇEKİRDEĞİ — KB-22 (2026-08-28).
 *
 * NEDEN AYRI DOSYA. Çekirdek hiçbir somut istemciye bağlı DEĞİLDİR: Prisma
 * istemcisi ve bildirim yazıcısı dışarıdan verilir. `@/lib/prisma` modülü
 * yüklendiği anda bağlantı dizesini çözmeye çalışır ve `DATABASE_URL` yoksa
 * fırlatır; çekirdeği o modülden ayırmasaydık iş kuralları GERÇEK BİR
 * VERİTABANI OLMADAN hiç ölçülemezdi. Bağımlılıklar port olarak geçtiği için
 * transaction sınırı, geri alma ve eşzamanlılık saf fonksiyon üzerinde
 * gözlemlenebilir.
 *
 * İKİNCİ BİR BİLDİRİM KOPYASI YOKTUR. Bildirim yazımı burada yeniden
 * yazılmaz; tek kanonik yazıcı (`createNotification`) bir port olarak
 * enjekte edilir ve transaction istemcisiyle çağrılır.
 */

import {
  URGENT_NO_OFFER_NUDGE_MESSAGE,
  URGENT_NO_OFFER_NUDGE_TITLE,
} from "@/lib/request/urgent-nudge-constants";

export const URGENT_NUDGE_BATCH_SIZE = 20;

export const URGENT_NUDGE_OPEN_STATUSES = [
  "PUBLISHED",
  "RECEIVING_OFFERS",
] as const;

export const URGENT_NUDGE_REAL_OFFER_STATUSES = [
  "SUBMITTED",
  "VIEWED",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

/** İşin ihtiyaç duyduğu EN DAR istemci yüzeyi. */
export type UrgentNudgeDb = {
  request: {
    findMany: (args: unknown) => Promise<
      { id: string; title: string; createdById: string }[]
    >;
    updateMany: (args: {
      where: Record<string, unknown>;
      data: { urgentOfferNudgeAt: Date };
    }) => Promise<{ count: number }>;
  };
  $transaction: <T>(fn: (tx: UrgentNudgeDb) => Promise<T>) => Promise<T>;
};

/** Kanonik bildirim yazıcısının portu — ikinci bir kopya değildir. */
export type UrgentNudgeNotifier = (
  input: {
    userId: string;
    type: "GENERAL";
    title: string;
    message: string;
    actionUrl: string;
    requestId: string;
  },
  client: UrgentNudgeDb,
) => Promise<unknown>;

export type UrgentNudgeScanInput = {
  db: UrgentNudgeDb;
  notify: UrgentNudgeNotifier;
  /** Yalnız bu kullanıcının talepleri; verilmezse VADESİ GELEN her talep. */
  userId?: string | null;
  now?: Date;
  waitMs: number;
};

/**
 * TEK TARAMA ÇEKİRDEĞİ. Poller (kullanıcıya bağlı) ve cron (kullanıcıdan
 * bağımsız) AYNI kodu koşar; iki ayrı uygulama zamanla ayrışırdı.
 *
 * SAHİPLİK TALEPTEN TÜRER. Bildirim alıcısı her zaman talebin
 * `createdById` değeridir — çağıranın verdiği bir kimlik değil. Cron
 * hiçbir istemci kimliğine güvenmez; poller'da ise `userId` yalnız
 * KAPSAMI daraltır, sahipliği belirlemez.
 */
export async function runUrgentNudgeScan(
  input: UrgentNudgeScanInput,
): Promise<{ created: number }> {
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - input.waitMs);

  const eligible = await input.db.request.findMany({
    where: {
      ...(input.userId ? { createdById: input.userId } : {}),
      deletedAt: null,
      isUrgent: true,
      urgentOfferNudgeAt: null,
      status: { in: [...URGENT_NUDGE_OPEN_STATUSES] },
      offers: {
        none: { status: { in: [...URGENT_NUDGE_REAL_OFFER_STATUSES] } },
      },
      OR: [
        { publishedAt: { lte: cutoff } },
        { AND: [{ publishedAt: null }, { createdAt: { lte: cutoff } }] },
      ],
    },
    select: { id: true, title: true, createdById: true },
    /* Sıra DETERMİNİSTİK: aynı girdi iki koşuda aynı batch'i verir. */
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: URGENT_NUDGE_BATCH_SIZE,
  });

  let created = 0;

  for (const request of eligible) {
    /**
     * CLAIM VE BİLDİRİM AYNI İŞLEMDE (KB-22). Önce damga atıp sonra
     * bildirimi ayrı yazmak, bildirim hata verdiğinde talebi kalıcı olarak
     * "nudge edilmiş" bırakırdı: kullanıcı hiçbir zaman uyarılmaz ve koşul
     * (`urgentOfferNudgeAt: null`) bir daha sağlanmadığı için yeniden
     * denenemezdi.
     */
    const done = await input.db.$transaction(async (tx) => {
      const claimed = await tx.request.updateMany({
        where: {
          id: request.id,
          createdById: request.createdById,
          urgentOfferNudgeAt: null,
          isUrgent: true,
          status: { in: [...URGENT_NUDGE_OPEN_STATUSES] },
          offers: {
            none: { status: { in: [...URGENT_NUDGE_REAL_OFFER_STATUSES] } },
          },
        },
        data: { urgentOfferNudgeAt: now },
      });

      if (claimed.count === 0) return false;

      await input.notify(
        {
          userId: request.createdById,
          type: "GENERAL",
          title: URGENT_NO_OFFER_NUDGE_TITLE,
          message: URGENT_NO_OFFER_NUDGE_MESSAGE,
          actionUrl: `/panel/taleplerim/${request.id}?acil-yayin=1`,
          requestId: request.id,
        },
        tx,
      );

      return true;
    });

    if (done) created += 1;
  }

  return { created };
}
