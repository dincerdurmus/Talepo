"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  CreditCard,
  LogOut,
  UserRound,
  Users,
} from "lucide-react";

export type PanelCompanyOption = {
  id: string;
  name: string;
};

type PanelAccountMenuProps = {
  displayName: string;
  email: string | null;
  image: string | null;
  initials: string;
  isCorporate: boolean;
  companyName?: string | null;
  activeCompanyId?: string | null;
  companies: PanelCompanyOption[];
};

export function PanelAccountMenu({
  displayName,
  email,
  image,
  initials,
  isCorporate,
  companyName,
  activeCompanyId,
  companies,
}: PanelAccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inCompanyContext = Boolean(activeCompanyId);

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
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 items-center gap-2 rounded-2xl border border-black/[0.06] bg-white px-2 pr-3 transition hover:bg-[#f5f5f2]"
      >
        {image ? (
          <img
            src={image}
            alt={displayName}
            className="h-8 w-8 rounded-full border border-black/10 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${
              isCorporate
                ? "bg-gradient-to-br from-[#0f1f1d] to-teal-800"
                : "bg-[#151515]"
            }`}
          >
            {initials}
          </div>
        )}
        <span className="hidden max-w-28 truncate text-sm font-medium sm:block">
          {displayName.split(" ")[0]}
        </span>
        <ChevronDown
          className={`hidden h-4 w-4 text-black/35 transition sm:block ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[100] mt-2 w-72 overflow-hidden rounded-2xl border border-black/10 bg-white p-2 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        >
          <div className="border-b border-black/5 px-3 py-3">
            <p className="truncate text-sm font-semibold text-[#171717]">
              {displayName}
            </p>
            <p className="mt-1 truncate text-xs text-black/45">{email ?? ""}</p>
            <p className="mt-2 text-[11px] font-medium text-black/40">
              {inCompanyContext
                ? `${isCorporate ? "Kurumsal" : "Firma"} · ${companyName ?? "Firma"}`
                : "Kişisel hesap"}
            </p>
          </div>

          <div className="py-1.5">
            <Link
              href="/panel/profil"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-black/70 transition hover:bg-black/[0.04] hover:text-black"
            >
              <UserRound className="h-4 w-4 text-black/35" />
              Profili düzenle
            </Link>

            <Link
              href="/panel/plan"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-black/70 transition hover:bg-black/[0.04] hover:text-black"
            >
              <CreditCard className="h-4 w-4 text-black/35" />
              Plan ve üyelik
            </Link>

            {isCorporate && (
              <Link
                href="/panel/ekip"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-black/70 transition hover:bg-black/[0.04] hover:text-black"
              >
                <Users className="h-4 w-4 text-black/35" />
                Ekip
              </Link>
            )}

            {inCompanyContext && (
              <Link
                href="/panel/firma"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-black/70 transition hover:bg-black/[0.04] hover:text-black"
              >
                <Building2 className="h-4 w-4 text-black/35" />
                Firma ayarları
              </Link>
            )}

            <Link
              href="/panel/firma/yeni"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-black/70 transition hover:bg-black/[0.04] hover:text-black"
            >
              <Building2 className="h-4 w-4 text-black/35" />
              {companies.length === 0 ? "Firma oluştur" : "Yeni firma oluştur"}
            </Link>
          </div>

          {companies.length > 0 && (
            <div className="border-t border-black/5 py-1.5">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
                Hesap değiştir
              </p>

              {inCompanyContext && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => void setCompanyContext(null)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-black/70 transition hover:bg-black/[0.04] hover:text-black disabled:opacity-60"
                >
                  <UserRound className="h-4 w-4 text-black/35" />
                  Kişisel hesaba geç
                </button>
              )}

              {companies.map((company) => {
                const active = activeCompanyId === company.id;
                return (
                  <button
                    key={company.id}
                    type="button"
                    role="menuitem"
                    disabled={busy || active}
                    onClick={() => void setCompanyContext(company.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-black/70 transition hover:bg-black/[0.04] hover:text-black disabled:opacity-60"
                  >
                    <Building2 className="h-4 w-4 text-teal-800/70" />
                    <span className="min-w-0 flex-1 truncate">
                      {active
                        ? `${company.name} (aktif)`
                        : companies.length === 1
                          ? "Kurumsal hesaba geç"
                          : `${company.name} hesabına geç`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="border-t border-black/5 pt-1.5">
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
