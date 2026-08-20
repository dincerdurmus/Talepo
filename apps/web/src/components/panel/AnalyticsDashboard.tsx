"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  Clock,
  FileText,
  Inbox,
  LoaderCircle,
  Sparkles,
  Target,
} from "lucide-react";

import {
  formatMoneyAmount,
  formatRelativePriceDelta,
  formatWinRateHint,
  formatWinRateValue,
} from "@/lib/monetization/performance-metrics";
import type {
  CommercialPerformanceMetrics,
  WorkspacePerformanceMetrics,
} from "@/lib/monetization/types";
import {
  ANALYSIS_ROLE_TABS,
  analysisHeadlineInsight,
  analysisWorkspaceCopy,
  buyerFlowSteps,
  displayEmptyMetric,
  resolveAnalysisNextStep,
  sellerFlowSteps,
  type AnalysisFlowStep,
  type AnalysisRoleView,
} from "@/lib/panel/analysis-signal";

type RangeDays = 7 | 30 | 90;

function rangeDates(days: RangeDays) {
  const to = new Date();
  const from = new Date(Date.now() - days * 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string | null;
  icon: React.ReactNode;
}) {
  const shown = displayEmptyMetric(value);
  return (
    <div className="talepo-analysis-metric">
      <div className="flex items-center gap-2 text-[#0f766e]/70">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p
        className="mt-3 text-[1.65rem] font-semibold tabular-nums tracking-[-0.03em] text-[#0f1f1d]"
        aria-label={`${label}: ${shown}`}
      >
        {shown}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-[#0f1f1d]/45">{hint}</p>
      ) : null}
    </div>
  );
}

function EmptyAction({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white/80 px-5 py-6">
      <h3 className="text-base font-semibold text-[#0f1f1d]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#0f1f1d]/55">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#0f766e] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40"
      >
        {cta}
      </Link>
    </div>
  );
}

function CommercialIntelligenceMark() {
  return (
    <span className="talepo-analysis-pro-mark" aria-hidden>
      <svg viewBox="0 0 32 32" width="18" height="18" fill="none">
        <path
          d="M5 23.5h22"
          stroke="currentColor"
          strokeOpacity="0.32"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M7 19.5 13.2 14.2 17.8 17.1 25 10"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="25" cy="10" r="1.85" fill="currentColor" />
      </svg>
    </span>
  );
}

function ProfessionalChamber({
  eyebrow,
  title,
  description,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="talepo-analysis-pro"
      aria-label="Profesyonel Ticari Performans Zekâsı"
    >
      <div className="talepo-analysis-pro-banner relative px-5 py-4 sm:px-6">
        <div className="talepo-my-requests-banner-grid" aria-hidden />
        <div className="talepo-my-requests-banner-glow" aria-hidden />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="flex min-w-0 max-w-2xl gap-3">
            <CommercialIntelligenceMark />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-amber-100/85">
                {eyebrow}
              </p>
              <h2 className="mt-1.5 text-[1.25rem] font-semibold tracking-[-0.03em] text-[#fffbeb] sm:text-[1.4rem]">
                {title}
              </h2>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-amber-50/70 sm:text-[14px]">
                {description}
              </p>
            </div>
          </div>
          {aside ? (
            <div className="flex w-full min-w-0 flex-col gap-3 lg:w-[16.75rem] lg:shrink-0">
              {aside}
            </div>
          ) : null}
        </div>
      </div>
      <div className="talepo-analysis-pro-body space-y-5 px-5 py-5 sm:px-6">
        {children}
      </div>
    </section>
  );
}

function completionRateDisplay(
  advanced: CommercialPerformanceMetrics,
  submitted: number,
): string {
  return formatWinRateValue({
    accepted: advanced.completedFromSubmittedCohort,
    submitted,
    winRate: advanced.completionRate,
    winRatePresentation: advanced.completionRatePresentation,
  });
}

