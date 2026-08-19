import { NextResponse } from "next/server";

import { hasAdminPermission } from "@/lib/auth/platform-admin";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/server/admin/audit";
import { assertMfaSession } from "@/server/admin/mfa";
import { PlatformAuthorizationError, requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";

const PLANS = ["STANDARD", "PROFESSIONAL"] as const;
const STATUSES = ["ACTIVE", "SUSPENDED"] as const;
const ROLES = ["USER", "SUPPORT", "MODERATOR", "ANALYST", "ADMIN", "SUPER_ADMIN"] as const;
const valid = (values: readonly string[], value: string | undefined) => !value || values.includes(value);

export async function GET(request: Request) {
  try {
    const admin = await requirePlatformAdmin("users.view");
    assertMfaSession(request, admin.id);
    const canSeeSensitive = hasAdminPermission(admin.platformRole, "sensitive.view");
    const canManageBilling = hasAdminPermission(admin.platformRole, "billing.manage");
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    const status = url.searchParams.get("status") ?? undefined;
    const role = url.searchParams.get("role") ?? undefined;
    const plan = url.searchParams.get("plan") ?? undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(10, Number(url.searchParams.get("pageSize") || 20)));
    const roleConstraint = admin.platformRole === "SUPER_ADMIN"
      ? valid(ROLES, role) && role ? role as (typeof ROLES)[number] : undefined
      : valid(ROLES, role) && role && role !== "SUPER_ADMIN" ? role as (typeof ROLES)[number] : { not: "SUPER_ADMIN" as const };
    const searchFields = canSeeSensitive
      ? [{ name: { contains: query, mode: "insensitive" as const } }, { email: { contains: query, mode: "insensitive" as const } }, { membershipNumber: { contains: query, mode: "insensitive" as const } }, { phone: { contains: query } }]
      : [{ name: { contains: query, mode: "insensitive" as const } }, { membershipNumber: { contains: query, mode: "insensitive" as const } }];
    const where = {
      deletedAt: null,
      ...(query ? { OR: searchFields } : {}),
      ...(valid(STATUSES, status) && status ? { status: status as (typeof STATUSES)[number] } : {}),
      ...(roleConstraint ? { platformRole: roleConstraint } : {}),
      ...(canManageBilling && valid(PLANS, plan) && plan ? { planTier: plan as (typeof PLANS)[number] } : {}),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, name: true, email: true, membershipNumber: true, status: true, platformRole: true, planTier: true, bonusOfferCredits: true, createdAt: true, lastLoginAt: true, _count: { select: { createdRequests: true, submittedOffers: true } } } }),
      prisma.user.count({ where }),
    ]);
    return NextResponse.json({
      ok: true,
      users: users.map((user) => ({
        ...user,
        email: canSeeSensitive ? user.email : maskEmail(user.email),
        membershipNumber: canSeeSensitive ? user.membershipNumber : maskMembership(user.membershipNumber),
        planTier: canManageBilling ? user.planTier : null,
        bonusOfferCredits: canManageBilling ? user.bonusOfferCredits : 0,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: canSeeSensitive ? user.lastLoginAt?.toISOString() ?? null : null,
        isAdmin: user.platformRole !== "USER",
      })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    return adminError(error, "Kullanıcılar alınamadı.");
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requirePlatformAdmin("users.manage");
    assertMfaSession(request, admin.id);
    const body = (await request.json()) as { userId?: string; planTier?: string; status?: string; bonusOfferCredits?: number; platformRole?: string; reason?: string };
    if (!body.userId) return NextResponse.json({ ok: false, message: "Kullanıcı seçilmedi." }, { status: 400 });
    if (!body.reason?.trim() || body.reason.trim().length < 5) return NextResponse.json({ ok: false, message: "İşlem gerekçesi en az 5 karakter olmalı." }, { status: 400 });
    if (!valid(PLANS, body.planTier) || !valid(STATUSES, body.status) || !valid(ROLES, body.platformRole)) return NextResponse.json({ ok: false, message: "Geçersiz değişiklik." }, { status: 400 });
    if (body.bonusOfferCredits !== undefined && (!Number.isInteger(body.bonusOfferCredits) || body.bonusOfferCredits < 0 || body.bonusOfferCredits > 10000)) return NextResponse.json({ ok: false, message: "Geçersiz kredi." }, { status: 400 });

    const current = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, status: true, platformRole: true, planTier: true, bonusOfferCredits: true } });
    if (!current) return NextResponse.json({ ok: false, message: "Kullanıcı bulunamadı." }, { status: 404 });
    if (current.platformRole === "SUPER_ADMIN" && admin.platformRole !== "SUPER_ADMIN") return NextResponse.json({ ok: false, message: "Süper Admin hesabına yalnızca başka bir Süper Admin müdahale edebilir." }, { status: 403 });
    if (current.id === admin.id && (body.status === "SUSPENDED" || body.platformRole === "USER")) return NextResponse.json({ ok: false, message: "Kendi yönetici hesabınızı pasife alamaz veya yetkisini kaldıramazsınız." }, { status: 400 });

    const after = { status: body.status ?? current.status, platformRole: body.platformRole ?? current.platformRole, planTier: body.planTier ?? current.planTier, bonusOfferCredits: body.bonusOfferCredits ?? current.bonusOfferCredits };
    const changed = Object.entries(after).filter(([key, value]) => current[key as keyof typeof current] !== value).map(([key]) => key);
    if (!changed.length) return NextResponse.json({ ok: true, message: "Değişiklik bulunmuyor." });
    if (changed.includes("platformRole")) {
      const hasFullRoleManagement = hasAdminPermission(admin.platformRole, "roles.manage");
      if (hasFullRoleManagement) {
        await requirePlatformAdmin("roles.manage");
      } else {
        await requirePlatformAdmin("roles.manage.limited");
        const protectedRoles = ["ADMIN", "SUPER_ADMIN"] as const;
        if (protectedRoles.includes(current.platformRole as typeof protectedRoles[number]) || protectedRoles.includes(after.platformRole as typeof protectedRoles[number])) {
          return NextResponse.json({ ok: false, message: "Admin yalnızca Kullanıcı, Support, Moderatör ve Analist rollerini düzenleyebilir." }, { status: 403 });
        }
      }
    }
    if (current.platformRole !== "USER" && changed.includes("status")) {
      if (hasAdminPermission(admin.platformRole, "roles.manage")) await requirePlatformAdmin("roles.manage");
      else {
        await requirePlatformAdmin("roles.manage.limited");
        if (["ADMIN", "SUPER_ADMIN"].includes(current.platformRole)) return NextResponse.json({ ok: false, message: "Admin, Admin veya Süper Admin hesabını aktifleştiremez ya da pasifleştiremez." }, { status: 403 });
      }
    }
    if (changed.includes("planTier") || changed.includes("bonusOfferCredits")) await requirePlatformAdmin("billing.manage");
    if (current.platformRole === "SUPER_ADMIN" && (after.platformRole !== "SUPER_ADMIN" || after.status !== "ACTIVE")) {
      const activeSuperAdmins = await prisma.user.count({ where: { platformRole: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null } });
      if (activeSuperAdmins <= 1) return NextResponse.json({ ok: false, message: "Son aktif Süper Admin pasife alınamaz veya yetkisi kaldırılamaz." }, { status: 400 });
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: current.id }, data: { status: after.status as "ACTIVE" | "SUSPENDED", platformRole: after.platformRole as (typeof ROLES)[number], planTier: after.planTier as (typeof PLANS)[number], bonusOfferCredits: after.bonusOfferCredits }, select: { id: true, name: true, status: true, platformRole: true, planTier: true, bonusOfferCredits: true } });
      await writeAdminAudit(tx, { actorId: admin.id, targetUserId: current.id, action: changed.includes("platformRole") ? "ROLE_CHANGED" : changed.includes("status") ? "ACCOUNT_STATUS_CHANGED" : changed.includes("planTier") ? "PLAN_CHANGED" : changed.includes("bonusOfferCredits") ? "CREDIT_CHANGED" : "USER_UPDATED", reason: body.reason!, before: current, after, metadata: { changedFields: changed }, request });
      return updated;
    });
    return NextResponse.json({ ok: true, message: "Kullanıcı güncellendi ve denetim kaydı oluşturuldu.", user });
  } catch (error) {
    return adminError(error, "Kullanıcı güncellenemedi.");
  }
}

function adminError(error: unknown, message: string) {
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
  if (error instanceof PlatformAuthorizationError) return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
  console.error("[admin/users]", error);
  return NextResponse.json({ ok: false, message }, { status: 500 });
}

function maskEmail(email: string | null) {
  if (!email) return null;
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain ?? "***"}`;
}

function maskMembership(value: string) {
  return `***${value.slice(-4)}`;
}
