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
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
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
  },
  ref,
) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const accountMenu = useHoverDisclosure();
  const inCompanyContext = Boolean(activeCompanyId);
  const hasCompanies = companies.length > 0;
  const platformRoleLabel = getPlatformRoleLabel(platformRole);

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
        className="flex h-11 items-center gap-2 rounded-2xl border border-teal-900/8 bg-[#f7faf9] px-2 pr-3 transition hover:bg-white"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={displayName}
            className="h-8 w-8 rounded-full border border-teal-900/10 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${
              isCorporate
                ? "bg-gradient-to-br from-[#0f1f1d] to-teal-800"
                : "bg-[#0f766e]"
            }`}
          >
            {initials}
          </div>
        )}
        {triggerName ? (
          <span className="hidden max-w-28 truncate text-sm font-medium text-[#0f1f1d] sm:block">
            {triggerName}
            {platformRoleLabel ? (
              <span className="ml-1.5 text-xs font-bold text-red-600">
                {platformRoleLabel}
              </span>
            ) : null}
          </span>
        ) : null}
        <ChevronDown
          className={`hidden h-4 w-4 text-teal-950/35 transition sm:block ${
            accountMenu.open ? "rotate-180" : ""
          }`}
        />
      </button>

      {accountMenu.open && (
        <div
          {...accountMenu.getMenuProps()}
          className="absolute right-0 top-full z-[200] mt-1 max-h-[min(32rem,calc(100dvh-4.5rem))] w-72 overflow-y-auto overflow-x-visible rounded-2xl border border-teal-900/10 bg-white p-1.5 shadow-[0_20px_60px_rgba(15,31,29,0.18)] before:absolute before:-top-2.5 before:right-0 before:left-0 before:h-2.5 before:content-['']"
        >
          <div className="border-b border-teal-900/6 px-3 py-2">
            <p className="truncate text-sm font-semibold text-[#0f1f1d]">
              {displayName}
              {platformRoleLabel ? (
                <span className="ml-1.5 text-xs font-bold text-red-600">
                  {platformRoleLabel}
                </span>
              ) : null}
            </p>
            {membershipNumber ? (
              <MembershipNumberLabel membershipNumber={membershipNumber} />
            ) : null}
            {email ? (
              <p className="mt-0.5 truncate text-xs text-teal-950/45">{email}</p>
            ) : null}
            <p className="mt-1 text-[11px] font-medium text-teal-950/45">
              Plan · {planLabel}
            </p>
            {inCompanyContext ? (
              <p className="mt-0.5 truncate text-[11px] text-teal-950/40">
                {isCorporate ? "Kurumsal" : "Firma"} · {companyName ?? "Firma"}
              </p>
            ) : null}
          </div>

          <div className="py-1">
            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/35">
              Çalışma alanları
            </p>

            {inCompanyContext ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void setCompanyContext(null)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d] disabled:opacity-60"
              >
                <UserRound className="h-4 w-4 text-teal-950/35" />
                Kişisel çalışma alanı
              </button>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl bg-[#f4faf8] px-3 py-2 text-sm font-medium text-[#0f1f1d]">
                <UserRound className="h-4 w-4 text-teal-800/70" />
                <span className="min-w-0 flex-1 truncate">
                  Kişisel çalışma alanı
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-teal-800/70">
                  Aktif
                </span>
              </div>
            )}

            {hasCompanies
              ? companies.map((company) => {
                  const active = activeCompanyId === company.id;
                  if (active) {
                    return (
                      <div
                        key={company.id}
                        className="flex items-center gap-2.5 rounded-xl bg-[#f4faf8] px-3 py-2 text-sm font-medium text-[#0f1f1d]"
                      >
                        <Building2 className="h-4 w-4 text-teal-800/70" />
                        <span className="min-w-0 flex-1 truncate">
                          {company.name}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-teal-800/70">
                          Aktif
                        </span>
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
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#0f1f1d] transition hover:bg-[#f7faf9] disabled:opacity-60"
                    >
                      <Building2 className="h-4 w-4 text-teal-800/70" />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                    </button>
                  );
                })
              : (
                <Link
                  href="/panel/firma/yeni"
                  role="menuitem"
                  onClick={() => accountMenu.close()}
                  className="flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm text-teal-950/80 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
                >
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-800/70" />
                  <span className="min-w-0">
                    <span className="block font-medium text-[#0f1f1d]">
                      Firma hesabı oluştur
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-teal-950/50">
                      Ekibinizle çalışmak için bir firma alanı açın.
                    </span>
                  </span>
                </Link>
              )}
          </div>

          <div className="border-t border-teal-900/6 py-1">
            <Link
              href="/panel"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[#0f1f1d] transition hover:bg-[#f7faf9]"
            >
              <LayoutDashboard className="h-4 w-4 text-teal-950/35" />
              Sayfam
            </Link>

            <Link
              href="/"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
            >
              <Home className="h-4 w-4 text-teal-950/35" />
              Ana sayfa
            </Link>

            <Link
              href="/panel/profil"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
            >
              <UserRound className="h-4 w-4 text-teal-950/35" />
              Profili düzenle
            </Link>

            <Link
              href="/panel/plan"
              role="menuitem"
              onClick={() => accountMenu.close()}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
            >
              <CreditCard className="h-4 w-4 text-teal-950/35" />
              Plan ve üyelik
            </Link>

            {platformRole !== "USER" && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => accountMenu.close()}
                className="flex items-center gap-2.5 rounded-xl border border-amber-900/10 bg-amber-50/70 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <ShieldCheck className="h-4 w-4 text-amber-800/75" />
                Admin Paneli
              </Link>
            )}

            {isCorporate && (
              <Link
                href="/panel/ekip"
                role="menuitem"
                onClick={() => accountMenu.close()}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
              >
                <Users className="h-4 w-4 text-teal-950/35" />
                Ekip
              </Link>
            )}

            {inCompanyContext && (
              <Link
                href="/panel/firma"
                role="menuitem"
                onClick={() => accountMenu.close()}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
              >
                <Building2 className="h-4 w-4 text-teal-950/35" />
                Firma ayarları
              </Link>
            )}
          </div>

          <div className="border-t border-teal-900/6 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Çıkış yap
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
