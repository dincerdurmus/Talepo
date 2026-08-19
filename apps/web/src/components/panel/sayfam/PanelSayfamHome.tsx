import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PlanBadge } from "@/components/panel/PlanBadge";
import { PanelSayfamActivityFeed } from "@/components/panel/sayfam/PanelSayfamActivityFeed";
import { PanelSayfamSpotlightCarousel } from "@/components/panel/sayfam/PanelSayfamSpotlightCarousel";
import type { PlanTierId } from "@/lib/membership/plans";
import type { SayfamHomeData } from "@/lib/panel/sayfam-home-types";

type PanelSayfamHomeProps = {
  firstName: string | null;
  planTier: PlanTierId;
  planLabel: string;
  supplierHref: string;
  home: SayfamHomeData;
};

const METRICS = [
  {
    key: "requests" as const,
    label: "Aktif talep",
    href: "/panel/taleplerim",
    value: (home: SayfamHomeData) => home.metrics.activeRequests,
  },
  {
    key: "responses" as const,
    label: "Yanıt bekleyen",
    href: "/panel/gelen-teklifler",
    value: (home: SayfamHomeData) => home.metrics.actionRequiredOffers,
    highlight: true,
  },
  {
    key: "messages" as const,
    label: "Mesaj",
    href: "/panel/mesajlar",
    value: (home: SayfamHomeData) => home.metrics.unreadMessages,
  },
];

export function PanelSayfamHome({
  firstName,
  planTier,
  planLabel,
  supplierHref,
  home,
}: PanelSayfamHomeProps) {
  return (
    <div className="talepo-beacon mx-auto w-full max-w-[68rem] pb-6 pt-1 sm:pb-8 sm:pt-2">
      <div className="talepo-beacon-shell relative overflow-hidden rounded-[1.75rem] sm:rounded-[2rem]">
        <header className="talepo-beacon-hero relative px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10 lg:px-12">
          <div className="talepo-beacon-hero-glow" aria-hidden />

          <div className="relative flex flex-wrap items-center gap-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/42">
              Talepo · {planLabel}
            </p>
            <PlanBadge
              planTier={planTier}
              planLabel={planLabel}
              variant="hero"
              size="sm"
              linked
            />
          </div>

          <div className="relative mt-6 flex flex-col gap-6 sm:mt-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="talepo-beacon-title font-semibold text-white">
                {firstName ? (
                  <>
                    Merhaba,{" "}
                    <span className="talepo-beacon-title-accent">{firstName}</span>
                  </>
                ) : (
                  "Merhaba"
                )}
              </h1>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/52 sm:text-[16px]">
                {home.heroHint}
              </p>
            </div>

            <div className="flex shrink-0 gap-2 sm:gap-2.5" aria-label="Özet sayaçlar">
              {METRICS.map((metric) => {
                const value = metric.value(home);
                return (
                  <Link
                    key={metric.key}
                    href={metric.href}
                    className={`talepo-beacon-pill min-h-11 ${
                      metric.highlight && value > 0
                        ? "talepo-beacon-pill--live"
                        : ""
                    }`}
                    aria-label={`${metric.label}: ${value}`}
                  >
                    <span className="talepo-beacon-pill-value">{value}</span>
                    <span className="talepo-beacon-pill-label">{metric.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </header>

        <div className="talepo-beacon-body relative px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="flex min-w-0 flex-col gap-5">
              <PanelSayfamSpotlightCarousel items={home.focusItems} />

              <section
                className="talepo-rise talepo-rise-delay-1 grid grid-cols-1 gap-3 sm:grid-cols-2"
                aria-label="Hızlı eylemler"
              >
                <Link
                  href="/talep"
                  className="talepo-beacon-action talepo-beacon-action--primary group min-h-11"
                >
                  <span>
                    <span className="talepo-beacon-action-eyebrow">Alıcı</span>
                    <span className="talepo-beacon-action-title">Yeni talep yaz</span>
                    <span className="talepo-beacon-action-desc">
                      İhtiyacını anlat, teklifler sana gelsin.
                    </span>
                  </span>
                  <ArrowUpRight className="h-5 w-5 shrink-0 opacity-80" strokeWidth={2} />
                </Link>

                <Link
                  href={supplierHref}
                  className="talepo-beacon-action talepo-beacon-action--secondary group min-h-11"
                >
                  <span>
                    <span className="talepo-beacon-action-eyebrow">Tedarikçi</span>
                    <span className="talepo-beacon-action-title">Taleplere göz at</span>
                    <span className="talepo-beacon-action-desc">
                      Uygun işlere teklif ver.
                    </span>
                  </span>
                  <ArrowUpRight className="h-5 w-5 shrink-0" strokeWidth={2} />
                </Link>
              </section>

              <div className="talepo-rise talepo-rise-delay-2 lg:hidden">
                <PanelSayfamActivityFeed
                  items={home.activity}
                  unreadCount={home.unreadNotifications}
                />
              </div>
            </div>

            <div className="talepo-rise talepo-rise-delay-2 hidden lg:block">
              <PanelSayfamActivityFeed
                items={home.activity}
                unreadCount={home.unreadNotifications}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
