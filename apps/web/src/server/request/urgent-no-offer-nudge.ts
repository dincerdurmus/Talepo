import { prisma } from "@/lib/prisma";
import { URGENT_NO_OFFER_NUDGE_MS } from "@/lib/request/urgent-nudge-constants";
import {
  createNotification,
  type NotificationWriteClient,
} from "@/server/notifications/create-notification";
import { distributeRequestToCompanies } from "@/server/request/distribute-request";

import {
  runUrgentNudgeScan,
  URGENT_NUDGE_OPEN_STATUSES as OPEN_STATUSES,
  type UrgentNudgeDb,
} from "./urgent-nudge-core";

export {
  URGENT_NO_OFFER_NUDGE_MESSAGE,
  URGENT_NO_OFFER_NUDGE_MS,
  URGENT_NO_OFFER_NUDGE_TITLE,
} from "@/lib/request/urgent-nudge-constants";

export {
  URGENT_NUDGE_BATCH_SIZE,
  runUrgentNudgeScan,
  type UrgentNudgeDb,
} from "./urgent-nudge-core";

/**
 * KALICI İŞ RENDER SINIRINDA DEĞİL, AÇIK BİR İŞ SINIRINDA KOŞAR (KB-22).
 *
 * Aşağıdaki iki sarmalayıcı yalnız üretim istemcisini ve kanonik bildirim
 * yazıcısını saf çekirdeğe bağlar. Kural mantığı `urgent-nudge-core.ts`
 * içindedir ve ikinci bir kopyası yoktur.
 */

const notify = (
  input: {
    userId: string;
    type: "GENERAL";
    title: string;
    message: string;
    actionUrl: string;
    requestId: string;
  },
  client: UrgentNudgeDb,
) => createNotification(input, client as unknown as NotificationWriteClient);

/** Alıcıya bağlı tur — poller POST rotası kullanır. */
export async function processUrgentNoOfferNudges(
  userId: string,
  db: UrgentNudgeDb = prisma as unknown as UrgentNudgeDb,
): Promise<{ created: number }> {
  return runUrgentNudgeScan({
    db,
    notify,
    userId,
    waitMs: URGENT_NO_OFFER_NUDGE_MS,
  });
}

/**
 * Kullanıcıdan bağımsız tur — cron kullanır.
 *
 * Cron hiçbir istemci kimliğine güvenmez: bildirim sahibi her zaman talebin
 * kendi `createdById` değerinden türer. Panel hiç açılmasa da vadesi gelen
 * nudge'lar bu yoldan işlenir.
 */
export async function processDueUrgentNoOfferNudges(
  db: UrgentNudgeDb = prisma as unknown as UrgentNudgeDb,
): Promise<{ created: number }> {
  return runUrgentNudgeScan({
    db,
    notify,
    waitMs: URGENT_NO_OFFER_NUDGE_MS,
  });
}

/**
 * Buyer confirmed the urgent nudge: re-run supplier matching and send
 * reminder notifications (once per supplier user).
 */
export async function sendUrgentRequestToSuppliers(
  userId: string,
  requestId: string,
): Promise<{
  matchedCompanyCount: number;
  notifiedUserCount: number;
}> {
  const request = await prisma.request.findFirst({
    where: {
      id: requestId,
      createdById: userId,
      deletedAt: null,
      isUrgent: true,
      status: { in: [...OPEN_STATUSES] },
    },
    select: { id: true },
  });

  if (!request) {
    throw new UrgentNudgeError("Talep bulunamadı veya acil yayın için uygun değil.");
  }

  return distributeRequestToCompanies(request.id, {
    reminderCopy: true,
    skipAlreadyRemindedUsers: true,
  });
}

export class UrgentNudgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrgentNudgeError";
  }
}
