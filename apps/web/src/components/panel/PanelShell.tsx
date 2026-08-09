"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  ChevronRight,
  Home,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  PanelAccountMenu,
  type PanelCompanyOption,
} from "@/components/panel/PanelAccountMenu";
import {
  filterPanelNavItems,
  PANEL_NAV_ITEMS,
  PANEL_NOTIFICATIONS_HREF,
} from "@/components/panel/panel-nav";
import type { FeatureKey } from "@/lib/membership/entitlements";
import type { PlanTierId } from "@/lib/membership/plans";

export type PanelUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type PanelWorkspace = {
  mode: "personal" | "corporate";
  companyId?: string | null;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  planTier: PlanTierId;
  planLabel: string;
  quotaUnlimited: boolean;
  quotaRemaining: number | null;
};

type PanelShellProps = {
  user: PanelUser;
  unreadNotifications: number;
  unreadMessages: number;
  dbUnavailable?: boolean;
  features?: Partial<Record<FeatureKey, boolean>>;
  workspace?: PanelWorkspace;
  companies?: PanelCompanyOption[];
  children: React.ReactNode;
};

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.trim() || "K";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPanelPageTitle(pathname: string) {
  if (pathname === "/panel") return "Özet";
  if (pathname.includes("/duzenle")) return "Talebi düzelt";
  if (pathname.startsWith("/panel/taleplerim")) return "Taleplerim";
  if (pathname.startsWith("/panel/talepler")) return "Talepleri keşfet";
  if (pathname.startsWith("/panel/teklifler")) return "Tekliflerimiz";
  if (pathname.startsWith("/panel/asistan")) return "AI asistan";
  if (pathname.startsWith("/panel/uyarilar")) return "Uyarı kuralları";
  if (pathname.startsWith("/panel/envanter")) return "Gizli envanter";
  if (pathname.startsWith("/panel/ekip")) return "Ekip";
  if (pathname.startsWith("/panel/firma/yeni")) return "Yeni firma oluştur";
  if (pathname.startsWith("/panel/firma")) return "Firma ayarları";
  if (pathname.startsWith("/panel/plan")) return "Plan";
  if (pathname.startsWith("/panel/mesajlar")) return "Mesajlar";
  if (pathname.startsWith("/panel/bildirimler")) return "Bildirimler";
  if (pathname.startsWith("/panel/profil")) return "Profil";
  return "Çalışma alanı";
}

const NAV_TONES = [
  "bg-[#dff4d9] text-[#2f6b34]",
  "bg-[#dce8ff] text-[#2a4a74]",
  "bg-[#fbf4ea] text-[#7a4e1a]",
  "bg-[#eef6f4] text-[#2f5c54]",
  "bg-[#e4f4f2] text-[#2f5c54]",
  "bg-[#ffe8d6] text-[#8a4b1a]",
  "bg-[#e8f3ea] text-[#356d3a]",
  "bg-[#e7eef8] text-[#334e68]",
] as const;

