import type { ReactNode } from "react";
import { Radar } from "lucide-react";

const RADAR_MARK_INLINE = <Radar strokeWidth={1.75} aria-hidden />;
const RADAR_MARK_FIELD = <Radar strokeWidth={1.15} aria-hidden />;

export function SignalActivityShell({
  tone,
  eyebrow,
  title,
  description,
  summary,
  action,
  className,
  children,
}: {
  tone: "activity" | "communication" | "opportunity" | "radar" | "pool";
  eyebrow: string;
  title: string;
  description: string;
  summary?: string | null;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const hasAside = Boolean(summary || action);
  const showRadarMark = tone === "radar";

  return (
    <div
      className={`talepo-activity mx-auto w-full max-w-[64rem] pb-6 pt-1 sm:pb-8 sm:pt-2${className ? ` ${className}` : ""}`}
    >
      <div className="talepo-beacon-shell relative overflow-hidden rounded-[1.75rem] sm:rounded-[2rem]">
        <header
          className={`talepo-activity-banner talepo-activity-banner--${tone} relative px-5 py-4 sm:px-8 sm:py-5 lg:px-9`}
        >
          <div className="talepo-my-requests-banner-grid" aria-hidden />
          <div className="talepo-my-requests-banner-glow" aria-hidden />
          {showRadarMark ? (
            <div className="talepo-radar-mark-field" aria-hidden>
              {RADAR_MARK_FIELD}
            </div>
          ) : null}
          <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="min-w-0 max-w-xl">
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[var(--activity-eyebrow)]">
                {showRadarMark ? (
                  <span className="talepo-radar-mark-inline">
                    {RADAR_MARK_INLINE}
                  </span>
                ) : null}
                {eyebrow}
              </p>
              <h1 className="mt-1.5 text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--activity-title)] sm:text-[1.75rem]">
                {title}
              </h1>
              <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-[var(--activity-copy)] sm:text-[15px]">
                {description}
              </p>
            </div>
            {hasAside ? (
              <div className="flex w-full min-w-0 flex-col gap-3 lg:w-[18.5rem] lg:shrink-0">
                {summary ? (
                  <div
                    className="talepo-my-requests-summary"
                    aria-live="polite"
                  >
                    <p className="text-[13px] leading-5 text-[var(--activity-summary)]">
                      {summary}
                    </p>
                  </div>
                ) : null}
                {action}
              </div>
            ) : null}
          </div>
        </header>
        <div className="talepo-beacon-body relative px-5 py-5 sm:px-8 sm:py-6 lg:px-9">
          {children}
        </div>
      </div>
    </div>
  );
}
