import { prisma } from "@/lib/prisma";

import { RequestValidationError } from "./request-schema";

export async function deleteRequest(userId: string, requestId: string) {
  const existing = await prisma.request.findFirst({
    where: {
      id: requestId,
      createdById: userId,
      deletedAt: null,
    },
    select: { id: true, title: true },
  });

  if (!existing) {
    throw new RequestValidationError(["Talep bulunamadı."]);
  }

  const deleted = await prisma.request.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
    select: { id: true, title: true },
  });

  return deleted;
}