export function PanelShell({
  user,
  unreadNotifications,
  unreadMessages,
  dbUnavailable = false,
  features,
  workspace,
  companies = [],
  children,
}: PanelShellProps) {
  const pathname = usePathname();
  const displayName = user.name?.trim() || "Kullanıcı";
  const initials = getInitials(user.name, user.email);
  const mode = workspace?.mode ?? "personal";
  const isCorporate = mode === "corporate";
  const navItems = filterPanelNavItems(PANEL_NAV_ITEMS, features, mode);
  const companyName = workspace?.companyName?.trim() || "Firma";
  const companyLogoUrl = workspace?.companyLogoUrl ?? null;
  const pageTitle = getPanelPageTitle(pathname);

  return (
    <main
      className={`min-h-screen ${
        isCorporate ? "bg-[#f3f6f4] text-[#0f1f1d]" : "bg-[#f3f3ef] text-[#151515]"
      }`}
    >
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        {isCorporate ? (
          <CorporateSidebar
            pathname={pathname}
            navItems={navItems}
            unreadMessages={unreadMessages}
            companyName={companyName}
            companyLogoUrl={companyLogoUrl}
            planLabel={workspace?.planLabel ?? "Kurumsal"}
            quotaUnlimited={workspace?.quotaUnlimited ?? true}
            quotaRemaining={workspace?.quotaRemaining ?? null}
          />
        ) : (
          <PersonalSidebar
            pathname={pathname}
            navItems={navItems}
            unreadMessages={unreadMessages}
            user={user}
            displayName={displayName}
            initials={initials}
          />
        )}

        <section className="min-w-0 flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8">
          <div className="mx-auto max-w-[1320px]">
            <header
              className={`relative z-40 flex items-center justify-between rounded-[24px] border border-black/[0.06] px-4 py-3 backdrop-blur-xl sm:px-5 ${
                isCorporate ? "bg-white shadow-sm" : "bg-white/70"
              }`}
            >
              <div className="flex items-center gap-3 lg:hidden">
                <div className="text-2xl font-semibold tracking-[-0.06em]">
                  tale<span className="text-black/35">po</span>
                </div>
                {isCorporate && (
                  <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Kurumsal
                  </span>
                )}
              </div>

              <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
                <div className="min-w-0">
                  <p
                    className={`truncate text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      isCorporate ? "text-teal-800/55" : "text-black/35"
                    }`}
                  >
                    {isCorporate ? companyName : `Merhaba, ${displayName.split(" ")[0]}`}
                  </p>
                  <p className="truncate text-sm font-semibold text-black/80">
                    {pageTitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={PANEL_NOTIFICATIONS_HREF}
                  aria-label="Bildirimler"
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-black/[0.06] bg-white transition hover:bg-[#f5f5f2]"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#72c56f]" />
                  )}
                </Link>

                <PanelAccountMenu
                  displayName={displayName}
                  email={user.email}
                  image={user.image}
                  initials={initials}
                  isCorporate={isCorporate}
                  companyName={workspace?.companyName}
                  activeCompanyId={workspace?.companyId}
                  companies={companies}
                />
              </div>
            </header>

            {dbUnavailable && (
              <div className="mt-4 rounded-[20px] border border-[#efb8b0] bg-[#fff1ee] px-4 py-4 text-sm leading-6 text-[#8b352b]">
                Supabase veritabanına bağlanılamıyor. Giriş yaptınız ancak talep
                ve panel verileri yüklenemez. Supabase projenizi kontrol edip{" "}
                <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">
                  .env
                </code>{" "}
                dosyasındaki bağlantı bilgilerini güncelleyin.
              </div>
            )}

            <div className="mt-4">{children}</div>
          </div>
        </section>
      </div>

      <nav className="fixed bottom-3 left-3 right-3 z-50 rounded-[25px] border border-black/[0.08] bg-white/90 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.15)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <MobileLink
            href="/panel"
            icon={Home}
            label={isCorporate ? "Özet" : "Ana sayfa"}
            active={isNavActive(pathname, "/panel", true)}
          />
          <MobileLink
            href="/panel/talepler"
            icon={Search}
            label="Keşfet"
            active={isNavActive(pathname, "/panel/talepler")}
          />

          <Link
            href={isCorporate ? "/panel/talepler" : "/talep"}
            aria-label={isCorporate ? "Talepleri keşfet" : "Talep oluştur"}
            className={`-mt-8 flex h-16 w-16 items-center justify-center rounded-full border-[5px] text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)] ${
              isCorporate
                ? "border-[#f3f6f4] bg-teal-800"
                : "border-[#f3f3ef] bg-[#151515]"
            }`}
          >
            {isCorporate ? <Search className="h-7 w-7" /> : <Plus className="h-7 w-7" />}
          </Link>

          <MobileLink
            href="/panel/mesajlar"
            icon={MessageCircle}
            label="Mesajlar"
            active={isNavActive(pathname, "/panel/mesajlar")}
            badge={unreadMessages > 0 ? unreadMessages : undefined}
          />
          <MobileLink
            href="/panel/profil"
            icon={UserRound}
            label="Profil"
            active={isNavActive(pathname, "/panel/profil")}
          />
        </div>
      </nav>
    </main>
  );
}

