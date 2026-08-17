import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  MessageCircle,
  Sparkles,
} from "lucide-react";

import { PlanBadge } from "@/components/panel/PlanBadge";
import { PersonalPlanMismatchBanner } from "@/components/panel/PersonalPlanMismatchBanner";
import { getPlanThemeStyle } from "@/lib/membership/plan-visuals";
import type { PlanTierId } from "@/lib/membership/plans";

type CorporateHomeProps = {
  companyName: string;
  planTier: PlanTierId;
  planLabel: string;
  unreadMessages: number;
  openOffersHint?: number;
  /** Feature key: hidden_inventory (CORPORATE plan). */
  hasHiddenInventory?: boolean;
  /** Kişisel plan firma planından yüksekse uyarı metni. */
  personalPlanMismatchDetail?: string | null;
};

const SETUP_STEPS = [
  {
    title: "Kategorilerini takip et",
    meta: "Taxonomy leaf / ancestor",
    note: "Canonical discovery ile market izleme",
    href: "/panel/firsatlar?view=browse",
  },
  {
    title: "Opportunity Center",
    meta: "Ata · Takip et · Teklif ver",
    note: "Şirket fırsat operasyonu",
    href: "/panel/firsatlar?view=ops",
  },
  {
    title: "Ekip ve envanter",
    meta: "Lead dağıtımı hazır",
    note: "Üyeleri ekle, envanteri güncelle",
    href: "/panel/ekip",
  },
];

export function CorporateHome({
  companyName,
  planTier,
  planLabel,
  unreadMessages,
  openOffersHint = 0,
  hasHiddenInventory = false,
  personalPlanMismatchDetail = null,
}: CorporateHomeProps) {
  const planThemeStyle = getPlanThemeStyle(planTier);

  return (
    <div className="talepo-plan-theme" style={planThemeStyle} data-plan={planTier}>
      {personalPlanMismatchDetail && (
        <section className="mb-5">
          <PersonalPlanMismatchBanner detail={personalPlanMismatchDetail} />
        </section>
      )}

      <header className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-teal-900/10 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,31,29,0.04)] sm:px-5">
        <div className="talepo-plan-accent-bar absolute inset-x-0 top-0 h-[3px]" aria-hidden />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/55">
            Kurumsal çalışma alanı
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0f1f1d]">
            {companyName} özeti
          </h1>
        </div>
        <PlanBadge
          planTier={planTier}
          planLabel={planLabel}
          size="md"
          showStandard
          linked
        />
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Keşfedilecek talep",
            value: "—",
            tone: "bg-[#eef6f4]",
            href: "/panel/talepler",
          },
          {
            label: "Açık teklif sinyali",
            value: String(openOffersHint),
            tone: "bg-white",
            href: "/panel/talepler",
          },
          {
            label: "Gizli envanter",
            value: hasHiddenInventory ? "Açık" : "Kapalı",
            tone: hasHiddenInventory ? "bg-[#e7f7f2]" : "bg-[#f0f4f3]",
            href: "/panel/envanter",
          },
          {
            label: "Okunmamış mesaj",
            value: String(unreadMessages),
            tone: "bg-[#eef6f4]",
            href: "/panel/mesajlar",
          },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`rounded-2xl border border-teal-900/8 ${item.tone} p-4 transition hover:-translate-y-0.5`}
          >
            <p className="text-xs text-teal-950/45">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {item.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_14px_40px_rgba(0,0,0,0.04)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/55">
                Opportunity Center
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Şirket fırsat operasyonu
              </h2>
              <p className="mt-2 text-sm text-black/45">
                Sahte eşleşme skoru yok. Gerçek fırsatlar Opportunity Center’da
                canonical discovery ile yönetilir.
              </p>
            </div>
            {hasHiddenInventory ? (
              <span className="rounded-full bg-[#dff4d9] px-3 py-1 text-xs font-semibold text-[#2f6b34]">
                Envanter açık
              </span>
            ) : (
              <Link
                href="/panel/plan"
                className="rounded-full bg-[#fbf4ea] px-3 py-1 text-xs font-semibold text-[#7a4e1a]"
              >
                Kurumsal planda açılır
              </Link>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {SETUP_STEPS.map((row) => (
              <div key={row.title} className="talepo-card p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-900/8 text-teal-800">
                    <Boxes className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{row.title}</p>
                    <p className="mt-1 text-xs text-black/45">{row.meta}</p>
                    <p className="mt-2 text-xs text-teal-800/80">{row.note}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={row.href}
                        className="talepo-plan-cta rounded-xl px-3 py-2 text-xs font-semibold shadow-none"
                      >
                        Aç
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-[24px] border border-black/[0.06] bg-[#0f1f1d] p-5 text-white">
            <div className="flex items-center gap-2 text-teal-200/80">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                AI asistan
              </p>
            </div>
            <h3 className="mt-3 text-lg font-semibold">Teklif taslakları</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Kurumsal planda AI asistan özelliği açıktır. Teklif taslağı aracı
              yakında kullanıma sunulacak.
            </p>
            <Link
              href="/panel/asistan"
              className="talepo-plan-cta mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              Asistanı aç
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
              Takiplerim
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                "Kategori + bölge bildirimleri",
                "Acil talep önceliği",
                "Envanter eşleşme uyarıları",
              ].map((rule) => (
                <li
                  key={rule}
                  className="flex items-start gap-2 rounded-xl bg-[#f6f8f6] px-3 py-2.5"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                  <span className="text-black/70">{rule}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/panel/takiplerim"
              className="mt-4 inline-block text-xs font-semibold text-teal-800"
            >
              Takiplerim →
            </Link>
          </section>

          <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
              Mesajlar
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7f7f2]">
                <MessageCircle className="h-4 w-4 text-teal-800" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {unreadMessages > 0
                    ? `${unreadMessages} okunmamış`
                    : "Gelen kutusu boş"}
                </p>
                <p className="text-xs text-black/45">
                  Kabul sonrası iletişim burada
                </p>
              </div>
            </div>
            <Link
              href="/panel/mesajlar"
              className="mt-4 inline-block text-xs font-semibold text-teal-800"
            >
              Mesajlara git →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
