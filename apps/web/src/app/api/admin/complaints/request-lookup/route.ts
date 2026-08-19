import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { parseRequestNumber } from "@/lib/request-number";
import { createSupportRequestAccessToken } from "@/server/admin/support-request-access";

export async function GET(request: Request) {
  try {
    const admin = await requirePlatformAdmin("moderation.view");
    const number = parseRequestNumber(new URL(request.url).searchParams.get("number") ?? "");
    if (!number) return NextResponse.json({ ok: false, message: "Geçerli bir talep numarası girin." }, { status: 400 });
    const item = await prisma.request.findFirst({ where: { requestNumber: number, deletedAt: null }, select: { id: true } });
    if (!item) return NextResponse.json({ ok: false, message: "Talep bulunamadı." }, { status: 404 });
    const token = createSupportRequestAccessToken(admin.id, item.id);
    return NextResponse.json({ ok: true, href: `/admin/requests/${item.id}?supportAccess=${encodeURIComponent(token)}` });
  } catch { return NextResponse.json({ ok: false, message: "Talep sorgulanamadı." }, { status: 403 }); }
}
