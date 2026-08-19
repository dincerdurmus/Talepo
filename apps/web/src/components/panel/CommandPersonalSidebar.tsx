"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  ChevronRight,
  Crown,
  FileText,
  Flame,
  Home,
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
  type PanelNavItem,
} from "@/components/panel/panel-nav";
import { formatPanelCountBadge } from "@/lib/offer/outgoing-offer-inbox";
import { getPlanDefinition, type PlanTierId } from "@/lib/membership/plans";

type CommandSection = "genel" | "talep-teklif" | "araclar" | "plan" | "hesap";

const RAIL_WIDTH_PX = 68;
const DOCK_WIDTH_PX = 284;

type ProToolTone = "follows" | "opportunities" | "analytics";

type ProToolItem = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: ProToolTone;
  badge?: string;
  active: boolean;
};

const PRO_TOOL_ICON_WRAP: Record<ProToolTone, string> = {
  follows:
    "bg-amber-400/15 text-amber-100 border border-amber-400/25",
  opportunities:
    "bg-rose-400/15 text-rose-100 border border-rose-400/25",
  analytics:
    "bg-purple-400/15 text-purple-100 border border-purple-400/25",
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
    railLabel: "Genel",
  },
  "talep-teklif": {
    title: "Talep & teklif",
    description: "Talepleriniz, teklifler ve keşif",
    railLabel: "Talep",
  },
  araclar: {
    title: "Araçlar",
    description: "Profesyonel plana özel akıllı araçlar",
    railLabel: "Pro araçlar",
  },
  plan: {
    title: "Plan",
    description: "Üyelik, teklif hakları ve faturalandırma",
    railLabel: "Plan",
  },
  hesap: {
    title: "Hesap",
    description: "Mesajlar ve profil",
    railLabel: "Hesap",
  },
};

