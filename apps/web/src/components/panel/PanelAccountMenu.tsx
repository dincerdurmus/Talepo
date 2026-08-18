"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
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

export type PanelCompanyOption = {
  id: string;
  name: string;
};

type PanelAccountMenuProps = {
  displayName: string;
  email: string | null;
  membershipNumber?: string | null;
  image: string | null;
  initials: string;
  isCorporate: boolean;
  companyName?: string | null;
  activeCompanyId?: string | null;
  companies: PanelCompanyOption[];
  platformRole: "USER" | "SUPPORT" | "MODERATOR" | "ANALYST" | "ADMIN" | "SUPER_ADMIN";
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

export function PanelAccountMenu({
  displayName,
  email,
  membershipNumber,
  image,
  initials,
  isCorporate,
  companyName,
  activeCompanyId,
  companies,
  platformRole,
}: PanelAccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inCompanyContext = Boolean(activeCompanyId);
  const platformRoleLabel = getPlatformRoleLabel(platformRole);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={menuRef} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
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
        <span className="hidden max-w-28 truncate text-sm font-medium text-[#0f1f1d] sm:block">
          {displayName.split(" ")[0]}
          {platformRoleLabel ? (
            <span className="ml-1.5 text-xs font-bold text-red-600">
              {platformRoleLabel}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`hidden h-4 w-4 text-teal-950/35 transition sm:block ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[200] mt-2 w-72 overflow-visible rounded-2xl border border-teal-900/10 bg-white p-2 shadow-[0_20px_60px_rgba(15,31,29,0.18)]"
        >
          <div className="border-b border-teal-900/6 px-3 py-3">
            <p className="truncate text-sm font-semibold text-[#0f1f1d]">
              {displayName}
              {platformRoleLabel ? (
                <span className="ml-1.5 text-xs font-bold text-red-600">
                  {platformRoleLabel}
                </span>
              ) : null}
            </p>
            <p className="mt-1 truncate text-xs text-teal-950/45">{email ?? ""}</p>
            {membershipNumber ? (
              <MembershipNumberLabel membershipNumber={membershipNumber} />
            ) : null}
            <p className="mt-2 text-[11px] font-medium text-teal-950/40">
              {inCompanyContext
                ? `${isCorporate ? "Kurumsal" : "Firma"} · ${companyName ?? "Firma"}`
                : "Kişisel hesap"}
            </p>
          </div>

          <div className="py-1.5">
            <Link
              href="/panel"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[#0f1f1d] transition hover:bg-[#f7faf9]"
            >
              <LayoutDashboard className="h-4 w-4 text-teal-950/35" />
              Sayfam
            </Link>

            <Link
              href="/"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
            >
              <Home className="h-4 w-4 text-teal-950/35" />
              Ana sayfa
            </Link>

            <Link
              href="/panel/profil"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
            >
              <UserRound className="h-4 w-4 text-teal-950/35" />
              Profili düzenle
            </Link>

            <Link
              href="/panel/plan"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
            >
              <CreditCard className="h-4 w-4 text-teal-950/35" />
              Plan ve üyelik
            </Link>

            {platformRole !== "USER" && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl border border-amber-900/10 bg-amber-50/70 px-3 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <ShieldCheck className="h-4 w-4 text-amber-800/75" />
                Admin Paneli
              </Link>
            )}

            {isCorporate && (
              <Link
                href="/panel/ekip"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
              >
                <Users className="h-4 w-4 text-teal-950/35" />
                Ekip
              </Link>
            )}

            {inCompanyContext && (
              <Link
                href="/panel/firma"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
              >
                <Building2 className="h-4 w-4 text-teal-950/35" />
                Firma ayarları
              </Link>
            )}
          </div>

          <div className="border-t border-teal-900/6 py-1.5">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/35">
              Firma
            </p>

            <Link
              href="/panel/firma/yeni"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
            >
              <Building2 className="h-4 w-4 text-teal-800/70" />
              {companies.length === 0 ? "Firma oluştur" : "Yeni firma oluştur"}
            </Link>

            {inCompanyContext && (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void setCompanyContext(null)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d] disabled:opacity-60"
              >
                <UserRound className="h-4 w-4 text-teal-950/35" />
                Kişisel hesaba geç
              </button>
            )}

            {companies.map((company) => {
              const active = activeCompanyId === company.id;
              if (active) {
                return (
                  <div
                    key={company.id}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-teal-950/45"
                  >
                    <Building2 className="h-4 w-4 text-teal-800/50" />
                    <span className="min-w-0 flex-1 truncate">
                      {company.name} (aktif)
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
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#0f1f1d] transition hover:bg-[#f7faf9] disabled:opacity-60"
                >
                  <Building2 className="h-4 w-4 text-teal-800/70" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-teal-900/6 pt-1.5">
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
}
