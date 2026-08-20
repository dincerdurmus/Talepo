"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Binoculars,
  ChevronRight,
  Crown,
  FileText,
  Flame,
  Home,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Plus,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import {
  filterPanelNavItems,
  isPanelNavActive,
  TALEP_TEKLIF_NAV_HREFS,
  type PanelNavItem,
} from "@/components/panel/panel-nav";
import { formatPanelCountBadge } from "@/lib/offer/outgoing-offer-inbox";
import { getPlanDefinition, type PlanTierId } from "@/lib/membership/plans";
import type { FeatureKey } from "@/lib/membership/entitlements";
import {
  resolveSignalRailProTools,
  signalRailHasLockedProTools,
  SIGNAL_RAIL_LOCKED_HINT,
  type ResolvedSignalRailProTool,
  type SignalRailProToolId,
} from "@/lib/panel/signal-rail-pro-tools";
import {
  signalNavIconToneForHref,
  signalNavIconWellClass,
} from "@/lib/panel/signal-nav-icon-tone";

type CommandSection = "genel" | "talep-teklif" | "araclar" | "plan" | "hesap";

export const SIGNAL_RAIL_WIDTH_PX = 84;
export const SIGNAL_RAIL_DOCK_WIDTH_PX = 284;
export const SIGNAL_RAIL_ICON_LABELS = {
  menu: "Menü",
  create: "Yeni talep",
  genel: "Sayfam",
  "talep-teklif": "Talep",
  araclar: "Pro araçlar",
  plan: "Plan",
  hesap: "Hesap",
} as const;

const RAIL_WIDTH_PX = SIGNAL_RAIL_WIDTH_PX;
const DOCK_WIDTH_PX = SIGNAL_RAIL_DOCK_WIDTH_PX;

const PRO_TOOL_JEWEL: Record<SignalRailProToolId, string> = {
  firsatlar:
    "border border-[#A85B68]/42 bg-[#A85B68]/22 text-[#f0c4cb] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  takip:
    "border border-[#6671B8]/42 bg-[#6671B8]/22 text-[#c9cef0] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  "teklif-zekasi":
    "border border-[#B28A35]/42 bg-[#B28A35]/22 text-[#f0d9a0] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
};

const PRO_TOOL_ICONS: Record<SignalRailProToolId, LucideIcon> = {
  firsatlar: Flame,
  takip: Binoculars,
  "teklif-zekasi": PieChart,
};

const PREMIUM_RAIL_ACTIVE =
  "border border-amber-300/50 bg-gradient-to-br from-[#fbbf24]/40 via-[#fb7185]/30 to-[#c084fc]/35 text-amber-50 shadow-[0_0_28px_rgba(251,191,36,0.32)]";
const PREMIUM_RAIL_IDLE =
  "border border-amber-400/38 bg-gradient-to-br from-[#f59e0b]/28 via-[#f43f5e]/18 to-[#a855f7]/22 text-amber-100 hover:border-amber-300/45 hover:from-[#fbbf24]/34 hover:via-[#fb7185]/24 hover:to-[#c084fc]/28 hover:text-amber-50 hover:shadow-[0_0_20px_rgba(251,191,36,0.2)]";

const RAIL_IDLE =
  "border border-white/12 bg-white/[0.07] text-white/72 hover:border-white/18 hover:bg-white/11 hover:text-white/95";
const RAIL_ACTIVE =
  "border border-teal-400/30 bg-teal-400/18 text-teal-200 shadow-[0_0_18px_rgba(45,212,191,0.14)]";

const SECTION_META: Record<
  CommandSection,
  { title: string; description: string; railLabel: string }
> = {
  genel: {
    title: "Genel",
    description: "Ana sayfa ve panel özeti",
    railLabel: SIGNAL_RAIL_ICON_LABELS.genel,
  },
  "talep-teklif": {
    title: "Talep ve teklif",
    description: "Talepleriniz, teklifler ve keşif",
    railLabel: SIGNAL_RAIL_ICON_LABELS["talep-teklif"],
  },
  araclar: {
    title: "Pro araçlar",
    description: "Profesyonel plana özel akıllı araçlar",
    railLabel: SIGNAL_RAIL_ICON_LABELS.araclar,
  },
  plan: {
    title: "Plan",
    description: "Üyelik, teklif hakları ve faturalandırma",
    railLabel: SIGNAL_RAIL_ICON_LABELS.plan,
  },
  hesap: {
    title: "Hesap",
    description: "Mesajlar ve profil",
    railLabel: SIGNAL_RAIL_ICON_LABELS.hesap,
  },
};

