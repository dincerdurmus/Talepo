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

const DEMO_MATCHES = [
  {
    title: "50 adet ofis sandalyesi",
    meta: "İstanbul · Mobilya ve Ofis · Acil",
    score: "94%",
    note: "Envanter eşleşmesi bekleniyor",
    href: "/panel/talepler",
  },
  {
    title: "Toplantı masası 220x100",
    meta: "Ankara · Mobilya ve Ofis",
    score: "88%",
    note: "Uyarı kuralınıza uyuyor",
    href: "/panel/talepler",
  },
  {
    title: "Kafe masa-sandalye seti ×20",
    meta: "İzmir · Mobilya ve Ofis",
    score: "81%",
    note: "Bölge filtresi: Ege",
    href: "/panel/talepler",
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
  return (
    <>
      {personalPlanMismatchDetail && (
        <section className="mb-5">
          <PersonalPlanMismatchBanner detail={personalPlanMismatchDetail} />
        </section>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-4 shadow-sm sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/60">
            Kurumsal çalışma alanı
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
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
            tone: "bg-[#e7f7f2]",
            href: "/panel/talepler",
          },
          {
            label: "Açık teklif sinyali",
            value: String(openOffersHint),
            tone: "bg-[#eef3fb]",
            href: "/panel/talepler",
          },
          {
            label: "Gizli envanter",
            value: hasHiddenInventory ? "Açık" : "Kapalı",
            tone: hasHiddenInventory ? "bg-[#e7f7f2]" : "bg-[#fbf4ea]",
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
            className={`rounded-2xl border border-black/[0.05] ${item.tone} p-4 transition hover:-translate-y-0.5`}
          >
            <p className="text-xs text-black/45">{item.label}</p>
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
                Gizli envanter + uyarı
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Size uyan talepler
              </h2>
              <p className="mt-2 text-sm text-black/45">
                Aşağıdakiler örnek kartlardır. Gerçek eşleşmeler talep
                yayınlandıkça bildirimlerinize düşer.
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
            {DEMO_MATCHES.map((row) => (
              <div
                key={row.title}
                className="rounded-2xl border border-black/[0.06] bg-[#f6f8f6] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.title}</p>
                    <p className="mt-1 text-xs text-black/45">{row.meta}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-teal-800/80">
                      <Boxes className="h-3.5 w-3.5" />
                      {row.note}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-teal-800">
                      {row.score}
                    </p>
                    <p className="text-[11px] text-black/40">örnek eşleşme</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={row.href}
                    className="rounded-xl bg-teal-800 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Talepleri aç
                  </Link>
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
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-3 py-2 text-xs font-semibold text-[#042f2e]"
            >
              Asistanı aç
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
              Uyarı kuralları
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
              href="/panel/uyarilar"
              className="mt-4 inline-block text-xs font-semibold text-teal-800"
            >
              Kuralları yönet →
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
    </>
  );
}
