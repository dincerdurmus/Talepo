import { DomainError, DomainErrorCode } from "@/lib/observability/errors";
import { prisma } from "@/lib/prisma";

/**
 * A temporary moderation restriction blocks marketplace writes while keeping
 * account access intact. The expiry is evaluated on every protected action.
 */
export async function assertUserCanAct(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { moderationRestrictedUntil: true },
  });

  if (user?.moderationRestrictedUntil && user.moderationRestrictedUntil > new Date()) {
    throw new DomainError({
      code: DomainErrorCode.FORBIDDEN,
      userMessage: "Hesabınız geçici olarak işlem yapmaya kısıtlandı. Destek ekibiyle iletişime geçebilirsiniz.",
      status: 403,
    });
  }
}
