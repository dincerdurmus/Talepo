import { prisma } from "@/lib/prisma";
import { type AdminPermission, hasAdminPermission } from "@/lib/auth/platform-admin";
import { ADMIN_MFA_COOKIE, verifyMfaSession } from "@/server/admin/mfa";
import { requireUser } from "@/server/auth/require-user";

export class PlatformAuthorizationError extends Error {
  constructor(message = "Bu alan yalnızca Talepo yöneticisine açıktır.") {
    super(message);
    this.name = "PlatformAuthorizationError";
  }
}

export async function requirePlatformAdmin(permission: AdminPermission = "admin.view", options?: { skipMfa?: boolean }) {
  const user = await requireUser();

  const authority = await prisma.user.findUnique({
    where: { id: user.id },
    select: { platformRole: true, status: true, deletedAt: true, adminMfaEnabled: true },
  });

  if (
    !authority ||
    !hasAdminPermission(authority.platformRole, permission) ||
    authority.status !== "ACTIVE" ||
    authority.deletedAt
  ) {
    throw new PlatformAuthorizationError();
  }

  if (!options?.skipMfa) {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const sessionVerified = verifyMfaSession(store.get(ADMIN_MFA_COOKIE)?.value, user.id);
    const localBypassAllowed = process.env.NODE_ENV !== "production";
    if (!sessionVerified || (!authority.adminMfaEnabled && !localBypassAllowed)) {
      throw new PlatformAuthorizationError("Yönetici ikinci doğrulaması gerekiyor.");
    }
  }

  return { ...user, platformRole: authority.platformRole };
}
