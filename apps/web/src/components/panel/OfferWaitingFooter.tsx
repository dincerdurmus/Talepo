"use client";

import { Clock } from "lucide-react";

export function OfferWaitingFooter({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div
      className="mt-4 border-t border-teal-900/[0.06] pt-4"
      data-offer-waiting-footer
    >
      <div
        className="flex items-start gap-3 rounded-xl border border-teal-900/10 bg-white/85 px-4 py-3.5 shadow-[0_4px_16px_rgba(15,31,29,0.04)]"
        role="status"
        aria-live="polite"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800/75 ring-1 ring-teal-900/8">
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
