"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { MembershipNumberLabel } from "@/components/panel/MembershipNumberLabel";

type HeaderCompany = {
  id: string;
  name: string;
};

type HeaderProps = {
  /** Ink tone blends the chrome into a dark atmospheric homepage hero. */
  tone?: "default" | "ink";
};

export function Header({ tone = "default" }: HeaderProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [companies, setCompanies] = useState<HeaderCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState<string | null>(
    null,
  );
  const [membershipNumber, setMembershipNumber] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const ink = tone === "ink";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function loadMembership() {
      try {
        const response = await fetch("/api/membership");
        const data = (await response.json()) as {
          ok?: boolean;
          companies?: HeaderCompany[];
          membershipNumber?: string | null;
          membership?: {
            companyId?: string | null;
            companyName?: string | null;
          };
        };

        if (cancelled || !response.ok || !data.ok) return;

        setCompanies(data.companies ?? []);
        setMembershipNumber(data.membershipNumber ?? null);
        setActiveCompanyId(data.membership?.companyId ?? null);
        setActiveCompanyName(data.membership?.companyName ?? null);
      } catch {
        /* keep previous / empty state */
      }
    }

    void loadMembership();

    return () => {
      cancelled = true;
    };
  }, [status]);

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
        setProfileMenuOpen(false);
        if (companyId) {
          setActiveCompanyId(companyId);
          setActiveCompanyName(
            companies.find((item) => item.id === companyId)?.name ?? null,
          );
          router.push("/panel");
          router.refresh();
        } else {
          setActiveCompanyId(null);
          setActiveCompanyName(null);
          router.refresh();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const userInitial =
    session?.user?.name?.trim().charAt(0).toUpperCase() ?? "K";
  const showAuthSkeleton = status === "loading";
  const isAuthenticated = status === "authenticated";
  const headerCompanies = isAuthenticated ? companies : [];
  const headerActiveCompanyId = isAuthenticated ? activeCompanyId : null;
  const headerActiveCompanyName = isAuthenticated ? activeCompanyName : null;
  const inCompanyContext = Boolean(headerActiveCompanyId);

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
        ink
          ? "border-white/[0.06] bg-[#070c0b]/78"
          : "border-teal-900/8 bg-[#f4f7f6]/92"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-8 lg:gap-10">
          <Link
            href="/"
            aria-label="Talepo ana sayfa"
            className="shrink-0"
          >
            <span
              className={`text-[1.45rem] font-semibold tracking-[-0.05em] ${
                ink ? "text-white" : "text-[#0f1f1d]"
              }`}
            >
              tale
              <span className={ink ? "text-teal-300/55" : "text-[#0f766e]"}>
                po
              </span>
            </span>
          </Link>

          <nav
            className={`hidden items-center gap-7 text-sm md:flex ${
              ink ? "text-white/45" : "text-teal-950/50"
            }`}
          >
            <Link
              className={`transition ${ink ? "hover:text-white" : "hover:text-[#0f1f1d]"}`}
              href="/#nasil"
            >
              Nasıl çalışır
            </Link>

            <Link
              className={`transition ${ink ? "hover:text-white" : "hover:text-[#0f1f1d]"}`}
              href="/#planlar"
            >
              Planlar
            </Link>

            <Link
              className={`transition ${ink ? "hover:text-white" : "hover:text-[#0f1f1d]"}`}
              href="/#firmalar"
            >
              Firmalar
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {showAuthSkeleton ? (
            <div
              className={`hidden h-10 w-32 animate-pulse rounded-full sm:block ${
                ink ? "bg-white/8" : "bg-teal-900/5"
              }`}
            />
          ) : session?.user ? (
            <div ref={profileMenuRef} className="relative z-50">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((current) => !current)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                aria-label="Hesap menüsü"
                className={`flex items-center gap-2 rounded-full p-1.5 pr-3 transition ${
                  ink ? "hover:bg-white/[0.06]" : "hover:bg-teal-900/[0.04]"
                }`}
              >
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "Kullanıcı"}
                    className={`h-9 w-9 rounded-full border object-cover ${
                      ink ? "border-white/15" : "border-teal-900/10"
                    }`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f766e] text-sm font-medium text-white">
                    {userInitial}
                  </span>
                )}

                <span
                  className={`hidden max-w-36 truncate text-sm font-medium sm:block ${
                    ink ? "text-white/70" : "text-teal-950/70"
                  }`}
                >
                  {session.user.name ?? "Kullanıcı"}
                </span>

                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`hidden h-4 w-4 transition sm:block ${
                    ink ? "text-white/40" : "text-teal-950/40"
                  } ${profileMenuOpen ? "rotate-180" : ""}`}
                >
                  <path
                    d="m6 8 4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-[200] mt-3 w-72 overflow-visible rounded-2xl border border-teal-900/10 bg-white p-2 shadow-[0_20px_60px_rgba(15,31,29,0.12)]"
                >
                  <div className="border-b border-teal-900/6 px-3 py-3">
                    <p className="truncate text-sm font-semibold text-[#0f1f1d]">
                      {session.user.name ?? "Kullanıcı"}
                    </p>

                    <p className="mt-1 truncate text-xs text-teal-950/45">
                      {session.user.email ?? ""}
                    </p>

                    {membershipNumber ? (
                      <MembershipNumberLabel membershipNumber={membershipNumber} />
                    ) : null}

                    <p className="mt-2 text-[11px] font-medium text-teal-950/40">
                      {inCompanyContext
                        ? `Kurumsal · ${headerActiveCompanyName ?? "Firma"}`
                        : "Kişisel hesap"}
                    </p>
                  </div>

                  <div className="py-2">
                    <Link
                      href="/panel"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center rounded-xl px-3 py-2.5 text-sm font-medium text-[#0f1f1d] transition hover:bg-[#f7faf9]"
                    >
                      Sayfam
                    </Link>

                    <Link
                      href="/panel/taleplerim"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center rounded-xl px-3 py-2.5 text-sm text-teal-950/65 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
                    >
                      Taleplerim
                    </Link>

                    <Link
                      href="/panel/talepler"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center rounded-xl px-3 py-2.5 text-sm text-teal-950/65 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
                    >
                      Talepleri keşfet
                    </Link>

                    <Link
                      href="/panel/teklifler"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center rounded-xl px-3 py-2.5 text-sm text-teal-950/65 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
                    >
                      Tekliflerim
                    </Link>

                    <Link
                      href="/panel/profil"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center rounded-xl px-3 py-2.5 text-sm text-teal-950/65 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
                    >
                      Profilim
                    </Link>

                    {session.user.platformRole !== "USER" && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        onClick={() => setProfileMenuOpen(false)}
                        className="mt-1 flex items-center rounded-xl border border-amber-900/10 bg-amber-50/70 px-3 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                      >
                        Admin Paneli
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
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center rounded-xl px-3 py-2.5 text-sm text-teal-950/65 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
                    >
                      {headerCompanies.length === 0
                        ? "Firma oluştur"
                        : "Yeni firma oluştur"}
                    </Link>

                    {headerCompanies.length === 0 && (
                      <Link
                        href="/panel/bildirimler"
                        role="menuitem"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center rounded-xl px-3 py-2.5 text-sm text-teal-950/65 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d]"
                      >
                        Firmaya bağlan
                      </Link>
                    )}

                    {inCompanyContext && (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={busy}
                        onClick={() => void setCompanyContext(null)}
                        className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-teal-950/65 transition hover:bg-[#f7faf9] hover:text-[#0f1f1d] disabled:opacity-60"
                      >
                        Kişisel hesaba geç
                      </button>
                    )}

                    {headerCompanies.map((company) => {
                      const active = headerActiveCompanyId === company.id;
                      if (active) {
                        return (
                          <div
                            key={company.id}
                            className="flex items-center rounded-xl px-3 py-2.5 text-sm text-teal-950/45"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {company.name} (aktif)
                            </span>
                          </div>
                        );
                      }

                      const label =
                        headerCompanies.length === 1
                          ? "Kurumsal hesaba geç"
                          : `${company.name} hesabına geç`;

                      return (
                        <button
                          key={company.id}
                          type="button"
                          role="menuitem"
                          disabled={busy}
                          onClick={() => void setCompanyContext(company.id)}
                          className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#0f1f1d] transition hover:bg-[#f7faf9] disabled:opacity-60"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-teal-900/6 pt-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                    >
                      Çıkış yap
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/giris"
                className={`hidden rounded-full px-4 py-2.5 text-sm font-medium transition sm:block ${
                  ink
                    ? "text-white/55 hover:bg-white/[0.06] hover:text-white"
                    : "text-teal-950/60 hover:bg-teal-900/[0.04] hover:text-[#0f1f1d]"
                }`}
              >
                Giriş yap
              </Link>

              <Link
                href="/kayit"
                className={
                  ink
                    ? "hidden rounded-full border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/[0.08] sm:inline-flex"
                    : "talepo-cloud-pill hidden px-4 py-2.5 text-sm font-medium text-[#0f1f1d] transition hover:border-teal-800/15 sm:inline-flex"
                }
              >
                Kayıt ol
              </Link>
            </>
          )}

          <Link
            href="/talep"
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              ink
                ? "bg-white text-[#070c0b] shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:bg-white/92"
                : "bg-[#0f766e] text-white shadow-[0_8px_20px_rgba(15,118,110,0.18)] hover:bg-[#115e59]"
            }`}
          >
            Talep oluştur
          </Link>
        </div>
      </div>
    </header>
  );
}
