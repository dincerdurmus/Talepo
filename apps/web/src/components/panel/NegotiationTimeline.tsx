import { ArrowDownLeft, ArrowUpRight, Check, Clock3, X } from "lucide-react";

import type { NegotiationHistoryEvent } from "@/lib/offer/negotiation-history";

const TONE_STYLES: Record<
  NegotiationHistoryEvent["tone"],
  { rail: string; amount: string; icon: string; well: string }
> = {
  neutral: {
    rail: "bg-teal-700/25",
    amount: "text-[#0f1f1d]",
    icon: "text-teal-800",
    well: "border-teal-900/10 bg-teal-50/50",
  },
  amber: {
    rail: "bg-amber-500/50",
    amount: "text-amber-950",
    icon: "text-amber-800",
    well: "border-amber-200/80 bg-amber-50/70",
  },
  teal: {
    rail: "bg-emerald-500/55",
    amount: "text-emerald-900",
    icon: "text-emerald-700",
    well: "border-emerald-200/80 bg-emerald-50/60",
  },
  rose: {
    rail: "bg-rose-300/40",
    amount: "text-rose-900/70",
    icon: "text-rose-600/70",
    well: "border-rose-200/40 bg-rose-50/35",
  },
};

function EventIcon({
  tone,
  title,
}: {
  tone: NegotiationHistoryEvent["tone"];
  title: string;
}) {
  const lower = title.toLocaleLowerCase("tr-TR");
  if (tone === "rose" || lower.includes("redded")) {
    return <X className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />;
  }
  if (tone === "teal" || lower.includes("kabul")) {
    return <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />;
  }
  if (tone === "amber" || lower.includes("sıra")) {
    return <Clock3 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />;
  }
  if (lower.includes("sizin")) {
    return <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />;
  }
  return <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />;
}

function isBuyerSideEvent(title: string) {
  const lower = title.toLocaleLowerCase("tr-TR");
  return (
    lower.includes("sizin") ||
    lower.includes("reddettiniz") ||
    lower.includes("kabul ettiniz")
  );
}

export function NegotiationTimeline({
  events,
  turnCopy,
}: {
  events: NegotiationHistoryEvent[];
  turnCopy?: string | null;
}) {
  if (events.length === 0) return null;

  return (
    <div className="mt-3">
      <ol className="space-y-2">
        {events.map((event) => {
          const tone = TONE_STYLES[event.tone];
          const buyerSide = isBuyerSideEvent(event.title);
          return (
            <li
              key={event.id}
              className={`relative flex gap-2 rounded-[12px] border px-2.5 py-2 ${tone.well} ${
                buyerSide ? "sm:ml-3" : "sm:mr-3"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-white/70 bg-white/80 ${tone.icon}`}
              >
                <EventIcon tone={event.tone} title={event.title} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  {event.amountLabel ? (
                    <p
                      className={`text-[15px] font-semibold tabular-nums tracking-tight ${tone.amount}`}
                    >
                      {event.amountLabel}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-[#0f1f1d]">
                      {event.title}
                    </p>
                  )}
                  {event.at ? (
                    <p className="shrink-0 text-[11px] tabular-nums text-black/40">
                      {event.at}
                    </p>
                  ) : null}
                </div>
                {event.amountLabel ? (
                  <p className="mt-0.5 text-[12px] font-medium leading-5 text-[#0f1f1d]/72">
                    {event.title}
                  </p>
                ) : null}
                {event.detail ? (
                  <p className="mt-0.5 text-[11px] leading-4 text-black/45">
                    {event.detail}
                  </p>
                ) : null}
              </div>
              <span
                aria-hidden
                className={`absolute inset-y-2 ${buyerSide ? "right-0" : "left-0"} w-0.5 rounded-full ${tone.rail}`}
              />
            </li>
          );
        })}
      </ol>
      {turnCopy ? (
        <p className="mt-2.5 inline-flex min-h-8 items-center rounded-full border border-amber-200/80 bg-amber-50/80 px-2.5 text-[11px] font-semibold text-amber-950/80">
          {turnCopy}
        </p>
      ) : null}
    </div>
  );
}
