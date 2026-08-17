import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  FileText,
  MessageCircle,
  Package,
} from "lucide-react";

import { CorporateHome } from "@/components/panel/CorporateHome";
import { InviteActions } from "@/components/panel/InviteActions";
import { PlanBadge } from "@/components/panel/PlanBadge";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import {
  formatPersonalPlanMismatchDetail,
  hasPersonalPlanMismatch,
} from "@/lib/membership/membership-rules";
import { getPlanHeroBanner } from "@/lib/membership/plan-visuals";
import type { PlanTierId } from "@/lib/membership/plans";
import {
  getPanelSummary,
  getUnreadMessageCount,
} from "@/lib/panel/get-panel-data";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function PanelPage() {
  const user = await requireUser({ allowDbUnavailable: true });
  const dbUnavailable = user.dbUnavailable;

  const summary = dbUnavailable
    ? {
        activeRequests: 0,
        unreadNotifications: 0,
        newOffers: 0,
        recentNotifications: [],
      }
    : await getPanelSummary(user.id);

  const unreadMessages = dbUnavailable
    ? 0
    : await getUnreadMessageCount(user.id);

  let isCorporate = false;
  let companyName = "Firma";
  let hasActiveCompany = false;
  let hasHiddenInventory = false;
  let planTier: PlanTierId = "STANDARD";
  let planLabel = "Standart";
  let personalPlanMismatchDetail: string | null = null;
  let pendingInvite: { companyId: string; companyName: string } | null = null;

  if (!dbUnavailable) {
    try {
      const [entitlements, activeMembership, invite] = await Promise.all([
        resolveEntitlements(user.id, await getCompanyContextOptions()),
        prisma.companyMember.findFirst({
          where: {
            userId: user.id,
            status: "ACTIVE",
            company: { deletedAt: null },
          },
          select: { id: true },
        }),
        prisma.companyMember.findFirst({
          where: {
            userId: user.id,
            status: "INVITED",
            company: {
              deletedAt: null,
              status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
            },
          },
          orderBy: { invitedAt: "desc" },
          select: {
            companyId: true,
            company: { select: { name: true } },
          },
        }),
      ]);
      isCorporate = entitlements.subject.type === "company";
      planTier = entitlements.effectivePlanTier;
      planLabel = entitlements.planLabel;
      if (entitlements.subject.type === "company" && entitlements.subject.name) {
        companyName = entitlements.subject.name;
      }
      hasHiddenInventory = entitlements.features.hidden_inventory === true;
      hasActiveCompany = Boolean(activeMembership);
      if (hasPersonalPlanMismatch(entitlements)) {
        personalPlanMismatchDetail = formatPersonalPlanMismatchDetail(entitlements);
      }
      if (invite) {
        pendingInvite = {
          companyId: invite.companyId,
          companyName: invite.company.name,
        };
      }
    } catch {
      // keep personal home
    }
  }

  if (isCorporate) {
    return (
      <CorporateHome
        companyName={companyName}
        planTier={planTier}
        planLabel={planLabel}
        unreadMessages={unreadMessages}
        openOffersHint={summary.newOffers}
        hasHiddenInventory={hasHiddenInventory}
        personalPlanMismatchDetail={personalPlanMismatchDetail}
      />
    );
  }

  const firstName =
    user.name?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    "Kullanıcı";
  const heroBanner = getPlanHeroBanner(planTier);

  return (
    <>
      {pendingInvite && (
        <section className="mb-5 rounded-2xl border border-teal-800/15 bg-[#e7f7f2] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/70">
            Firma daveti
          </p>
          <p className="mt-2 font-semibold text-teal-950">
            {pendingInvite.companyName} sizi ekibe davet etti
          </p>
          <InviteActions
            companyId={pendingInvite.companyId}
            companyName={pendingInvite.companyName}
          />
        </section>
      )}

      {!hasActiveCompany && (
        <section className="relative mb-5 overflow-hidden rounded-2xl border border-teal-900/10 bg-white px-5 py-5 shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:px-6">
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef6f4] text-teal-800">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[#0f1f1d]">
                  Firma hesabı oluşturun
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-teal-950/55">
                  Satıcı veya ekip olarak çalışacaksanız firmanızı oluşturun;
                  ardından ekip daveti ve kurumsal araçlar açılır.
                </p>
              </div>
            </div>
            <Link
              href="/panel/firma/yeni"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115e59]"
            >
              Firma oluştur
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <section className={heroBanner.section}>
        <div className={heroBanner.glowPrimary} />
        <div className={heroBanner.glowSecondary} />
        <div className={heroBanner.glowTertiary} />

        <div className="relative px-6 py-7 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className={heroBanner.eyebrow}>
              Çalışma alanı
            </p>
            <PlanBadge
              planTier={planTier}
              planLabel={planLabel}
              variant="hero"
              size="md"
              showStandard
              linked
            />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            Merhaba, {firstName}
          </h1>
          <p
            className={`mt-2 max-w-2xl text-sm leading-6 ${heroBanner.subtitle}`}
          >
            Taleplerinizi yönetin, uygun iş fırsatlarını değerlendirin ve
            teklif süreçlerini tek yerden takip edin.
          </p>
        </div>

        <div className="relative grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3">
          <MetricCell
            label="Aktif talepler"
            value={String(summary.activeRequests)}
            accent="text-teal-100"
            href="/panel/taleplerim"
          />
          <MetricCell
            label="Yeni teklifler"
            value={String(summary.newOffers)}
            accent="text-white"
            href="/panel/gelen-teklifler"
            hint="Teklifleri gör →"
          />
          <MetricCell
            label="Okunmamış mesajlar"
            value={String(unreadMessages)}
            accent="text-teal-50"
            href="/panel/mesajlar"
          />
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <PrimaryAction
          href="/talep"
          eyebrow="Alıcı"
          title="Talep oluştur"
          description="İhtiyacınızı yazın; uygun firmalardan teklif alın."
          icon={Package}
          action="Yeni talep başlat"
          tone="green"
        />
        <PrimaryAction
          href="/panel/talepler"
          eyebrow="Tedarikçi"
          title="Talepleri keşfet"
          description="Uzmanlığınıza uygun talepleri inceleyip teklif verin."
          icon={BriefcaseBusiness}
          action="Keşfe git"
          tone="blue"
        />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <RecentActivity notifications={summary.recentNotifications} />

        <aside className="overflow-hidden rounded-2xl border border-teal-900/10 bg-white shadow-[0_12px_36px_rgba(15,31,29,0.04)]">
          <div className="border-b border-teal-900/8 px-5 py-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
              Hızlı erişim
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#0f1f1d]">
              Sık kullanılanlar
            </h2>
          </div>

          <div className="divide-y divide-teal-900/6 p-2">
            <QuickLink href="/panel/taleplerim" label="Taleplerim" />
            <QuickLink href="/panel/gelen-teklifler" label="Gelen teklifler" />
            <QuickLink href="/panel/mesajlar" label="Mesajlar" />
            <QuickLink href="/panel/firma/yeni" label="Firma oluştur" />
            <QuickLink href="/panel/plan" label="Plan ve üyelik" />
            <QuickLink href="/panel/profil" label="Profil ayarları" />
          </div>
        </aside>
      </section>
    </>
  );
}

