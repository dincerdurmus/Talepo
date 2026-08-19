import Link from "next/link";
import type { ReactNode } from "react";

import { ExploreBannerArt } from "@/components/panel/explore/ExploreBannerArt";

type PanelExploreHomeProps = {
  matchedCount: number;
  matchedHref: string;
  showInterestPicker: boolean;
  tabs: ReactNode;
  children: ReactNode;
};

export function PanelExploreHome({
  matchedCount,
  matchedHref,
  showInterestPicker,
  tabs,
  children,
}: PanelExploreHomeProps) {
  return (
    <div className="talepo-beacon mx-auto w-full max-w-[68rem] pb-6 pt-1 sm:pb-8 sm:pt-2">
      <div className="talepo-beacon-shell relative overflow-hidden rounded-[1.75rem] sm:rounded-[2rem]">
        <header className="talepo-explore-banner relative px-5 py-6 sm:px-8 sm:py-7 lg:px-10">
          <div className="talepo-explore-banner-mesh" aria-hidden />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                Talepler
              </p>
              <h1 className="mt-2 text-[1.7rem] font-semibold tracking-[-0.03em] text-[#0f1f1d] sm:text-[2rem]">
                Size yakışan talepler
              </h1>
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#0f1f1d]/58 sm:text-[15px]">
                Kategorilerine göre açık talepler burada. Kendi taleplerin{" "}
                <Link
                  href="/panel/taleplerim"
                  className="font-medium text-slate-800 underline-offset-2 hover:underline"
                >
                  Taleplerim
                </Link>
                ’de.
              </p>
            </div>

            <div className="flex shrink-0 items-end gap-3">
              {!showInterestPicker ? (
                <Link
                  href={matchedHref}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#0f1f1d]/8 bg-white/90 px-3.5 py-2 text-sm font-semibold text-[#0f1f1d]"
                  aria-label={`Size uygun: ${matchedCount}`}
                >
                  <span className="tabular-nums text-[#0f1f1d]">{matchedCount}</span>
                  <span className="text-[#0f1f1d]/55">Size uygun</span>
                </Link>
              ) : null}
              <ExploreBannerArt className="hidden h-[5.75rem] w-[7.5rem] sm:block" />
            </div>
          </div>
        </header>

        <div className="talepo-beacon-body relative px-5 py-5 sm:px-8 sm:py-7 lg:px-10">
          <nav
            className="mb-5 flex gap-1 rounded-2xl border border-[#0f1f1d]/8 bg-white/70 p-1"
            aria-label="Talepler sekmeleri"
          >
            {tabs}
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ExploreTabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-xs font-semibold transition sm:px-3 sm:text-sm ${
        active
          ? "bg-[#0f1f1d] text-white shadow-sm"
          : "text-[#0f1f1d]/50 hover:bg-white hover:text-[#0f1f1d]"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
