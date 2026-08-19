import { NextResponse } from "next/server";

import type { PlatformRole } from "@/lib/auth/platform-admin";
import { prisma } from "@/lib/prisma";
import { assertMfaSession } from "@/server/admin/mfa";
import { PlatformAuthorizationError, requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";

type NoteRole = Exclude<PlatformRole, "USER">;
type PlatformAdmin = Awaited<ReturnType<typeof requirePlatformAdmin>>;

const ADMIN_TARGET_ROLES = new Set<PlatformRole>(["SUPPORT", "MODERATOR", "ANALYST"]);
const SUPER_ADMIN_AUDIENCES: NoteRole[] = ["SUPPORT", "MODERATOR", "ANALYST", "ADMIN", "SUPER_ADMIN"];

export async function GET(request: Request) {
  try {
    const admin = await requirePlatformAdmin("admin.view");
    assertMfaSession(request, admin.id);
    const targetUserId = new URL(request.url).searchParams.get("userId") ?? admin.id;
    const target = await findRoleTarget(targetUserId);
    assertReadAccess(admin, target);
    const notes = await prisma.roleUserNote.findMany({
      where: { targetUserId, deletedAt: null, OR: [{ authorId: admin.id }, { visibleToRoles: { has: admin.platformRole } }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, body: true, visibleToRoles: true, createdAt: true, author: { select: { name: true, email: true, platformRole: true } } },
    });
    const events = notes.length ? await prisma.roleUserNoteEvent.findMany({ where: { noteId: { in: notes.map((note) => note.id) } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, noteId: true, action: true, beforeBody: true, afterBody: true, createdAt: true, actor: { select: { name: true, email: true, platformRole: true } } } }) : [];
    return NextResponse.json({ ok: true, notes: notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })), events: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })), selectableVisibilityRoles: admin.platformRole === "SUPER_ADMIN" ? SUPER_ADMIN_AUDIENCES : [] });
  } catch (error) {
    return roleNoteError(error, "İç notlar alınamadı.");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin("admin.view");
    assertMfaSession(request, admin.id);
    const body = await request.json() as { userId?: string; body?: string; visibleToRoles?: PlatformRole[] };
    const targetUserId = body.userId ?? admin.id;
    const note = body.body?.trim();
    if (!note || note.length < 3 || note.length > 2_000) return NextResponse.json({ ok: false, message: "Not 3–2000 karakter arasında olmalı." }, { status: 400 });
    const target = await findRoleTarget(targetUserId);
    assertWriteAccess(admin, target);
    const visibleToRoles = resolveVisibility(admin.platformRole, body.visibleToRoles);
    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.roleUserNote.create({ data: { targetUserId, authorId: admin.id, body: note, visibleToRoles }, select: { id: true, body: true, visibleToRoles: true, createdAt: true, author: { select: { name: true, email: true, platformRole: true } } } });
      await tx.roleUserNoteEvent.create({ data: { noteId: item.id, targetUserId, actorId: admin.id, action: "CREATED", afterBody: note } });
      if (admin.platformRole === "SUPER_ADMIN" && visibleToRoles.includes("SUPER_ADMIN")) {
        const superAdmins = await tx.user.findMany({ where: { platformRole: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null, id: { not: admin.id } }, select: { id: true } });
        if (superAdmins.length) await tx.notification.createMany({ data: superAdmins.map((user) => ({ userId: user.id, type: "GENERAL", title: "İç takip notu eklendi", message: "Bir Süper Admin yeni bir iç takip notu paylaştı.", actionUrl: "/admin/notlar" })) });
      }
      return item;
    });
    return NextResponse.json({ ok: true, note: { ...created, createdAt: created.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    return roleNoteError(error, "İç not kaydedilemedi.");
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requirePlatformAdmin("admin.view");
    assertMfaSession(request, admin.id);
    const body = await request.json() as { noteId?: string; body?: string; visibleToRoles?: PlatformRole[] };
    const nextBody = body.body?.trim();
    if (!body.noteId || !nextBody || nextBody.length < 3 || nextBody.length > 2_000) return NextResponse.json({ ok: false, message: "Not 3–2000 karakter arasında olmalı." }, { status: 400 });
    const current = await prisma.roleUserNote.findFirst({ where: { id: body.noteId, deletedAt: null }, select: { id: true, targetUserId: true, authorId: true, body: true, visibleToRoles: true, author: { select: { platformRole: true } }, targetUser: { select: { id: true, platformRole: true } } } });
    if (!current) return NextResponse.json({ ok: false, message: "Not bulunamadı." }, { status: 404 });
    assertEditAccess(admin, current);
    const visibleToRoles = admin.platformRole === "SUPER_ADMIN" && body.visibleToRoles ? resolveVisibility(admin.platformRole, body.visibleToRoles) : current.visibleToRoles;
    const updated = await prisma.$transaction(async (tx) => { const item = await tx.roleUserNote.update({ where: { id: current.id }, data: { body: nextBody, visibleToRoles }, select: { id: true, body: true, visibleToRoles: true, createdAt: true, author: { select: { name: true, email: true, platformRole: true } } } }); await tx.roleUserNoteEvent.create({ data: { noteId: current.id, targetUserId: current.targetUserId, actorId: admin.id, action: "UPDATED", beforeBody: current.body, afterBody: nextBody } }); return item; });
    return NextResponse.json({ ok: true, note: { ...updated, createdAt: updated.createdAt.toISOString() } });
  } catch (error) { return roleNoteError(error, "İç not güncellenemedi."); }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requirePlatformAdmin("admin.view");
    assertMfaSession(request, admin.id);
    const noteId = new URL(request.url).searchParams.get("noteId");
    if (!noteId) return NextResponse.json({ ok: false, message: "Not seçilmedi." }, { status: 400 });
    const current = await prisma.roleUserNote.findFirst({ where: { id: noteId, deletedAt: null }, select: { id: true, targetUserId: true, authorId: true, body: true, visibleToRoles: true, author: { select: { platformRole: true } }, targetUser: { select: { id: true, platformRole: true } } } });
    if (!current) return NextResponse.json({ ok: false, message: "Not bulunamadı." }, { status: 404 });
    assertEditAccess(admin, current);
    await prisma.$transaction(async (tx) => { await tx.roleUserNote.update({ where: { id: current.id }, data: { deletedAt: new Date(), deletedById: admin.id } }); await tx.roleUserNoteEvent.create({ data: { noteId: current.id, targetUserId: current.targetUserId, actorId: admin.id, action: "DELETED", beforeBody: current.body } }); });
    return NextResponse.json({ ok: true });
  } catch (error) { return roleNoteError(error, "İç not silinemedi."); }
}

