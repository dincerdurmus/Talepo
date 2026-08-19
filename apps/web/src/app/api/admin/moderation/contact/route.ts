import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/server/auth/require-platform-admin";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin("moderation.view");
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
    const userId = url.searchParams.get("userId");
    if (!caseId || !userId) return NextResponse.json({ ok: false, message: "Şikayet ve kullanıcı seçilmelidir." }, { status: 400 });
    const item = await prisma.moderationCase.findUnique({ where: { id: caseId }, select: { reporterId: true, targetUserId: true } });
    if (!item || (item.reporterId !== userId && item.targetUserId !== userId)) return NextResponse.json({ ok: false, message: "Bu kişi şikayetin tarafı değil." }, { status: 403 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } });
    if (!user) return NextResponse.json({ ok: false, message: "Kullanıcı bulunamadı." }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  } catch { return NextResponse.json({ ok: false, message: "İletişim bilgisi alınamadı." }, { status: 403 }); }
}