function isNavActive(pathname: string, href: string, exact?: boolean) {
  const path = href.split("?")[0] ?? href;
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
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
    pathname.startsWith("/panel/analiz") ||
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

export type CommandPersonalSidebarProps = {
  pathname: string;
  navItems: ReturnType<typeof filterPanelNavItems>;
  unreadMessages: number;
  unreadIncomingOfferEvents: number;
  unreadOutgoingOfferEvents: number;
  planTier: PlanTierId;
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
  collapsed,
  onToggle,
}: CommandPersonalSidebarProps) {
  const pathSection = useMemo(() => getSectionFromPath(pathname), [pathname]);
  const [activeSection, setActiveSection] = useState<CommandSection>(pathSection);
  const [hoverSection, setHoverSection] = useState<CommandSection | null>(null);

  useEffect(() => {
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
          items: navItems.filter((item) => ["/", "/panel"].includes(item.href)),
        },
        {
          id: "talep-teklif" as const,
          label: "Talep & teklif",
          items: navItems.filter((item) =>
            [
              "/panel/taleplerim",
              "/panel/gelen-teklifler",
              "/panel/talepler",
              "/panel/teklifler",
            ].includes(item.href),
          ),
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

  const analizItem = navItems.find((item) => item.href === "/panel/analiz");
  const planItem = navItems.find((item) => item.href === "/panel/plan");
  const takiplerimItem = navItems.find((item) => item.href === "/panel/takiplerim");
  const firsatlarItem = navItems.find((item) => item.href === "/panel/firsatlar");

  const showFollows = Boolean(takiplerimItem);
  const showOpportunities = Boolean(firsatlarItem);
  const showProCard = showFollows || showOpportunities;

  const proTools: ProToolItem[] = useMemo(() => {
    const tools: ProToolItem[] = [];
    if (showOpportunities) {
      tools.push({
        href: "/panel/firsatlar",
        icon: Flame,
        title: "Fırsatlar",
        description: "Sana uygun açık talepler",
        tone: "opportunities",
        active: pathname.startsWith("/panel/firsatlar"),
      });
    }
    if (showFollows) {
      tools.push({
        href: "/panel/takiplerim",
        icon: Bookmark,
        title: "Takiplerim",
        description: "Kriterlerinle fırsatları kaçırma",
        tone: "follows",
        active: isNavActive(pathname, "/panel/takiplerim"),
      });
    }
    if (analizItem) {
      tools.push({
        href: "/panel/analiz",
        icon: PieChart,
        title: "Analiz",
        description: "Performansını ölç, gelişimini gör",
        tone: "analytics",
        active: isNavActive(pathname, "/panel/analiz"),
      });
    }
    return tools;
  }, [analizItem, pathname, showFollows, showOpportunities]);

  const hasToolsSection = showProCard || Boolean(analizItem);

  const railSections = useMemo(() => {
    const sections: CommandSection[] = ["genel", "talep-teklif"];
    if (hasToolsSection) sections.push("araclar");
    sections.push("plan", "hesap");
    return sections;
  }, [hasToolsSection]);

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
      ? "text-amber-200/85"
      : "text-teal-300/85";

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
        className="flex h-full shrink-0 flex-col items-center border-r border-white/10 bg-gradient-to-b from-[#0b100f] to-[#070a09] py-4"
        style={{ width: RAIL_WIDTH_PX }}
        data-plan={planTier}
        aria-label="Panel gezinme"
      >
        <Link
          href="/"
          aria-label="Ana sayfa"
          title="talepo"
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 text-sm font-extrabold tracking-tighter text-white shadow-[0_4px_20px_rgba(45,212,191,0.22)]"
        >
          tp
        </Link>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={dockVisible}
          aria-label={pinnedOpen ? "Menüyü daralt" : "Menüyü aç"}
          title={pinnedOpen ? "Menüyü daralt" : "Menüyü aç"}
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/14 bg-white/8 text-white/78 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
        >
          {pinnedOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>

        <Link
          href="/talep"
          title="Yeni talep"
          aria-label="Yeni talep"
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-[#0f1f1d] shadow-[0_8px_28px_rgba(255,255,255,0.14)] transition hover:-translate-y-0.5"
        >
          <Plus className="h-5 w-5" strokeWidth={2.25} />
        </Link>

        <nav className="flex w-full flex-1 flex-col items-center gap-1">
          {railSections.map((section) => {
            const Icon = sectionRailIcon(section);
            const isProRail = section === "araclar" && showProCard;
            const sectionLabel =
              section === "araclar" && !showProCard
                ? "Araçlar"
                : SECTION_META[section].railLabel;
            const isActive = pinnedOpen
              ? activeSection === section
              : hoverSection === section || pathSection === section;
            const badge = sectionBadge(section);
            return (
              <div
                key={section}
                className="relative flex w-full justify-center"
                onMouseEnter={() => {
                  setHoverSection(section);
                  if (pinnedOpen) setActiveSection(section);
                }}
              >
                <button
                  type="button"
                  onClick={() => handleRailClick(section)}
                  aria-label={sectionLabel}
                  aria-expanded={pinnedOpen && activeSection === section}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition ${
                    isProRail
                      ? isActive
                        ? PREMIUM_RAIL_ACTIVE
                        : PREMIUM_RAIL_IDLE
                      : isActive
                        ? RAIL_ACTIVE
                        : RAIL_IDLE
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                  {isProRail ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-[4px] bg-gradient-to-r from-[#fbbf24] via-[#fb7185] to-[#c084fc] px-1 py-px text-[7px] font-bold uppercase tracking-[0.06em] text-white shadow-[0_2px_8px_rgba(251,191,36,0.35)]"
                    >
                      Pro
                    </span>
                  ) : null}
                  {badge ? (
                    <span
                      className={`absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#070a09] px-0.5 text-[9px] font-bold text-white ${
                        isProRail ? "bg-rose-500" : "bg-teal-600"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                  {isActive ? (
                    <span
                      aria-hidden
                      className={`absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r ${
                        isProRail ? "bg-amber-400" : "bg-teal-400"
                      }`}
                    />
                  ) : null}
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {dockVisible ? (
          <aside
            className="flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(165deg,rgba(12,22,20,0.48)_0%,rgba(10,18,17,0.38)_55%,rgba(12,22,20,0.44)_100%)] shadow-[inset_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-[40px] backdrop-saturate-150 lg:flex"
            style={{ width: DOCK_WIDTH_PX }}
            aria-label={`${SECTION_META[dockSection].title} menüsü`}
          >
            <div className="flex h-full min-h-0 flex-col px-4 pb-4 pt-5">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/8 pb-4">
                <div className="min-w-0">
                  <p className={`text-xs font-semibold tracking-wide ${dockAccentClass}`}>
                    Şu an buradasınız
                  </p>
                  <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-white">
                    {SECTION_META[dockSection].title}
                  </h2>
                  <p className="mt-1 text-sm leading-snug text-white/45">
                    {SECTION_META[dockSection].description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDock}
                  aria-label="Menüyü kapat"
                  title="Menüyü kapat (Esc)"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-white/55 transition hover:bg-white/12 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/12 [&::-webkit-scrollbar]:w-1">
                <DockSectionContent
                  section={dockSection}
                  navGroups={navGroups}
                  proTools={proTools}
                  showProCard={showProCard}
                  analizItem={analizItem}
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
  showProCard,
  analizItem,
  planHref,
  planLabel,
  pathname,
  unreadMessages,
  unreadIncomingOfferEvents,
  unreadOutgoingOfferEvents,
}: {
  section: CommandSection;
  navGroups: Array<{ id: CommandSection; label: string; items: PanelNavItem[] }>;
  proTools: ProToolItem[];
  showProCard: boolean;
  analizItem?: PanelNavItem;
  planHref: string;
  planLabel: string;
  pathname: string;
  unreadMessages: number;
  unreadIncomingOfferEvents: number;
  unreadOutgoingOfferEvents: number;
}) {
  if (section === "araclar") {
    return (
      <div className="space-y-3">
        <p
          className={`px-2 text-[11px] font-bold uppercase tracking-[0.08em] ${
            showProCard ? "text-amber-200/50" : "text-white/35"
          }`}
        >
          {showProCard ? "Profesyonel araçlar" : "Araçlar"}
        </p>
        {showProCard ? (
          <CommandProToolsCard items={proTools} />
        ) : analizItem ? (
          <DockNavLink
            href={analizItem.href}
            icon={analizItem.icon}
            label={analizItem.label}
            active={isNavActive(pathname, analizItem.href, analizItem.exact)}
            premium
          />
        ) : null}
      </div>
    );
  }

  if (section === "plan") {
    const planActive = isNavActive(pathname, planHref);
    return (
      <div className="space-y-3">
        <p className="px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/35">
          Plan
        </p>
        <div className="rounded-[14px] border border-white/10 bg-white/4 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
            Aktif plan
          </p>
          <p className="mt-1 text-base font-semibold tracking-tight text-white">
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
      <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/35">
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
    : "border border-teal-400/20 bg-teal-400/12 font-semibold text-teal-200";
  const iconActiveClass = premium
    ? "border-amber-300/30 bg-gradient-to-br from-amber-400/25 via-rose-400/20 to-purple-400/22 text-amber-50"
    : "border-teal-400/25 bg-teal-400/15 text-teal-200";
  const indicatorClass = premium ? "bg-amber-400" : "bg-teal-400";

  return (
    <Link
      href={href}
      title={linkLabel}
      aria-label={linkLabel}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[14.5px] font-medium transition ${
        active
          ? activeClass
          : "text-white/72 hover:bg-white/6 hover:text-white"
      }`}
    >
      {active ? (
        <span
          aria-hidden
          className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r ${indicatorClass}`}
        />
      ) : null}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border ${
          active
            ? iconActiveClass
            : "border-white/6 bg-white/5 text-white/55 group-hover:text-white/85"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span
          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-teal-400/25 bg-teal-400/20 px-1.5 text-[11px] font-semibold tabular-nums text-teal-200"
          aria-hidden="true"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function CommandProToolsCard({ items }: { items: ProToolItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[16px] border border-amber-400/28 bg-[linear-gradient(145deg,rgba(251,191,36,0.14)_0%,rgba(244,63,94,0.1)_48%,rgba(168,85,247,0.12)_100%)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_28px_rgba(251,191,36,0.1)] backdrop-blur-md">
      <div className="mb-1.5 flex items-start gap-2 px-1 pt-0.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-amber-300/35 bg-gradient-to-br from-[#fbbf24]/35 via-[#fb7185]/28 to-[#c084fc]/30 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.25)]">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.1} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-4 tracking-[-0.02em] text-white/95">
            Pro Araçlar
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-amber-100/50">
            Yalnız Profesyonel planda
          </p>
        </div>
      </div>
      <div>
        {items.map((item, index) => (
          <CommandProToolRow
            key={item.href}
            item={item}
            showSeparator={index < items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function CommandProToolRow({
  item,
  showSeparator,
}: {
  item: ProToolItem;
  showSeparator: boolean;
}) {
  const Icon = item.icon;
  const accessibleLabel = item.badge
    ? `${item.title}, ${item.badge.toLocaleLowerCase("tr-TR")}. ${item.description}`
    : `${item.title}. ${item.description}`;

  return (
    <>
      <Link
        href={item.href}
        title={item.title}
        aria-label={accessibleLabel}
        aria-current={item.active ? "page" : undefined}
        className={`group flex items-center gap-2 rounded-[10px] px-1.5 py-1.5 transition ${
          item.active
            ? "border border-amber-300/28 bg-gradient-to-r from-amber-400/12 via-rose-400/8 to-purple-400/10"
            : "hover:bg-white/6"
        }`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${PRO_TOOL_ICON_WRAP[item.tone]}`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.05} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold leading-4 tracking-[-0.01em] text-white/88">
              {item.title}
            </span>
            {item.badge ? (
              <span className="rounded-[5px] bg-gradient-to-r from-amber-400/30 to-purple-400/25 px-1.5 py-px text-[8.5px] font-bold uppercase tracking-[0.08em] text-amber-50">
                {item.badge}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-4 text-white/38">
            {item.description}
          </span>
        </span>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-white/30 transition group-hover:text-white/55"
          strokeWidth={2}
        />
      </Link>
      {showSeparator ? (
        <div
          aria-hidden
          className="mx-2 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]"
        />
      ) : null}
    </>
  );
}
