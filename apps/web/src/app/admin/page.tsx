import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { AdminSecurityGate } from "@/components/admin/AdminSecurityGate";
import { AdminOperationsCenter } from "@/components/admin/AdminOperationsCenter";
import { DateRangeComparison } from "@/components/admin/DateRangeComparison";
import { AdminHealthMeta } from "@/components/admin/AdminHealthMeta";
import { AdminChartInsights } from "@/components/admin/AdminChartInsights";
import { AdminPrivacyNotice } from "@/components/admin/AdminPrivacyNotice";
import { CategoryManagement } from "@/components/admin/CategoryManagement";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { prisma } from "@/lib/prisma";
import {
  PlatformAuthorizationError,
  requirePlatformAdmin,
} from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";
import { ADMIN_MFA_COOKIE, verifyMfaSession } from "@/server/admin/mfa";
import { adminPermissions, hasAdminPermission } from "@/lib/auth/platform-admin";
import { getBuiltInCategoryById } from "@/lib/request-category-engine";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let admin;
  try {
    admin = await requirePlatformAdmin("admin.view", { skipMfa: true });
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof PlatformAuthorizationError) {
      notFound();
    }
    throw error;
  }

  const mfaState = await prisma.user.findUnique({ where: { id: admin.id }, select: { adminMfaEnabled: true } });
  const cookieStore = await cookies();
  if (!verifyMfaSession(cookieStore.get(ADMIN_MFA_COOKIE)?.value, admin.id)) {
    return <div className="admin-signature admin-security-frame"><Link href="/panel" className="admin-security-brand">talepo.</Link><AdminSecurityGate enabled={Boolean(mfaState?.adminMfaEnabled)} allowBypass={process.env.NODE_ENV !== "production"} /></div>;
  }

  const permissions = adminPermissions(admin.platformRole);
  const canSeeSensitive = hasAdminPermission(admin.platformRole, "sensitive.view");
  const canManageBilling = hasAdminPermission(admin.platformRole, "billing.manage");
  const canViewBilling = hasAdminPermission(admin.platformRole, "billing.view") || canManageBilling;
  const canManageCategories = hasAdminPermission(admin.platformRole, "categories.manage");

  const [users, counts, billingSubscriptions, categories] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null, ...(admin.platformRole !== "SUPER_ADMIN" ? { platformRole: { not: "SUPER_ADMIN" as const } } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        membershipNumber: true,
        status: true,
        platformRole: true,
        planTier: true,
        bonusOfferCredits: true,
        createdAt: true,
        lastLoginAt: true,
      },
      take: 100,
    }),
    loadDashboardCounts(),
    canViewBilling ? prisma.billingSubscription.findMany({ where: { subjectType: "USER" }, select: { subjectId: true, status: true, currentPeriodEnd: true } }) : Promise.resolve([]),
    canManageCategories ? prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, description: true, isActive: true, sortOrder: true, _count: { select: { requests: true, companyCategories: true, forms: true, suggestions: true, alertRules: true, inventoryItems: true, priceObservations: true } } } }) : Promise.resolve([]),
  ]);

  const billingByUser = new Map(billingSubscriptions.map((subscription) => [subscription.subjectId, subscription]));
  const serializedUsers = users.map((user) => ({
    ...user,
    email: canSeeSensitive ? user.email : maskEmail(user.email),
    membershipNumber: canSeeSensitive ? user.membershipNumber : maskMembership(user.membershipNumber),
    planTier: canViewBilling ? user.planTier : null,
    billingStatus: canViewBilling ? billingByUser.get(user.id)?.status ?? "INACTIVE" : null,
    billingPeriodEnd: canViewBilling ? billingByUser.get(user.id)?.currentPeriodEnd?.toISOString() ?? null : null,
    bonusOfferCredits: canManageBilling ? user.bonusOfferCredits : 0,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: canSeeSensitive ? user.lastLoginAt?.toISOString() ?? null : null,
    isAdmin: user.platformRole !== "USER",
  }));

  return (
    <AdminShell name={admin.name} role={admin.platformRole} title="Genel bakış">
      <AdminOverview name={admin.name} role={admin.platformRole} counts={counts} dateLabel={new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date())} />
      <AdminPrivacyNotice sensitive={canSeeSensitive} />
      <div id="memberships" className="mt-5">
        <AdminUsersTable initialUsers={serializedUsers} permissions={permissions} currentUserId={admin.id} />
      </div>
      {canManageCategories ? <div id="categories"><CategoryManagement initialCategories={categories.map((category) => ({ ...category, isBuiltIn: Boolean(getBuiltInCategoryById(category.slug)) }))} canDeleteCategories={admin.platformRole === "SUPER_ADMIN"} /></div> : null}
      <div id="operations"><AdminOperationsCenter permissions={permissions} /></div>
      {hasAdminPermission(admin.platformRole, "analytics.view") ? <>
        <DateRangeComparison />
        <AdminHealthMeta />
        <AdminChartInsights />
      </> : null}
    </AdminShell>
  );
}

function maskEmail(email: string | null) {
  if (!email) return null;
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain ?? "***"}`;
}

function maskMembership(value: string) {
  return `***${value.slice(-4)}`;
}

type DashboardCounts = { userCount: number; companyCount: number; requestCount: number; offerCount: number };

async function loadDashboardCounts(): Promise<DashboardCounts> {
  const directUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!directUrl) throw new Error("Dashboard sayacı için veritabanı bağlantısı bulunamadı.");
  const connectionString = directUrl.replace(":6543/", ":5432/").replace("?pgbouncer=true", "").replace("&pgbouncer=true", "");
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query('SELECT (SELECT count(*)::int FROM "User" WHERE "deletedAt" IS NULL) AS "userCount", (SELECT count(*)::int FROM "Company" WHERE "deletedAt" IS NULL) AS "companyCount", (SELECT count(*)::int FROM "Request" WHERE "deletedAt" IS NULL) AS "requestCount", (SELECT count(*)::int FROM "Offer") AS "offerCount"');
    const row = result.rows[0] ?? {};
    return { userCount: Number(row.userCount ?? 0), companyCount: Number(row.companyCount ?? 0), requestCount: Number(row.requestCount ?? 0), offerCount: Number(row.offerCount ?? 0) };
  } finally {
    await client.end();
  }
}
