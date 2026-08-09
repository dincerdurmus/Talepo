import Link from "next/link";
import type { ReactNode } from "react";
import { Fraunces, Manrope } from "next/font/google";
import { ArrowRight, PencilLine } from "lucide-react";

import { ExploreAutoRefresh } from "@/components/panel/ExploreAutoRefresh";
import { ExploreCategoryFilterBar } from "@/components/panel/ExploreCategoryFilterBar";
import { ExploreFilterUpsell } from "@/components/panel/ExploreFilterUpsell";
import { ExploreRequestCard } from "@/components/panel/ExploreRequestCard";
import { InterestCategoryPicker } from "@/components/panel/InterestCategoryPicker";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import {
  appendExploreFilterParams,
  buildExploreFilterWhere,
  hasActiveAdvancedExploreFilters,
  hasActiveExploreFilters,
  parseExploreFilters,
  stripAdvancedExploreFilters,
} from "@/lib/explore/category-filters";
import { parseInterestSlugs } from "@/lib/explore/interest-categories";
import { buildSupplierVisibilityFilter } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { formatQuotaRemaining } from "@/lib/membership/serialize";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { ensureEngineCategories } from "@/server/company/sync-company-categories";
import { backfillMatchesForCompany } from "@/server/request/distribute-request";

const exploreDisplay = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-explore-display",
});

const exploreSans = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-explore-sans",
});

type ExploreTab = "matched" | "all" | "newest";

function parseExploreTab(raw: string | undefined): ExploreTab {
  if (raw === "all") return "all";
  if (raw === "newest") return "newest";
  return "matched";
}

const requestListSelect = {
  id: true,
  title: true,
  city: true,
  isUrgent: true,
  isFeatured: true,
  publishedAt: true,
  createdAt: true,
  coverImageUrl: true,
  aiSummary: true,
  description: true,
  budgetMin: true,
  budgetMax: true,
  currency: true,
  category: { select: { name: true, slug: true } },
  _count: { select: { offers: true } },
} as const;

type RequestRow = {
  id: string;
  title: string;
  city: string | null;
  isUrgent: boolean;
  isFeatured: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  coverImageUrl: string | null;
  aiSummary: string | null;
  description: string;
  budgetMin: { toString(): string } | null;
  budgetMax: { toString(): string } | null;
  currency: string;
  category: { name: string; slug: string };
  _count: { offers: number };
  matchScore?: number | null;
  matchReason?: string | null;
};

const OPEN_STATUSES = ["PUBLISHED", "RECEIVING_OFFERS"] as [
  "PUBLISHED",
  "RECEIVING_OFFERS",
];