function isNavActive(pathname: string, href: string, exact?: boolean) {
  return isPanelNavActive(pathname, href, exact);
}

function sidebarLinkAriaLabel(label: string, badgeAriaLabel?: string) {
  return badgeAriaLabel ? `${label}, ${badgeAriaLabel}` : label;
}

function incomingOffersBadgeAria(count: number): string | undefined {
  if (count <= 0) return undefined;
  const display = count > 99 ? "99+" : String(count);
  return `okunmamış ${display} gelen teklif`;
}

function outgoingOffersBadgeAria(count: number): string | undefined {
  if (count <= 0) return undefined;
  const display = count > 99 ? "99+" : String(count);
  return `okunmamış ${display} teklif`;
}

function sidebarNavBadge(
  href: string,
  unreadMessages: number,
  unreadIncomingOfferEvents: number,
  unreadOutgoingOfferEvents: number,
): { badge?: string; badgeAriaLabel?: string } {
  if (href === "/panel/mesajlar" && unreadMessages > 0) {
    return { badge: String(unreadMessages) };
  }
  if (href === "/panel/gelen-teklifler") {
    return {
      badge: formatPanelCountBadge(unreadIncomingOfferEvents),
      badgeAriaLabel: incomingOffersBadgeAria(unreadIncomingOfferEvents),
    };
  }
  if (href === "/panel/teklifler") {
    return {
      badge: formatPanelCountBadge(unreadOutgoingOfferEvents),
      badgeAriaLabel: outgoingOffersBadgeAria(unreadOutgoingOfferEvents),
    };
  }
  return {};
}

const RAIL_SECTIONS: CommandSection[] = [
  "genel",
  "talep-teklif",
  "araclar",
  "plan",
  "hesap",
];

function getSectionFromPath(pathname: string): CommandSection {
  if (
    pathname.startsWith("/panel/mesajlar") ||
    pathname.startsWith("/panel/profil") ||
    pathname.startsWith("/panel/bildirimler")
  ) {
    return "hesap";
  }
  if (pathname.startsWith("/panel/plan")) {
    return "plan";
  }
  if (
    pathname.startsWith("/panel/firsatlar") ||
    pathname.startsWith("/panel/takiplerim") ||
    pathname.startsWith("/panel/uyarilar") ||
    pathname.startsWith("/panel/kayitli-aramalar")
  ) {
    return "araclar";
  }
  if (
    pathname.startsWith("/panel/taleplerim") ||
    pathname.startsWith("/panel/gelen-teklifler") ||
    pathname.startsWith("/panel/talepler") ||
    pathname.startsWith("/panel/teklifler")
  ) {
    return "talep-teklif";
  }
  return "genel";
}

function sectionRailIcon(section: CommandSection): LucideIcon {
  switch (section) {
    case "genel":
      return Home;
    case "talep-teklif":
      return FileText;
    case "araclar":
      return Sparkles;
    case "plan":
      return Crown;
    case "hesap":
      return UserRound;
  }
}

function railSectionAriaLabel(
  section: CommandSection,
  sectionLabel: string,
  badge?: string,
) {
  if (!badge) return sectionLabel;
  if (section === "talep-teklif") {
    return `Talep ve teklif, okunmamış ${badge} gelen teklif`;
  }
  if (section === "hesap") {
    return `Hesap, okunmamış ${badge} mesaj`;
  }
  return `${sectionLabel}, ${badge}`;
}

function RailCaption({
  children,
  active = false,
  premium = false,
}: {
  children: string;
  active?: boolean;
  premium?: boolean;
}) {
  return (
    <span
      className={`mt-1 line-clamp-2 max-w-[4.5rem] text-center text-[10px] font-medium leading-[1.15] ${
        premium
          ? active
            ? "text-amber-50"
            : "text-amber-100/78"
          : active
            ? "text-teal-100"
            : "text-white/58"
      }`}
    >
      {children}
    </span>
  );
}

