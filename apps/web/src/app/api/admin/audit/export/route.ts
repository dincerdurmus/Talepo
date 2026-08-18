import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/server/admin/audit";
import { assertMfaSession } from "@/server/admin/mfa";
import { requirePlatformAdmin } from "@/server/auth/require-platform-admin";

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin("analytics.view");
    assertMfaSession(request, admin.id);
    const body = await request.json() as { filename?: string; rowCount?: number };
    await prisma.$transaction((tx) => writeAdminAudit(tx, { actorId: admin.id, action: "DATA_EXPORTED", reason: `CSV dışa aktarma: ${body.filename ?? "admin-kayitlari.csv"}`, metadata: { filename: body.filename, rowCount: body.rowCount }, request }));
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }, { status: 403 }); }
}