export default async function ExploreRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = parseExploreTab(params.tab);
  const categoryFilter = params.category?.trim() || "";
  const cityFilter = params.city?.trim() || "";
  const editingInterests = params.edit === "1";

  await ensureEngineCategories();

  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const visibilityFilter = buildSupplierVisibilityFilter(entitlements);
  const hasUrgentPriority = entitlements.features.urgent_request_priority;
  const hasAdvancedFilters = entitlements.features.advanced_filters;
  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const companyMeta = companyId
    ? await prisma.company.findFirst({
        where: { id: companyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          city: true,
        },
      })
    : null;

  if (companyMeta) {
    await backfillMatchesForCompany(companyMeta.id);
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Interests are URL-only (`?interest=...`) — leaving the page clears them.
  const interestSlugs = parseInterestSlugs(params.interest);
  const interestCategories = categories.filter((c) =>
    interestSlugs.includes(c.slug),
  );
  const interestCategoryIds = interestCategories.map((c) => c.id);
  const showInterestPicker =
    tab === "matched" && (editingInterests || interestSlugs.length === 0);

  const rawExploreFilters = parseExploreFilters(params, interestSlugs);
  const exploreFilters = hasAdvancedFilters
    ? rawExploreFilters
    : stripAdvancedExploreFilters(rawExploreFilters);
  const advancedFiltersAttempted =
    !hasAdvancedFilters && hasActiveAdvancedExploreFilters(rawExploreFilters);
  const filterWhere = buildExploreFilterWhere(exploreFilters);
  const filtersActive = hasActiveExploreFilters(exploreFilters);

  const allFilterSlugs = categoryFilter ? [categoryFilter] : ([] as string[]);
  const rawAllFilters = parseExploreFilters(params, allFilterSlugs);
  const allExploreFilters = hasAdvancedFilters
    ? rawAllFilters
    : stripAdvancedExploreFilters(rawAllFilters);
  const allFilterWhere = buildExploreFilterWhere(allExploreFilters);

  const focusCategoryId = categories.find(
    (c) => c.slug === exploreFilters.focus,
  )?.id;
  // Narrow to focused category when field filters or explicit focus are set.
  const scopeMatchedToFocus =
    Boolean(params.focus?.trim()) || exploreFilters.fields.length > 0;
  const matchedCategoryIds =
    scopeMatchedToFocus && focusCategoryId
      ? [focusCategoryId]
      : interestCategoryIds;

  const baseWhere = {
    deletedAt: null,
    createdById: { not: user.id },
    status: { in: OPEN_STATUSES },
    ...visibilityFilter,
  };

  let requests: RequestRow[] = [];
  let matchedCount = 0;

  if (!showInterestPicker && interestCategoryIds.length > 0) {
    matchedCount = await prisma.request.count({
      where: {
        ...baseWhere,
        categoryId: { in: interestCategoryIds },
      },
    });
  }

  if (tab === "matched" && !showInterestPicker && interestCategoryIds.length > 0) {
    const matchedRequestWhere = {
      ...baseWhere,
      categoryId: { in: matchedCategoryIds },
      ...filterWhere,
    };

    if (companyId) {
      const matches = await prisma.requestMatch.findMany({
        where: {
          companyId,
          request: matchedRequestWhere,
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: 50,
        include: {
          request: {
            select: requestListSelect,
          },
        },
      });

      if (matches.length > 0) {
        requests = matches
          .map((row) => ({
            ...row.request,
            matchScore: row.score,
            matchReason: row.matchReason,
          }))
          .sort((a, b) => {
            if (hasUrgentPriority && a.isUrgent !== b.isUrgent) {
              return a.isUrgent ? -1 : 1;
            }
            if (a.isFeatured !== b.isFeatured) {
              return a.isFeatured ? -1 : 1;
            }
            return (b.matchScore ?? 0) - (a.matchScore ?? 0);
          });
      }
    }

    if (requests.length === 0) {
      const rows = await prisma.request.findMany({
        where: matchedRequestWhere,
        orderBy: hasUrgentPriority
          ? [
              { isUrgent: "desc" },
              { isFeatured: "desc" },
              { publishedAt: "desc" },
            ]
          : [{ isFeatured: "desc" }, { publishedAt: "desc" }],
        take: 50,
        select: requestListSelect,
      });
      requests = rows.map((row) => ({
        ...row,
        matchReason: "Seçtiğiniz kategori",
      }));
    }
  } else if (tab === "all") {
    const categoryId = categoryFilter
      ? categories.find(
          (c) => c.slug === categoryFilter || c.id === categoryFilter,
        )?.id
      : undefined;

    const rows = await prisma.request.findMany({
      where: {
        ...baseWhere,
        ...(categoryId ? { categoryId } : {}),
        ...(cityFilter
          ? { city: { contains: cityFilter, mode: "insensitive" as const } }
          : {}),
        ...allFilterWhere,
      },
      orderBy: hasUrgentPriority
        ? [
            { isUrgent: "desc" },
            { isFeatured: "desc" },
            { publishedAt: "desc" },
          ]
        : [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      take: 50,
      select: requestListSelect,
    });

    requests = rows;
  } else if (tab === "newest") {
    const rows = await prisma.request.findMany({
      where: baseWhere,
      orderBy: hasUrgentPriority
        ? [
            { isUrgent: "desc" },
            { isFeatured: "desc" },
            { publishedAt: "desc" },
            { createdAt: "desc" },
          ]
        : [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: requestListSelect,
    });
    requests = rows;
  }

  const remainingLabel = formatQuotaRemaining(entitlements.quota);
  const interestLabels = interestCategories.map((c) => c.name);
  const interestOptions = interestCategories.map((c) => ({
    slug: c.slug,
    name: c.name,
  }));

  const clearMatchedFiltersHref = (() => {
    const q = new URLSearchParams();
    if (interestSlugs.length > 0) {
      q.set("interest", interestSlugs.join(","));
    }
    const s = q.toString();
    return s ? `/panel/talepler?${s}` : "/panel/talepler";
  })();

  const tabHref = (next: ExploreTab) => {
    const q = new URLSearchParams();
    if (next === "all") q.set("tab", "all");
    if (next === "newest") q.set("tab", "newest");
    if (next === "matched" && interestSlugs.length > 0) {
      appendExploreFilterParams(q, exploreFilters, interestSlugs);
    }
    if (next === "all") {
      if (categoryFilter) q.set("category", categoryFilter);
      if (cityFilter) q.set("city", cityFilter);
      if (params.q?.trim()) q.set("q", params.q.trim());
    }
    const s = q.toString();
    return s ? `/panel/talepler?${s}` : "/panel/talepler";
  };

  return (
    <div
      className={`${exploreDisplay.variable} ${exploreSans.variable} font-[family-name:var(--font-explore-sans)]`}
    >
      <ExploreAutoRefresh enabled={tab === "newest"} />
      <section className="relative overflow-hidden py-4 sm:py-6">
        <div className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-[#9ae89a]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-8 h-32 w-32 rounded-full bg-[#ffe08a]/25 blur-3xl" />

        <p className="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/70">
          Keşfet
        </p>
        <div className="relative mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-explore-display)] text-3xl font-semibold tracking-[-0.03em] text-[#0f3d38] sm:text-4xl">
              Size yakışan talepler
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#3d5c57]">
              Kategorilerinize göre fırsatlar burada. Kendi talepleriniz{" "}
              <Link
                href="/panel/taleplerim"
                className="font-semibold text-teal-800 underline-offset-2 hover:underline"
              >
                Taleplerim
              </Link>
              ’de.
            </p>
          </div>
          <p className="rounded-full bg-teal-700/10 px-3 py-1.5 text-xs font-medium text-teal-900">
            {entitlements.planLabel} · {remainingLabel} teklif
            {companyMeta ? ` · ${companyMeta.name}` : ""}
          </p>
        </div>

        <div className="relative mt-6 flex gap-1 border-b border-teal-900/10">
          <TabLink href={tabHref("matched")} active={tab === "matched"}>
            Size uygun
            {!showInterestPicker && matchedCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-teal-700/15 px-1.5 py-0.5 text-[11px] text-teal-900">
                {matchedCount}
              </span>
            ) : null}
          </TabLink>
          <TabLink href={tabHref("all")} active={tab === "all"}>
            Tümü
          </TabLink>
          <TabLink href={tabHref("newest")} active={tab === "newest"}>
            En yeniler
            {tab === "newest" ? (
              <span className="ml-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            ) : null}
          </TabLink>
        </div>
      </section>

      <section className="pb-10">
        {tab === "all" && (
          <div className="mb-5 space-y-3">
            <form
              method="get"
              className="flex flex-col gap-2 rounded-2xl border border-teal-900/10 bg-white/80 p-3 shadow-sm sm:flex-row sm:items-end"
            >
              <input type="hidden" name="tab" value="all" />
              {params.q?.trim() ? (
                <input type="hidden" name="q" value={params.q.trim()} />
              ) : null}
              <label className="flex-1 text-xs font-semibold text-teal-900/55">
                Kategori
                <select
                  name="category"
                  defaultValue={categoryFilter}
                  className="mt-1 h-11 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
                >
                  <option value="">Tüm kategoriler</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1 text-xs font-semibold text-teal-900/55">
                Şehir
                <input
                  name="city"
                  defaultValue={cityFilter}
                  placeholder="ör. İstanbul"
                  className="mt-1 h-11 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
                />
              </label>
              <button
                type="submit"
                className="h-11 rounded-xl bg-[#0f766e] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115e59]"
              >
                Filtrele
              </button>
            </form>

            {hasAdvancedFilters && !categoryFilter ? (
              <form
                method="get"
                className="rounded-2xl border border-teal-900/10 bg-white/80 p-3 shadow-sm"
              >
                <input type="hidden" name="tab" value="all" />
                {cityFilter ? (
                  <input type="hidden" name="city" value={cityFilter} />
                ) : null}
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-800/60">
                  Gelişmiş filtreler
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  {hasUrgentPriority ? (
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-teal-900/70">
                      <input
                        type="checkbox"
                        name="urgent"
                        value="1"
                        defaultChecked={allExploreFilters.advanced.urgentOnly}
                        className="h-4 w-4 rounded border-teal-900/20 text-teal-700"
                      />
                      Sadece acil talepler
                    </label>
                  ) : null}
                  <label className="min-w-[7rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[9rem]">
                    Min bütçe (₺)
                    <TrMoneyInput
                      name="budgetMin"
                      defaultValue={allExploreFilters.advanced.budgetMin}
                      placeholder="ör. 10.000"
                      className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
                    />
                  </label>
                  <label className="min-w-[7rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[9rem]">
                    Max bütçe (₺)
                    <TrMoneyInput
                      name="budgetMax"
                      defaultValue={allExploreFilters.advanced.budgetMax}
                      placeholder="ör. 500.000"
                      className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
                    />
                  </label>
                  <label className="min-w-[8rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[10rem]">
                    Yayın tarihi
                    <select
                      name="since"
                      defaultValue={
                        allExploreFilters.advanced.sinceDays != null
                          ? String(allExploreFilters.advanced.sinceDays)
                          : ""
                      }
                      className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
                    >
                      <option value="">Tüm zamanlar</option>
                      <option value="1">Son 24 saat</option>
                      <option value="7">Son 7 gün</option>
                      <option value="30">Son 30 gün</option>
                      <option value="90">Son 90 gün</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="h-10 rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
                  >
                    Uygula
                  </button>
                </div>
              </form>
            ) : !hasAdvancedFilters ? (
              <ExploreFilterUpsell />
            ) : null}

            {categoryFilter ? (
              <ExploreCategoryFilterBar
                interestOptions={categories
                  .filter((c) => c.slug === categoryFilter)
                  .map((c) => ({ slug: c.slug, name: c.name }))}
                filters={allExploreFilters}
                hiddenFields={{
                  tab: "all",
                  category: categoryFilter,
                  ...(cityFilter ? { city: cityFilter } : {}),
                }}
                clearHref={`/panel/talepler?tab=all&category=${encodeURIComponent(categoryFilter)}${cityFilter ? `&city=${encodeURIComponent(cityFilter)}` : ""}`}
                advancedFiltersEnabled={hasAdvancedFilters}
                showUrgentFilter={hasUrgentPriority}
              />
            ) : null}
          </div>
        )}

        {showInterestPicker ? (
          <InterestCategoryPicker
            categories={categories.map((c) => ({
              slug: c.slug,
              name: c.name,
            }))}
            initialSelected={interestSlugs}
          />
        ) : tab === "matched" && interestLabels.length > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-teal-900/50">
                İlgi alanlarınız:
              </span>
              {interestLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-teal-700/10 px-2.5 py-1 text-xs font-semibold text-teal-900"
                >
                  {label}
                </span>
              ))}
              <Link
                href="/panel/talepler"
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline"
              >
                <PencilLine className="h-3.5 w-3.5" />
                Değiştir
              </Link>
            </div>
            <ExploreCategoryFilterBar
              interestOptions={interestOptions}
              filters={exploreFilters}
              clearHref={clearMatchedFiltersHref}
              advancedFiltersEnabled={hasAdvancedFilters}
              showUrgentFilter={hasUrgentPriority}
            />
            {advancedFiltersAttempted ? (
              <p className="mb-4 rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs text-amber-900/80">
                Gelişmiş filtre parametreleri Profesyonel planda geçerlidir; şu an
                uygulanmadı.
              </p>
            ) : null}
            {hasUrgentPriority ? (
              <p className="mb-4 text-xs font-medium text-sky-800/70">
                Acil talepler listenizde öncelikli sıralanır.
              </p>
            ) : null}
          </>
        ) : null}

        {tab === "newest" && requests.length > 0 ? (
          <p className="mb-3 text-xs font-medium text-emerald-800/70">
            En son yayınlanan açık talepler · yaklaşık 20 sn’de bir yenilenir
          </p>
        ) : null}

        {!showInterestPicker && requests.length === 0 ? (
          <EmptyState
            variant={
              tab === "matched" && filtersActive
                ? "search"
                : tab === "newest"
                  ? "requests"
                  : "search"
            }
            title={
              tab === "matched" && filtersActive
                ? "Filtreye uyan talep yok"
                : tab === "matched"
                  ? "Bu kategorilerde henüz açık talep yok"
                  : tab === "newest"
                    ? "Henüz yayınlanmış talep yok"
                    : "Filtreye uyan talep yok"
            }
            body={
              tab === "matched" && filtersActive
                ? "Arama veya kategori filtrelerini gevşeterek tekrar deneyin."
                : tab === "matched"
                  ? "Yeni talepler düştükçe burada görünecek. İsterseniz kategorileri değiştirin veya En yeniler’e bakın."
                  : tab === "newest"
                    ? "Birisi talep yayınladığında anında burada listelenir."
                    : "Kategori, şehir veya alan filtrelerini değiştirerek tekrar deneyin."
            }
            actionHref={
              tab === "matched" && filtersActive
                ? clearMatchedFiltersHref
                : tab === "matched"
                  ? "/panel/talepler?edit=1"
                  : tab === "newest"
                    ? "/panel/talepler"
                    : "/panel/talepler?tab=newest"
            }
            actionLabel={
              tab === "matched" && filtersActive
                ? "Filtreleri temizle"
                : tab === "matched"
                  ? "Kategorileri değiştir"
                  : tab === "newest"
                    ? "Size uygun’a dön"
                    : "En yenilere bak"
            }
          />
        ) : !showInterestPicker ? (
          <ul className="space-y-3">
            {requests.map((request) => {
              const when = request.publishedAt ?? request.createdAt;
              return (
                <li key={request.id}>
                  <ExploreRequestCard
                    href={`/panel/talepler/${request.id}`}
                    title={request.title}
                    categoryName={request.category.name}
                    categorySlug={request.category.slug}
                    city={request.city}
                    coverImageUrl={request.coverImageUrl}
                    summary={request.aiSummary}
                    description={request.description}
                    budgetMin={request.budgetMin}
                    budgetMax={request.budgetMax}
                    currency={request.currency}
                    offerCount={request._count.offers}
                    timeLabel={
                      tab === "newest"
                        ? formatRelativeTime(when)
                        : formatShortDate(when)
                    }
                    isUrgent={request.isUrgent}
                    isFeatured={request.isFeatured}
                    isFresh={tab === "newest" && isFresh(when)}
                    matchReason={
                      tab === "matched" ? request.matchReason : null
                    }
                    matchScore={
                      tab === "matched" ? (request.matchScore ?? null) : null
                    }
                    emphasizeTime={tab === "newest"}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-teal-700 text-teal-900"
          : "border-transparent text-[#6b8681] hover:text-teal-900"
      }`}
    >
      {children}
    </Link>
  );
}

function EmptyState({
  variant = "search",
  title,
  body,
  actionHref,
  actionLabel,
}: {
  variant?: "requests" | "offers" | "search" | "inbox";
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="talepo-card px-6 py-10 text-center">
      <EmptyIllustration variant={variant} />
      <p className="mt-5 font-[family-name:var(--font-explore-display)] text-xl font-semibold text-[#0f3d38]">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5a7a74]">
        {body}
      </p>
      <Link
        href={actionHref}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115e59]"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return formatShortDate(date);
}

function isFresh(date: Date) {
  return Date.now() - date.getTime() < 60 * 60 * 1000;
}