function RailSectionButton({
  section,
  label,
  icon: Icon,
  premium = false,
  active,
  badge,
  onMouseEnter,
  onClick,
  isCurrent,
}: {
  section: CommandSection;
  label: string;
  icon: LucideIcon;
  premium?: boolean;
  active: boolean;
  badge?: string;
  onMouseEnter: () => void;
  onClick: () => void;
  isCurrent: boolean;
}) {
  return (
    <div
      className="relative flex w-full justify-center"
      onMouseEnter={onMouseEnter}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={railSectionAriaLabel(section, label, badge)}
        aria-expanded={isCurrent}
        className="relative flex min-h-11 w-full flex-col items-center justify-center px-1 py-1"
      >
        {active ? (
          <span
            aria-hidden
            className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r ${
              premium ? "bg-amber-400" : "bg-teal-400"
            }`}
          />
        ) : null}
        <span
          className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
            premium
              ? active
                ? PREMIUM_RAIL_ACTIVE
                : PREMIUM_RAIL_IDLE
              : active
                ? RAIL_ACTIVE
                : RAIL_IDLE
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
          {badge ? (
            <span
              className={`absolute -right-0.5 -top-0.5 z-[1] flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#070a09] px-0.5 text-[9px] font-bold text-white ${
                premium ? "bg-rose-500" : "bg-teal-600"
              }`}
            >
              {badge}
            </span>
          ) : null}
        </span>
        <RailCaption active={active} premium={premium}>
          {label}
        </RailCaption>
      </button>
    </div>
  );
}

export type CommandPersonalSidebarProps = {
  pathname: string;
  navItems: ReturnType<typeof filterPanelNavItems>;
  unreadMessages: number;
  unreadIncomingOfferEvents: number;
  unreadOutgoingOfferEvents: number;
  planTier: PlanTierId;
  features?: Partial<Record<FeatureKey, boolean>>;
  collapsed: boolean;
  onToggle: () => void;
};

export function CommandPersonalSidebar({
  pathname,
  navItems,
  unreadMessages,
  unreadIncomingOfferEvents,
  unreadOutgoingOfferEvents,
  planTier,
  features,
  collapsed,
  onToggle,
}: CommandPersonalSidebarProps) {
  const pathSection = useMemo(() => getSectionFromPath(pathname), [pathname]);
  const [activeSection, setActiveSection] = useState<CommandSection>(pathSection);
  const [hoverSection, setHoverSection] = useState<CommandSection | null>(null);

  useEffect(() => {
    // Keep the pinned dock on the route the user just opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- path-driven section
    setActiveSection(pathSection);
  }, [pathSection]);

  const pinnedOpen = !collapsed;
  const dockVisible = pinnedOpen || hoverSection !== null;
  const dockSection = pinnedOpen
    ? activeSection
    : (hoverSection ?? activeSection);

  const closeDock = useCallback(() => {
    if (pinnedOpen) {
      onToggle();
      return;
    }
    setHoverSection(null);
  }, [onToggle, pinnedOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dockVisible) closeDock();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDock, dockVisible]);

  const navGroups = useMemo(
    () =>
      [
        {
          id: "genel" as const,
          label: "Genel",
          items: navItems.filter((item) =>
            ["/", "/panel", "/panel/analiz"].includes(item.href),
          ),
        },
        {
          id: "talep-teklif" as const,
          label: "Talep ve teklif",
          items: TALEP_TEKLIF_NAV_HREFS.map((href) =>
            navItems.find((item) => item.href === href),
          ).filter((item): item is PanelNavItem => Boolean(item)),
        },
        {
          id: "hesap" as const,
          label: "Hesap",
          items: navItems.filter((item) =>
            ["/panel/mesajlar", "/panel/profil"].includes(item.href),
          ),
        },
      ].filter((group) => group.items.length > 0),
    [navItems],
  );

  const planItem = navItems.find((item) => item.href === "/panel/plan");

  const proTools = useMemo(
    () => resolveSignalRailProTools(features, pathname),
    [features, pathname],
  );

  const planHref = planItem?.href ?? "/panel/plan";
  const planLabel = getPlanDefinition(planTier).label;

  const sectionBadge = useCallback(
    (section: CommandSection): string | undefined => {
      if (section === "talep-teklif") {
        const badge = formatPanelCountBadge(unreadIncomingOfferEvents);
        return badge === "0" ? undefined : badge;
      }
      if (section === "hesap" && unreadMessages > 0) {
        return unreadMessages > 99 ? "99+" : String(unreadMessages);
      }
      return undefined;
    },
    [unreadIncomingOfferEvents, unreadMessages],
  );

  const openSection = (section: CommandSection) => {
    setActiveSection(section);
    if (collapsed) onToggle();
  };

  const handleRailClick = (section: CommandSection) => {
    if (pinnedOpen && activeSection === section) {
      onToggle();
      return;
    }
    openSection(section);
  };

  const dockAccentClass =
    dockSection === "araclar"
      ? "text-amber-200"
      : "text-teal-200";

  return (
    <div
      className="sticky top-0 z-40 hidden h-svh shrink-0 transition-[width] duration-200 ease-out lg:block"
      style={{ width: dockVisible ? RAIL_WIDTH_PX + DOCK_WIDTH_PX : RAIL_WIDTH_PX }}
    >
      <div
        className="flex h-full"
        onMouseLeave={() => setHoverSection(null)}
      >
      <aside
        className="flex h-full min-h-0 shrink-0 flex-col items-center border-r border-white/10 bg-gradient-to-b from-[#0b100f] to-[#070a09] py-3"
        style={{ width: RAIL_WIDTH_PX }}
        data-plan={planTier}
        aria-label="Panel gezinme"
      >
        <Link
          href="/"
          aria-label="Ana sayfa"
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 text-sm font-extrabold tracking-tighter text-white shadow-[0_4px_20px_rgba(45,212,191,0.22)]"
        >
          tp
        </Link>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={dockVisible}
          aria-label={pinnedOpen ? "Menüyü daralt" : "Menüyü aç"}
          className="mb-2 flex min-h-11 w-full flex-col items-center justify-center px-1 py-1"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/14 bg-white/8 text-white/78 transition hover:border-white/20 hover:bg-white/12 hover:text-white">
            {pinnedOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </span>
          <RailCaption>{SIGNAL_RAIL_ICON_LABELS.menu}</RailCaption>
        </button>

        <Link
          href="/talep"
          aria-label={SIGNAL_RAIL_ICON_LABELS.create}
          className="group mb-2 flex min-h-11 w-full flex-col items-center justify-center px-1 py-1"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-[#0f1f1d] shadow-[0_8px_28px_rgba(255,255,255,0.14)] transition group-hover:-translate-y-0.5">
            <Plus className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <RailCaption>{SIGNAL_RAIL_ICON_LABELS.create}</RailCaption>
        </Link>

        <nav
          className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto overflow-x-hidden py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/12"
          aria-label="Bölümler"
        >
          {RAIL_SECTIONS
            .filter((section) => section !== "plan" && section !== "hesap")
            .map((section) => (
              <RailSectionButton
                key={section}
                section={section}
                label={SECTION_META[section].railLabel}
                icon={sectionRailIcon(section)}
                premium={section === "araclar"}
                active={
                  pinnedOpen
                    ? activeSection === section
                    : hoverSection === section || pathSection === section
                }
                badge={sectionBadge(section)}
                onMouseEnter={() => {
                  setHoverSection(section);
                  if (pinnedOpen) setActiveSection(section);
                }}
                onClick={() => handleRailClick(section)}
                isCurrent={pinnedOpen && activeSection === section}
              />
            ))}
        </nav>

        <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-2 pt-2">
          {(["plan", "hesap"] as const).map((section) => (
            <RailSectionButton
              key={section}
              section={section}
              label={SECTION_META[section].railLabel}
              icon={sectionRailIcon(section)}
              active={
                pinnedOpen
                  ? activeSection === section
                  : hoverSection === section || pathSection === section
              }
              badge={sectionBadge(section)}
              onMouseEnter={() => {
                setHoverSection(section);
                if (pinnedOpen) setActiveSection(section);
              }}
              onClick={() => handleRailClick(section)}
              isCurrent={pinnedOpen && activeSection === section}
            />
          ))}
        </div>
      </aside>

      {dockVisible ? (
          <aside
            className="talepo-signal-dock flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(165deg,rgba(12,22,20,0.62)_0%,rgba(10,18,17,0.5)_55%,rgba(12,22,20,0.58)_100%)] shadow-[inset_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-[40px] backdrop-saturate-150 lg:flex"
            style={{ width: DOCK_WIDTH_PX }}
            aria-label={`${SECTION_META[dockSection].title} menüsü`}
          >
            <div className="flex h-full min-h-0 flex-col px-4 pb-4 pt-5">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div className="min-w-0">
                  <p className={`text-xs font-semibold tracking-wide ${dockAccentClass}`}>
                    Şu an buradasınız
                  </p>
                  <h2 className="talepo-signal-dock-solid mt-1 truncate text-lg font-semibold tracking-tight text-white">
                    {SECTION_META[dockSection].title}
                  </h2>
                  <p className="talepo-signal-dock-muted mt-1 text-sm leading-snug text-white">
                    {SECTION_META[dockSection].description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDock}
                  aria-label="Menüyü kapat"
                  title="Menüyü kapat (Esc)"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/15 text-white transition hover:bg-white/25"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar]:w-1">
                <DockSectionContent
                  section={dockSection}
                  navGroups={navGroups}
                  proTools={proTools}
                  planHref={planHref}
                  planLabel={planLabel}
                  pathname={pathname}
                  unreadMessages={unreadMessages}
                  unreadIncomingOfferEvents={unreadIncomingOfferEvents}
                  unreadOutgoingOfferEvents={unreadOutgoingOfferEvents}
                />
              </div>
            </div>
          </aside>
      ) : null}
      </div>
    </div>
  );
}

function DockSectionContent({
  section,
  navGroups,
  proTools,
  planHref,
  planLabel,
  pathname,
  unreadMessages,
  unreadIncomingOfferEvents,
  unreadOutgoingOfferEvents,
}: {
  section: CommandSection;
  navGroups: Array<{ id: CommandSection; label: string; items: PanelNavItem[] }>;
  proTools: ResolvedSignalRailProTool[];
  planHref: string;
  planLabel: string;
  pathname: string;
  unreadMessages: number;
  unreadIncomingOfferEvents: number;
  unreadOutgoingOfferEvents: number;
}) {
  if (section === "araclar") {
    return <CommandProToolsCard items={proTools} />;
  }

  if (section === "plan") {
    const planActive = isNavActive(pathname, planHref);
    return (
      <div className="space-y-3">
        <p className="talepo-signal-dock-solid px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
          Plan
        </p>
        <div className="rounded-[14px] border border-white/12 bg-white/10 px-3 py-3">
          <p className="talepo-signal-dock-solid text-[11px] font-medium uppercase tracking-[0.08em] text-white">
            Aktif plan
          </p>
          <p className="talepo-signal-dock-solid mt-1 text-base font-semibold tracking-tight text-white">
            {planLabel}
          </p>
        </div>
        <DockNavLink
          href={planHref}
          icon={Crown}
          label="Plan ve üyelik"
          active={planActive}
        />
      </div>
    );
  }

  const group = navGroups.find((entry) => entry.id === section);
  if (!group) return null;

  return (
    <div className="space-y-1">
      <p className="talepo-signal-dock-solid mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
        {group.label}
      </p>
      {group.items.map((item) => {
        const navBadge = sidebarNavBadge(
          item.href,
          unreadMessages,
          unreadIncomingOfferEvents,
          unreadOutgoingOfferEvents,
        );
        return (
          <DockNavLink
            key={`${item.href}-${item.label}`}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isNavActive(pathname, item.href, item.exact)}
            badge={navBadge.badge}
            badgeAriaLabel={navBadge.badgeAriaLabel}
          />
        );
      })}
    </div>
  );
}

function DockNavLink({
  href,
  icon: Icon,
  label,
  active = false,
  badge,
  badgeAriaLabel,
  premium = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: string;
  badgeAriaLabel?: string;
  premium?: boolean;
}) {
  const linkLabel = sidebarLinkAriaLabel(label, badgeAriaLabel);
  const activeClass = premium
    ? "border border-amber-300/30 bg-gradient-to-r from-amber-400/14 via-rose-400/10 to-purple-400/14 font-semibold text-amber-50"
    : "border border-teal-400/20 bg-teal-400/12 font-semibold text-teal-50";
  const indicatorClass = premium ? "bg-amber-400" : "bg-teal-300";
  const tone = signalNavIconToneForHref(href);
  const iconWellClass = premium
    ? active
      ? "border-amber-300/30 bg-gradient-to-br from-amber-400/25 via-rose-400/20 to-purple-400/22 text-amber-50"
      : "border-amber-400/28 bg-amber-400/12 text-amber-100/85"
    : signalNavIconWellClass(tone, active);

  return (
    <Link
      href={href}
      title={linkLabel}
      aria-label={linkLabel}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[14.5px] font-semibold transition ${
        active
          ? activeClass
          : "text-white hover:bg-white/10"
      }`}
    >
      {active ? (
        <span
          aria-hidden
          className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r ${indicatorClass}`}
        />
      ) : null}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border transition ${iconWellClass} ${
          active ? "" : "group-hover:brightness-110"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="talepo-signal-dock-solid min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span
          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-teal-300/40 bg-teal-400/25 px-1.5 text-[11px] font-semibold tabular-nums text-white"
          aria-hidden="true"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function CommandProToolsCard({
  items,
}: {
  items: ResolvedSignalRailProTool[];
}) {
  if (items.length === 0) return null;
  const hasLocked = signalRailHasLockedProTools(items);

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-white/14 bg-[linear-gradient(165deg,rgba(255,255,255,0.11)_0%,rgba(255,255,255,0.045)_55%,rgba(15,118,110,0.08)_100%)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-teal-200/40 to-transparent"
      />
      <div className="mb-1.5 flex items-start gap-2 px-1 pt-0.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-teal-300/45 bg-teal-400/22 text-teal-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.1} />
        </span>
        <div className="min-w-0">
          <p className="talepo-signal-dock-solid flex items-center gap-1.5 text-[13.5px] font-semibold leading-4 tracking-[-0.02em] text-white">
            Pro Araçlar
            <span className="rounded-[5px] border border-teal-200/30 bg-teal-400/15 px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.08em] text-teal-50/90">
              Pro
            </span>
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-white/62">
            Profesyonel plana özel akıllı araçlar
          </p>
        </div>
      </div>
      <div>
        {items.map((item, index) => (
          <CommandProToolRow
            key={item.id}
            item={item}
            showSeparator={index < items.length - 1}
          />
        ))}
      </div>
      {hasLocked ? (
        <p className="px-1.5 pb-1 pt-2 text-[11px] leading-4 text-white/70">
          {SIGNAL_RAIL_LOCKED_HINT}
        </p>
      ) : null}
    </div>
  );
}

function CommandProToolRow({
  item,
  showSeparator,
}: {
  item: ResolvedSignalRailProTool;
  showSeparator: boolean;
}) {
  const Icon = PRO_TOOL_ICONS[item.id];
  const jewel = PRO_TOOL_JEWEL[item.id];

  return (
    <>
      {item.locked || !item.href ? (
        <div
          role="group"
          aria-disabled="true"
          aria-label={`${item.title}, kilitli`}
          className="flex cursor-default items-center gap-2 rounded-[10px] px-1.5 py-1.5 text-white/70"
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${jewel} opacity-70`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.05} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="talepo-signal-dock-solid truncate text-[13px] font-medium leading-4 text-white">
                {item.title}
              </span>
              <span className="rounded-[5px] border border-white/20 px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.06em] text-white">
                Profesyonel
              </span>
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-4 text-white/70">
              {item.description}
            </span>
          </span>
          <Lock
            className="h-3.5 w-3.5 shrink-0 text-white"
            strokeWidth={2}
            aria-hidden
          />
          <span className="sr-only">Kilitli</span>
        </div>
      ) : (
        <Link
          href={item.href}
          aria-label={`${item.title}. ${item.description}`}
          aria-current={item.active ? "page" : undefined}
          className={`group flex items-center gap-2 rounded-[10px] px-1.5 py-1.5 transition ${
            item.active
              ? "border border-white/18 bg-white/10"
              : "hover:bg-white/[0.07]"
          }`}
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${jewel}`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.05} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="talepo-signal-dock-solid truncate text-[13px] font-semibold leading-4 tracking-[-0.01em] text-white">
              {item.title}
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-4 text-white/70">
              {item.description}
            </span>
          </span>
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-white transition group-hover:text-white"
            strokeWidth={2}
          />
        </Link>
      )}
      {showSeparator ? (
        <div
          aria-hidden
          className="mx-2 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]"
        />
      ) : null}
    </>
  );
}
