import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { HomeComposer } from "@/components/home/HomeComposer";
import { PricingPlans } from "@/components/home/PricingPlans";
import {
  ArrowRight,
  Check,
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
    <main className="min-h-screen overflow-hidden bg-[#f3f3ef] text-[#151515]">
      <Header />

      {/* HERO — tek iş: anla + yaz */}
      <section className="relative px-5 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.85),_transparent_55%)]" />
          <div className="talepo-blob-a absolute -left-28 top-10 h-[420px] w-[420px] rounded-full bg-[#b8f0ae]/55 blur-[100px]" />
          <div className="talepo-blob-b absolute -right-20 -top-8 h-[460px] w-[460px] rounded-full bg-[#b7cff8]/55 blur-[110px]" />
          <div className="talepo-blob-c absolute left-1/2 top-[42%] h-56 w-56 -translate-x-1/2 rounded-full bg-[#ffe8b8]/40 blur-[90px]" />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(20,20,20,0.08) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage:
                "radial-gradient(ellipse at center, black 20%, transparent 72%)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <p className="talepo-rise text-[clamp(2.2rem,6vw,3.5rem)] font-semibold leading-none tracking-[-0.07em] text-[#151515]">
            tale<span className="text-black/30">po</span>
          </p>

          <p className="talepo-rise talepo-rise-delay-1 mt-5 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-4 py-1.5 text-sm font-medium text-black/50 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#60ad64]" />
            Ücretsiz talep · Firmalar teklif verir
          </p>

          <h1 className="talepo-rise talepo-rise-delay-2 mt-6 text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.06em] sm:text-5xl lg:text-[3.75rem]">
            Ne lazımsa yazın.
            <span className="mt-2 block bg-gradient-to-r from-black/45 via-black/30 to-[#3d7a42]/70 bg-clip-text text-transparent">
              Firmalar teklif versin.
            </span>
          </h1>

          <p className="talepo-rise talepo-rise-delay-3 mx-auto mt-5 max-w-xl text-base leading-7 text-black/50 sm:text-lg">
            Siz yazarsınız, firmalar teklif verir; beğendiğinizi seçersiniz.
            İletişiminiz kabulden önce gizli kalır.
          </p>
        </div>

        <div className="talepo-rise talepo-rise-delay-3 relative mx-auto mt-9 max-w-2xl">
          <HomeComposer />
        </div>

        <ul className="relative mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-3 text-sm">
          {[
            "Talep ücretsiz",
            "İletişim kabulden önce gizli",
            "Karşılaştırıp seç",
          ].map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/75 px-3.5 py-2 text-black/55 shadow-sm backdrop-blur"
            >
              <Check className="h-4 w-4 text-[#60ad64]" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* NASIL ÇALIŞIR — cahil kullanıcı için */}
      <section
        id="nasil"
        className="border-y border-black/[0.06] bg-white/60 px-5 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-black/40">3 adımda bitti</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              İşleyiş bu kadar basit.
            </h2>
            <p className="mt-3 text-base leading-7 text-black/50">
              Hesap açmadan önce bile sürecin nasıl işlediğini buradan
              görebilirsiniz. Karışık jargon yok.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 lg:grid-cols-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.n}
                  className="relative rounded-[28px] border border-black/[0.06] bg-[#f3f3ef] p-6 sm:p-7"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-4xl font-semibold tracking-[-0.06em] text-black/15">
                      {step.n}
                    </span>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-black/50">
                    {step.body}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/talep"
              className="inline-flex items-center gap-2 rounded-full bg-[#151515] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              Hemen talep yaz
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-sm text-black/40">
              Örnek: “Bağcılar’da 2+1 kiralık daire”
            </p>
          </div>
        </div>
      </section>

      {/* KİM İÇİN — iki yol, net */}
      <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-2">
          <div className="rounded-[30px] border border-black/[0.06] bg-white p-7 shadow-[0_16px_50px_rgba(0,0,0,0.04)] sm:p-9">
            <p className="text-sm font-medium text-black/40">Alıcıysanız</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              Bir şeye ihtiyacınız var.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-black/50">
              Yazın → teklifleri görün → birini seçin. Talep ücretsizdir.
              Firmalar size ulaşır.
            </p>
            <Link
              href="/talep"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#151515] px-5 py-3 text-sm font-semibold text-white"
            >
              Talep oluştur
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div
            id="firmalar"
            className="rounded-[30px] border border-black/[0.06] bg-[#151515] p-7 text-white shadow-[0_16px_50px_rgba(0,0,0,0.08)] sm:p-9"
          >
            <p className="text-sm font-medium text-white/40">Firmaysanız</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              İş fırsatı arıyorsunuz.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/45">
              Açık talepleri görün, teklif verin. Alıcı kabul ederse
              mesajlaşmaya geçersiniz. Planlar hız ve kotayı büyütür.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/talepler"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black"
              >
                Talepleri gör
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#planlar"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/80"
              >
                Planlar
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PricingPlans />

      <footer className="border-t border-black/[0.06] px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-2xl font-semibold tracking-[-0.06em]"
            >
              tale<span className="text-black/35">po</span>
            </Link>
            <p className="mt-2 text-sm text-black/35">
              Yaz → teklif al → seç.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-black/40">
            <a href="#nasil" className="transition hover:text-black">
              Nasıl çalışır
            </a>
            <a href="#planlar" className="transition hover:text-black">
              Planlar
            </a>
            <Link href="/talep" className="transition hover:text-black">
              Talep oluştur
            </Link>
            <Link
              href="/kullanim-kosullari"
              className="transition hover:text-black"
            >
              Kullanım koşulları
            </Link>
            <Link
              href="/gizlilik-politikasi"
              className="transition hover:text-black"
            >
              Gizlilik
            </Link>
          </div>

          <p className="text-sm text-black/30">
            © 2026 Talepo. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </main>
  );
}
