import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { HealthCenter } from "@/components/admin/HealthCenter";
import { Header } from "@/components/layout/Header";
import { ADMIN_MFA_COOKIE, verifyMfaSession } from "@/server/admin/mfa";
import {
  PlatformAuthorizationError,
  requirePlatformAdmin,
} from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";

export const dynamic = "force-dynamic";

/**
 * SAYFA KAPISI (CLAUDE_PRODUCT_IMPROVEMENT, 2026-08-31).
 *
 * Ölçüldü: bütün admin sayfaları `requirePlatformAdmin` + MFA + `notFound`
 * kalıbını kullanırken bu sayfa KORUMASIZDI — API verisi sızmıyordu (route
 * kendi kapısını taşıyor) ama admin kabuğu herkese çiziliyor, yetkisiz
 * kullanıcı Talepo operasyon panelinin varlığını ve düzenini görüyordu.
 * Kapı diğer admin sayfalarıyla AYNI kalıptır; ikinci bir yetki sistemi
 * kurulmadı.
 */
export default async function AdminHealthPage() {
  let admin;
  try {
    admin = await requirePlatformAdmin("admin.view", { skipMfa: true });
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof PlatformAuthorizationError
    ) {
      notFound();
    }
    throw error;
  }
  if (
    !verifyMfaSession((await cookies()).get(ADMIN_MFA_COOKIE)?.value, admin.id)
  ) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#071310]">
      <Header tone="ink" />
      <HealthCenter />
    </div>
  );
}
