"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export function Header() {
  const { data: session, status } = useSession();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuthReady(true);
  }, []);

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

  const userInitial =
    session?.user?.name?.trim().charAt(0).toUpperCase() ?? "K";
  const showAuthSkeleton = !authReady || status === "loading";

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f8f8f6]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Talepo ana sayfa"
          className="flex items-center gap-2"
        >
          <span className="text-2xl font-bold tracking-[-0.06em] text-[#171717]">
            tale<span className="text-black/45">po</span>
          </span>

          <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.16em] text-black/45">
            BETA
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-black/55 md:flex">
          <a className="transition hover:text-black" href="/#nasil">
            Nasıl çalışır
          </a>

          <a className="transition hover:text-black" href="/#planlar">
            Planlar
          </a>

          <a className="transition hover:text-black" href="/#firmalar">
            Firmalar
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {showAuthSkeleton ? (
            <div className="hidden h-10 w-32 animate-pulse rounded-full bg-black/5 sm:block" />
          ) : session?.user ? (
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((current) => !current)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full p-1.5 pr-3 transition hover:bg-black/5"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "Kullanıcı"}
                    className="h-9 w-9 rounded-full border border-black/10 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171717] text-sm font-medium text-white">
                    {userInitial}
                  </span>
                )}

                <span className="hidden max-w-36 truncate text-sm font-medium text-black/70 sm:block">
                  {session.user.name ?? "Kullanıcı"}
                </span>

                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`hidden h-4 w-4 text-black/40 transition sm:block ${
                    profileMenuOpen ? "rotate-180" : ""
                  }`}
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
                  className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-black/10 bg-white p-2 shadow-[0_20px_60px_rgba(0,0,0,0.14)]"
                >
                  <div className="border-b border-black/5 px-3 py-3">
                    <p className="truncate text-sm font-semibold text-[#171717]">
                      {session.user.name ?? "Kullanıcı"}
                    </p>

                    <p className="mt-1 truncate text-xs text-black/45">
                      {session.user.email ?? ""}
                    </p>
                  </div>

                  <div className="py-2">
                    <Link
                      href="/panel/taleplerim"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center rounded-xl px-3 py-2.5 text-sm text-black/65 transition hover:bg-black/[0.04] hover:text-black"
                    >
                      Taleplerim
                    </Link>

                    <Link
                      href="/panel/talepler"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center rounded-xl px-3 py-2.5 text-sm text-black/65 transition hover:bg-black/[0.04] hover:text-black"
                    >
                      Tekliflerim
                    </Link>

                    <Link
                      href="/panel/profil"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center rounded-xl px-3 py-2.5 text-sm text-black/65 transition hover:bg-black/[0.04] hover:text-black"
                    >
                      Profilim
                    </Link>
                  </div>

                  <div className="border-t border-black/5 pt-2">
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
                className="hidden rounded-full px-4 py-2.5 text-sm font-medium text-black/65 transition hover:bg-black/5 hover:text-black sm:block"
              >
                Giriş yap
              </Link>

              <Link
                href="/kayit"
                className="hidden rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition hover:border-black/20 sm:block"
              >
                Kayıt ol
              </Link>
            </>
          )}

          <Link
            href="/talep"
            className="rounded-full bg-[#171717] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black hover:shadow-md"
          >
            Talep oluştur
          </Link>
        </div>
      </div>
    </header>
  );
}