import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import {
  getAvailablePlans,
  FEATURE_BOOST_OPTIONS,
  OFFER_CREDIT_PACKS,
} from "@/lib/membership/plans";
import {
  getPublicProductLabel,
  PUBLIC_PLAN_TAGLINES,
  toPublicPlanId,
} from "@/lib/membership/product-packaging";
import { PLAN_FEATURES } from "@/lib/membership/plan-visuals";

export function HomeOnePlans() {
  const plans = getAvailablePlans();

  return (
    <section
      id="planlar"
      className="relative overflow-hidden bg-[#070c0b] px-5 py-24 text-white sm:px-6 sm:py-28 lg:px-8 lg:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(15,118,110,0.18)_0%,transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[76rem]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-teal-300/42">
            Planlar
          </p>
          <h2 className="talepo-home1-section-title mt-5 font-semibold">
            Bireysel ücretsiz.
            <span className="block text-teal-200/65">Profesyonel keşif için.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-8 text-white/42">
            Talep oluşturmak her zaman ücretsizdir. Profesyonel; Radar, Fırsatlar,
            Takiplerim ve Analiz sunar.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const isPro = plan.id === "PROFESSIONAL";
            return (
              <article
                key={plan.id}
                className={`talepo-home1-card-hover rounded-[1.5rem] p-7 sm:p-8 ${
                  isPro
                    ? "bg-gradient-to-b from-[#0f766e]/30 to-white/[0.03] ring-1 ring-teal-400/18"
                    : "bg-white/[0.035] ring-1 ring-white/10"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">
                  {isPro ? "Profesyonel" : "Standart"}
                </p>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">
                  {getPublicProductLabel(plan.id)}
                </h3>
                <div className="mt-6">
                  {plan.priceTry ? (
                    <p className="text-[2rem] font-semibold tracking-[-0.04em] leading-none">
                      ₺{plan.priceTry.toLocaleString("tr-TR")}
                      <span className="ml-1 text-base font-normal text-white/32">/ ay</span>
                    </p>
                  ) : (
                    <p className="text-[2rem] font-semibold tracking-[-0.04em]">Ücretsiz</p>
                  )}
                  <p className="mt-2 text-sm text-white/42">
                    {PUBLIC_PLAN_TAGLINES[toPublicPlanId(plan.id)]}
                  </p>
                </div>
                <ul className="mt-7 space-y-3">
                  {PLAN_FEATURES[plan.id].slice(0, 5).map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm leading-6 text-white/55"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-300/70" strokeWidth={2.5} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.id === "STANDARD" ? "/kayit" : "/panel/plan"}
                  className={`mt-9 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                    isPro
                      ? "bg-white text-[#0f1f1d] hover:bg-[#f4f7f6]"
                      : "bg-white/10 text-white hover:bg-white/14"
                  }`}
                >
                  {plan.id === "STANDARD" ? "Ücretsiz başla" : "Profesyonel'e geç"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>

        <details className="mx-auto mt-12 max-w-3xl rounded-2xl bg-white/[0.025] ring-1 ring-white/8">
          <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium text-white/58 marker:content-none [&::-webkit-details-marker]:hidden">
            Ek paketler ve alıcı boost seçenekleri
          </summary>
          <div className="border-t border-white/8 px-6 py-5">
            <p className="text-sm leading-7 text-white/42">
              Alıcı boost ve firma teklif paketleri bilgilendirme amaçlıdır; ödeme
              bağlandığında aktifleşecek.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.values(FEATURE_BOOST_OPTIONS).map((boost) => (
                <span
                  key={boost.label}
                  className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/50"
                >
                  {boost.label} · ₺{boost.priceTry}
                </span>
              ))}
              {Object.values(OFFER_CREDIT_PACKS).map((pack) => (
                <span
                  key={pack.label}
                  className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/50"
                >
                  {pack.label} · ₺{pack.priceTry}
                </span>
              ))}
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

export function HomeOneFooter() {
  return (
    <footer className="border-t border-teal-900/8 bg-[#f4f7f6] px-5 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[76rem] flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/"
            className="text-[1.65rem] font-semibold tracking-[-0.06em] text-[#0f1f1d]"
          >
            tale<span className="text-teal-800/38">po</span>
          </Link>
          <p className="mt-2 text-sm text-teal-950/38">Yaz → karşılaştır → seç.</p>
        </div>
        <nav className="flex flex-wrap gap-x-7 gap-y-2 text-sm text-teal-950/42">
          <a href="#kategoriler" className="transition hover:text-[#0f1f1d]">
            Kategoriler
          </a>
          <a href="#nasil" className="transition hover:text-[#0f1f1d]">
            Nasıl çalışır
          </a>
          <a href="#planlar" className="transition hover:text-[#0f1f1d]">
            Planlar
          </a>
          <Link href="/talep" className="transition hover:text-[#0f1f1d]">
            Talep oluştur
          </Link>
          <Link href="/kullanim-kosullari" className="transition hover:text-[#0f1f1d]">
            Kullanım koşulları
          </Link>
          <Link href="/gizlilik-politikasi" className="transition hover:text-[#0f1f1d]">
            Gizlilik
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-[76rem] text-xs text-teal-950/28">
        © 2026 Talepo. Tüm hakları saklıdır.
      </p>
    </footer>
  );
}
