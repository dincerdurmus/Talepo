"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  CreditCard,
  Crown,
  Home,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import { MembershipNumberLabel } from "@/components/panel/MembershipNumberLabel";
import type { PlanTierId } from "@/lib/membership/plans";

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
  planTier: PlanTierId;
  isAdmin?: boolean;
};

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
  planTier,
  isAdmin = false,
}: PanelAccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [upgradeAnimating, setUpgradeAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inCompanyContext = Boolean(activeCompanyId);
  const isIndividualPlan = planTier === "STANDARD";

  function previewUpgrade() {
    if (upgradeAnimating) return;
    setUpgradeAnimating(true);
    window.setTimeout(() => {
      setOpen(false);
      setUpgradeAnimating(false);
      router.push("/panel/plan/premium");
    }, 650);
  }

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
        </span>
        {isAdmin ? (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white">
            A
          </span>
        ) : null}
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
            </p>
            <p className="mt-1 truncate text-xs text-teal-950/45">{email ?? ""}</p>
            {isAdmin ? (
              <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">
                Talepo yöneticisi
              </p>
            ) : null}
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

            {isAdmin ? (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center justify-between rounded-xl bg-[#071310] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#102421]"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-amber-300" />
                  AdminPanel
                </span>
                <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#241a02]">
                  Admin
                </span>
              </Link>
            ) : null}

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
              {isIndividualPlan ? "Üyelik" : "Firma"}
            </p>

            {isIndividualPlan ? (
              <button
                type="button"
                role="menuitem"
                onClick={previewUpgrade}
                className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 px-3 py-3 text-left text-sm font-bold text-white shadow-[0_10px_28px_rgba(168,85,247,0.28)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(217,70,239,0.38)] ${upgradeAnimating ? "scale-[1.03]" : ""}`}
              >
                <span className={`absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,.45)_50%,transparent_75%)] bg-[length:250%_100%] ${upgradeAnimating ? "animate-[shimmer_700ms_ease-in-out]" : "-translate-x-full"}`} />
                <span className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition ${upgradeAnimating ? "rotate-[360deg] scale-110" : "group-hover:rotate-12"}`}>
                  <Crown className="h-4 w-4" />
                </span>
                <span className="relative flex-1">
                  {upgradeAnimating ? "Hazırlanıyor…" : "Premiumlu Ol!"}
                </span>
                <span className={`relative text-lg transition ${upgradeAnimating ? "translate-x-1" : "group-hover:translate-x-1"}`}>→</span>
                {upgradeAnimating ? <span className="absolute right-8 top-1 h-2 w-2 animate-ping rounded-full bg-yellow-200" /> : null}
              </button>
            ) : (
              <Link
                href="/panel/firma/yeni"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-teal-950/70 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
              >
                <Building2 className="h-4 w-4 text-teal-800/70" />
                {companies.length === 0 ? "Firma oluştur" : "Yeni firma oluştur"}
              </Link>
            )}

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
