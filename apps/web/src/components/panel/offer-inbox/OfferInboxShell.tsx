import Link from "next/link";
import type { ReactNode } from "react";

type OfferInboxCta = {
  href: string;
  label: string;
};

export function OfferInboxShell({
  tone,
  eyebrow,
  title,
  description,
  summary,
  cta,
  toolbar,
  children,
}: {
  tone: "incoming" | "outgoing";
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  cta?: OfferInboxCta | null;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="talepo-my-requests mx-auto w-full max-w-[64rem] pb-6 pt-1 sm:pb-8 sm:pt-2">
      <div className="talepo-beacon-shell relative overflow-hidden rounded-[1.75rem] sm:rounded-[2rem]">
        <header
          className={`talepo-my-requests-banner talepo-offer-inbox-banner talepo-offer-inbox-banner--${tone} relative px-5 py-4 sm:px-8 sm:py-5 lg:px-9 lg:py-6`}
        >
          <div className="talepo-my-requests-banner-grid" aria-hidden />
          <div className="talepo-my-requests-banner-glow" aria-hidden />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="min-w-0 max-w-xl">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--offer-inbox-eyebrow)]">
                {eyebrow}
              </p>
              <h1 className="mt-1.5 text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--offer-inbox-title)] sm:text-[1.75rem]">
                {title}
              </h1>
              <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-[var(--offer-inbox-copy)] sm:text-[15px]">
                {description}
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-3 lg:w-[19.5rem] lg:shrink-0">
              <div className="talepo-my-requests-summary" aria-live="polite">
                <p className="text-[13px] leading-5 text-[var(--offer-inbox-summary)]">
                  {summary}
                </p>
              </div>
              {cta ? (
                <Link
                  href={cta.href}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--offer-inbox-cta-bg)] px-4 text-sm font-semibold text-[var(--offer-inbox-cta-fg)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {cta.label}
                </Link>
              ) : null}
            </div>
          </div>
        </header>
        <div className="talepo-beacon-body relative px-5 py-5 sm:px-8 sm:py-6 lg:px-9">
          {toolbar}
          <div className={toolbar ? "mt-5" : undefined}>{children}</div>
        </div>
      </div>
    </div>
  );
}
