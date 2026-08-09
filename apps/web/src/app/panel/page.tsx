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
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import {
  getPanelSummary,
  getUnreadMessageCount,
} from "@/lib/panel/get-panel-data";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function PanelPage() {
  const user = await requireUser({ allowDbUnavailable: true });
  const dbUnavailable = user.id.includes("@");

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
      if (entitlements.subject.type === "company" && entitlements.subject.name) {
        companyName = entitlements.subject.name;
      }
      hasHiddenInventory = entitlements.features.hidden_inventory === true;
      hasActiveCompany = Boolean(activeMembership);
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
        unreadMessages={unreadMessages}
        openOffersHint={summary.newOffers}
        hasHiddenInventory={hasHiddenInventory}
      />
    );
  }

  const firstName = user.name?.trim().split(/\s+/)[0] ?? "Merhaba";

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
        <section className="mb-5 rounded-2xl border border-black/[0.06] bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f1f1d] text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Firma hesabı oluşturun
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-black/45">
                  Satıcı veya ekip olarak çalışacaksanız firmanızı oluşturun;
                  ardından ekip daveti ve kurumsal araçlar açılır.
                </p>
              </div>
            </div>
            <Link
              href="/panel/firma/yeni"
              className="inline-flex items-center gap-2 rounded-full bg-[#0f1f1d] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Firma oluştur
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-2xl border border-teal-900/10 bg-gradient-to-br from-[#0f766e] via-[#0e7490] to-[#1e3a5f] text-white shadow-[0_20px_60px_rgba(15,118,110,0.22)]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-300/25 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-sky-300/20 blur-[80px]" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 rounded-full bg-amber-200/15 blur-[60px]" />

        <div className="relative px-6 py-7 sm:px-8 sm:py-8">
          <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-50">
            Çalışma alanı
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            Merhaba, {firstName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-50/75">
            Taleplerinizi yönetin, uygun iş fırsatlarını değerlendirin ve
            teklif süreçlerini tek yerden takip edin.
          </p>
        </div>

        <div className="relative grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3">
          <MetricCell
            label="Aktif talepler"
            value={String(summary.activeRequests)}
            accent="text-emerald-200"
          />
          <MetricCell
            label="Yeni teklifler"
            value={String(summary.newOffers)}
            accent="text-sky-200"
          />
          <MetricCell
            label="Okunmamış mesajlar"
            value={String(unreadMessages)}
            accent="text-amber-200"
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

        <aside className="overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-b from-[#fffbeb] to-white shadow-[0_12px_40px_rgba(217,119,6,0.08)]">
          <div className="border-b border-amber-200/50 px-5 py-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800/70">
              Hızlı erişim
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#0f172a]">
              Sık kullanılanlar
            </h2>
          </div>

          <div className="divide-y divide-amber-100 p-2">
            <QuickLink href="/panel/taleplerim" label="Taleplerim" />
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
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-white/[0.06] px-6 py-5 backdrop-blur-sm sm:px-8">
      <p className="text-xs font-medium text-white/55">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${accent}`}>
        {value}
      </p>
    </div>
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
  const isGreen = tone === "green";

  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border p-6 shadow-[0_14px_45px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(15,23,42,0.1)] sm:p-7 ${
        isGreen
          ? "border-emerald-200/70 bg-gradient-to-br from-[#ecfdf5] via-white to-[#f0fdf4]"
          : "border-sky-200/70 bg-gradient-to-br from-[#e0f2fe] via-white to-[#f0f9ff]"
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full blur-[50px] ${
          isGreen ? "bg-emerald-300/40" : "bg-sky-300/40"
        }`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm ${
            isGreen
              ? "bg-gradient-to-br from-emerald-500 to-teal-600"
              : "bg-gradient-to-br from-sky-500 to-blue-600"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white ${
            isGreen ? "bg-emerald-700" : "bg-sky-700"
          }`}
        >
          {eyebrow}
        </span>
      </div>

      <h2 className="relative mt-6 text-xl font-semibold tracking-tight text-[#0f172a]">
        {title}
      </h2>
      <p className="relative mt-2 text-sm leading-6 text-[#5b6b7c]">
        {description}
      </p>

      <div
        className={`relative mt-8 flex items-center gap-2 text-sm font-semibold ${
          isGreen ? "text-emerald-800" : "text-sky-800"
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
      className="flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-medium text-[#0f172a] transition hover:bg-amber-50"
    >
      {label}
      <ChevronRight className="h-4 w-4 text-amber-700/50" />
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
    <section className="overflow-hidden rounded-2xl border border-sky-200/60 bg-gradient-to-b from-[#f0f9ff] to-white shadow-[0_12px_40px_rgba(14,165,233,0.08)]">
      <div className="flex items-center justify-between border-b border-sky-100 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800/70">
            Aktivite
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#0f172a]">
            Son gelişmeler
          </h2>
        </div>

        <Link
          href="/panel/bildirimler"
          className="flex items-center gap-1 text-sm font-medium text-sky-800/70 transition hover:text-sky-950"
        >
          Tümü
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {notifications.length === 0 ? (
        <div className="px-5 py-8 text-sm leading-6 text-[#5b6b7c] sm:px-6">
          Henüz bildirim yok. İlk talebinizi oluşturduğunuzda gelişmeler burada
          listelenir.
        </div>
      ) : (
        <div className="divide-y divide-sky-100/80">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.actionUrl ?? "/panel/bildirimler"}
              className="flex items-start gap-3 px-5 py-4 transition hover:bg-sky-50/70 sm:px-6"
            >
              <ActivityIcon type={notification.type} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#0f172a]">
                  {notification.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-[#5b6b7c]">
                  {notification.message}
                </p>
              </div>
              <span className="shrink-0 text-xs text-[#94a3b8]">
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
  let tone = "bg-sky-100 text-sky-800";

  if (
    type === "NEW_OFFER" ||
    type === "OFFER_ACCEPTED" ||
    type === "OFFER_VIEWED"
  ) {
    Icon = BriefcaseBusiness;
    tone = "bg-emerald-100 text-emerald-800";
  }

  if (type === "NEW_MESSAGE") {
    Icon = MessageCircle;
    tone = "bg-amber-100 text-amber-800";
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
