import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { writeAdminAudit } from "@/server/admin/audit";
import { moderationSla } from "@/server/admin/moderation-sla";

const STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const ENFORCEMENTS = ["HIDE_CONTENT", "RESTORE_CONTENT", "WARN_USER", "RESTRICT_24H", "RESTRICT_7D", "LIFT_RESTRICTION"] as const;

export async function GET(request: Request) {
  try {
    const admin = await requirePlatformAdmin("moderation.view");
    const status = new URL(request.url).searchParams.get("status");
    const assigneeRoles: ("SUPPORT" | "ADMIN" | "SUPER_ADMIN")[] = admin.platformRole === "SUPER_ADMIN" ? ["SUPPORT", "ADMIN", "SUPER_ADMIN"] : ["SUPPORT"];
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [items, assignees, mineOpen, mineInvestigating, mineClosedLastWeek, myHistory] = await Promise.all([
      prisma.moderationCase.findMany({ where: status && STATUSES.includes(status as typeof STATUSES[number]) ? { status: status as typeof STATUSES[number] } : {}, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 100, include: { assignee: { select: { id: true, name: true, email: true, platformRole: true } }, reporter: { select: { id: true, name: true, email: true } }, targetUser: { select: { id: true, name: true, email: true, moderationRestrictedUntil: true } } } }),
      admin.platformRole === "SUPPORT" ? Promise.resolve([]) : prisma.user.findMany({ where: { platformRole: { in: assigneeRoles }, status: "ACTIVE", deletedAt: null }, select: { id: true, name: true, email: true, platformRole: true }, orderBy: [{ platformRole: "asc" }, { name: "asc" }] }),
      prisma.moderationCase.count({ where: { assigneeId: admin.id, status: "OPEN" } }),
      prisma.moderationCase.count({ where: { assigneeId: admin.id, status: "INVESTIGATING" } }),
      prisma.moderationCase.count({ where: { assigneeId: admin.id, status: { in: ["RESOLVED", "DISMISSED"] }, resolvedAt: { gte: since } } }),
      prisma.adminAuditLog.findMany({ where: { actorId: admin.id, action: "MODERATION_CASE_UPDATED" }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, reason: true, createdAt: true, metadata: true } }),
    ]);
    const requestIds = items.filter((item) => item.subjectType === "REQUEST").map((item) => item.subjectId);
    const offerIds = items.filter((item) => item.subjectType === "OFFER").map((item) => item.subjectId);
    const targetUserIds = [...new Set(items.map((item) => item.targetUserId).filter((id): id is string => Boolean(id)))];
    const [requests, offers, targetHistory] = await Promise.all([
      requestIds.length ? prisma.request.findMany({ where: { id: { in: requestIds } }, select: { id: true, isModerationHidden: true, moderationReason: true } }) : Promise.resolve([]),
      offerIds.length ? prisma.offer.findMany({ where: { id: { in: offerIds } }, select: { id: true, isModerationHidden: true, moderationReason: true } }) : Promise.resolve([]),
      targetUserIds.length ? prisma.adminAuditLog.findMany({ where: { targetUserId: { in: targetUserIds }, action: "MODERATION_CASE_UPDATED" }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, targetUserId: true, reason: true, createdAt: true, metadata: true, actor: { select: { name: true, email: true } } } }) : Promise.resolve([]),
    ]);
    const contentStates = new Map([...requests, ...offers].map((item) => [item.id, item]));
    const enforcementHistory = targetHistory.filter((entry) => {
      const metadata = entry.metadata as { enforcement?: unknown } | null;
      return typeof metadata?.enforcement === "string";
    });
    const historyByTargetUser = new Map<string, typeof enforcementHistory>();
    for (const entry of enforcementHistory) if (entry.targetUserId) historyByTargetUser.set(entry.targetUserId, [...(historyByTargetUser.get(entry.targetUserId) ?? []), entry]);
    const now = new Date();
    return NextResponse.json({ ok: true, viewerId: admin.id, canReassign: admin.platformRole !== "SUPPORT", canEnforce: admin.platformRole !== "SUPPORT", canFilterByAssignee: admin.platformRole === "ADMIN" || admin.platformRole === "SUPER_ADMIN", assignees, myWorkload: { open: mineOpen, investigating: mineInvestigating, closedLastWeek: mineClosedLastWeek, totalActive: mineOpen + mineInvestigating }, myHistory: myHistory.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })), items: items.map((item) => ({ ...item, assignee: item.assignee ? { id: item.assignee.id, platformRole: item.assignee.platformRole } : null, contentModeration: contentStates.get(item.subjectId) ?? null, targetUser: item.targetUser ? { ...item.targetUser, moderationRestrictedUntil: item.targetUser.moderationRestrictedUntil } : null, targetUserModerationHistory: item.targetUserId ? (historyByTargetUser.get(item.targetUserId) ?? []).slice(0, 8).map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })) : [], sla: { ...moderationSla(item.priority, item.createdAt, now), dueAt: moderationSla(item.priority, item.createdAt, now).dueAt.toISOString() }, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), resolvedAt: item.resolvedAt?.toISOString() ?? null })) });
  } catch (error) { console.error("[admin/moderation]", error); return NextResponse.json({ ok: false, message: error instanceof Error && error.name === "PlatformAuthorizationError" ? "Moderasyon için yönetici doğrulaması gerekiyor." : "Moderasyon kayıtları alınamadı." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try { const admin = await requirePlatformAdmin("moderation.manage"); const body = await request.json() as { subjectType?: string; subjectId?: string; category?: string; summary?: string; priority?: string }; if (!body.subjectType || !body.subjectId || !body.category || !body.summary?.trim()) return NextResponse.json({ ok: false, message: "Konu, kategori ve açıklama zorunlu." }, { status: 400 }); const priority = PRIORITIES.includes(body.priority as typeof PRIORITIES[number]) ? body.priority as typeof PRIORITIES[number] : "MEDIUM"; const item = await prisma.moderationCase.create({ data: { subjectType: body.subjectType, subjectId: body.subjectId, category: body.category, summary: body.summary.trim(), priority, reporterId: admin.id } }); return NextResponse.json({ ok: true, item }); } catch { return NextResponse.json({ ok: false, message: "Moderasyon kaydı oluşturulamadı." }, { status: 403 }); }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requirePlatformAdmin("moderation.manage");
    const body = await request.json() as { id?: string; status?: string; priority?: string; resolutionNote?: string; internalNote?: string; assigneeId?: string | null; enforcement?: string };
    if (!body.id) return NextResponse.json({ ok: false, message: "Kayıt seçilmedi." }, { status: 400 });
    if (admin.platformRole === "SUPPORT" && body.assigneeId !== undefined && body.assigneeId !== "self" && body.assigneeId !== admin.id) return NextResponse.json({ ok: false, message: "Support yalnızca kaydı kendisine atabilir." }, { status: 403 });
    const current = await prisma.moderationCase.findUnique({ where: { id: body.id }, include: { targetUser: { select: { id: true, name: true, moderationRestrictedUntil: true } } } });
    if (!current) return NextResponse.json({ ok: false, message: "Kayıt bulunamadı." }, { status: 404 });
    const enforcement = ENFORCEMENTS.includes(body.enforcement as typeof ENFORCEMENTS[number]) ? body.enforcement as typeof ENFORCEMENTS[number] : null;
    const submittedInternalNote = body.internalNote?.trim();
    if (enforcement && admin.platformRole === "SUPPORT") return NextResponse.json({ ok: false, message: "Support içerik veya kullanıcı yaptırımı uygulayamaz." }, { status: 403 });
    const reason = body.resolutionNote?.trim() || submittedInternalNote || "";
    if (enforcement && reason.length < 5) return NextResponse.json({ ok: false, message: "Yaptırım gerekçesi en az 5 karakter olmalı." }, { status: 400 });
    if (enforcement && !current.targetUserId) return NextResponse.json({ ok: false, message: "Bu kayıtta yaptırım uygulanacak kullanıcı bulunamadı." }, { status: 400 });
    if (["HIDE_CONTENT", "RESTORE_CONTENT"].includes(enforcement ?? "") && !["REQUEST", "OFFER"].includes(current.subjectType)) return NextResponse.json({ ok: false, message: "Bu kayıt için içerik yaptırımı uygulanamaz." }, { status: 400 });
    const status = STATUSES.includes(body.status as typeof STATUSES[number]) ? body.status as typeof STATUSES[number] : current.status;
    const priority = PRIORITIES.includes(body.priority as typeof PRIORITIES[number]) ? body.priority as typeof PRIORITIES[number] : current.priority;
    const assigneeId = body.assigneeId === "self" ? admin.id : body.assigneeId === undefined ? current.assigneeId : body.assigneeId;
    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { platformRole: true, status: true, deletedAt: true } });
      const allowedRoles = admin.platformRole === "SUPER_ADMIN" ? ["SUPPORT", "ADMIN", "SUPER_ADMIN"] : ["SUPPORT"];
      if (!assignee || assignee.status !== "ACTIVE" || assignee.deletedAt || !allowedRoles.includes(assignee.platformRole)) return NextResponse.json({ ok: false, message: "Bu kullanıcı şikayet takibine atanamaz." }, { status: 403 });
    }
    const item = await prisma.$transaction(async (tx) => {
      if (enforcement === "HIDE_CONTENT" || enforcement === "RESTORE_CONTENT") {
        const hidden = enforcement === "HIDE_CONTENT";
        const data = hidden ? { isModerationHidden: true, moderationHiddenAt: new Date(), moderationHiddenById: admin.id, moderationReason: reason } : { isModerationHidden: false, moderationHiddenAt: null, moderationHiddenById: null, moderationReason: null };
        if (current.subjectType === "REQUEST") await tx.request.update({ where: { id: current.subjectId }, data });
        else await tx.offer.update({ where: { id: current.subjectId }, data });
      }
      if (enforcement === "RESTRICT_24H" || enforcement === "RESTRICT_7D") {
        const hours = enforcement === "RESTRICT_24H" ? 24 : 24 * 7;
        await tx.user.update({ where: { id: current.targetUserId! }, data: { moderationRestrictedUntil: new Date(Date.now() + hours * 60 * 60 * 1000), moderationRestrictionReason: reason } });
      }
      if (enforcement === "LIFT_RESTRICTION") await tx.user.update({ where: { id: current.targetUserId! }, data: { moderationRestrictedUntil: null, moderationRestrictionReason: null } });
      const updated = await tx.moderationCase.update({ where: { id: body.id }, data: { status, priority, assigneeId, internalNote: submittedInternalNote || current.internalNote, resolutionNote: body.resolutionNote?.trim() || current.resolutionNote, resolvedAt: ["RESOLVED", "DISMISSED"].includes(status) ? new Date() : null } });
      if (admin.platformRole === "SUPER_ADMIN" && submittedInternalNote && submittedInternalNote !== current.internalNote) {
        const superAdmins = await tx.user.findMany({ where: { platformRole: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null, id: { not: admin.id } }, select: { id: true } });
        if (superAdmins.length) await tx.notification.createMany({ data: superAdmins.map((user) => ({ userId: user.id, type: "GENERAL", title: "Şikâyete iç not eklendi", message: `Şikâyet #${current.complaintNumber ?? "—"} için yeni bir iç takip notu eklendi.`, actionUrl: "/admin" })) });
      }
      if (assigneeId && assigneeId !== current.assigneeId) await tx.notification.create({ data: { userId: assigneeId, type: "GENERAL", title: "Size şikayet atandı", message: `Şikayet #${current.complaintNumber ?? "—"} sizin takibinize atandı.`, actionUrl: "/admin" } });
      if (current.reporterId && (body.resolutionNote?.trim() || status !== current.status)) await tx.notification.create({ data: { userId: current.reporterId, type: "GENERAL", title: "Şikayetiniz güncellendi", message: body.resolutionNote?.trim() || "Şikayetinizin durumu güncellendi.", actionUrl: `/panel/bildirimler?complaint=${current.id}` } });
      if (enforcement) {
        const titles: Record<typeof enforcement, string> = { HIDE_CONTENT: "İçeriğiniz yayından kaldırıldı", RESTORE_CONTENT: "İçeriğiniz yeniden yayında", WARN_USER: "Hesabınıza ihtar eklendi", RESTRICT_24H: "Hesabınız 24 saat işlem kısıtlamasına alındı", RESTRICT_7D: "Hesabınız 7 gün işlem kısıtlamasına alındı", LIFT_RESTRICTION: "Hesap kısıtlamanız kaldırıldı" };
        await tx.notification.create({ data: { userId: current.targetUserId!, type: "GENERAL", title: titles[enforcement], message: reason, actionUrl: "/panel/bildirimler" } });
      }
      await writeAdminAudit(tx, { actorId: admin.id, targetUserId: current.targetUserId, action: "MODERATION_CASE_UPDATED", reason: reason || `Moderasyon durumu ${status} olarak güncellendi`, before: { status: current.status, priority: current.priority, assigneeId: current.assigneeId, restrictionUntil: current.targetUser?.moderationRestrictedUntil?.toISOString() ?? null }, after: { status, priority, assigneeId }, metadata: { caseId: current.id, enforcement, subjectType: current.subjectType, subjectId: current.subjectId }, request });
      return updated;
    });
    return NextResponse.json({ ok: true, item });
  } catch { return NextResponse.json({ ok: false, message: "Moderasyon kaydı güncellenemedi." }, { status: 403 }); }
}
