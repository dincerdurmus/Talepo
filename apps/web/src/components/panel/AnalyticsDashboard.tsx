"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  return (
    <div className="rounded-2xl border border-teal-900/8 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-teal-800/60">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-teal-950">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-teal-950/45">{hint}</p>
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
    <div className="rounded-[24px] border border-teal-900/8 bg-teal-50/40 px-5 py-6">
      <h3 className="text-base font-semibold text-teal-950">{title}</h3>
      <p className="mt-1 text-sm text-teal-950/55">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline"
      >
        {cta}
      </Link>
    </div>
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

function ProfessionalLockedSection() {
  return (
    <section className="rounded-[28px] border border-rose-200/70 bg-gradient-to-br from-rose-50/80 via-white to-violet-50/50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-rose-100/80 p-2 text-rose-700">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700/70">
            Professional
          </p>
          <h2 className="mt-1 text-xl font-semibold text-teal-950">
            Professional ile Ticari Performans Zekâsı
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-950/60">
            Temel Analiz tüm planlarda açıktır. Professional, tamamlanan
            işlemlerinizden ticaret hacmi, pazarlık ve kategori sonuçlarını
            gösterir.
          </p>
        </div>
      </div>
      <ul className="mt-5 grid gap-2 text-sm text-teal-950/70 sm:grid-cols-2">
        <li className="rounded-xl border border-teal-900/6 bg-white/70 px-3 py-2">
          Tamamlanan ticaret hacmi
        </li>
        <li className="rounded-xl border border-teal-900/6 bg-white/70 px-3 py-2">
          Pazarlık performansı
        </li>
        <li className="rounded-xl border border-teal-900/6 bg-white/70 px-3 py-2">
          Kategori performansı
        </li>
        <li className="rounded-xl border border-teal-900/6 bg-white/70 px-3 py-2">
          Gerçek veriden içgörüler
        </li>
      </ul>
      <Link
        href="/panel/plan"
        className="mt-5 inline-flex rounded-full bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-800"
      >
        Professional ile aç
      </Link>
    </section>
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

  return (
    <section className="space-y-6 rounded-[28px] border border-rose-200/60 bg-gradient-to-br from-rose-50/50 via-white to-violet-50/40 p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700/70">
          Professional · Ticari Performans Zekâsı
        </p>
        <h2 className="mt-1 text-xl font-semibold text-teal-950">
          Nerede kazanıyorsunuz, nerede kaybediyorsunuz?
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-teal-950/55">
          Kazanma oranı gönderim tarihine göre; tamamlanan hacim ise işlem
          tamamlanma tarihine göre hesaplanır (son {rangeDays} gün). Bunlar
          aynı cohort değildir.
        </p>
      </div>

      {!hasOffers ? (
        <EmptyAction
          title="İlk teklifinizi verin"
          body="Gönderilen teklifler oluştukça ticari performans özeti burada görünür."
          href="/panel/talepler"
          cta="Talepleri keşfet"
        />
      ) : null}

      {hasOffers && accepted === 0 ? (
        <EmptyAction
          title="Henüz kabul edilen teklifiniz yok"
          body="Kabul edilen teklifler oluştukça kazanma oranı burada güçlenir."
          href="/panel/talepler"
          cta="Talepleri keşfet"
        />
      ) : null}

      {hasOffers && accepted > 0 && !hasCompleted ? (
        <EmptyAction
          title="Tamamlanan işlem bekleniyor"
          body="Tamamlanan işlemler oluştukça ticaret hacminiz burada görünür."
          href="/panel/gelen-teklifler"
          cta="Tekliflere git"
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            value="—"
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
                : "—"
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
              : advanced.mixedCurrency
                ? "—"
                : "—"
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
            formatRelativePriceDelta(advanced.negotiationPriceDelta) ?? "—"
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
        <div className="rounded-2xl border border-teal-900/8 bg-white/80 p-4">
          <h3 className="text-sm font-semibold text-teal-950">
            Para birimine göre hacim
          </h3>
          <p className="mt-1 text-xs text-teal-950/45">
            Farklı para birimleri toplanmaz; kur çevrimi yapılmaz.
          </p>
          <ul className="mt-3 space-y-2">
            {advanced.volumesByCurrency.map((row) => (
              <li
                key={row.currency}
                className="flex items-center justify-between text-sm text-teal-950"
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
        <div className="rounded-2xl border border-rose-200/50 bg-white/90 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-700" />
            <h3 className="text-base font-semibold text-teal-950">
              Talepo İçgörüleri
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {advanced.insights.map((insight) => (
              <li
                key={insight.id}
                className="rounded-xl border border-teal-900/6 bg-teal-50/40 px-3 py-2.5 text-sm leading-6 text-teal-950/80"
              >
                {insight.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-teal-950">
          Kategori performansı
        </h3>
        {!showCategoryTable ? (
          <p className="text-sm text-teal-950/55">
            Daha fazla işlem verisi oluştuğunda kategori karşılaştırması açılır.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-teal-900/8 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-teal-900/8 text-xs uppercase tracking-wide text-teal-950/45">
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
                    className="border-b border-teal-900/5 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-teal-950">
                      {row.categoryName}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.submitted}</td>
                    <td className="px-4 py-3 tabular-nums">{row.accepted}</td>
                    <td className="px-4 py-3 tabular-nums">{row.completed}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatWinRateValue({
                        accepted: row.accepted,
                        submitted: row.submitted,
                        winRate: row.winRate,
                        winRatePresentation: row.winRatePresentation,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-teal-900/8 bg-white/80 p-4">
        <h3 className="text-sm font-semibold text-teal-950">
          Güven özeti (ömür boyu)
        </h3>
        <p className="mt-1 text-xs text-teal-950/45">
          Yalnız görünür değerlendirmeler. Seçilen 7/30/90 gün penceresinden
          bağımsızdır.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-teal-950/45">
              Tamamlanan işlem
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-teal-950">
              {advanced.trust.completedTransactions}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-teal-950/45">
              Görünür değerlendirme
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-teal-950">
              {advanced.trust.reviewCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-teal-950/45">Ortalama puan</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-teal-950">
              {advanced.trust.averageRating != null
                ? advanced.trust.averageRating.toFixed(1)
                : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function AnalyticsDashboard() {
  const [range, setRange] = useState<RangeDays>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<WorkspacePerformanceMetrics | null>(
    null,
  );
  const [advanced, setAdvanced] = useState<CommercialPerformanceMetrics | null>(
    null,
  );
  const [advancedAvailable, setAdvancedAvailable] = useState(false);

  const load = useCallback(async (days: RangeDays) => {
    setLoading(true);
    setError(null);
    const { from, to } = rangeDates(days);
    try {
      const response = await fetch(
        `/api/monetization/analytics?type=performance&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
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
    void load(range);
  }, [load, range]);

  const offers = metrics?.offers;
  const requests = metrics?.requests;
  const isCompany = metrics?.scope === "company";
  const hasRequestData = (requests?.published ?? 0) > 0;
  const hasOfferData = (offers?.submitted ?? 0) > 0;
  const showPersonalEmpty =
    metrics?.scope === "personal" && !hasRequestData && !hasOfferData && !loading;
  const showCompanyEmpty = isCompany && !hasOfferData && !loading;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {([7, 30, 90] as RangeDays[]).map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={range === days}
            onClick={() => setRange(days)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              range === days
                ? "bg-teal-900 text-white"
                : "border border-teal-900/10 bg-white text-teal-900/70 hover:bg-teal-50"
            }`}
          >
            Son {days} gün
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-teal-950/50">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Metrikler yükleniyor...
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
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
          cta="Talepleri keşfet"
        />
      ) : null}

      {showCompanyEmpty ? (
        <EmptyAction
          title="Bu dönemde gönderilmiş teklif yok"
          body="Şirket teklif performansı, çalışma alanındaki gönderilmiş tekliflerden hesaplanır."
          href="/panel/talepler"
          cta="Talepleri keşfet"
        />
      ) : null}

      {metrics?.scope === "personal" && !showPersonalEmpty ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/45">
              Talep performansı
            </p>
            <h2 className="mt-1 text-lg font-semibold text-teal-950">
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      : "—"
                  }
                  icon={<BarChart3 className="h-4 w-4" />}
                />
                <MetricCard
                  label="Kabul ile sonuçlanan"
                  value={requests.acceptedOutcome}
                  icon={<Target className="h-4 w-4" />}
                />
              </div>
              {requests.withoutOffers > 0 ? (
                <p className="text-sm text-teal-950/60">
                  {requests.withoutOffers} talebiniz henüz teklif almadı.{" "}
                  <Link
                    href="/panel/taleplerim"
                    className="font-semibold text-teal-800 underline"
                  >
                    Taleplerim
                  </Link>
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {metrics && !showPersonalEmpty && !showCompanyEmpty ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/45">
              {isCompany ? "Şirket teklif performansı" : "Teklif performansı"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-teal-950">
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
              cta="Talepleri keşfet"
            />
          ) : offers ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          ) : null}
        </section>
      ) : null}

      {!loading && metrics ? (
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

      <p className="text-xs text-teal-950/40">
        {isCompany
          ? "Metrikler seçili firma çalışma alanı ve tarih aralığında, gönderim tarihine göre hesaplanır."
          : "Metrikler kişisel hesabınız ve seçilen tarih aralığında, gönderim / yayın tarihine göre hesaplanır."}
        {" "}
        Kazanma oranı, dönemde gönderilen tekliflerin şu an kabul edilen payıdır.
        Tamamlanan işlemler, aynı dönemde iki tarafça onaylanan kayıtlardır; kabul ile aynı şey değildir.
      </p>
    </div>
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
      <section className="rounded-[24px] border border-teal-900/8 bg-teal-50/40 p-6">
        <h2 className="text-lg font-semibold text-teal-950">Platform özeti</h2>
        <p className="mt-2 text-sm text-teal-950/55">
          Son 30 günde anonim yayınlanan talep sayısı henüz yeterli değil (
          {requestCount} talep).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-teal-900/8 bg-white p-6">
      <h2 className="text-lg font-semibold text-teal-950">Platform özeti</h2>
      <p className="mt-1 text-sm text-teal-950/50">
        Son 30 günde yayınlanan taleplerin anonim toplu özeti. Talep bütçesi
        ortalamasıdır; piyasa fiyatı veya Price Intelligence değildir.
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase text-teal-950/45">
            Yayınlanan talep
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-teal-950">
            {requestCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-teal-950/45">
            Ort. talep bütçesi
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-teal-950">
            {averageBudget != null
              ? `${averageBudget.toLocaleString("tr-TR")} ₺`
              : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
