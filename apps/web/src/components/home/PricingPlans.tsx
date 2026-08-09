import Link from "next/link";
import { ArrowRight, Check, Crown } from "lucide-react";

import { PLAN_FEATURES, PLAN_VISUALS } from "@/lib/membership/plan-visuals";
import {
  FEATURE_BOOST_OPTIONS,
  OFFER_CREDIT_PACKS,
  PLAN_DEFINITIONS,
} from "@/lib/membership/plans";

export function PricingPlans() {
  const plans = Object.values(PLAN_DEFINITIONS);

  return (
    <section
      id="planlar"
      className="relative mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#eee7ff]/40 to-transparent" />

      <div className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-[#7c5cff]/20 bg-[#f3edff] px-4 py-2 text-sm font-medium text-[#5b3fd4]">
            <Crown className="h-4 w-4" />
            Talepo planları
          </div>

          <h2 className="mt-6 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Talep ücretsiz.
            <span className="block text-black/40">Hız ve erişim premium.</span>
          </h2>

          <p className="mt-5 text-base leading-7 text-black/45 sm:text-lg">
            Alıcılar talep oluşturmak için ödeme yapmaz. Firmalar gerçek
            alıcılara daha erken ulaşmak, daha hızlı teklif vermek ve AI
            araçlarından yararlanmak için plan yükseltir.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const visual = PLAN_VISUALS[plan.id];
            const Icon = visual.icon;
            const isDark = visual.dark;

            return (
              <article
                key={plan.id}
                className={`relative overflow-hidden rounded-[30px] border ${visual.border} ${
                  visual.highlight
                    ? "shadow-[0_28px_90px_rgba(124,92,255,0.18)] ring-1 ring-[#7c5cff]/20"
                    : "shadow-[0_18px_60px_rgba(0,0,0,0.05)]"
                } ${isDark ? "bg-[#151515] text-white" : "bg-white text-[#151515]"}`}
              >
                <div
                  className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-[50px] ${visual.glow}`}
                />

                <div className="relative p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${visual.accent} ${
                        isDark ? "text-white shadow-lg" : "text-[#151515]"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${visual.badge}`}
                    >
                      {visual.badgeText}
                    </span>
                  </div>

                  <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                    {plan.label}
                  </h3>

                  <p
                    className={`mt-3 min-h-[72px] text-sm leading-6 ${
                      isDark ? "text-white/55" : "text-black/45"
                    }`}
                  >
                    {plan.description}
                  </p>

                  <div className="mt-6">
                    {plan.priceTry ? (
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-semibold tracking-[-0.05em]">
                          ₺{plan.priceTry.toLocaleString("tr-TR")}
                        </span>
                        <span
                          className={`pb-1 text-sm ${
                            isDark ? "text-white/40" : "text-black/35"
                          }`}
                        >
                          / ay
                        </span>
                      </div>
                    ) : plan.id === "CORPORATE" ? (
                      <p className="text-2xl font-semibold tracking-tight">
                        Özel fiyatlandırma
                      </p>
                    ) : (
                      <p className="text-2xl font-semibold tracking-tight">
                        Ücretsiz
                      </p>
                    )}
                  </div>

                  <ul className="mt-6 space-y-3">
                    {PLAN_FEATURES[plan.id].map((feature) => (
                      <li
                        key={feature}
                        className={`flex items-start gap-3 text-sm leading-6 ${
                          isDark ? "text-white/70" : "text-black/55"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            isDark ? "bg-white/10" : "bg-[#e4f4df]"
                          }`}
                        >
                          <Check
                            className={`h-3 w-3 ${
                              isDark ? "text-[#c4f3bb]" : "text-[#356d3a]"
                            }`}
                          />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.id === "CORPORATE" ? "/kayit" : "/panel/plan"}
                    className={`mt-8 flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold transition ${visual.button}`}
                  >
                    {plan.id === "CORPORATE"
                      ? "İletişime geç"
                      : plan.id === "STANDARD"
                        ? "Ücretsiz başla"
                        : "Planı seç"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[28px] border border-[#f59e0b]/20 bg-gradient-to-br from-[#fff7e8] to-[#ffedd0] p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
              Alıcılar için
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[#7c2d12]">
              Talep oluşturmak her zaman ücretsiz
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#9a3412]/75">
              İsterseniz talebinizi öne çıkarın veya &quot;Acil alıcıyım&quot;
              seçeneğiyle firmaların dikkatini çekin.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.values(FEATURE_BOOST_OPTIONS).map((boost) => (
                <span
                  key={boost.label}
                  className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#9a3412]"
                >
                  {boost.label} · ₺{boost.priceTry}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#6366f1]/15 bg-gradient-to-br from-[#eef2ff] to-[#e0e7ff] p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4338ca]">
              Firmalar için
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[#312e81]">
              Ek teklif paketleri
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#3730a3]/75">
              Premium almak istemeyen işletmeler aylık 5 ücretsiz teklif
              hakkını doldurduğunda ek paket satın alabilir.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.values(OFFER_CREDIT_PACKS).map((pack) => (
                <span
                  key={pack.label}
                  className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-semibold text-[#3730a3]"
                >
                  {pack.label} · ₺{pack.priceTry}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] bg-[#151515] px-6 py-8 text-center text-white sm:px-10">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/35">
            Ana mesaj
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            Gerçek alıcıları daha erken gör, daha hızlı teklif ver.
          </p>
          <Link
            href="/panel/plan"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7c5cff] to-[#5b3fd4] px-6 py-3.5 text-sm font-semibold text-white"
          >
            Planları karşılaştır
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
