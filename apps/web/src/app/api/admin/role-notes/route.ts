import { NextResponse } from "next/server";

import { hasAdminPermission } from "@/lib/auth/platform-admin";
import { prisma } from "@/lib/prisma";
import { assertMfaSession } from "@/server/admin/mfa";
import { PlatformAuthorizationError, requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";

const PROTECTED_FOR_LIMITED_ADMIN = new Set(["ADMIN", "SUPER_ADMIN"]);

export async function GET(request: Request) {
  try {
    const admin = await requirePlatformAdmin("admin.view");
    assertMfaSession(request, admin.id);
    const targetUserId = new URL(request.url).searchParams.get("userId");
    if (!targetUserId) return NextResponse.json({ ok: false, message: "Kullanıcı seçilmedi." }, { status: 400 });

    await assertRoleNoteAccess(admin.platformRole, targetUserId);
    const notes = await prisma.roleUserNote.findMany({
      where: { targetUserId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, body: true, createdAt: true, author: { select: { name: true, email: true, platformRole: true } } },
    });
    const events = hasAdminPermission(admin.platformRole, "roles.manage") ? await prisma.roleUserNoteEvent.findMany({ where: { targetUserId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, noteId: true, action: true, beforeBody: true, afterBody: true, createdAt: true, actor: { select: { name: true, email: true } } } }) : [];
    return NextResponse.json({ ok: true, notes: notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })), events: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })) });
  } catch (error) {
    return roleNoteError(error, "İç notlar alınamadı.");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin("admin.view");
    assertMfaSession(request, admin.id);
    const body = await request.json() as { userId?: string; body?: string };
    const targetUserId = body.userId;
    const note = body.body?.trim();
    if (!targetUserId || !note || note.length < 3 || note.length > 2_000) return NextResponse.json({ ok: false, message: "Not 3–2000 karakter arasında olmalı." }, { status: 400 });

    await assertRoleNoteAccess(admin.platformRole, targetUserId);
    const created = await prisma.$transaction(async (tx) => { const item = await tx.roleUserNote.create({ data: { targetUserId, authorId: admin.id, body: note }, select: { id: true, body: true, createdAt: true, author: { select: { name: true, email: true, platformRole: true } } } }); await tx.roleUserNoteEvent.create({ data: { noteId: item.id, targetUserId, actorId: admin.id, action: "CREATED", afterBody: note } }); return item; });
    return NextResponse.json({ ok: true, note: { ...created, createdAt: created.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    return roleNoteError(error, "İç not kaydedilemedi.");
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requirePlatformAdmin("admin.view");
    assertMfaSession(request, admin.id);
    const body = await request.json() as { noteId?: string; body?: string };
    const nextBody = body.body?.trim();
    if (!body.noteId || !nextBody || nextBody.length < 3 || nextBody.length > 2_000) return NextResponse.json({ ok: false, message: "Not 3–2000 karakter arasında olmalı." }, { status: 400 });
    const current = await prisma.roleUserNote.findFirst({ where: { id: body.noteId, deletedAt: null }, select: { id: true, targetUserId: true, body: true } });
    if (!current) return NextResponse.json({ ok: false, message: "Not bulunamadı." }, { status: 404 });
    await assertRoleNoteAccess(admin.platformRole, current.targetUserId);
    const updated = await prisma.$transaction(async (tx) => { const item = await tx.roleUserNote.update({ where: { id: current.id }, data: { body: nextBody }, select: { id: true, body: true, createdAt: true, author: { select: { name: true, email: true, platformRole: true } } } }); await tx.roleUserNoteEvent.create({ data: { noteId: current.id, targetUserId: current.targetUserId, actorId: admin.id, action: "UPDATED", beforeBody: current.body, afterBody: nextBody } }); return item; });
    return NextResponse.json({ ok: true, note: { ...updated, createdAt: updated.createdAt.toISOString() } });
  } catch (error) { return roleNoteError(error, "İç not güncellenemedi."); }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requirePlatformAdmin("admin.view");
    assertMfaSession(request, admin.id);
    const noteId = new URL(request.url).searchParams.get("noteId");
    if (!noteId) return NextResponse.json({ ok: false, message: "Not seçilmedi." }, { status: 400 });
    const current = await prisma.roleUserNote.findFirst({ where: { id: noteId, deletedAt: null }, select: { id: true, targetUserId: true, body: true } });
    if (!current) return NextResponse.json({ ok: false, message: "Not bulunamadı." }, { status: 404 });
    await assertRoleNoteAccess(admin.platformRole, current.targetUserId);
    await prisma.$transaction(async (tx) => { await tx.roleUserNote.update({ where: { id: current.id }, data: { deletedAt: new Date(), deletedById: admin.id } }); await tx.roleUserNoteEvent.create({ data: { noteId: current.id, targetUserId: current.targetUserId, actorId: admin.id, action: "DELETED", beforeBody: current.body } }); });
    return NextResponse.json({ ok: true });
  } catch (error) { return roleNoteError(error, "İç not silinemedi."); }
}

async function assertRoleNoteAccess(platformRole: Parameters<typeof hasAdminPermission>[0], targetUserId: string) {
  const canManageAllRoles = hasAdminPermission(platformRole, "roles.manage");
  const canManageLimitedRoles = hasAdminPermission(platformRole, "roles.manage.limited");
  if (!canManageAllRoles && !canManageLimitedRoles) throw new PlatformAuthorizationError();

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { platformRole: true } });
  if (!target || target.platformRole === "USER") throw new PlatformAuthorizationError("İç notlar yalnızca rol atanmış kullanıcılar için tutulur.");
  if (!canManageAllRoles && PROTECTED_FOR_LIMITED_ADMIN.has(target.platformRole)) throw new PlatformAuthorizationError("Admin, Admin veya Süper Admin kullanıcıları için iç not yönetemez.");
}

function roleNoteError(error: unknown, message: string) {
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
  if (error instanceof PlatformAuthorizationError) return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
  console.error("[admin/role-notes]", error);
  return NextResponse.json({ ok: false, message }, { status: 500 });
}
