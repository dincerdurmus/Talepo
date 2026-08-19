import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertMfaSession } from "@/server/admin/mfa";
import { requirePlatformAdmin } from "@/server/auth/require-platform-admin";

const ACTIONS = ["USER_UPDATED", "ROLE_CHANGED", "ACCOUNT_STATUS_CHANGED", "PLAN_CHANGED", "CREDIT_CHANGED", "SENSITIVE_DATA_VIEWED", "MFA_ENABLED", "MFA_DISABLED", "MODERATION_CASE_CREATED", "MODERATION_CASE_UPDATED", "DATA_EXPORTED"] as const;

export async function GET(request: Request) {
  try {
    const admin = await requirePlatformAdmin("audit.view");
    assertMfaSession(request, admin.id);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const daysParam = url.searchParams.get("days") || "30";
    const days = daysParam === "all" ? null : [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30;
    const action = url.searchParams.get("action") || "";
    const query = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const where: Prisma.AdminAuditLogWhereInput = {};
    if (days) where.createdAt = { gte: new Date(Date.now() - days * 86_400_000) };
    if (ACTIONS.includes(action as typeof ACTIONS[number])) where.action = action as typeof ACTIONS[number];
    if (query) where.OR = [
      { reason: { contains: query, mode: "insensitive" } },
      { actor: { is: { name: { contains: query, mode: "insensitive" } } } },
      { actor: { is: { email: { contains: query, mode: "insensitive" } } } },
      { targetUser: { is: { name: { contains: query, mode: "insensitive" } } } },
      { targetUser: { is: { email: { contains: query, mode: "insensitive" } } } },
      { targetUser: { is: { membershipNumber: { contains: query, mode: "insensitive" } } } },
    ];
    const pageSize = 25;
    const [items, total] = await Promise.all([
      prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, action: true, reason: true, before: true, after: true, metadata: true, createdAt: true, actor: { select: { name: true, email: true } }, targetUser: { select: { name: true, email: true, membershipNumber: true } } } }),
      prisma.adminAuditLog.count({ where }),
    ]);
    return NextResponse.json({ ok: true, items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })), pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (error) {
    console.error("[admin/audit]", error);
    return NextResponse.json({ ok: false, message: "Denetim kayıtları alınamadı." }, { status: 403 });
  }
}
