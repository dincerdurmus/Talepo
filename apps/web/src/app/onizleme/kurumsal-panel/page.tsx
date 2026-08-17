"use client";

import { useState } from "react";
import {
  ArrowRight,
  Bell,
  BellRing,
  Boxes,
  Building2,
  Check,
  Crown,
  FileText,
  Home,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";

type Mode = "corporate" | "personal";

const CORP_NAV = [
  { icon: Home, label: "Sayfam", active: true },
  { icon: Search, label: "Talepleri keşfet" },
  { icon: FileText, label: "Tekliflerimiz" },
  { icon: BellRing, label: "Uyarı kuralları" },
  { icon: WandSparkles, label: "Teklif taslağı" },
  { icon: Boxes, label: "Gizli envanter" },
  { icon: Users, label: "Ekip" },
  { icon: Crown, label: "Plan" },
  { icon: MessageCircle, label: "Mesajlar", badge: "4" },
];

const MATCHES = [
  {
    title: "50 adet ofis sandalyesi",
    meta: "İstanbul · Mobilya · Acil",
    score: "94%",
    note: "Envanter: Mesh ofis sandalyesi ×120",
  },
  {
    title: "Toplantı masası 220x100",
    meta: "Ankara · Mobilya",
    score: "88%",
    note: "MDFLAM stok ile eşleşti",
  },
  {
    title: "Kafe masa-sandalye seti ×20",
    meta: "İzmir · Mobilya",
    score: "81%",
    note: "Uyarı kuralı: Ege + mobilya",
  },
];

export default function CorporatePanelPreviewPage() {
  const [mode, setMode] = useState<Mode>("corporate");

  return (
    <main className="min-h-screen bg-[#0b1413] text-white">
      <div className="border-b border-white/10 bg-[#0b1413]/95 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200/70">
              Önizleme · Kurumsal firma paneli
            </p>
            <p className="mt-1 text-sm text-white/50">
              Gerçek panele henüz bağlanmadı — nasıl görüneceğini buradan seç.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("corporate")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                mode === "corporate"
                  ? "bg-teal-500 text-[#042f2e]"
                  : "border border-white/15 bg-white/5 text-white/70"
              }`}
            >
              Kurumsal firma
            </button>
            <button
              type="button"
              onClick={() => setMode("personal")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                mode === "personal"
                  ? "bg-white text-black"
                  : "border border-white/15 bg-white/5 text-white/70"
              }`}
            >
              Kişisel (karşılaştır)
            </button>
          </div>
        </div>
      </div>

      {mode === "corporate" ? (
        <CorporateShell />
      ) : (
        <PersonalContrast onShowCorporate={() => setMode("corporate")} />
      )}
    </main>
  );
}

function CorporateShell() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1400px] lg:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="relative overflow-hidden border-b border-white/10 bg-[#0f1f1d] lg:border-b-0 lg:border-r">
        <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-20 right-0 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative flex h-full flex-col px-4 py-5">
          <div className="px-2">
            <div className="text-2xl font-semibold tracking-[-0.06em]">
              tale<span className="text-white/35">po</span>
            </div>
            <div className="mt-4 rounded-2xl border border-teal-400/25 bg-teal-500/10 p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/25 text-teal-100">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    Atlas Mobilya A.Ş.
                  </p>
                  <p className="text-[11px] text-teal-100/70">Kurumsal · Aktif</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-teal-100/80">
                <ShieldCheck className="h-3.5 w-3.5" />
                Doğrulanmış firma
              </div>
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {CORP_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                    item.active
                      ? "bg-teal-500 text-[#042f2e] font-semibold"
                      : "text-white/55 hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {"badge" in item && item.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.active
                          ? "bg-[#042f2e]/15 text-[#042f2e]"
                          : "bg-teal-400/20 text-teal-100"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Kota
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              Sınırsız teklif
            </p>
            <p className="mt-1 text-xs text-white/45">
              Kurumsal plan · gizli envanter açık
            </p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <section className="bg-[#f3f6f4] px-4 py-5 text-[#0f1f1d] sm:px-6 lg:px-8 lg:py-7">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/60">
              Kurumsal çalışma alanı
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              Atlas Mobilya özeti
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] bg-[#f3f6f4]"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white">
              Kurumsal
            </div>
          </div>
        </header>

        {/* KPI */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Bugün eşleşen talep", value: "12", tone: "bg-[#e7f7f2]" },
            { label: "Açık teklif", value: "7", tone: "bg-[#eef3fb]" },
            { label: "Envanter eşleşmesi", value: "5", tone: "bg-[#fbf4ea]" },
            { label: "Ekip üyesi", value: "6", tone: "bg-[#eef6f4]" },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl border border-black/[0.05] ${item.tone} p-4`}
            >
              <p className="text-xs text-black/45">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Matches */}
          <div className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_14px_40px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/55">
                  Gizli envanter + uyarı
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  Size uyan talepler
                </h2>
              </div>
              <span className="rounded-full bg-[#dff4d9] px-3 py-1 text-xs font-semibold text-[#2f6b34]">
                Canlı
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {MATCHES.map((row) => (
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
                      <p className="text-[11px] text-black/40">eşleşme</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-teal-800 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Teklif hazırla
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-medium"
                    >
                      Detay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <div className="rounded-[24px] border border-black/[0.06] bg-[#0f1f1d] p-5 text-white">
              <div className="flex items-center gap-2 text-teal-200/80">
                <Sparkles className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                  Teklif taslağı
                </p>
              </div>
              <h3 className="mt-3 text-lg font-semibold">
                3 teklif taslağı hazır
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Ofis sandalyesi talebi için birim fiyat, montaj ve teslim
                süresi önerildi.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-3 py-2 text-xs font-semibold text-[#042f2e]"
              >
                Taslakları aç
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="rounded-[24px] border border-black/[0.06] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
                Aktif uyarı kuralları
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  "Mobilya · İstanbul · Bütçe ₺50k+",
                  "Acil talepler · Tüm Türkiye",
                  "Ofis sandalyesi · Stok eşleşmesi",
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
              <button
                type="button"
                className="mt-4 text-xs font-semibold text-teal-800"
              >
                Kural ekle →
              </button>
            </div>

            <div className="rounded-[24px] border border-black/[0.06] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
                Ekip
              </p>
              <div className="mt-4 flex -space-x-2">
                {["AY", "MK", "SD", "EL", "BR", "+1"].map((initials) => (
                  <div
                    key={initials}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#0f1f1d] text-[11px] font-semibold text-white"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-black/45">
                6 üye · teklif ve mesaj yetkileri yönetiliyor
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PersonalContrast({
  onShowCorporate,
}: {
  onShowCorporate: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <p className="text-sm text-white/50">
        Kişisel panel: soft gri sidebar, “Yeni talep”, alıcı + satıcı karışık
        özet.
      </p>
      <p className="mt-4 text-2xl font-semibold tracking-tight">
        Kurumsalda fark:
      </p>
      <ul className="mx-auto mt-6 max-w-lg space-y-3 text-left text-sm text-white/70">
        <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          Firma bağlamı üstte (Atlas Mobilya) — kişisel hesap değil
        </li>
        <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          Teal kurumsal dil + gizli envanter / uyarı / ekip menüleri
        </li>
        <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          Ana ekran: eşleşen talepler + AI taslak + kural motoru
        </li>
      </ul>
      <button
        type="button"
        onClick={onShowCorporate}
        className="mt-8 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-[#042f2e]"
      >
        Kurumsal görünüme dön
      </button>
    </div>
  );
}