function PersonalSidebar({
  pathname,
  navItems,
  unreadMessages,
  user,
  displayName,
  initials,
}: {
  pathname: string;
  navItems: ReturnType<typeof filterPanelNavItems>;
  unreadMessages: number;
  user: PanelUser;
  displayName: string;
  initials: string;
}) {
  return (
    <aside className="relative sticky top-0 hidden h-screen w-[270px] shrink-0 overflow-hidden border-r border-black/[0.06] bg-[#eef1ea] px-4 py-6 lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-[#c9f4c1]/50 blur-[70px]" />
        <div className="absolute -right-20 bottom-28 h-52 w-52 rounded-full bg-[#c6d9ff]/45 blur-[80px]" />
      </div>

      <div className="relative">
        <Link
          href="/panel"
          className="inline-flex items-end gap-2 px-2 text-[30px] font-semibold tracking-[-0.06em]"
        >
          tale<span className="text-black/35">po</span>
          <span className="mb-1.5 rounded-full bg-[#dff4d9] px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-[#2f6b34]">
            PANEL
          </span>
        </Link>

        <Link
          href="/talep"
          className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-[#151515] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-black"
        >
          <Plus className="h-4 w-4" />
          Yeni talep
        </Link>
      </div>

      <nav className="relative mt-8 space-y-1">
        {navItems.map((item, index) => (
          <SidebarLink
            key={`${item.href}-${item.label}`}
            href={item.href}
            icon={item.icon}
            label={item.label}
            tone={NAV_TONES[index % NAV_TONES.length]}
            active={isNavActive(pathname, item.href, item.exact)}
            badge={
              item.href === "/panel/mesajlar" && unreadMessages > 0
                ? String(unreadMessages)
                : undefined
            }
          />
        ))}
      </nav>

      <div className="relative mt-auto space-y-3 px-0.5">
        <div className="rounded-2xl border border-[#b7e3b0]/70 bg-[#eef9eb]/90 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2f6b34]">
            Hızlı ipucu
          </p>
          <p className="mt-1.5 text-xs leading-5 text-black/55">
            İhtiyacını günlük dille yaz; firmalar teklif getirsin.
          </p>
        </div>

        <Link
          href="/panel/profil"
          className="block rounded-[22px] border border-black/[0.06] bg-white/90 p-3.5 shadow-[0_14px_40px_rgba(0,0,0,0.05)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
        >
          <div className="flex items-center gap-3">
            {user.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="h-11 w-11 rounded-full border border-black/10 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#151515] to-[#3d5c45] text-sm font-semibold text-white">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="mt-0.5 truncate text-xs text-black/40">
                Kişisel hesap
              </p>
            </div>

            <ChevronRight className="h-4 w-4 text-black/30" />
          </div>
        </Link>
      </div>
    </aside>
  );
}

function CorporateSidebar({
  pathname,
  navItems,
  unreadMessages,
  companyName,
  companyLogoUrl,
  planLabel,
  quotaUnlimited,
  quotaRemaining,
}: {
  pathname: string;
  navItems: ReturnType<typeof filterPanelNavItems>;
  unreadMessages: number;
  companyName: string;
  companyLogoUrl?: string | null;
  planLabel: string;
  quotaUnlimited: boolean;
  quotaRemaining: number | null;
}) {
  return (
    <aside className="relative sticky top-0 hidden h-screen w-[280px] shrink-0 overflow-hidden border-r border-white/10 bg-[#0f1f1d] px-4 py-5 text-white lg:flex lg:flex-col">
      <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 right-0 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative px-2">
        <Link href="/panel" className="text-2xl font-semibold tracking-[-0.06em]">
          tale<span className="text-white/35">po</span>
        </Link>

        <div className="mt-4 rounded-2xl border border-teal-400/25 bg-teal-500/10 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-teal-500/25 text-teal-100">
              {companyLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={companyLogoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {companyName}
              </p>
              <p className="text-[11px] text-teal-100/70">
                {planLabel} · Aktif
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-teal-100/80">
            <ShieldCheck className="h-3.5 w-3.5" />
            Kurumsal çalışma alanı
          </div>
        </div>
      </div>

      <nav className="relative mt-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href, item.exact);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-teal-500 font-semibold text-[#042f2e]"
                  : "text-white/55 hover:bg-white/5 hover:text-white/85"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.href === "/panel/mesajlar" && unreadMessages > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    active
                      ? "bg-[#042f2e]/15 text-[#042f2e]"
                      : "bg-teal-400/20 text-teal-100"
                  }`}
                >
                  {unreadMessages}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="relative mt-auto rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Kota
        </p>
        <p className="mt-2 text-sm font-semibold text-white">
          {quotaUnlimited
            ? "Sınırsız teklif"
            : `${quotaRemaining ?? 0} teklif hakkı`}
        </p>
        <p className="mt-1 text-xs text-white/45">
          {planLabel}
          {quotaUnlimited ? " · gizli envanter açık" : ""}
        </p>
        <Link
          href="/panel/plan"
          className="mt-3 inline-block text-xs font-semibold text-teal-200/90"
        >
          Planı yönet →
        </Link>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  tone,
  active = false,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  tone: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-[#151515] text-white shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
          : "text-black/55 hover:bg-white/80 hover:text-black"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
          active
            ? "bg-white/15 text-white"
            : `${tone} group-hover:scale-[1.03]`
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>

      {badge && (
        <span
          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold ${
            active ? "bg-[#c9f4c1] text-[#1f4d36]" : "bg-[#151515] text-white"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function MobileLink({
  href,
  icon: Icon,
  label,
  active = false,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`relative flex min-w-14 flex-col items-center gap-1.5 text-[11px] font-medium ${
        active ? "text-black" : "text-black/35"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#151515] px-1 text-[10px] text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
