import { prisma } from "@/lib/prisma";
import {
  URGENT_NO_OFFER_NUDGE_MESSAGE,
  URGENT_NO_OFFER_NUDGE_MS,
  URGENT_NO_OFFER_NUDGE_TITLE,
} from "@/lib/request/urgent-nudge-constants";
import { createNotification } from "@/server/notifications/create-notification";
import { distributeRequestToCompanies } from "@/server/request/distribute-request";

export {
  URGENT_NO_OFFER_NUDGE_MESSAGE,
  URGENT_NO_OFFER_NUDGE_MS,
  URGENT_NO_OFFER_NUDGE_TITLE,
} from "@/lib/request/urgent-nudge-constants";

const OPEN_STATUSES = ["PUBLISHED", "RECEIVING_OFFERS"] as const;

const REAL_OFFER_STATUSES = [
  "SUBMITTED",
  "VIEWED",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

/**
 * Scan the buyer's open urgent requests and create at most one in-app nudge
 * per request when no real offer has arrived after the wait window.
 */
export async function processUrgentNoOfferNudges(userId: string): Promise<{
  created: number;
}> {
  const cutoff = new Date(Date.now() - URGENT_NO_OFFER_NUDGE_MS);

  const eligible = await prisma.request.findMany({
    where: {
      createdById: userId,
      deletedAt: null,
      isUrgent: true,
      urgentOfferNudgeAt: null,
      status: { in: [...OPEN_STATUSES] },
      offers: {
        none: { status: { in: [...REAL_OFFER_STATUSES] } },
      },
      OR: [
        { publishedAt: { lte: cutoff } },
        { AND: [{ publishedAt: null }, { createdAt: { lte: cutoff } }] },
      ],
    },
    select: { id: true, title: true },
    take: 20,
  });

  if (eligible.length === 0) {
    return { created: 0 };
  }

  let created = 0;
  const now = new Date();

  for (const request of eligible) {
    // Claim first so concurrent panel loads cannot create duplicate nudges.
    const claimed = await prisma.request.updateMany({
      where: {
        id: request.id,
        createdById: userId,
        urgentOfferNudgeAt: null,
        isUrgent: true,
        status: { in: [...OPEN_STATUSES] },
        offers: {
          none: { status: { in: [...REAL_OFFER_STATUSES] } },
        },
      },
      data: { urgentOfferNudgeAt: now },
    });

    if (claimed.count === 0) continue;

    await createNotification({
      userId,
      type: "GENERAL",
      title: URGENT_NO_OFFER_NUDGE_TITLE,
      message: URGENT_NO_OFFER_NUDGE_MESSAGE,
      actionUrl: `/panel/taleplerim/${request.id}?acil-yayin=1`,
      requestId: request.id,
    });

    created += 1;
  }

  return { created };
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
