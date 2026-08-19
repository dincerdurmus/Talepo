import Link from "next/link";

import { HomeComposer } from "@/components/home/HomeComposer";
import { HomeOneHeroIllustration } from "@/components/home/v1/HomeOneHeroIllustration";
import { Lock, Scale, Sparkles } from "lucide-react";

const TRUST = [
  { icon: Sparkles, label: "Ücretsiz talep" },
  { icon: Lock, label: "Gizli iletişim" },
  { icon: Scale, label: "Yan yana karşılaştırma" },
];

export function HomeOnePreviewBanner() {
  return (
    <div
      className="sticky top-0 z-50 border-b border-amber-400/20 bg-[#120e08]/95 px-4 py-2.5 text-center text-[13px] text-amber-100/88 backdrop-blur-xl"
      role="status"
    >
      <span className="font-semibold text-amber-50">Ana Sayfa 1</span> — premium önizleme ·
      Onay için ·{" "}
      <Link href="/" className="underline underline-offset-2 hover:text-white">
        Mevcut ana sayfa
      </Link>
      {" · "}
      <Link
        href="/onizleme/ana-sayfa-v2"
        className="underline underline-offset-2 hover:text-white"
      >
        v2 taslağı
      </Link>
    </div>
  );
}

export function HomeOneHero() {
  return (
    <>
      <div
        aria-hidden
        className="talepo-home1-hero-canvas pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 talepo-home1-grain mix-blend-soft-light opacity-[0.22]" />
        <div className="talepo-home1-hero-horizon absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
      </div>

      <section
        className="relative flex min-h-[min(88svh,880px)] flex-col justify-center px-5 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10 lg:px-8 lg:pb-24"
        aria-label="Talepo ana hero"
      >
        <div className="relative mx-auto grid w-full max-w-[76rem] items-center gap-12 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] lg:gap-14 xl:gap-16">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="talepo-rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300/80" aria-hidden />
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
                Talep ve teklif platformu
              </span>
            </div>

            <h1 className="talepo-rise talepo-rise-delay-1 talepo-home1-display mt-7 max-w-[14ch] font-semibold text-white sm:mt-8">
              İhtiyacınızı yazın.
              <span className="mt-1 block bg-gradient-to-r from-teal-100 via-teal-200/95 to-teal-300/80 bg-clip-text text-transparent">
                Teklifleri karşılaştırın.
              </span>
            </h1>

            <p className="talepo-rise talepo-rise-delay-2 mt-5 max-w-md text-[15px] leading-7 text-white/46 sm:text-[16px] sm:leading-8">
              Firmalar fiyat ve süre sunar. Kabul edene kadar numaranız ve
              e-postanız gizli kalır — baskı yok, acele yok.
            </p>

            <div className="talepo-composer-enter mt-9 w-full max-w-xl sm:mt-10">
              <HomeComposer onInk variant="home1" />
            </div>

            <ul className="talepo-rise talepo-rise-delay-3 mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 lg:justify-start">
              {TRUST.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 text-[12.5px] text-white/40 sm:text-[13px]"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06]">
                    <Icon className="h-3 w-3 text-teal-200/70" strokeWidth={2.25} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="talepo-composer-enter relative w-full lg:justify-self-end lg:pt-2">
            <HomeOneHeroIllustration />
          </div>
        </div>
      </section>
    </>
  );
}

export function HomeOneManifesto() {
  return (
    <section
      aria-hidden
      className="relative border-y border-teal-900/10 bg-[#f4f7f6] px-5 py-8 sm:px-6 lg:px-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
      />
      <p className="mx-auto max-w-4xl text-center text-[clamp(1.05rem,2vw,1.35rem)] font-medium leading-relaxed tracking-[-0.02em] text-[#0f1f1d]/72">
        Talep yaz. Teklif topla.{" "}
        <span className="text-teal-800/55">Sakin sakin karar ver.</span>
      </p>
    </section>
  );
}
