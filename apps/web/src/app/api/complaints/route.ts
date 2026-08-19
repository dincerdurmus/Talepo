import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { assertUserCanAct } from "@/server/auth/assert-user-can-act";
import { canAccessRequest } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await assertUserCanAct(user.id);
    const body = await request.json() as { subjectType?: string; subjectId?: string; targetUserId?: string; summary?: string; details?: string; attachmentUrls?: string[] };
    const subjectType = body.subjectType === "REQUEST" || body.subjectType === "OFFER" ? body.subjectType : null;
    if (!subjectType || !body.subjectId || !body.summary?.trim() || !body.details?.trim()) {
      return NextResponse.json({ ok: false, message: "Şikayet konusu ve açıklaması zorunludur." }, { status: 400 });
    }
    const subject = subjectType === "REQUEST"
      ? await prisma.request.findFirst({ where: { id: body.subjectId, deletedAt: null }, select: { createdById: true, visibleToSuppliersAt: true } })
      : await prisma.offer.findFirst({
          where: { id: body.subjectId },
          select: { submittedById: true, request: { select: { createdById: true } } },
        });
    if (!subject) {
      return NextResponse.json({ ok: false, message: "Şikayet konusu bulunamadı." }, { status: 404 });
    }
    const requestSubject = subjectType === "REQUEST"
      ? subject as { createdById: string; visibleToSuppliersAt: Date | null }
      : null;
    const offerSubject = subjectType === "OFFER"
      ? subject as { submittedById: string; request: { createdById: string } }
      : null;
    const targetUserId = requestSubject?.createdById ?? offerSubject!.submittedById;
    if (requestSubject && user.id !== requestSubject.createdById) {
      const entitlements = await resolveEntitlements(user.id, await getCompanyContextOptions());
      if (!canAccessRequest(entitlements, requestSubject)) return NextResponse.json({ ok: false, message: "Bu talep için şikayet oluşturma yetkiniz yok." }, { status: 403 });
    }
    if (offerSubject && user.id !== offerSubject.submittedById && user.id !== offerSubject.request.createdById) {
      return NextResponse.json({ ok: false, message: "Bu teklif için şikayet oluşturma yetkiniz yok." }, { status: 403 });
    }
    if (subjectType === "REQUEST") {
      const recentComplaint = await prisma.moderationCase.findFirst({ where: { reporterId: user.id, subjectType, subjectId: body.subjectId, isComplaint: true, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } }, select: { createdAt: true } });
      if (recentComplaint) return NextResponse.json({ ok: false, message: "Bu talep için günde yalnızca bir şikayet oluşturabilirsiniz." }, { status: 429 });
    }
    const existing = await prisma.moderationCase.findFirst({ where: { reporterId: user.id, subjectType, subjectId: body.subjectId, isComplaint: true, status: { notIn: ["RESOLVED", "DISMISSED"] } }, select: { complaintNumber: true } });
    if (existing) return NextResponse.json({ ok: false, message: `Bu konu için zaten açık bir şikayetiniz var: ŞK-${existing.complaintNumber ?? "—"}.` }, { status: 409 });
    const attachmentUrls = (body.attachmentUrls ?? []).filter((value): value is string => typeof value === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/.test(value) && value.length <= 950_000).slice(0, 3);
    const complaint = await prisma.moderationCase.create({ data: { subjectType, subjectId: body.subjectId, category: "COMPLAINT", summary: body.summary.trim(), details: body.details.trim(), isComplaint: true, attachmentUrls, reporterId: user.id, targetUserId } });
    return NextResponse.json({ ok: true, complaintNumber: complaint.complaintNumber }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, message: "Şikayet oluşturulamadı." }, { status: 400 });
  }
}
