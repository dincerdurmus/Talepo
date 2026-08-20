"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  Compass,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";

import { MembershipNumberLabel } from "@/components/panel/MembershipNumberLabel";
import { useHoverDisclosure } from "@/hooks/useHoverDisclosure";

export type PanelCompanyOption = {
  id: string;
  name: string;
};

export type PanelAccountMenuHandle = {
  openMenu: () => void;
};

type PanelAccountMenuProps = {
  displayName: string;
  triggerName: string | null;
  email: string | null;
  membershipNumber?: string | null;
  image: string | null;
  initials: string;
  isCorporate: boolean;
  companyName?: string | null;
  activeCompanyId?: string | null;
  companies: PanelCompanyOption[];
  platformRole: "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
  planLabel: string;
  surface?: "panel" | "public";
  triggerTone?: "default" | "ink";
  navigateToPanelOnCompany?: boolean;
  onCompanyContextChange?: (companyId: string | null) => void;
};

function getPlatformRoleLabel(
  role: PanelAccountMenuProps["platformRole"],
) {
  if (role === "SUPPORT") return "Sup";
  if (role === "MODERATOR") return "Mod";
  if (role === "ANALYST") return "Analist";
  if (role === "ADMIN") return "A";
  if (role === "SUPER_ADMIN") return "SA";
  return null;
}

export const PanelAccountMenu = forwardRef<
  PanelAccountMenuHandle,
  PanelAccountMenuProps
