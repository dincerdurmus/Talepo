import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { HomeComposer } from "@/components/home/HomeComposer";
import { PricingPlans } from "@/components/home/PricingPlans";
import {
  ArrowRight,
  Handshake,
  MessageSquareText,
  PenLine,
} from "lucide-react";

const STEPS = [
  {
    n: "1",
    title: "İhtiyacınızı yazın",
    body: "Ne lazım, nerede, kaç adet — günlük dille yazmanız yeter. Form doldurmanıza gerek yok.",
    icon: PenLine,
  },
  {
    n: "2",
    title: "Firmalar teklif verir",
    body: "Uygun firmalar fiyat ve süre yazar. Siz yalnızca teklifleri yan yana görürsünüz.",
    icon: MessageSquareText,
  },
  {
    n: "3",
    title: "Beğendiğinizi seçin",
    body: "Teklifi kabul edince mesajlaşmaya geçersiniz. Ondan önce telefonunuz ve e-postanız gizli kalır.",
    icon: Handshake,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f7f6] text-[#0f1f1d]">
      <div className="relative bg-[#070c0b]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            aria-hidden
            className="talepo-hero-atmosphere absolute -left-[20%] top-[-10%] h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.28)_0%,transparent_68%)]"
          />
          <div
            aria-hidden
            className="talepo-hero-atmosphere-slow absolute -right-[15%] bottom-[-20%] h-[65%] w-[60%] rounded-full bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.12)_0%,transparent_70%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,11,0.2)_0%,rgba(7,12,11,0.45)_50%,rgba(7,12,11,0.92)_100%)]"
          />
        </div>

        <Header tone="ink" />

        {/* HERO — full-bleed ink atmosphere; composer is the product */}
        <section
          className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center px-5 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-12 lg:px-8 lg:pb-24 lg:pt-14"
          aria-label="Talepo: ihtiyacınızı yazın, teklif alın, seçin"
        >
          <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <p className="talepo-rise text-[11px] font-medium uppercase tracking-[0.22em] text-teal-200/45 sm:text-xs">
              Talep ve Teklif Platformu
            </p>

            <h1 className="talepo-rise talepo-rise-delay-1 mt-5 sm:mt-6">
              <span className="block text-[3.35rem] font-semibold leading-none tracking-[-0.07em] text-white sm:text-[4.75rem] lg:text-[5.5rem]">
                tale<span className="text-teal-300/55">po</span>
              </span>
              <span className="mt-5 block text-[1.35rem] font-medium leading-[1.25] tracking-[-0.035em] text-white/88 sm:mt-6 sm:text-[1.75rem] lg:text-[1.9rem]">
                Yazın. Teklif alın. Seçin.
              </span>
            </h1>

            <p className="talepo-rise talepo-rise-delay-2 mt-4 max-w-md text-[14px] leading-6 text-white/48 sm:mt-5 sm:text-[15px] sm:leading-7">
              İhtiyacınızı yazın; firmalar fiyat ve süre sunar. İletişiminiz
              kabulden önce gizli kalır.
            </p>

            <div className="talepo-composer-enter mt-9 w-full max-w-2xl sm:mt-11">
              <HomeComposer onInk />
            </div>
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-400/20 to-transparent"
          />
        </section>
      </div>

      <section
        id="nasil"
        className="border-y border-teal-900/8 bg-white px-5 py-14 sm:px-6 lg:px-8 lg:py-16"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-teal-800/50">Nasıl çalışır</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#0f1f1d] sm:text-3xl">
              Üç adımda teklif alın.
            </h2>
          </div>

          <ol className="mt-8 grid gap-3 lg:grid-cols-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.n}
                  className="rounded-2xl border border-teal-900/8 bg-[#f7faf9] p-5 sm:p-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-sm font-semibold text-white">
                      {step.n}
                    </span>
                    <Icon className="h-4 w-4 text-teal-800/50" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-[#0f1f1d]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-teal-950/50">
                    {step.body}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="mt-8">
            <Link
              href="/talep"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115e59]"
            >
              Talep yazmaya başla
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* KİM İÇİN — iki yol */}
      <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-teal-900/10 bg-white p-7 shadow-[0_16px_48px_rgba(15,31,29,0.04)] sm:p-9">
            <p className="text-sm font-medium text-teal-800/45">Alıcıysanız</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#0f1f1d] sm:text-3xl">
              Bir şeye ihtiyacınız var.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-teal-950/50">
              Yazın → teklifleri görün → birini seçin. Talep ücretsizdir.
              Firmalar size ulaşır.
            </p>
            <Link
              href="/talep"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#115e59]"
            >
              Talep oluştur
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div
            id="firmalar"
            className="rounded-2xl border border-teal-950/20 bg-[#0f1f1d] p-7 text-white shadow-[0_16px_48px_rgba(15,31,29,0.12)] sm:p-9"
          >
            <p className="text-sm font-medium text-teal-200/45">Firmaysanız</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              İş fırsatı arıyorsunuz.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/50">
              Açık talepleri görün, teklif verin. Alıcı kabul ederse
              mesajlaşmaya geçersiniz. Planlar hız ve kotayı büyütür.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/talepler"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0f1f1d] transition hover:bg-[#f4f7f6]"
              >
                Talepleri gör
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#planlar"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5"
              >
                Planlar
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PricingPlans />

      <footer className="border-t border-teal-900/8 px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-2xl font-semibold tracking-[-0.06em] text-[#0f1f1d]"
            >
              tale<span className="text-teal-800/40">po</span>
            </Link>
            <p className="mt-2 text-sm text-teal-950/40">
              Yaz → teklif al → seç.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-teal-950/40">
            <a href="#nasil" className="transition hover:text-[#0f1f1d]">
              Nasıl çalışır
            </a>
            <a href="#planlar" className="transition hover:text-[#0f1f1d]">
              Planlar
            </a>
            <Link href="/talep" className="transition hover:text-[#0f1f1d]">
              Talep oluştur
            </Link>
            <Link
              href="/kullanim-kosullari"
              className="transition hover:text-[#0f1f1d]"
            >
              Kullanım koşulları
            </Link>
            <Link
              href="/gizlilik-politikasi"
              className="transition hover:text-[#0f1f1d]"
            >
              Gizlilik
            </Link>
          </div>

          <p className="text-sm text-teal-950/30">
            © 2026 Talepo. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </main>
  );
}