function MetricCell({
  label,
  value,
  accent,
  href,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white/[0.06] px-6 py-5 backdrop-blur-sm transition hover:bg-white/[0.12] sm:px-8"
    >
      <p className="text-xs font-medium text-white/55">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${accent}`}>
        {value}
      </p>
      <p className="mt-2 text-[11px] font-medium text-white/40 transition group-hover:text-white/70">
        {hint ?? "Görüntüle →"}
      </p>
    </Link>
  );
}

function PrimaryAction({
  href,
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
  tone,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  action: string;
  tone: "green" | "blue";
}) {
  const isBuyer = tone === "green";

  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-6 shadow-[0_12px_36px_rgba(15,31,29,0.04)] transition hover:-translate-y-0.5 sm:p-7 ${
        isBuyer
          ? "border-amber-900/10 hover:shadow-[0_16px_48px_rgba(234,88,12,0.1)]"
          : "border-cyan-900/10 hover:shadow-[0_16px_48px_rgba(14,116,144,0.1)]"
      }`}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: isBuyer
            ? "linear-gradient(90deg, #f59e0b, #ea580c)"
            : "linear-gradient(90deg, #14b8a6, #0284c7)",
        }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm ${
            isBuyer
              ? "bg-gradient-to-br from-[#f59e0b] to-[#ea580c]"
              : "bg-gradient-to-br from-[#0d9488] to-[#0284c7]"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
            isBuyer
              ? "bg-[#ffedd5] text-[#9a3412]"
              : "bg-[#cffafe] text-[#155e75]"
          }`}
        >
          {eyebrow}
        </span>
      </div>

      <h2 className="relative mt-6 text-xl font-semibold tracking-tight text-[#0f1f1d]">
        {title}
      </h2>
      <p className="relative mt-2 text-sm leading-6 text-teal-950/50">
        {description}
      </p>

      <div
        className={`relative mt-8 flex items-center gap-2 text-sm font-semibold ${
          isBuyer ? "text-[#c2410c]" : "text-[#0e7490]"
        }`}
      >
        {action}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-medium text-[#0f1f1d] transition hover:bg-[#f7faf9]"
    >
      {label}
      <ChevronRight className="h-4 w-4 text-teal-800/35" />
    </Link>
  );
}

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  type: string;
  actionUrl: string | null;
  status: string;
};

function RecentActivity({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-teal-900/10 bg-white shadow-[0_12px_36px_rgba(15,31,29,0.04)]">
      <div className="flex items-center justify-between border-b border-teal-900/8 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
            Aktivite
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#0f1f1d]">
            Son gelişmeler
          </h2>
        </div>

        <Link
          href="/panel/bildirimler"
          className="flex items-center gap-1 text-sm font-medium text-teal-800/70 transition hover:text-teal-950"
        >
          Tümü
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {notifications.length === 0 ? (
        <div className="px-5 py-8 text-sm leading-6 text-teal-950/50 sm:px-6">
          Henüz bildirim yok. İlk talebinizi oluşturduğunuzda gelişmeler burada
          listelenir.
        </div>
      ) : (
        <div className="divide-y divide-teal-900/6">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={`/panel/bildirimler/r/${notification.id}`}
              className="flex items-start gap-3 px-5 py-4 transition hover:bg-[#f7faf9] sm:px-6"
            >
              <ActivityIcon type={notification.type} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#0f1f1d]">
                  {notification.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-teal-950/50">
                  {notification.message}
                </p>
              </div>
              <span className="shrink-0 text-xs text-teal-950/35">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityIcon({ type }: { type: string }) {
  let Icon: LucideIcon = FileText;
  let tone = "bg-[#eef6f4] text-teal-800";

  if (
    type === "NEW_OFFER" ||
    type === "OFFER_ACCEPTED" ||
    type === "OFFER_VIEWED"
  ) {
    Icon = BriefcaseBusiness;
    tone = "bg-[#e7f7f2] text-teal-900";
  }

  if (type === "NEW_MESSAGE") {
    Icon = MessageCircle;
    tone = "bg-[#f0f4f3] text-[#0f1f1d]";
  }

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Az önce";
  if (diffHours < 24) return `${diffHours} saat önce`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Dün";
  if (diffDays < 7) return `${diffDays} gün önce`;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(date);
}
