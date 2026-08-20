"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { PanelAccountMenu } from "@/components/panel/PanelAccountMenu";
import { getPlanDefinition } from "@/lib/membership/plans";

type HeaderCompany = {
  id: string;
  name: string;
};

type HeaderProps = {
  /** Ink tone blends the chrome into a dark atmospheric homepage hero. */
  tone?: "default" | "ink";
  /** Slim landing-page chrome used on Ana Sayfa 1 preview. */
  variant?: "default" | "home1";
};

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.trim() || "K";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function Header({ tone = "default", variant = "default" }: HeaderProps) {
  const { data: session, status } = useSession();
  const [companies, setCompanies] = useState<HeaderCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState<string | null>(
    null,
  );
  const [membershipNumber, setMembershipNumber] = useState<string | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const ink = tone === "ink";
  const home1 = variant === "home1";

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
            planLabel?: string | null;
          };
        };

        if (cancelled || !response.ok || !data.ok) return;

        setCompanies(data.companies ?? []);
        setMembershipNumber(data.membershipNumber ?? null);
        setActiveCompanyId(data.membership?.companyId ?? null);
        setActiveCompanyName(data.membership?.companyName ?? null);
        setPlanLabel(data.membership?.planLabel ?? null);
      } catch {
        /* keep previous / empty state */
      }
    }

    void loadMembership();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const showAuthSkeleton = status === "loading";
  const isAuthenticated = status === "authenticated";
  const headerCompanies = isAuthenticated ? companies : [];
  const headerActiveCompanyId = isAuthenticated ? activeCompanyId : null;
  const headerActiveCompanyName = isAuthenticated ? activeCompanyName : null;
  const inCompanyContext = Boolean(headerActiveCompanyId);
  const displayName = session?.user?.name?.trim() || "Kullanıcı";
  const triggerName = session?.user?.name?.trim().split(/\s+/)[0] ?? null;

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
        home1
          ? "border-white/[0.05] bg-[#0e1614]/72"
          : ink
            ? "border-white/[0.06] bg-[#070c0b]/78"
            : "border-teal-900/8 bg-[#f4f7f6]/92"
      }`}
    >
      <div
        className={`mx-auto flex items-center justify-between gap-6 px-5 sm:px-6 lg:px-8 ${
          home1 ? "h-14 max-w-[76rem]" : "h-16 max-w-6xl"
        }`}
      >
        <div className="flex min-w-0 items-center gap-8 lg:gap-10">
          <Link
            href="/"
            aria-label="Talepo ana sayfa"
            className="shrink-0"
          >
            <span
              className={`font-semibold tracking-[-0.05em] ${
                home1
                  ? "text-[1.3rem]"
                  : "text-[1.45rem]"
              } ${ink ? "text-white" : "text-[#0f1f1d]"}`}
            >
              tale
              <span className={ink ? "text-teal-300/55" : "text-[#0f766e]"}>
                po
              </span>
            </span>
          </Link>

          <nav
            className={`hidden items-center text-sm md:flex ${
              home1 ? "gap-6 text-[13px]" : "gap-7"
            } ${ink ? "text-white/45" : "text-teal-950/50"}`}
          >
            {home1 ? (
              <>
                <Link
                  className="transition hover:text-white/88"
                  href="#kategoriler"
                >
                  Kategoriler
                </Link>
                <Link
                  className="transition hover:text-white/88"
                  href="#nasil"
                >
                  Nasıl çalışır
                </Link>
                <Link
                  className="transition hover:text-white/88"
                  href="#planlar"
                >
                  Planlar
                </Link>
                <Link
                  className="transition hover:text-white/88"
                  href="#saticilar"
                >
                  Satıcılar
                </Link>
              </>
            ) : (
              <>
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
              </>
            )}
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
            <PanelAccountMenu
              displayName={displayName}
              triggerName={triggerName}
              email={session.user.email ?? null}
              membershipNumber={membershipNumber}
              image={session.user.image ?? null}
              initials={getInitials(session.user.name, session.user.email)}
              isCorporate={inCompanyContext}
              companyName={headerActiveCompanyName}
              activeCompanyId={headerActiveCompanyId}
              companies={headerCompanies}
              platformRole={session.user.platformRole ?? "USER"}
              planLabel={planLabel ?? getPlanDefinition("STANDARD").label}
              surface="public"
              triggerTone={ink || home1 ? "ink" : "default"}
              navigateToPanelOnCompany
              onCompanyContextChange={(companyId) => {
                setActiveCompanyId(companyId);
                setActiveCompanyName(
                  companyId
                    ? companies.find((item) => item.id === companyId)?.name ??
                        null
                    : null,
                );
              }}
            />
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
            className={`font-semibold transition ${
              home1
                ? "rounded-full bg-white px-4 py-2 text-[13px] text-[#070c0b] hover:bg-white/92"
                : ink
                  ? "rounded-xl px-5 py-2.5 text-sm bg-white text-[#070c0b] shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:bg-white/92"
                  : "rounded-xl px-5 py-2.5 text-sm bg-[#0f766e] text-white shadow-[0_8px_20px_rgba(15,118,110,0.18)] hover:bg-[#115e59]"
            }`}
          >
            Talep oluştur
          </Link>
        </div>
      </div>
    </header>
  );
}
