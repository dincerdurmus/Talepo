import Link from "next/link";
import { ArrowRight, Check, Layers } from "lucide-react";

import {
  PLAN_FEATURES,
  PLAN_THEME_TOKENS,
  PLAN_VISUALS,
} from "@/lib/membership/plan-visuals";
import {
  FEATURE_BOOST_OPTIONS,
  getAvailablePlans,
  OFFER_CREDIT_PACKS,
} from "@/lib/membership/plans";
import { getPublicProductLabel } from "@/lib/membership/product-packaging";

export function PricingPlans() {
  const plans = getAvailablePlans().filter((plan) => plan.id === "STANDARD" || plan.id === "PROFESSIONAL");

  return (
    <section
      id="planlar"
      className="relative mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-amber-50/40 via-teal-50/30 to-transparent" />

      <div className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-teal-800/15 bg-[#eef6f4] px-4 py-2 text-sm font-medium text-teal-900/80">
            <Layers className="h-4 w-4" />
            Talepo planları
          </div>

          <h2 className="mt-6 text-3xl font-semibold tracking-[-0.045em] text-[#0f1f1d] sm:text-4xl">
            Talebini yaz, teklifleri topla.
            <span className="block text-teal-800/45">
              Firmalar hız ve erişim için plan seçer.
            </span>
          </h2>

          <p className="mt-5 text-base leading-7 text-teal-950/50 sm:text-[17px]">
            Bireysel üyelik ücretsizdir. Profesyonel üyelik; bireysel
            profesyoneller ve ekip koltuğu kullanan şirketler için tüm gelişmiş
            özellikleri tek planda sunar.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const visual = PLAN_VISUALS[plan.id];
            const theme = PLAN_THEME_TOKENS[plan.id];
            const Icon = visual.icon;

            return (
              <article
                key={plan.id}
                className={`relative overflow-hidden rounded-2xl border ${visual.border} ${visual.surface} ${
                  visual.highlight
                    ? (visual.highlightClass ??
                      "shadow-[0_16px_48px_rgba(15,31,29,0.05)]")
                    : "shadow-[0_12px_36px_rgba(15,31,29,0.04)]"
                }`}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{
                    background: `linear-gradient(90deg, ${theme.accent}, ${theme.primary})`,
                  }}
                  aria-hidden
                />
                <div
                  className={`pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full blur-[48px] ${visual.glow}`}
                />

                <div className="relative p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${visual.accent} ${visual.iconClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${visual.badge}`}
                    >
                      {visual.badgeText}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-semibold tracking-tight">
                    {getPublicProductLabel(plan.id)}
                  </h3>

                  <p className="mt-2 min-h-[64px] text-sm leading-6 text-teal-950/45">
                    {plan.description}
                  </p>

                  <div className="mt-5">
                    {plan.priceTry ? (
                      <div className="flex items-end gap-1">
                        <span className="text-3xl font-semibold tracking-[-0.04em]">
                          ₺{plan.priceTry.toLocaleString("tr-TR")}
                        </span>
                        <span className="pb-1 text-sm text-teal-950/35">/ ay</span>
                      </div>
                    ) : (
                      <p className="text-xl font-semibold tracking-tight">
                        Ücretsiz
                      </p>
                    )}
                    {plan.id === "PROFESSIONAL" && (
                      <p className="mt-1 text-xs font-medium text-teal-900/70">
                        5 ekip koltuğu dahil
                      </p>
                    )}
                  </div>

                  <ul className="mt-5 space-y-2.5">
                    {PLAN_FEATURES[plan.id].map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm leading-6 text-teal-950/55"
                      >
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                          style={{ background: theme.primarySoft }}
                        >
                          <Check
                            className="h-3 w-3"
                            style={{ color: theme.primary }}
                          />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.id === "STANDARD" ? "/kayit" : "/panel/plan"}
                    className={`mt-7 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${visual.button}`}
                  >
                    {plan.id === "STANDARD"
                        ? "Ücretsiz başla"
                        : "Planları inceleyin"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-teal-900/10 bg-[#eef6f4] px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/70">
            Ekip vs kişisel
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-teal-900/75">
            PRO kişisel kullanımda gelişmiş intelligence motorlarını sunar;
            Workspace context’inde aynı PRO değerini şirket envanteri ve ekip
            yetkileriyle genişletir.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-teal-900/10 bg-white p-6 shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/60">
              Alıcılar için
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[#0f1f1d]">
              Talep oluşturmak her zaman ücretsiz
            </h3>
            <p className="mt-3 text-sm leading-6 text-teal-950/50">
              İsterseniz talebinizi öne çıkarın veya &quot;Acil alıcıyım&quot;
              seçeneğiyle firmaların dikkatini çekin. Ödeme bağlandığında
              aktifleşecek.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.values(FEATURE_BOOST_OPTIONS).map((boost) => (
                <span
                  key={boost.label}
                  className="rounded-lg border border-teal-900/8 bg-[#f7faf9] px-3 py-1.5 text-xs font-semibold text-teal-950/70"
                >
                  {boost.label} · ₺{boost.priceTry}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] font-medium text-teal-800/55">
              Fiyatlar bilgilendirme amaçlı · ödeme yakında
            </p>
          </div>

          <div className="rounded-2xl border border-teal-900/10 bg-white p-6 shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/60">
              Firmalar için
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[#0f1f1d]">
              Ek teklif paketleri
            </h3>
            <p className="mt-3 text-sm leading-6 text-teal-950/50">
              Profesyonel üyelik almak istemeyen işletmeler aylık 5 ücretsiz teklif
              hakkını doldurduğunda ek paket satın alabilecek.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.values(OFFER_CREDIT_PACKS).map((pack) => (
                <span
                  key={pack.label}
                  className="rounded-lg border border-teal-900/8 bg-[#f7faf9] px-3 py-1.5 text-xs font-semibold text-teal-950/70"
                >
                  {pack.label} · ₺{pack.priceTry}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] font-medium text-teal-800/55">
              Fiyatlar bilgilendirme amaçlı · ödeme yakında
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-[#0f1f1d] px-6 py-8 text-center text-white sm:px-10">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/35">
            Ana mesaj
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            Gerçek alıcıları daha erken gör, daha hızlı teklif ver.
          </p>
          <Link
            href="/panel/plan"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0d9488]"
          >
            Planları karşılaştır
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
