import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  Activity,
  ArrowLeft,
  Building2,
  FileText,
  HandCoins,
  ShieldCheck,
  Users,
} from "lucide-react";

import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { AdminSecurityGate } from "@/components/admin/AdminSecurityGate";
import { AdminOperationsCenter } from "@/components/admin/AdminOperationsCenter";
import { DateRangeComparison } from "@/components/admin/DateRangeComparison";
import { AdminHealthMeta } from "@/components/admin/AdminHealthMeta";
import { AdminChartInsights } from "@/components/admin/AdminChartInsights";
import { AdminPrivacyNotice } from "@/components/admin/AdminPrivacyNotice";
import { Header } from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import {
  PlatformAuthorizationError,
  requirePlatformAdmin,
} from "@/server/auth/require-platform-admin";
import { AuthenticationError } from "@/server/auth/require-user";
import { ADMIN_MFA_COOKIE, verifyMfaSession } from "@/server/admin/mfa";
import { adminPermissions, hasAdminPermission } from "@/lib/auth/platform-admin";

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
    return <div className="min-h-screen bg-[#071310] text-white"><Header tone="ink" /><AdminSecurityGate enabled={Boolean(mfaState?.adminMfaEnabled)} allowBypass={process.env.NODE_ENV !== "production"} /></div>;
  }

  const permissions = adminPermissions(admin.platformRole);
  const canSeeSensitive = hasAdminPermission(admin.platformRole, "sensitive.view");
  const canManageBilling = hasAdminPermission(admin.platformRole, "billing.manage");

  const [users, userCount, companyCount, requestCount, offerCount] = await Promise.all([
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
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.company.count({ where: { deletedAt: null } }),
    prisma.request.count({ where: { deletedAt: null } }),
    prisma.offer.count(),
  ]);

  const serializedUsers = users.map((user) => ({
    ...user,
    email: canSeeSensitive ? user.email : maskEmail(user.email),
    membershipNumber: canSeeSensitive ? user.membershipNumber : maskMembership(user.membershipNumber),
    planTier: canManageBilling ? user.planTier : null,
    bonusOfferCredits: canManageBilling ? user.bonusOfferCredits : 0,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: canSeeSensitive ? user.lastLoginAt?.toISOString() ?? null : null,
    isAdmin: user.platformRole !== "USER",
  }));

  return (
    <div className="min-h-screen bg-[#071310] text-white">
      <Header tone="ink" />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link href="/panel" className="inline-flex items-center gap-2 text-sm text-emerald-100/45 transition hover:text-emerald-100">
              <ArrowLeft className="h-4 w-4" /> Kullanıcı paneline dön
            </Link>
            <div className="mt-6 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300 text-[#241a02] shadow-lg shadow-amber-300/10"><ShieldCheck className="h-6 w-6" /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/65">Talepo yönetim merkezi</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Admin Panel</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/45">Hoş geldin {admin.name}. Üyelikleri, planları ve platformun temel hareketlerini buradan yönetebilirsin.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.07] px-4 py-3 text-sm text-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Sistem aktif</div>
        </div>

        <AdminPrivacyNotice sensitive={canSeeSensitive} />

        <section className="my-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric href="/admin/users" icon={Users} label="Toplam kullanıcı" value={userCount} tone="emerald" />
          <Metric href="/admin/companies" icon={Building2} label="Şirket" value={companyCount} tone="cyan" />
          <Metric href="/admin/requests" icon={FileText} label="Talep" value={requestCount} tone="amber" />
          <Metric href="/admin/offers" icon={HandCoins} label="Teklif" value={offerCount} tone="violet" />
        </section>

        <AdminUsersTable initialUsers={serializedUsers} permissions={permissions} />

        <AdminOperationsCenter permissions={permissions} />
        {hasAdminPermission(admin.platformRole, "analytics.view") ? <DateRangeComparison /> : null}
        {hasAdminPermission(admin.platformRole, "analytics.view") ? <AdminHealthMeta /> : null}
        {hasAdminPermission(admin.platformRole, "analytics.view") ? <AdminChartInsights /> : null}
        {hasAdminPermission(admin.platformRole, "analytics.view") ? <Link href="/admin/health" className="mt-5 inline-flex items-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/20">Sağlık merkezini aç</Link> : null}

        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4 text-xs text-white/35"><Activity className="h-4 w-4 text-emerald-300/60" /> Değişiklikler yalnızca sunucuda doğrulanan admin oturumuyla uygulanır.</div>
      </main>
    </div>
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

function Metric({ href, icon: Icon, label, value, tone }: { href: string; icon: typeof Users; label: string; value: number; tone: "emerald" | "cyan" | "amber" | "violet" }) {
  const colors = { emerald: "bg-emerald-300/10 text-emerald-200", cyan: "bg-cyan-300/10 text-cyan-200", amber: "bg-amber-300/10 text-amber-200", violet: "bg-violet-300/10 text-violet-200" };
  return <Link href={href} className="group rounded-[24px] border border-white/[0.08] bg-white/[0.045] p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-white/[0.07]"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div><p className="mt-5 text-sm text-white/40 group-hover:text-white/65">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p></Link>;
}