async function findRoleTarget(id: string) {
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, platformRole: true } });
  if (!target || target.platformRole === "USER") throw new PlatformAuthorizationError("İç notlar yalnızca rol atanmış kullanıcılar için tutulur.");
  return target;
}

function assertReadAccess(admin: PlatformAdmin, target: { id: string; platformRole: PlatformRole }) {
  if (target.id === admin.id || admin.platformRole === "SUPER_ADMIN") return;
  if (admin.platformRole === "ADMIN" && ADMIN_TARGET_ROLES.has(target.platformRole)) return;
  throw new PlatformAuthorizationError("Bu iç notları görüntüleme yetkiniz yok.");
}

function assertWriteAccess(admin: PlatformAdmin, target: { id: string; platformRole: PlatformRole }) {
  if (target.id === admin.id || admin.platformRole === "SUPER_ADMIN") return;
  if (admin.platformRole === "ADMIN" && ADMIN_TARGET_ROLES.has(target.platformRole)) return;
  throw new PlatformAuthorizationError("Yalnızca kendi notunuzu veya alt rol notlarını yazabilirsiniz.");
}

function assertEditAccess(admin: PlatformAdmin, note: { authorId: string; visibleToRoles: PlatformRole[]; author: { platformRole: PlatformRole }; targetUser: { id: string; platformRole: PlatformRole } }) {
  if (note.authorId === admin.id || admin.platformRole === "SUPER_ADMIN") return;
  if (note.author.platformRole === "SUPER_ADMIN") throw new PlatformAuthorizationError("Süper Admin notları yalnızca Süper Admin tarafından düzenlenebilir veya silinebilir.");
  if (admin.platformRole === "ADMIN" && note.visibleToRoles.includes("ADMIN") && ADMIN_TARGET_ROLES.has(note.targetUser.platformRole)) return;
  throw new PlatformAuthorizationError("Bu iç notu düzenleme yetkiniz yok.");
}

function resolveVisibility(authorRole: PlatformRole, requested: PlatformRole[] | undefined): NoteRole[] {
  if (authorRole === "SUPER_ADMIN") return [...new Set((requested ?? ["SUPER_ADMIN"]).filter((role): role is NoteRole => SUPER_ADMIN_AUDIENCES.includes(role as NoteRole)))];
  if (authorRole === "ADMIN") return ["SUPER_ADMIN"];
  return ["ADMIN", "SUPER_ADMIN"];
}

function roleNoteError(error: unknown, message: string) {
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
  if (error instanceof PlatformAuthorizationError) return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
  console.error("[admin/role-notes]", error);
  return NextResponse.json({ ok: false, message }, { status: 500 });
}
