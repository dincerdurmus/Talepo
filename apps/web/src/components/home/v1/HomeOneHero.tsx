import Link from "next/link";

import { HomeComposer } from "@/components/home/HomeComposer";
import { HomeOneHeroIllustration } from "@/components/home/v1/HomeOneHeroIllustration";

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
        className="relative flex min-h-[min(88svh,880px)] flex-col justify-center overflow-hidden px-5 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-12 lg:pb-24 lg:pl-16 lg:pr-8"
        aria-label="Talepo ana hero"
      >
        <div className="pointer-events-none absolute inset-0 z-0">
          <HomeOneHeroIllustration />
        </div>

        <div className="relative z-10 flex w-full items-center">
          <div className="flex w-full max-w-[42rem] flex-col items-start text-left lg:w-[46%] lg:max-w-[38rem]">
            <h1 className="talepo-rise talepo-home1-display max-w-[11ch] font-medium text-white">
              <span className="block">Bir talep.</span>
              <span className="mt-1 block text-teal-200/95">
                Binlerce olasılık.
              </span>
            </h1>

            <p className="talepo-rise talepo-rise-delay-1 mt-6 max-w-xl text-[15px] leading-7 text-white/52 sm:text-[16px] sm:leading-8">
              İhtiyacınızı yazın; doğru satıcılar teklifleriyle size ulaşsın.
            </p>

            <div className="talepo-composer-enter relative z-20 mt-9 w-full max-w-[41rem] sm:mt-10">
              <HomeComposer onInk variant="home1" />
            </div>
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
      <div className="mx-auto grid max-w-4xl gap-6 text-center sm:grid-cols-3 sm:gap-8 sm:text-left">
        {[
          { t: "Tek talep", d: "Bir kez yazın." },
          { t: "Birden fazla teklif", d: "Uygun satıcılar size gelsin." },
          { t: "Siz seçin", d: "Karşılaştırın, karar verin." },
        ].map((v) => (
          <div key={v.t}>
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#0f1f1d]/85">
              {v.t}
            </p>
            <p className="mt-1 text-[13.5px] leading-6 text-teal-950/50">{v.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