>(function PanelAccountMenu(
  {
    displayName,
    triggerName,
    email,
    membershipNumber,
    image,
    initials,
    isCorporate,
    companyName,
    activeCompanyId,
    companies,
    platformRole,
    planLabel,
    surface = "panel",
    triggerTone = "default",
    navigateToPanelOnCompany = false,
    onCompanyContextChange,
  },
  ref,
) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const accountMenu = useHoverDisclosure();
  const inCompanyContext = Boolean(activeCompanyId);
  const hasCompanies = companies.length > 0;
  const platformRoleLabel = getPlatformRoleLabel(platformRole);
  const isPublic = surface === "public";

  useImperativeHandle(
    ref,
    () => ({
      openMenu: accountMenu.openMenu,
    }),
    [accountMenu.openMenu],
  );

  async function setCompanyContext(companyId: string | null) {
    setBusy(true);
    try {
      const response = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-company-context",
          companyId,
        }),
      });
      const data = (await response.json()) as { ok?: boolean };
      if (response.ok && data.ok) {
        accountMenu.close();
        onCompanyContextChange?.(companyId);
        if (navigateToPanelOnCompany && companyId) {
          router.push("/panel");
        }
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div {...accountMenu.getRootProps()} className="relative z-50">
      <button
        type="button"
        {...accountMenu.getTriggerProps()}
        aria-label="Hesap menüsü"
        className={`talepo-header-action talepo-header-action--account${
          triggerTone === "ink" ? " talepo-header-action--ink" : ""
        }`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={displayName}
            className="talepo-header-action-avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className={`talepo-header-action-avatar talepo-header-action-avatar--fallback${
              isCorporate ? " talepo-header-action-avatar--company" : ""
            }`}
          >
            {initials}
          </div>
        )}
        {triggerName ? (
          <span className="talepo-header-action-name hidden max-w-24 truncate text-[13px] font-medium sm:block">
            {triggerName}
            {platformRoleLabel ? (
              <span
                className={`ml-1.5 text-[11px] font-semibold ${
                  triggerTone === "ink"
                    ? "text-amber-200/80"
                    : "text-amber-800/75"
                }`}
              >
                {platformRoleLabel}
              </span>
            ) : null}
          </span>
        ) : null}
        <ChevronDown
          className={`talepo-header-action-chevron hidden h-3.5 w-3.5 transition sm:block ${
            accountMenu.open ? "rotate-180" : ""
          }`}
        />
      </button>

      {accountMenu.open && (
        <div {...accountMenu.getMenuProps()} className="talepo-account-menu">
          <div className="talepo-account-menu-identity">
            <p className="talepo-account-menu-name">
              {displayName}
              {platformRoleLabel ? (
                <span className="ml-1.5 text-[11px] font-semibold text-amber-800/75">
                  {platformRoleLabel}
                </span>
              ) : null}
            </p>
            {email ? (
              <p className="talepo-account-menu-meta">{email}</p>
            ) : null}
            {membershipNumber ? (
              <MembershipNumberLabel membershipNumber={membershipNumber} />
            ) : null}
            <p className="talepo-account-menu-plan">
              Plan · {planLabel}
            </p>
            {inCompanyContext ? (
              <p className="talepo-account-menu-context">
                {isCorporate ? "Kurumsal" : "Firma"} · {companyName ?? "Firma"}
              </p>
            ) : null}
          </div>

          <div className="talepo-account-menu-divider talepo-account-menu-section">
            <p className="talepo-account-menu-eyebrow">
              Çalışma alanları
            </p>

            <div className="talepo-account-menu-workspace">
              {inCompanyContext ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => void setCompanyContext(null)}
                  className="talepo-account-menu-item"
                >
                  <UserRound />
                  Kişisel çalışma alanı
                </button>
              ) : (
                <div className="talepo-account-menu-item talepo-account-menu-item--active">
                  <UserRound />
                  <span className="min-w-0 flex-1 truncate">
                    Kişisel çalışma alanı
                  </span>
                  <span className="talepo-account-menu-marker">Aktif</span>
                </div>
              )}

              {hasCompanies
                ? companies.map((company) => {
                    const active = activeCompanyId === company.id;
                    if (active) {
                      return (
                        <div
                          key={company.id}
                          className="talepo-account-menu-item talepo-account-menu-item--active"
                        >
                          <Building2 />
                          <span className="min-w-0 flex-1 truncate">
                            {company.name}
                          </span>
                          <span className="talepo-account-menu-marker">Aktif</span>
                        </div>
                      );
                    }

                    const label =
                      companies.length === 1
                        ? "Kurumsal hesaba geç"
                        : `${company.name} hesabına geç`;

                    return (
                      <button
                        key={company.id}
                        type="button"
                        role="menuitem"
                        disabled={busy}
                        onClick={() => void setCompanyContext(company.id)}
                        className="talepo-account-menu-item"
                      >
                        <Building2 />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                      </button>
                    );
                  })
                : (
                  <Link
                    href="/panel/firma/yeni"
                    role="menuitem"
                    onClick={() => accountMenu.close()}
                    className="talepo-account-menu-item talepo-account-menu-item--stack"
                  >
                    <Building2 />
                    <span className="min-w-0">
                      <span className="block font-medium text-[#0f1f1d]">
                        Firma hesabı oluştur
                      </span>
                      <span className="mt-0.5 block text-[11px] font-normal leading-4 text-teal-950/50">
                        Ekibinizle çalışmak için bir firma alanı açın.
                      </span>
                    </span>
                  </Link>
                )}

              {isPublic && !hasCompanies ? (
                <Link
                  href="/panel/bildirimler"
                  role="menuitem"
                  onClick={() => accountMenu.close()}
                  className="talepo-account-menu-item"
                >
                  <UserPlus />
                  Firmaya bağlan
                </Link>
              ) : null}

              {isPublic && hasCompanies ? (
                <Link
                  href="/panel/firma/yeni"
                  role="menuitem"
                  onClick={() => accountMenu.close()}
                  className="talepo-account-menu-item"
                >
                  <Building2 />
                  Yeni firma oluştur
                </Link>
              ) : null}
            </div>
          </div>

          <div className="talepo-account-menu-divider talepo-account-menu-section">
            <Link
              href="/panel"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="talepo-account-menu-item"
            >
              <LayoutDashboard />
              Sayfam
            </Link>

            <Link
              href="/panel/taleplerim"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="talepo-account-menu-item"
            >
              <FileText />
              Taleplerim
            </Link>

            <Link
              href="/panel/teklifler"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="talepo-account-menu-item"
            >
              <ClipboardList />
              Tekliflerim
            </Link>

            <Link
              href="/panel/talepler"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="talepo-account-menu-item"
            >
              <Compass />
              Talepleri keşfet
            </Link>
          </div>

          <div className="talepo-account-menu-divider talepo-account-menu-section">
            <Link
              href="/panel/profil"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="talepo-account-menu-item"
            >
              <UserRound />
              Profilim
            </Link>

            <Link
              href="/panel/plan"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="talepo-account-menu-item"
            >
              <CreditCard />
              Plan ve üyelik
            </Link>

            {isCorporate && (
              <Link
                href="/panel/ekip"
                role="menuitem"
                onClick={() => accountMenu.close()}
                className="talepo-account-menu-item"
              >
                <Users />
                Ekip
              </Link>
            )}

            {inCompanyContext && (
              <Link
                href="/panel/firma"
                role="menuitem"
                onClick={() => accountMenu.close()}
                className="talepo-account-menu-item"
              >
                <Building2 />
                Firma ayarları
              </Link>
            )}
          </div>

          {platformRole !== "USER" && (
            <div className="talepo-account-menu-divider talepo-account-menu-section">
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => accountMenu.close()}
                className="talepo-account-menu-item talepo-account-menu-item--admin"
              >
                <span className="talepo-account-menu-admin-well" aria-hidden="true">
                  <ShieldCheck />
                </span>
                <span className="talepo-account-menu-admin-label">
                  Admin Paneli
                </span>
                <span className="talepo-account-menu-admin-mark">Yönetim</span>
              </Link>
            </div>
          )}

          <div className="talepo-account-menu-divider">
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="talepo-account-menu-item talepo-account-menu-item--logout"
            >
              <LogOut />
              Çıkış yap
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
