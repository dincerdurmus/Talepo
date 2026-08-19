import { prisma } from "@/lib/prisma";

import { RequestValidationError } from "./request-schema";

/** Terminal history must remain readable. Soft-delete stays for drafts/active. */
export const REQUEST_DELETE_BLOCKED_STATUSES = new Set([
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
]);

export function canDeleteRequestStatus(status: string) {
  return !REQUEST_DELETE_BLOCKED_STATUSES.has(status);
}

export class RequestDeleteNotAllowedError extends Error {
  constructor(message = "Sonuçlanan talepler silinemez.") {
    super(message);
    this.name = "RequestDeleteNotAllowedError";
  }
}

export async function deleteRequest(userId: string, requestId: string) {
  const existing = await prisma.request.findFirst({
    where: {
      id: requestId,
      createdById: userId,
      deletedAt: null,
    },
    select: { id: true, title: true, status: true },
  });

  if (!existing) {
    throw new RequestValidationError(["Talep bulunamadı."]);
  }

  if (!canDeleteRequestStatus(existing.status)) {
    throw new RequestDeleteNotAllowedError();
  }

  const deleted = await prisma.request.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
    select: { id: true, title: true },
  });

  return deleted;
}
