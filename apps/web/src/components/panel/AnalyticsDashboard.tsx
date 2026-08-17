"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Clock,
  FileText,
  Inbox,
  LoaderCircle,
  Target,
} from "lucide-react";

import {
  formatWinRateHint,
  formatWinRateValue,
} from "@/lib/monetization/performance-metrics";
import type { WorkspacePerformanceMetrics } from "@/lib/monetization/types";

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

export function AnalyticsDashboard() {
  const [range, setRange] = useState<RangeDays>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<WorkspacePerformanceMetrics | null>(
    null,
  );

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
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "Analiz alınamadı.");
      setMetrics(data.metrics ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiz alınamadı.");
      setMetrics(null);
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
