"use client";

import { Clock } from "lucide-react";

export function OfferWaitingFooter({
  message,
  hint,
  compact = false,
}: {
  message: string;
  hint?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className="mt-3 border-t border-teal-900/[0.06] pt-3"
        data-offer-waiting-footer
      >
        <p
          className="inline-flex min-h-9 items-start gap-2 text-[12px] leading-5 text-[#7a5a2b]"
          role="status"
          aria-live="polite"
        >
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span>
            <span className="font-semibold">{message}</span>
            {hint ? (
              <span className="mt-0.5 block font-normal text-black/40">{hint}</span>
            ) : null}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-4 border-t border-teal-900/[0.06] pt-4"
      data-offer-waiting-footer
    >
      <div
        className="flex items-start gap-3 rounded-xl border border-[#e8dcc8] bg-[#faf6ef] px-4 py-3.5"
        role="status"
        aria-live="polite"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#8a6a3d] ring-1 ring-[#e8dcc8]">
          <Clock className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0f1f1d]">{message}</p>
          {hint ? (
            <p className="mt-0.5 text-xs leading-5 text-black/45">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
