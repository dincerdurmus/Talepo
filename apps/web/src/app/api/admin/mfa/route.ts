import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { ADMIN_MFA_COOKIE, assertMfaSession, createMfaSecret, createMfaSession, decryptMfaSecret, encryptMfaSecret, verifyTotp } from "@/server/admin/mfa";
import { writeAdminAudit } from "@/server/admin/audit";

export async function GET() {
  try {
    const admin = await requirePlatformAdmin("admin.view", { skipMfa: true });
    const state = await prisma.user.findUnique({ where: { id: admin.id }, select: { adminMfaEnabled: true } });
    return NextResponse.json({ ok: true, enabled: Boolean(state?.adminMfaEnabled) });
  } catch {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin("admin.view", { skipMfa: true });
    const body = await request.json() as { action?: string; secret?: string; code?: string; targetUserId?: string; reason?: string };

    if (body.action === "reset") {
      assertMfaSession(request, admin.id);
      await requirePlatformAdmin("roles.manage");
      if (!body.targetUserId || body.targetUserId === admin.id || (body.reason?.trim().length ?? 0) < 5) return NextResponse.json({ ok: false, message: "Başka bir Süper Admin ve en az 5 karakterlik gerekçe gerekir." }, { status: 400 });
      const target = await prisma.user.findUnique({ where: { id: body.targetUserId }, select: { id: true, platformRole: true, name: true } });
      if (!target || target.platformRole !== "SUPER_ADMIN") return NextResponse.json({ ok: false, message: "MFA kurtarma yalnızca başka bir Süper Admin için yapılabilir." }, { status: 403 });
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: target.id }, data: { adminMfaEnabled: false, adminMfaSecretEncrypted: null } });
        await tx.notification.create({ data: { userId: target.id, type: "GENERAL", title: "Yönetici MFA sıfırlandı", message: "Başka bir Süper Admin, yönetici ikinci doğrulamanızı sıfırladı. Bir sonraki yönetici girişinizde yeniden kurulum yapın.", actionUrl: "/admin" } });
        await writeAdminAudit(tx, { actorId: admin.id, targetUserId: target.id, action: "MFA_DISABLED", reason: body.reason!.trim(), metadata: { securityEvent: "MFA_RECOVERY_RESET", targetRole: "SUPER_ADMIN" }, request });
      });
      return NextResponse.json({ ok: true, message: `${target.name ?? "Süper Admin"} için MFA sıfırlandı.` });
    }

    const user = await prisma.user.findUnique({ where: { id: admin.id }, select: { email: true, adminMfaEnabled: true, adminMfaSecretEncrypted: true } });
    if (!user) return NextResponse.json({ ok: false }, { status: 404 });
    if (body.action === "begin") {
      if (user.adminMfaEnabled) return NextResponse.json({ ok: false, message: "İkinci doğrulama zaten etkin." }, { status: 400 });
      const secret = createMfaSecret();
      return NextResponse.json({ ok: true, secret, uri: `otpauth://totp/Talepo:${encodeURIComponent(user.email ?? admin.id)}?secret=${secret}&issuer=Talepo&digits=6&period=30` });
    }
    if (body.action === "bypass") {
      if (process.env.NODE_ENV === "production") return NextResponse.json({ ok: false, message: "Production ortamında bypass kullanılamaz." }, { status: 403 });
      await prisma.$transaction(async (tx) => {
        await writeAdminAudit(tx, { actorId: admin.id, targetUserId: admin.id, action: "USER_UPDATED", reason: "Local geliştirme ortamında geçici authenticator bypass kullanıldı", metadata: { securityEvent: "MFA_LOCAL_BYPASS", temporary: true }, request });
      });
      return verifiedResponse(admin.id, "Geçici local erişim açıldı.", 2 * 60 * 60);
    }
    if (body.action === "enable" && body.secret && body.code) {
      const secret = body.secret;
      if (!verifyTotp(secret, body.code)) return NextResponse.json({ ok: false, message: "Kod doğrulanamadı." }, { status: 400 });
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: admin.id }, data: { adminMfaEnabled: true, adminMfaSecretEncrypted: encryptMfaSecret(secret) } });
        await writeAdminAudit(tx, { actorId: admin.id, targetUserId: admin.id, action: "MFA_ENABLED", reason: "Yönetici ikinci doğrulamayı etkinleştirdi", request });
      });
      return verifiedResponse(admin.id, "İkinci doğrulama etkinleştirildi.");
    }
    if (body.action === "verify" && body.code && user.adminMfaSecretEncrypted) {
      if (!verifyTotp(decryptMfaSecret(user.adminMfaSecretEncrypted), body.code)) return NextResponse.json({ ok: false, message: "Kod hatalı." }, { status: 400 });
      return verifiedResponse(admin.id, "Yönetici oturumu doğrulandı.");
    }
    return NextResponse.json({ ok: false, message: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    console.error("[admin/mfa]", error);
    return NextResponse.json({ ok: false, message: "İkinci doğrulama işlemi başarısız." }, { status: 500 });
  }
}

function verifiedResponse(userId: string, message: string, maxAge = 8 * 60 * 60) {
  const response = NextResponse.json({ ok: true, message });
  response.cookies.set(ADMIN_MFA_COOKIE, createMfaSession(userId), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  return response;
}
