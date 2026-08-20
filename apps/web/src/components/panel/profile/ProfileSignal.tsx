"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Orbit } from "lucide-react";

/** Shared Talepo Signal surface tokens (Tailwind-only, no new packages). */
export const signalSurface =
  "relative overflow-hidden rounded-[18px] border border-teal-950/[0.08] bg-[#fbfcfc] shadow-[0_1px_0_rgba(15,31,29,0.03),0_10px_28px_rgba(15,118,110,0.04)]";

export const signalHeroSurface =
  "relative overflow-hidden rounded-[20px] border border-teal-950/[0.08] bg-[linear-gradient(145deg,#faf8f4_0%,#f5faf8_42%,#f2f5f7_100%)] shadow-[0_1px_0_rgba(15,31,29,0.04),0_14px_36px_rgba(15,31,29,0.05)]";

/** Self-profile identity banner — deep graphite / ink / restrained petrol. */
export const signalIdentityHeroSurface =
  "relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[radial-gradient(ellipse_at_12%_0%,rgba(45,90,82,0.22),transparent_52%),linear-gradient(155deg,#151d1b_0%,#111716_48%,#19302d_100%)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_18px_40px_rgba(8,14,13,0.28)]";

export const signalInput =
  "mt-1.5 w-full rounded-[12px] border border-teal-950/[0.1] bg-white px-3 py-2 text-[13px] text-[#0f1f1d] outline-none transition-[border-color,box-shadow] placeholder:text-[#0f1f1d]/40 focus:border-teal-700/30 focus:shadow-[0_0_0_3px_rgba(15,118,110,0.1)]";

export const signalEditorialInput =
  "mt-1.5 w-full min-h-[8.5rem] rounded-[14px] border border-teal-950/[0.1] bg-white px-3.5 py-3 text-[14px] leading-6 text-[#0f1f1d] outline-none transition-[border-color,box-shadow] placeholder:text-[#0f1f1d]/42 focus:border-teal-700/30 focus:shadow-[0_0_0_3px_rgba(15,118,110,0.1)] resize-y";

export const signalLabel =
  "text-[12px] font-medium text-[#0f1f1d]/62";

export const signalHelper =
  "mt-1 block text-[11px] leading-4 text-[#0f1f1d]/52";

export const signalTabContent =
  "motion-safe:animate-[signalFadeIn_220ms_ease-out] motion-reduce:animate-none";

export function SignalOrbitDecor({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border border-teal-800/[0.06]" />
      <div className="absolute -right-2 top-6 h-20 w-20 rounded-full border border-teal-800/[0.04]" />
      <div className="absolute bottom-0 left-1/4 h-px w-1/2 bg-gradient-to-r from-transparent via-teal-800/10 to-transparent" />
    </div>
  );
}

export function ProfileCompletionRing({
  percent,
  size = 88,
  tone = "light",
  children,
}: {
  percent: number;
  size?: number;
  /** Dark identity hero uses a lighter track so teal progress stays readable. */
  tone?: "light" | "dark";
  children: React.ReactNode;
}) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const track = tone === "dark" ? "rgba(255,255,255,0.16)" : "rgba(15,118,110,0.12)";
  const face =
    tone === "dark"
      ? "bg-[#f5f7f6] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
      : "bg-white shadow-[inset_0_0_0_1px_rgba(15,31,29,0.06)]";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Profil tamamlanma yüzde ${clamped}`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-reduce:transition-none"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#0f766e"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="motion-safe:animate-[signalRingDraw_650ms_ease-out] motion-reduce:animate-none"
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div
        className={`absolute inset-[6px] flex items-center justify-center overflow-hidden rounded-full ${face}`}
      >
        {children}
      </div>
    </div>
  );
}

export function SignalSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={`${signalSurface} p-4 sm:p-5`}>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-[#0f1f1d] sm:text-base">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#0f1f1d]/52">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="relative mt-4">{children}</div>
    </section>
  );
}

export function SignalEmptyState({
  title,
  description,
  icon: Icon = Orbit,
}: {
  title: string;
  description: string;
  icon?: typeof Orbit;
}) {
  return (
    <div className="rounded-xl border border-dashed border-teal-900/12 bg-teal-950/[0.02] px-5 py-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-teal-800/10 bg-white/70">
        <Icon className="h-4 w-4 text-teal-800/45" aria-hidden />
      </div>
      <p className="mt-4 text-sm font-semibold text-[#0f1f1d]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-teal-950/50">
        {description}
      </p>
    </div>
  );
}

export function SignalPrivateLabel({ text = "Yalnızca size görünür" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3d5c58]/80">
      <Lock className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      {text}
    </span>
  );
}

export type SignalTabId = "profil" | "guven" | "giris" | "hesap";

const TABS: Array<{ id: SignalTabId; label: string }> = [
  { id: "profil", label: "Profil" },
  { id: "guven", label: "Güven ve puan" },
  { id: "giris", label: "Giriş ve güvenlik" },
  { id: "hesap", label: "Hesap" },
];

export function SignalTabStrip({
  active,
  onChange,
}: {
  active: SignalTabId;
  onChange: (id: SignalTabId) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const btn = strip.querySelector<HTMLButtonElement>(`[data-tab-id="${active}"]`);
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    btn.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div className="sticky top-0 z-20 mt-4 rounded-[14px] border border-teal-900/[0.07] bg-[#f4f7f6]/95 px-1.5 py-1 backdrop-blur-sm sm:mt-5">
      <div
        ref={stripRef}
        className="relative flex gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Profil bölümleri"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 h-0.5 rounded-full bg-teal-700 motion-safe:transition-[left,width] motion-safe:duration-200 motion-reduce:transition-none"
          style={{ left: indicator.left + 8, width: Math.max(0, indicator.width - 16) }}
        />
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab-id={tab.id}
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={`relative shrink-0 min-h-10 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition-colors sm:px-4 ${
                selected
                  ? "text-teal-950"
                  : "text-[#0f1f1d]/48 hover:text-[#0f1f1d]/72"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SignalTabPanels({
  active,
  sections,
}: {
  active: SignalTabId;
  sections: Record<SignalTabId, React.ReactNode>;
}) {
  return (
    <div className="mt-4 min-w-0 pb-24 sm:mt-5 sm:pb-8">
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          hidden={active !== tab.id}
          className={active === tab.id ? signalTabContent : "hidden"}
        >
          {sections[tab.id]}
        </div>
      ))}
    </div>
  );
}

export function SignalSaveSuccess({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 motion-safe:animate-[signalFadeIn_220ms_ease-out]">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
        <path
          d="M3 8.5 L6.5 12 L13 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="motion-safe:[stroke-dasharray:20] motion-safe:[stroke-dashoffset:20] motion-safe:animate-[signalCheckDraw_500ms_ease-out_forwards] motion-reduce:[stroke-dashoffset:0]"
        />
      </svg>
      Kaydedildi
    </span>
  );
}