function FlowChart({
  title,
  summary,
  steps,
}: {
  title: string;
  summary: string;
  steps: AnalysisFlowStep[];
}) {
  const max = Math.max(...steps.map((step) => step.value), 1);
  const empty = steps.every((step) => step.value === 0);
  if (empty) return null;

  return (
    <section className="rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white/80 p-5">
      <h3 className="text-base font-semibold text-[#0f1f1d]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[#0f1f1d]/50">{summary}</p>
      <ul className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40"
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-[#0f1f1d]">{step.label}</span>
                <span className="tabular-nums text-[#0f1f1d]/70">{step.value}</span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#0f1f1d]/6"
                aria-hidden
              >
                <div
                  className="talepo-analysis-flow-bar h-full rounded-full bg-[#0f766e]"
                  style={{ width: `${Math.max(8, (step.value / max) * 100)}%` }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProfessionalLockedSection() {
  return (
    <ProfessionalChamber
      eyebrow="Profesyonel"
      title="Profesyonel ile Ticari Performans Zekâsı"
      description="Temel Analiz tüm planlarda açıktır. Profesyonel, tamamlanan işlemlerinizden ticaret hacmi, pazarlık ve kategori sonuçlarını gösterir. Kilitli alanda sahte sayı yok."
      aside={
        <>
          <div className="talepo-my-requests-summary">
            <p className="text-[13px] leading-5 text-amber-50/88">
              Bu oda yalnız Profesyonel planında açılır. Sayı uydurulmaz.
            </p>
          </div>
          <Link
            href="/panel/plan"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#f4fbf9] px-4 text-sm font-semibold text-[#0c1d1a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Profesyonel ile aç
          </Link>
        </>
      }
    >
      <ul className="grid gap-2 text-sm text-[#0f1f1d]/75 sm:grid-cols-2">
        <li className="talepo-analysis-pro-tile">Tamamlanan ticaret hacmi</li>
        <li className="talepo-analysis-pro-tile">Pazarlık performansı</li>
        <li className="talepo-analysis-pro-tile">Kategori performansı</li>
        <li className="talepo-analysis-pro-tile">Gerçek veriden içgörüler</li>
        <li className="talepo-analysis-pro-tile">
          Kaynak performansı (Radar / Takiplerim / Fırsatlar)
        </li>
        <li className="talepo-analysis-pro-tile">
          Teklif Zekâsı görüntüleme özeti
        </li>
      </ul>
    </ProfessionalChamber>
  );
}

function ProfessionalCommerceSection({
  advanced,
  submitted,
  accepted,
  rangeDays,
}: {
  advanced: CommercialPerformanceMetrics;
  submitted: number;
  accepted: number;
  rangeDays: RangeDays;
}) {
  const hasOffers = submitted > 0;
  const hasCompleted = advanced.completedDeals > 0;
  const eligibleCategories = advanced.categories.filter(
    (row) => row.submitted > 0,
  );
  const showCategoryTable = eligibleCategories.some(
    (row) => row.rankEligible || row.submitted >= 3,
  );
  const chamberInsight = !hasOffers
    ? "İlk teklif bu odayı doldurur."
    : accepted === 0
      ? "Kabul edilen teklif henüz yok."
      : hasCompleted
        ? `Son ${rangeDays} günde ${advanced.completedDeals} tamamlanan işlem.`
        : "Tamamlanan işlem bekleniyor.";

  return (
    <ProfessionalChamber
      eyebrow="Profesyonel · Ticari Performans Zekâsı"
      title="Nerede kazanıyorsunuz, nerede kaybediyorsunuz?"
      description={`Kazanma oranı teklifin gönderim tarihine, tamamlanan hacim ise işlemin tamamlanma tarihine göre hesaplanır (son ${rangeDays} gün). Bu nedenle iki değer aynı teklif grubunu temel almaz.`}
      aside={
        <div className="talepo-my-requests-summary">
          <p className="text-[13px] leading-5 text-amber-50/88">
            {chamberInsight}
          </p>
        </div>
      }
    >
      {!hasOffers ? (
        <EmptyAction
          title="İlk teklifinizi verin"
          body="Gönderilen teklifler oluştukça ticari performans özeti burada görünür."
          href="/panel/talepler"
          cta="Talepler"
        />
      ) : null}

      {hasOffers && accepted === 0 ? (
        <EmptyAction
          title="Henüz kabul edilen teklifiniz yok"
          body="Kabul edilen teklifler oluştukça kazanma oranı burada güçlenir."
          href="/panel/talepler"
          cta="Talepler"
        />
      ) : null}

      {hasOffers && accepted > 0 && !hasCompleted ? (
        <EmptyAction
          title="Tamamlanan işlem bekleniyor"
          body="Tamamlanan işlemler oluştukça ticaret hacminiz burada görünür."
          href="/panel/teklifler"
          cta="Tekliflerim"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Tamamlanan işlem"
          value={advanced.completedDeals}
          hint="İki tarafın da onayladığı; tamamlanma tarihine göre"
          icon={<Target className="h-4 w-4" />}
        />
        <MetricCard
          label="Tamamlanma oranı"
          value={completionRateDisplay(advanced, submitted)}
          hint={`Dönemde gönderilen tekliflerden tamamlanan: ${advanced.completedFromSubmittedCohort} / ${submitted}`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        {advanced.mixedCurrency ? (
          <MetricCard
            label="Gerçekleşen ticaret hacmi"
            value="Karışık"
            hint="Birden fazla para birimi var; tek toplam gösterilmiyor"
            icon={<BarChart3 className="h-4 w-4" />}
          />
        ) : (
          <MetricCard
            label="Gerçekleşen ticaret hacmi"
            value={
              advanced.primaryVolume
                ? formatMoneyAmount(
                    advanced.primaryVolume.totalAgreedAmount,
                    advanced.primaryVolume.currency,
                  )
                : "Veri yok"
            }
            hint={
              hasCompleted
                ? "Yalnız bilateral tamamlanan DealOutcome.agreedPrice"
                : "Tamamlanan işlem yok"
            }
            icon={<BarChart3 className="h-4 w-4" />}
          />
        )}
        <MetricCard
          label="Ort. anlaşma tutarı"
          value={
            advanced.primaryVolume?.averageAgreedAmount != null
              ? formatMoneyAmount(
                  advanced.primaryVolume.averageAgreedAmount,
                  advanced.primaryVolume.currency,
                )
              : "Veri yok"
          }
          hint={
            advanced.mixedCurrency
              ? "Para birimleri ayrı listelenir"
              : "Tamamlanan işlemlerin ortalama agreedPrice değeri"
          }
          icon={<Target className="h-4 w-4" />}
        />
        <MetricCard
          label="Doğrudan kabul"
          value={advanced.directCompleted}
          hint="Pazarlıksız tamamlanan işlem"
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          label="Pazarlıklı tamamlanan"
          value={advanced.negotiatedCompleted}
          hint="Kabul edilmiş karşı teklif içeren"
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          label="İlk teklif → anlaşma farkı"
          value={
            formatRelativePriceDelta(advanced.negotiationPriceDelta) ??
            "Veri yok"
          }
          hint={
            advanced.negotiationPriceDeltaSample > 0
              ? `Pazarlıklı tamamlanan ${advanced.negotiationPriceDeltaSample} işlem ortalaması`
              : "Pazarlıklı tamamlanan işlem yok"
          }
          icon={<Target className="h-4 w-4" />}
        />
      </div>

      {advanced.mixedCurrency && advanced.volumesByCurrency.length > 0 ? (
        <div className="rounded-2xl border border-[#0f1f1d]/8 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#0f1f1d]">
            Para birimine göre hacim
          </h3>
          <p className="mt-1 text-xs text-[#0f1f1d]/45">
            Farklı para birimleri toplanmaz; kur çevrimi yapılmaz.
          </p>
          <ul className="mt-3 space-y-2">
            {advanced.volumesByCurrency.map((row) => (
              <li
                key={row.currency}
                className="flex items-center justify-between text-sm text-[#0f1f1d]"
              >
                <span>
                  {row.currency} · {row.dealCount} işlem
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoneyAmount(row.totalAgreedAmount, row.currency)}
                  {row.averageAgreedAmount != null
                    ? ` · ort. ${formatMoneyAmount(row.averageAgreedAmount, row.currency)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {advanced.insights.length > 0 ? (
        <div className="rounded-2xl border border-[#0f1f1d]/8 bg-[#f7faf9] p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0f766e]" />
            <h3 className="text-base font-semibold text-[#0f1f1d]">
              Talepo İçgörüleri
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {advanced.insights.map((insight) => (
              <li
                key={insight.id}
                className="rounded-xl border border-[#0f1f1d]/6 bg-white px-3 py-2.5 text-sm leading-6 text-[#0f1f1d]/80"
              >
                {insight.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-[#0f1f1d]">
            Teklif Zekâsı etkisi
          </h3>
          <p className="mt-1 text-xs text-[#0f1f1d]/45">
            Yalnız gerçekten açılmış Teklif Zekâsı sonuçları. Plan kilidi veya
            yetersiz örnek ekranı exposure sayılmaz. Bu bir nedensellik iddiası
            değildir.
          </p>
        </div>
        {advanced.intelligenceAssistance.exposedOffers === 0 ? (
          <p className="text-sm text-[#0f1f1d]/55">
            Bu dönemde görüntülenen Teklif Zekâsı kaydı yok.
          </p>
        ) : (
          <div className="rounded-2xl border border-[#0f1f1d]/8 bg-white p-4">
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[10px] uppercase text-[#0f1f1d]/45">
                  Görüntülenen teklif
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#0f1f1d]">
                  {advanced.intelligenceAssistance.exposedOffers}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-[#0f1f1d]/45">
                  Kabul
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#0f1f1d]">
                  {advanced.intelligenceAssistance.accepted}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-[#0f1f1d]/45">
                  Tamamlanan
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#0f1f1d]">
                  {advanced.intelligenceAssistance.completed}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-[#0f1f1d]/50">
              Kazanma:{" "}
              {displayEmptyMetric(
                formatWinRateValue({
                  accepted: advanced.intelligenceAssistance.accepted,
                  submitted: advanced.intelligenceAssistance.exposedOffers,
                  winRate: advanced.intelligenceAssistance.winRate,
                  winRatePresentation:
                    advanced.intelligenceAssistance.winRatePresentation,
                }),
              )}
            </p>
            {advanced.intelligenceAssistance.primaryVolume ? (
              <p className="mt-1 text-xs text-[#0f1f1d]/55">
                Bu tekliflerden başlayan tamamlanmış işlemler:{" "}
                {formatMoneyAmount(
                  advanced.intelligenceAssistance.primaryVolume
                    .totalAgreedAmount,
                  advanced.intelligenceAssistance.primaryVolume.currency,
                )}
              </p>
            ) : advanced.intelligenceAssistance.mixedCurrency ? (
              <p className="mt-1 text-xs text-[#0f1f1d]/45">
                Birden fazla para birimi. Tek toplam yok.
              </p>
            ) : null}
            <p className="mt-2 text-[11px] text-[#0f1f1d]/40">
              Görüntülenmeyen tekliflerle karşılaştırma bu sürümde yok; geçmiş
              eligibility güvenilir biçimde yeniden kurulamıyor.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-[#0f1f1d]">
            Talepo sana nereden iş getiriyor?
          </h3>
          <p className="mt-1 text-xs text-[#0f1f1d]/45">
            Yalnız teklif oluşturulurken doğrulanmış ürün kaynağı. Sonradan
            Radar&apos;a giren talepler eski teklifleri değiştirmez. Kaynak
            bilinmeyen teklifler burada listelenmez.
          </p>
        </div>
        {advanced.sourcePerformance.length === 0 ? (
          <p className="text-sm text-[#0f1f1d]/55">
            Henüz yeterli kaynak verisi yok. Radar, Takiplerim, Fırsatlar veya
            Talepler üzerinden teklif verdikçe burada görünür.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {advanced.sourcePerformance.map((row) => (
              <div
                key={row.source}
                className="rounded-2xl border border-[#0f1f1d]/8 bg-white p-4"
              >
                <p className="text-sm font-semibold text-[#0f1f1d]">{row.label}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-[10px] uppercase text-[#0f1f1d]/45">
                      Teklif
                    </dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-[#0f1f1d]">
                      {row.submitted}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-[#0f1f1d]/45">
                      Kabul
                    </dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-[#0f1f1d]">
                      {row.accepted}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-[#0f1f1d]/45">
                      Tamamlanan
                    </dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-[#0f1f1d]">
                      {row.completed}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-[#0f1f1d]/50">
                  Kazanma:{" "}
                  {displayEmptyMetric(
                    formatWinRateValue({
                      accepted: row.accepted,
                      submitted: row.submitted,
                      winRate: row.winRate,
                      winRatePresentation: row.winRatePresentation,
                    }),
                  )}
                </p>
                {row.primaryVolume ? (
                  <p className="mt-1 text-xs text-[#0f1f1d]/55">
                    Bu kaynaktan başlayan tamamlanmış işlemler:{" "}
                    {formatMoneyAmount(
                      row.primaryVolume.totalAgreedAmount,
                      row.primaryVolume.currency,
                    )}
                  </p>
                ) : row.mixedCurrency ? (
                  <p className="mt-1 text-xs text-[#0f1f1d]/45">
                    Birden fazla para birimi. Tek toplam yok.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-[#0f1f1d]">
          Kategori performansı
        </h3>
        {!showCategoryTable ? (
          <p className="text-sm text-[#0f1f1d]/55">
            Daha fazla işlem verisi oluştuğunda kategori karşılaştırması açılır.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#0f1f1d]/8 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#0f1f1d]/8 text-xs uppercase tracking-wide text-[#0f1f1d]/45">
                <tr>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 font-semibold">Teklif</th>
                  <th className="px-4 py-3 font-semibold">Kabul</th>
                  <th className="px-4 py-3 font-semibold">Tamamlanan</th>
                  <th className="px-4 py-3 font-semibold">Kazanma</th>
                </tr>
              </thead>
              <tbody>
                {eligibleCategories.slice(0, 5).map((row) => (
                  <tr
                    key={row.categoryId}
                    className="border-b border-[#0f1f1d]/5 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-[#0f1f1d]">
                      {row.categoryName}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.submitted}</td>
                    <td className="px-4 py-3 tabular-nums">{row.accepted}</td>
                    <td className="px-4 py-3 tabular-nums">{row.completed}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {displayEmptyMetric(
                        formatWinRateValue({
                          accepted: row.accepted,
                          submitted: row.submitted,
                          winRate: row.winRate,
                          winRatePresentation: row.winRatePresentation,
                        }),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#0f1f1d]/8 bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0f1f1d]">
          Güven özeti (ömür boyu)
        </h3>
        <p className="mt-1 text-xs text-[#0f1f1d]/45">
          Yalnız görünür değerlendirmeler. Seçilen 7/30/90 gün penceresinden
          bağımsızdır.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-[#0f1f1d]/45">
              Tamamlanan işlem
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-[#0f1f1d]">
              {advanced.trust.completedTransactions}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-[#0f1f1d]/45">
              Görünür değerlendirme
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-[#0f1f1d]">
              {advanced.trust.reviewCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-[#0f1f1d]/45">Ortalama puan</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-[#0f1f1d]">
              {advanced.trust.averageRating != null
                ? advanced.trust.averageRating.toFixed(1)
                : "Veri yok"}
            </dd>
          </div>
        </dl>
      </div>
    </ProfessionalChamber>
  );
}

export function AnalyticsDashboard({
  planLabel,
  workspaceKind,
  children,
}: {
  planLabel: string;
  workspaceKind: "user" | "company";
  children?: ReactNode;
}) {
  const [range, setRange] = useState<RangeDays>(30);
  const [role, setRole] = useState<AnalysisRoleView>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<WorkspacePerformanceMetrics | null>(
    null,
  );
  const [advanced, setAdvanced] = useState<CommercialPerformanceMetrics | null>(
    null,
  );
  const [advancedAvailable, setAdvancedAvailable] = useState(false);
  const tablistId = useId();

  const load = useCallback(async (days: RangeDays) => {
    setLoading(true);
    setError(null);
    const { from, to } = rangeDates(days);
    try {
      const response = await fetch(
        `/api/monetization/analytics?type=performance&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        metrics?: WorkspacePerformanceMetrics;
        advanced?: CommercialPerformanceMetrics | null;
        advancedAvailable?: boolean;
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "Analiz alınamadı.");
      setMetrics(data.metrics ?? null);
      setAdvancedAvailable(Boolean(data.advancedAvailable));
      setAdvanced(data.advancedAvailable ? (data.advanced ?? null) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiz alınamadı.");
      setMetrics(null);
      setAdvanced(null);
      setAdvancedAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remote analytics snapshot
    void load(range);
  }, [load, range]);

  const offers = metrics?.offers;
  const requests = metrics?.requests;
  const isCompany = metrics?.scope === "company" || workspaceKind === "company";
  const hasRequestData = (requests?.published ?? 0) > 0;
  const hasOfferData = (offers?.submitted ?? 0) > 0;
  const showPersonalEmpty =
    metrics?.scope === "personal" && !hasRequestData && !hasOfferData && !loading;
  const showCompanyEmpty = isCompany && !hasOfferData && !loading && !error;
  const workspaceLabel = analysisWorkspaceCopy({
    kind: metrics?.scope === "company" ? "company" : workspaceKind,
    companyName: metrics?.companyName ?? null,
  });
  const insight = analysisHeadlineInsight(metrics, range);
  const nextStep = resolveAnalysisNextStep(metrics);
  const buyerFlow = metrics ? buyerFlowSteps(metrics) : null;
  const sellerFlow = metrics
    ? sellerFlowSteps(
        metrics,
        advancedAvailable ? (advanced?.negotiatedCompleted ?? null) : null,
      )
    : null;

  const visibleTabs = useMemo(
    () =>
      ANALYSIS_ROLE_TABS.filter(
        (tab) => tab.id !== "buyer" || metrics?.scope !== "company",
      ),
    [metrics?.scope],
  );

  const activeRole: AnalysisRoleView =
    metrics?.scope === "company" && role === "buyer" ? "overview" : role;

  return (
    <>
      <header className="talepo-my-requests-banner relative px-5 py-4 sm:px-8 sm:py-5 lg:px-9 lg:py-6">
        <div className="talepo-my-requests-banner-grid" aria-hidden />
        <div className="talepo-my-requests-banner-glow" aria-hidden />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 max-w-xl">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#c8f4eb]">
              PERFORMANS MERKEZİ
            </p>
            <p className="mt-1.5 text-[1.5rem] font-semibold tracking-[-0.03em] text-[#f4fbf9] sm:text-[1.75rem]">
              Analiz
            </p>
            <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-[#d7ece7] sm:text-[15px]">
              İşlerin nasıl gittiğini ve sonraki adımı tek bakışta görün.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="talepo-analysis-chip">{planLabel}</span>
              <span className="talepo-analysis-chip">{workspaceLabel}</span>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-[19.5rem] lg:shrink-0">
            <div
              className="talepo-my-requests-summary"
              aria-live="polite"
            >
              <p className="text-[13px] leading-5 text-[#e7f3f0]">
                {loading ? "Metrikler yükleniyor..." : insight}
              </p>
            </div>
            <Link
              href={nextStep.href}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#f4fbf9] px-4 text-sm font-semibold text-[#0c1d1a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {nextStep.cta}
            </Link>
          </div>
        </div>
      </header>

      <div className="talepo-beacon-body relative space-y-6 px-5 py-5 sm:px-8 sm:py-6 lg:px-9">

      <div className="flex flex-wrap items-center gap-2">
        {([7, 30, 90] as RangeDays[]).map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={range === days}
            onClick={() => setRange(days)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40 ${
              range === days
                ? "bg-[#0f1f1d] text-white"
                : "border border-[#0f1f1d]/10 bg-white text-[#0f1f1d]/70 hover:bg-white"
            }`}
          >
            Son {days} gün
          </button>
        ))}
      </div>

      {loading ? (
        <div
          className="grid min-h-[7.25rem] gap-3 sm:grid-cols-2 lg:grid-cols-4"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Metrikler yükleniyor...</span>
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={slot}
              className="talepo-analysis-metric animate-pulse bg-[#0f1f1d]/4"
            />
          ))}
          <div className="col-span-full flex items-center gap-2 text-sm text-[#0f1f1d]/50">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Metrikler yükleniyor...
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p>{error}</p>
          <p className="mt-1 text-rose-800/80">
            Veriler şu anda okunamıyor. Sayfayı yenilemeden tekrar deneyin.
          </p>
          <button
            type="button"
            onClick={() => void load(range)}
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-rose-800 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            Yeniden dene
          </button>
        </div>
      ) : null}

      {showPersonalEmpty ? (
        <EmptyAction
          title="Bu dönemde henüz hareket yok"
          body="Analiz, yayınladığınız talepler ve gönderdiğiniz tekliflerden oluşur."
          href="/talep"
          cta="Talep oluştur"
        />
      ) : null}

      {showPersonalEmpty ? (
        <EmptyAction
          title="Teklif performansı"
          body="Açık taleplere teklif verdiğinizde kazanma oranınız burada görünür."
          href="/panel/talepler"
          cta="Talepler"
        />
      ) : null}

      {showCompanyEmpty ? (
        <EmptyAction
          title="Bu dönemde gönderilmiş teklif yok"
          body="Şirket teklif performansı, çalışma alanındaki gönderilmiş tekliflerden hesaplanır."
          href="/panel/talepler"
          cta="Talepler"
        />
      ) : null}

      {metrics && !loading && !error ? (
        <div
          role="tablist"
          aria-label="Alıcı ve satıcı görünümü"
          id={tablistId}
          className="flex flex-wrap gap-2"
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeRole === tab.id}
              className="talepo-analysis-tab min-h-11 rounded-full border border-[#0f1f1d]/10 bg-white px-4 text-sm font-semibold text-[#0f1f1d]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40"
              onClick={() => setRole(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {metrics && !loading && !error && activeRole === "overview" && !showPersonalEmpty && !showCompanyEmpty ? (
        <section aria-labelledby="analysis-overview-heading" className="space-y-4">
          <h2 id="analysis-overview-heading" className="text-lg font-semibold text-[#0f1f1d]">
            Genel görünüm
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.scope === "personal" && requests ? (
              <MetricCard
                label="Yayınlanan talepler"
                value={requests.published}
                hint="Alıcı olarak, yayın tarihine göre"
                icon={<FileText className="h-4 w-4" />}
              />
            ) : null}
            <MetricCard
              label="Gönderilen teklif"
              value={offers?.submitted ?? 0}
              hint="Satıcı olarak, gönderim tarihine göre"
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <MetricCard
              label="Kazanma oranı"
              value={offers ? formatWinRateValue(offers) : "Veri yok"}
              hint={offers ? formatWinRateHint(offers) : null}
              icon={<Target className="h-4 w-4" />}
            />
            {metrics.scope === "personal" && requests && requests.withoutOffers > 0 ? (
              <MetricCard
                label="Teklifsiz"
                value={requests.withoutOffers}
                hint="Dikkat: henüz teklif almayan talepler"
                icon={<Inbox className="h-4 w-4" />}
              />
            ) : (
              <MetricCard
                label="Bekleyen"
                value={offers?.pending ?? 0}
                hint="Yanıt bekleyen gönderilmiş teklifler"
                icon={<Inbox className="h-4 w-4" />}
              />
            )}
          </div>
        </section>
      ) : null}

      {metrics?.scope === "personal" &&
      !showPersonalEmpty &&
      !loading &&
      activeRole === "buyer" ? (
        <section className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]/70">
              Talep performansı
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#0f1f1d]">
              Yayınladığınız talepler
            </h2>
          </div>
          {!hasRequestData ? (
            <EmptyAction
              title="Bu dönemde yayınlanmış talebiniz yok"
              body="Talep yayınladığınızda teklif ve sonuç özeti burada görünür."
              href="/talep"
              cta="Talep oluştur"
            />
          ) : requests ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard
                  label="Yayınlanan talepler"
                  value={requests.published}
                  icon={<FileText className="h-4 w-4" />}
                />
                <MetricCard
                  label="Aktif talepler"
                  value={requests.active}
                  icon={<Target className="h-4 w-4" />}
                />
                <MetricCard
                  label="Teklif alan"
                  value={requests.withOffers}
                  icon={<Inbox className="h-4 w-4" />}
                />
                <MetricCard
                  label="Teklifsiz"
                  value={requests.withoutOffers}
                  icon={<Inbox className="h-4 w-4" />}
                />
                <MetricCard
                  label="Alınan teklif"
                  value={requests.totalOffersReceived}
                  icon={<BarChart3 className="h-4 w-4" />}
                />
                <MetricCard
                  label="Ort. teklif / talep"
                  value={
                    requests.averageOffersPerRequest != null
                      ? requests.averageOffersPerRequest
                      : "Veri yok"
                  }
                  icon={<BarChart3 className="h-4 w-4" />}
                />
                <MetricCard
                  label="Kabul ile sonuçlanan"
                  value={requests.acceptedOutcome}
                  icon={<Target className="h-4 w-4" />}
                />
              </div>
              {buyerFlow ? (
                <FlowChart
                  title="Alıcı süreci"
                  summary="Talep, gelen teklif ve kabul. Satıcı sayıları burada yok."
                  steps={buyerFlow}
                />
              ) : null}
              {requests.withoutOffers > 0 ? (
                <p className="text-sm text-[#0f1f1d]/60">
                  {requests.withoutOffers} talebiniz henüz teklif almadı.{" "}
                  <Link
                    href="/panel/taleplerim"
                    className="font-semibold text-[#0f766e] underline"
                  >
                    Taleplerim
                  </Link>
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {metrics &&
      !showPersonalEmpty &&
      !showCompanyEmpty &&
      !loading &&
      activeRole === "seller" ? (
        <section className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]/70">
              {isCompany ? "Şirket teklif performansı" : "Teklif performansı"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#0f1f1d]">
              {isCompany
                ? metrics.companyName
                  ? `${metrics.companyName} teklifleri`
                  : "Firma teklifleri"
                : "Gönderdiğiniz teklifler"}
            </h2>
          </div>
          {!hasOfferData ? (
            <EmptyAction
              title="Bu dönemde gönderilmiş teklif yok"
              body="Açık taleplere teklif verdiğinizde kabul ve kazanma özeti burada görünür."
              href="/panel/talepler"
              cta="Talepler"
            />
          ) : offers ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard
                  label="Gönderilen teklif"
                  value={offers.submitted}
                  icon={<BarChart3 className="h-4 w-4" />}
                />
                <MetricCard
                  label="Kabul edilen"
                  value={offers.accepted}
                  icon={<Target className="h-4 w-4" />}
                />
                <MetricCard
                  label="Tamamlanan işlemler"
                  value={offers.completedTransactions}
                  hint="İki tarafın da onayladığı işlemler"
                  icon={<Target className="h-4 w-4" />}
                />
                <MetricCard
                  label="Bekleyen"
                  value={offers.pending}
                  icon={<Inbox className="h-4 w-4" />}
                />
                <MetricCard
                  label="Reddedilen"
                  value={offers.rejected}
                  icon={<FileText className="h-4 w-4" />}
                />
                <MetricCard
                  label="Sonuçsuz"
                  value={offers.unsuccessful}
                  hint="Süresi dolan veya geri çekilen"
                  icon={<FileText className="h-4 w-4" />}
                />
                <MetricCard
                  label="Kazanma oranı"
                  value={formatWinRateValue(offers)}
                  hint={formatWinRateHint(offers)}
                  icon={<Target className="h-4 w-4" />}
                />
                {offers.averageOfferLatencyHours != null ? (
                  <MetricCard
                    label="Ort. teklif verme süresi"
                    value={`${offers.averageOfferLatencyHours} sa`}
                    hint="Talep yayınından teklif gönderimine"
                    icon={<Clock className="h-4 w-4" />}
                  />
                ) : null}
              </div>
              {sellerFlow ? (
                <FlowChart
                  title="Satıcı süreci"
                  summary="Gönderilen teklif, bekleyen yanıt ve tamamlanan işlem. Alıcı sayıları burada yok."
                  steps={sellerFlow}
                />
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {!loading && metrics && activeRole !== "buyer" ? (
        advancedAvailable && advanced ? (
          <ProfessionalCommerceSection
            advanced={advanced}
            submitted={offers?.submitted ?? 0}
            accepted={offers?.accepted ?? 0}
            rangeDays={range}
          />
        ) : (
          <ProfessionalLockedSection />
        )
      ) : null}

      {children}

      <p className="text-xs text-[#0f1f1d]/40">
        {isCompany
          ? "Metrikler seçili firma çalışma alanı ve tarih aralığında, gönderim tarihine göre hesaplanır."
          : "Metrikler kişisel hesabınız ve seçilen tarih aralığında, gönderim / yayın tarihine göre hesaplanır."}{" "}
        Kazanma oranı, dönemde gönderilen tekliflerin şu an kabul edilen payıdır.
        Tamamlanan işlemler, aynı dönemde iki tarafça onaylanan kayıtlardır; kabul
        ile aynı şey değildir.
      </p>
      </div>
    </>
  );
}

export function BasicMarketInsights({
  requestCount,
  averageBudget,
  insufficientData,
}: {
  requestCount: number;
  averageBudget: number | null;
  insufficientData: boolean;
}) {
  if (insufficientData) {
    return (
      <section className="rounded-[1.5rem] border border-[#0f1f1d]/8 bg-white/80 p-6">
        <h2 className="text-lg font-semibold text-[#0f1f1d]">Platform özeti</h2>
        <p className="mt-2 text-sm text-[#0f1f1d]/55">
          Son 30 günde anonim yayınlanan talep sayısı henüz yeterli değil (
          {requestCount} talep).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border border-[#0f1f1d]/8 bg-white p-6">
      <h2 className="text-lg font-semibold text-[#0f1f1d]">Platform özeti</h2>
      <p className="mt-1 text-sm text-[#0f1f1d]/50">
        Son 30 günde yayınlanan taleplerin anonim toplu özeti. Talep bütçesi
        ortalamasıdır; piyasa fiyatı veya Price Intelligence değildir.
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase text-[#0f1f1d]/45">
            Yayınlanan talep
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-[#0f1f1d]">
            {requestCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[#0f1f1d]/45">
            Ort. talep bütçesi
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-[#0f1f1d]">
            {averageBudget != null
              ? `${averageBudget.toLocaleString("tr-TR")} ₺`
              : "Veri yok"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
