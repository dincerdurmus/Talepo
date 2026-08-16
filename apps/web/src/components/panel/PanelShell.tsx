"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "talepo.panel.sidebarCollapsed";

import {
  PanelAccountMenu,
  type PanelCompanyOption,
} from "@/components/panel/PanelAccountMenu";
import { PlanBadge } from "@/components/panel/PlanBadge";
import {
  filterPanelNavItems,
  PANEL_NAV_ITEMS,
  PANEL_NOTIFICATIONS_HREF,
} from "@/components/panel/panel-nav";
import type { FeatureKey } from "@/lib/membership/entitlements";
import { getPlanThemeStyle } from "@/lib/membership/plan-visuals";
import { getPublicProductLabel } from "@/lib/membership/product-packaging";
import { isPaidPlan } from "@/lib/membership/plans";
import type { PlanTierId } from "@/lib/membership/plans";

export type PanelUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  membershipNumber?: string | null;
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
  if (pathname === "/panel") return "Sayfam";
  if (pathname.includes("/duzenle")) return "Talebi düzelt";
  if (pathname.startsWith("/panel/taleplerim")) return "Taleplerim";
  if (pathname.startsWith("/panel/gelen-teklifler")) return "Gelen teklifler";
  if (pathname.includes("/panel/talepler/") && pathname.endsWith("/teklif")) {
    return "Teklif ver";
  }
  if (pathname.startsWith("/panel/talepler")) return "Talepleri keşfet";
  if (pathname.startsWith("/panel/teklifler")) return "Tekliflerim";
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
  const displayName =
    user.name?.trim() ||
    user.email?.split("@")[0] ||
    "Kullanıcı";
  const initials = getInitials(user.name, user.email);
  const mode = workspace?.mode ?? "personal";
  const isCorporate = mode === "corporate";
  const planTier = workspace?.planTier ?? "STANDARD";
  const planThemeStyle = getPlanThemeStyle(planTier);
  const navItems = filterPanelNavItems(PANEL_NAV_ITEMS, features, mode);
  const companyName = workspace?.companyName?.trim() || "Firma";
  const companyLogoUrl = workspace?.companyLogoUrl ?? null;
  const pageTitle = getPanelPageTitle(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const skipPersistRef = useRef(true);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const onToggleSidebar = () => setCollapsed((value) => !value);

  return (
    <main
      className="talepo-plan-theme min-h-screen bg-[#edf3f1] text-[#0b2522]"
      style={planThemeStyle}
      data-plan={planTier}
    >
      <div className="flex min-h-screen w-full">
        {isCorporate ? (
          <CorporateSidebar
            pathname={pathname}
            navItems={navItems}
            unreadMessages={unreadMessages}
            companyName={companyName}
            companyLogoUrl={companyLogoUrl}
            planTier={planTier}
            planLabel={workspace?.planLabel ?? "Standart"}
            quotaUnlimited={workspace?.quotaUnlimited ?? true}
            quotaRemaining={workspace?.quotaRemaining ?? null}
            collapsed={collapsed}
            onToggle={onToggleSidebar}
          />
        ) : (
          <PersonalSidebar
            pathname={pathname}
            navItems={navItems}
            unreadMessages={unreadMessages}
            planTier={planTier}
            collapsed={collapsed}
            onToggle={onToggleSidebar}
          />
        )}

        <section
          className={`min-w-0 flex-1 pb-28 pt-4 transition-[padding] duration-200 ease-out sm:px-6 lg:pb-8 ${
            collapsed
              ? "px-4 lg:pl-4 lg:pr-6"
              : "px-4 lg:px-8"
          }`}
        >
          <div
            className={`w-full transition-[max-width] duration-200 ease-out ${
              collapsed
                ? "max-w-none"
                : "mx-auto max-w-[1320px]"
            }`}
          >
            <header className="relative z-40 flex items-center justify-between overflow-visible rounded-[20px] border border-teal-900/10 bg-[#fbfdfc] px-4 py-3.5 shadow-[0_12px_34px_rgba(15,31,29,0.06)] sm:px-6">
              <div
                className="talepo-plan-accent-bar pointer-events-none absolute inset-x-0 top-0 h-[3px] rounded-t-2xl"
                aria-hidden
              />
              <div className="flex min-w-0 items-center gap-3 lg:hidden">
                <div className="text-2xl font-semibold tracking-[-0.06em] text-[#0f1f1d]">
                  tale<span className="text-teal-800/40">po</span>
                </div>
                {isCorporate && (
                  <PlanBadge
                    planTier={planTier}
                    planLabel={workspace?.planLabel}
                    size="sm"
                    linked
                  />
                )}
              </div>

              <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800/55">
                    {isCorporate ? companyName : `Merhaba, ${displayName.split(" ")[0]}`}
                  </p>
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#0f1f1d]">
                      {pageTitle}
                    </p>
                    <PlanBadge
                      planTier={planTier}
                      planLabel={workspace?.planLabel}
                      size="sm"
                      linked
                    />
                  </div>
                </div>
              </div>

              <div className="relative z-50 flex shrink-0 items-center gap-2">
                <Link
                  href={PANEL_NOTIFICATIONS_HREF}
                  aria-label="Bildirimler"
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-teal-900/8 bg-[#f7faf9] transition hover:bg-white"
                >
                  <Bell className="h-5 w-5 text-[#0f1f1d]/70" />
                  {unreadNotifications > 0 && (
                    <span className="talepo-plan-dot absolute right-2.5 top-2.5 h-2 w-2 rounded-full" />
                  )}
                </Link>

                <PanelAccountMenu
                  displayName={displayName}
                  email={user.email}
                  membershipNumber={user.membershipNumber}
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

            <div className="mt-4">
              <PanelBackLink pathname={pathname} />
              {children}
            </div>
          </div>
        </section>
      </div>

      <nav className="fixed bottom-3 left-3 right-3 z-50 rounded-[25px] border border-teal-900/10 bg-white/92 px-4 py-3 shadow-[0_18px_50px_rgba(15,31,29,0.12)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <MobileLink
            href="/panel"
            icon={LayoutDashboard}
            label="Sayfam"
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
            className="talepo-plan-cta -mt-8 flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-[#f4f7f6] shadow-[0_12px_30px_var(--plan-glow)]"
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

function SidebarToggle({
  collapsed,
  onToggle,
  tone = "light",
}: {
  collapsed: boolean;
  onToggle: () => void;
  tone?: "light" | "dark";
}) {
  const light = tone === "light";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Menüyü aç" : "Menüyü daralt"}
      title={collapsed ? "Menüyü aç" : "Menüyü daralt"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
        light
          ? "border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f3f4f6] hover:text-[#111827]"
          : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {collapsed ? (
        light ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )
      ) : light ? (
        <PanelLeftClose className="h-4 w-4" />
      ) : (
        <ChevronLeft className="h-4 w-4" />
      )}
    </button>
  );
}

function PersonalSidebar({
  pathname,
  navItems,
  unreadMessages,
  planTier,
  collapsed,
  onToggle,
}: {
  pathname: string;
  navItems: ReturnType<typeof filterPanelNavItems>;
  unreadMessages: number;
  planTier: PlanTierId;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const navGroups = [
    { label: "Genel", items: navItems.filter((item) => ["/", "/panel"].includes(item.href)) },
    { label: "Talep & teklif", items: navItems.filter((item) => ["/panel/taleplerim", "/panel/gelen-teklifler", "/panel/talepler", "/panel/teklifler"].includes(item.href)) },
    { label: "Pro araçları", items: navItems.filter((item) => ["/panel/asistan", "/panel/uyarilar", "/panel/kayitli-aramalar", "/panel/firsatlar", "/panel/analiz"].includes(item.href)) },
    { label: "Hesap", items: navItems.filter((item) => ["/panel/plan", "/panel/mesajlar", "/panel/profil"].includes(item.href)) },
  ].filter((group) => group.items.length > 0);

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#d9e5e1] bg-[#f3f8f6] py-5 shadow-[8px_0_30px_rgba(15,47,43,0.035)] transition-[width,padding] duration-200 ease-out lg:flex ${
        collapsed ? "w-[72px] px-2" : "w-[268px] px-3.5"
      }`}
      data-plan={planTier}
    >
      <div className={collapsed ? "flex flex-col items-center gap-3" : ""}>
        <div
          className={`flex items-center ${
            collapsed ? "w-full flex-col gap-2" : "justify-between gap-2 px-0.5"
          }`}
        >
          <Link
            href="/"
            aria-label="Ana sayfa"
            title="talepo"
              className={`inline-flex items-center font-semibold tracking-[-0.05em] text-[#0b2522] ${
              collapsed
                ? "justify-center text-xl"
                : "gap-2.5 px-2.5 text-[26px]"
            }`}
          >
            {collapsed ? (
              <span>
                t<span className="text-teal-800/35">p</span>
              </span>
            ) : (
              <>
                <span>
                  tale<span className="text-teal-800/40">po</span>
                </span>
                <span className="rounded-md border border-teal-900/10 bg-[#e8f2ef] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.16em] text-teal-900/65">
                  PANEL
                </span>
              </>
            )}
          </Link>
          <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
        </div>

        <Link
          href="/talep"
          title="Yeni talep"
          aria-label="Yeni talep"
          className={`talepo-plan-cta mt-7 flex items-center justify-center rounded-[13px] text-[13px] font-bold tracking-[-0.01em] shadow-[0_10px_24px_rgba(13,116,110,0.2)] ring-1 ring-teal-900/10 transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_15px_30px_rgba(13,116,110,0.26)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 ${
            collapsed ? "h-10 w-10" : "gap-2 px-4 py-2.5"
          }`}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>Yeni talep</span>}
        </Link>
      </div>

      <nav className={`mt-7 space-y-5 ${collapsed ? "px-0" : ""}`}>
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-950/48">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarLink key={`${item.href}-${item.label}`} href={item.href} icon={item.icon} label={item.label} active={isNavActive(pathname, item.href, item.exact)} collapsed={collapsed} badge={item.href === "/panel/mesajlar" && unreadMessages > 0 ? String(unreadMessages) : undefined} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-auto px-0.5">
          <div className={`relative overflow-hidden rounded-[18px] border px-4 py-4 ${isPaidPlan(planTier) ? "border-teal-800/25 bg-[#103b38] text-white shadow-[0_14px_28px_rgba(13,67,62,0.18)]" : "border-[#d8e5e1] bg-[#fbfdfc] shadow-[0_8px_20px_rgba(15,47,43,0.05)]"}`}>
            {isPaidPlan(planTier) && <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-violet-300/15 blur-2xl" />}
            <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isPaidPlan(planTier) ? "text-teal-100/65" : "text-teal-800/55"}`}>
              {getPublicProductLabel(planTier, "PERSONAL")}
            </p>
            <p className={`relative mt-2 text-xs leading-5 ${isPaidPlan(planTier) ? "text-white/75" : "text-teal-950/58"}`}>
              {isPaidPlan(planTier) ? "Fırsatı bul, analiz et, güçlü teklif ver ve doğru zamanda takip et." : "Temel talep ve teklif akışınız hazır."}
            </p>
            <Link href="/panel/plan" className={`relative mt-3 inline-flex text-xs font-bold ${isPaidPlan(planTier) ? "text-teal-100 hover:text-white" : "text-teal-800 hover:text-teal-950"}`}>
              {isPaidPlan(planTier) ? "Planı yönet →" : "PRO’yu keşfet →"}
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}

function CorporateSidebar({
  pathname,
  navItems,
  unreadMessages,
  companyName,
  companyLogoUrl,
  planTier,
  planLabel,
  quotaUnlimited,
  quotaRemaining,
  collapsed,
  onToggle,
}: {
  pathname: string;
  navItems: ReturnType<typeof filterPanelNavItems>;
  unreadMessages: number;
  companyName: string;
  companyLogoUrl?: string | null;
  planTier: PlanTierId;
  planLabel: string;
  quotaUnlimited: boolean;
  quotaRemaining: number | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`relative sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-white/8 bg-[#0f1f1d] py-5 text-white transition-[width,padding] duration-200 ease-out lg:flex lg:flex-col ${
        collapsed ? "w-[72px] px-2" : "w-[280px] px-4"
      }`}
      data-plan={planTier}
    >
      <div
        className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: "var(--plan-sidebar-glow)" }}
      />
      <div
        className="pointer-events-none absolute bottom-20 right-0 h-44 w-44 rounded-full blur-3xl opacity-80"
        style={{ background: "var(--plan-glow)" }}
      />

      <div className={`relative ${collapsed ? "px-0" : "px-2"}`}>
        <div
          className={`flex items-center ${
            collapsed ? "flex-col gap-2" : "justify-between gap-2"
          }`}
        >
          <Link
            href="/"
            aria-label="Ana sayfa"
            title="talepo"
            className={`font-semibold tracking-[-0.06em] ${
              collapsed ? "text-xl" : "text-2xl"
            }`}
          >
            {collapsed ? (
              <span>
                t<span className="text-white/35">p</span>
              </span>
            ) : (
              <>
                tale<span className="text-white/35">po</span>
              </>
            )}
          </Link>
          <SidebarToggle
            collapsed={collapsed}
            onToggle={onToggle}
            tone="dark"
          />
        </div>

        {collapsed ? (
          <div
            className="mx-auto mt-4 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-white"
            style={{ background: "color-mix(in srgb, var(--plan-accent) 35%, transparent)" }}
            title={companyName}
          >
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
        ) : (
          <div
            className="mt-4 rounded-2xl border p-3"
            style={{
              borderColor: "color-mix(in srgb, var(--plan-accent) 40%, transparent)",
              background: "color-mix(in srgb, var(--plan-accent) 14%, transparent)",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-white"
                style={{
                  background: "color-mix(in srgb, var(--plan-accent) 35%, transparent)",
                }}
              >
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
                <p className="text-[11px] text-white/65">
                  {planLabel} · Aktif
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/75">
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--plan-accent)" }} />
              Kurumsal çalışma alanı
            </div>
          </div>
        )}
      </div>

      <nav className="relative mt-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href, item.exact);
          const hasBadge =
            item.href === "/panel/mesajlar" && unreadMessages > 0;
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={`relative flex items-center rounded-xl text-sm transition ${
                collapsed
                  ? "mx-auto h-10 w-10 justify-center"
                  : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "font-semibold text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white/85"
              }`}
              style={
                active
                  ? { background: "var(--plan-primary)" }
                  : undefined
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              {hasBadge && !collapsed && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/80"
                  }`}
                >
                  {unreadMessages}
                </span>
              )}
              {hasBadge && collapsed && (
                <span
                  className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${
                    active ? "bg-white" : ""
                  }`}
                  style={active ? undefined : { background: "var(--plan-accent)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
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
            className="mt-3 inline-block text-xs font-semibold"
            style={{ color: "var(--plan-accent)" }}
          >
            Planı yönet →
          </Link>
        </div>
      )}
      {collapsed && <div className="mt-auto" />}
    </aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active = false,
  badge,
  collapsed = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: string;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`group relative flex items-center rounded-[11px] text-[13px] font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 ${
        collapsed
          ? "mx-auto h-10 w-10 justify-center px-0"
          : "gap-3 px-2.5 py-2"
      } ${
        active
          ? "bg-[#d8ebe6] font-bold text-[#0b3b36] shadow-[inset_3px_0_0_#2d7770,0_5px_14px_rgba(31,94,87,0.08)]"
          : "text-teal-950/68 hover:bg-[#e7f1ee] hover:text-[#0f1f1d]"
      }`}
    >
      <span
        className={`relative flex items-center justify-center rounded-md transition ${
          collapsed ? "h-8 w-8" : "h-8 w-8"
        } ${
          active
            ? "bg-[#b9ddd5] text-[#0b5149]"
            : "bg-[#e8f1ee] text-teal-950/62 group-hover:bg-white group-hover:text-[#0f1f1d]"
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
        {badge && collapsed && (
          <span className="talepo-plan-dot absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[#eef2f1]" />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge && (
            <span
              className={`flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold ${
                active ? "bg-white/15 text-white" : "talepo-plan-cta"
              }`}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

function PanelBackLink({ pathname }: { pathname: string }) {
  const router = useRouter();

  if (pathname === "/panel") return null;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/panel");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="talepo-cloud-pill mb-2 px-3.5 py-2 text-sm font-medium text-teal-950/50 transition hover:text-[#0f1f1d]"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      Geri
    </button>
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
        active ? "" : "text-teal-950/35"
      }`}
      style={active ? { color: "var(--plan-primary)" } : undefined}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="talepo-plan-cta absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] shadow-none">
          {badge}
        </span>
      )}
    </Link>
  );
}
