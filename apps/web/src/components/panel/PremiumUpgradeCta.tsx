"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Sparkles } from "lucide-react";

export function PremiumUpgradeCta({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [animating, setAnimating] = useState(false);

  function openPremium() {
    if (animating) return;
    setAnimating(true);
    window.setTimeout(() => router.push("/panel/plan/premium"), 650);
  }

  return (
    <section className={`relative flex items-center justify-center overflow-hidden rounded-[32px] border border-violet-200/60 bg-gradient-to-br from-white via-violet-50/70 to-orange-50/70 p-6 shadow-[0_24px_80px_rgba(88,28,135,0.08)] sm:p-10 ${compact ? "min-h-72" : "min-h-[58vh]"}`}>
      <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-orange-300/25 blur-[90px]" />

      <div className="relative max-w-lg text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-white shadow-[0_15px_35px_rgba(192,38,211,0.3)] transition duration-500 ${animating ? "rotate-[360deg] scale-110" : "hover:rotate-6"}`}>
          <Crown className="h-7 w-7" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-violet-700/55">
          Daha fazlasını keşfet
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-[#171225] sm:text-4xl">
          Talepo deneyimini güçlendir
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600">
          Gelişmiş özellikleri, ekip araçlarını ve profesyonel fırsatları tek
          üyelikte inceleyin.
        </p>

        <button
          type="button"
          onClick={openPremium}
          className={`group relative mx-auto mt-8 flex min-w-64 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 px-7 py-4 text-base font-bold text-white shadow-[0_16px_38px_rgba(192,38,211,0.3)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(217,70,239,0.38)] ${animating ? "scale-105" : ""}`}
        >
          <span className={`absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,.48)_50%,transparent_75%)] bg-[length:250%_100%] ${animating ? "animate-[shimmer_650ms_ease-in-out]" : "-translate-x-full"}`} />
          <Sparkles className={`relative h-5 w-5 transition ${animating ? "rotate-180 scale-125" : "group-hover:rotate-12"}`} />
          <span className="relative">{animating ? "Hazırlanıyor…" : "Premiumlu Ol!"}</span>
          <span className="relative transition group-hover:translate-x-1">→</span>
        </button>
        <p className="mt-4 text-xs text-slate-400">Detayları görmeden ödeme başlamaz.</p>
      </div>
    </section>
  );
}
