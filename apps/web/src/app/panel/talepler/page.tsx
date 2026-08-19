import Link from "next/link";
import { ArrowRight, PencilLine } from "lucide-react";

import { ExploreAutoRefresh } from "@/components/panel/ExploreAutoRefresh";
import { ExploreCategoryFilterBar } from "@/components/panel/ExploreCategoryFilterBar";
import { ExploreFilterUpsell } from "@/components/panel/ExploreFilterUpsell";
import { ExploreRequestCard } from "@/components/panel/ExploreRequestCard";
import { InterestCategoryPicker } from "@/components/panel/InterestCategoryPicker";
import {
  ExploreTabLink,
  PanelExploreHome,
} from "@/components/panel/explore/PanelExploreHome";
import { ExploreLocationFilterFields } from "@/components/panel/explore/ExploreLocationFilterFields";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import {
  evaluateDiscoveryFilter,
  hasCanonicalFilterSignal,
  parseDiscoveryProjection,
  validateCanonicalDiscoveryFilter,
  type CanonicalDiscoveryFilter,
} from "@/lib/discovery";
import {
  appendExploreFilterParams,
  buildExploreFilterWhere,
  hasActiveAdvancedOnlyFilters,
  hasActiveExploreFilters,
  parseExploreFilters,
  stripAdvancedExploreFilters,
} from "@/lib/explore/category-filters";
import { parseInterestSlugs } from "@/lib/explore/interest-categories";
import { buildSupplierVisibilityFilter } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { assessCompanyProfileReadiness } from "@/lib/monetization/company-profile-readiness";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { attributedRequestDetailHref } from "@/server/offer/attributed-request-href";
import { batchMatchCompanyRequests } from "@/server/monetization/batch-matching";
import { ensureEngineCategories } from "@/server/company/sync-company-categories";
import { backfillMatchesForCompany } from "@/server/request/distribute-request";

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
  discoveryProjection: true,
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
  discoveryProjection?: unknown;
  category: { name: string; slug: string };
  _count: { offers: number };
  matchScore?: number | null;
  matchReason?: string | null;
  matchReasons?: string[] | null;
  discoveryMatchPath?: string | null;
};

/** Phase 3A — URL-derived canonical filter (URL is not SoT). */
function parseCanonicalFilterFromParams(
  params: Record<string, string | undefined>,
): CanonicalDiscoveryFilter | null {
  const leaf = params.taxonomyLeaf?.trim();
  const node = params.taxonomyNode?.trim();
  const leafExact = params.leafExact === "1" || params.leafExact === "true";
  if (!leaf && !node) return null;

  const raw: Record<string, unknown> = {
    version: 1,
    kind: "canonical_discovery_filter",
  };
  if (leaf) {
    raw.primaryLeafId = leaf;
    if (leafExact) raw.leafExact = true;
  }
  if (node) raw.taxonomyNodeIds = [node];

  const brand = params.brand?.trim();
  const excludedBrand = params.excludedBrand?.trim();
  if (brand || excludedBrand) {
    raw.attributes = brand ? { brand } : undefined;
    if (excludedBrand) raw.excluded = { brand: [excludedBrand] };
  }

  const validated = validateCanonicalDiscoveryFilter(raw);
  return validated.ok ? validated.filter : null;
}

function applyCanonicalDiscoveryPostFilter(
  rows: RequestRow[],
  filter: CanonicalDiscoveryFilter | null,
): RequestRow[] {
  if (!filter || !hasCanonicalFilterSignal(filter)) return rows;
  const out: RequestRow[] = [];
  for (const row of rows) {
    const projection = parseDiscoveryProjection(row.discoveryProjection);
    const result = evaluateDiscoveryFilter(projection, filter);
    if (!result.match) continue;
    out.push({
      ...row,
      discoveryMatchPath: result.path,
      matchReasons: [
        ...(row.matchReasons ?? []),
        result.path,
        ...result.reasons.slice(0, 2),
      ],
    });
  }
  return out;
}

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
  const editingInterests = params.edit === "1";
  const canonicalExploreFilter = parseCanonicalFilterFromParams(params);
  const taxonomyLeaf = params.taxonomyLeaf?.trim() || undefined;
  const taxonomyNode = params.taxonomyNode?.trim() || undefined;
  const leafExact = params.leafExact === "1" || params.leafExact === "true";

  await ensureEngineCategories();

  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const visibilityFilter = buildSupplierVisibilityFilter(entitlements);
  const hasUrgentPriority = entitlements.features.urgent_request_priority;
  const hasAdvancedFilters = entitlements.features.advanced_filters;
  const hasSmartMatching = entitlements.features.smart_matching;
  const hasSavedSearches = entitlements.features.saved_searches;
  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const companyMeta = companyId
    ? await prisma.company.findFirst({
        where: { id: companyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          city: true,
          description: true,
          _count: { select: { categories: true } },
        },
      })
    : null;

  const profileReadiness = companyMeta
    ? assessCompanyProfileReadiness({
        city: companyMeta.city,
        description: companyMeta.description,
        categoryCount: companyMeta._count.categories,
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
    !hasAdvancedFilters && hasActiveAdvancedOnlyFilters(rawExploreFilters);
  const filterWhere = buildExploreFilterWhere(exploreFilters);
  const filtersActive = hasActiveExploreFilters(exploreFilters);
  const cityFilter = exploreFilters.city;
  const districtFilter = exploreFilters.district;

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

  // Phase 3A — taxonomy/constraint post-filter (legacy rows without projection stay via LEGACY_FALLBACK)
  requests = applyCanonicalDiscoveryPostFilter(
    requests,
    canonicalExploreFilter,
  );

  if (hasSmartMatching && companyId && requests.length > 0) {
    const matchMap = await batchMatchCompanyRequests(
      companyId,
      requests.map((r) => r.id),
    );
    requests = requests.map((row) => {
      const preview = matchMap.get(row.id);
      if (!preview) return row;
      return {
        ...row,
        matchScore: preview.score,
        matchReasons: preview.reasons,
        matchReason: preview.reasons[0] ?? row.matchReason,
      };
    });
    if (tab === "matched") {
      requests.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
    }
  }

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

  const editInterestsHref = (() => {
    const q = new URLSearchParams();
    q.set("edit", "1");
    if (interestSlugs.length > 0) {
      q.set("interest", interestSlugs.join(","));
    }
    return `/panel/talepler?${q.toString()}`;
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
      if (districtFilter) q.set("district", districtFilter);
      if (params.q?.trim()) q.set("q", params.q.trim());
    }
    const s = q.toString();
    return s ? `/panel/talepler?${s}` : "/panel/talepler";
  };

  return (
    <>
      <ExploreAutoRefresh enabled={tab === "newest"} />
      <PanelExploreHome
        matchedCount={matchedCount}
        matchedHref={tabHref("matched")}
        showInterestPicker={showInterestPicker}
        tabs={
          <>
            <ExploreTabLink href={tabHref("matched")} active={tab === "matched"}>
              Size uygun
              {!showInterestPicker && matchedCount > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    tab === "matched"
                      ? "bg-white/15 text-white"
                      : "bg-teal-700/10 text-teal-900"
                  }`}
                >
                  {matchedCount}
                </span>
              ) : null}
            </ExploreTabLink>
            <ExploreTabLink href={tabHref("all")} active={tab === "all"}>
              Tümü
            </ExploreTabLink>
            <ExploreTabLink href={tabHref("newest")} active={tab === "newest"}>
              En yeniler
              {tab === "newest" ? (
                <span
                  className="talepo-beacon-unread-dot"
                  aria-hidden
                />
              ) : null}
            </ExploreTabLink>
          </>
        }
      >
        {tab === "all" && (
          <div className="mb-5 space-y-3">
            <form
              method="get"
              className="flex flex-col gap-2 rounded-[1.35rem] border border-[#0f1f1d]/10 bg-white/80 p-3 sm:flex-row sm:items-end"
            >
              <input type="hidden" name="tab" value="all" />
              {params.q?.trim() ? (
                <input type="hidden" name="q" value={params.q.trim()} />
              ) : null}
              <label className="flex-1 text-xs font-semibold text-[#0f1f1d]/45">
                Kategori
                <select
                  name="category"
                  defaultValue={categoryFilter}
                  className="mt-1 h-11 w-full rounded-xl border border-[#0f1f1d]/10 bg-white px-3 text-sm text-[#0f1f1d] outline-none focus:border-[#0f1f1d]/30"
                >
                  <option value="">Tüm kategoriler</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <ExploreLocationFilterFields
                key={`${cityFilter}|${districtFilter}`}
                initialCities={cityFilter}
                initialDistricts={districtFilter}
              />
              <button
                type="submit"
                className="h-11 rounded-xl bg-[#0f1f1d] px-5 text-sm font-semibold text-white transition hover:bg-black"
              >
                Filtrele
              </button>
            </form>

            {hasAdvancedFilters && !categoryFilter ? (
              <form
                method="get"
                className="rounded-[1.35rem] border border-[#0f1f1d]/10 bg-white/80 p-3"
              >
                <input type="hidden" name="tab" value="all" />
                {cityFilter ? (
                  <input type="hidden" name="city" value={cityFilter} />
                ) : null}
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0f766e]">
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
                      className="mt-1 h-10 w-full rounded-xl border border-[#0f1f1d]/10 bg-white px-3 text-sm text-[#0f1f1d] outline-none focus:border-teal-600/50"
                    />
                  </label>
                  <label className="min-w-[7rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[9rem]">
                    Max bütçe (₺)
                    <TrMoneyInput
                      name="budgetMax"
                      defaultValue={allExploreFilters.advanced.budgetMax}
                      placeholder="ör. 500.000"
                      className="mt-1 h-10 w-full rounded-xl border border-[#0f1f1d]/10 bg-white px-3 text-sm text-[#0f1f1d] outline-none focus:border-teal-600/50"
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
                      className="mt-1 h-10 w-full rounded-xl border border-[#0f1f1d]/10 bg-white px-3 text-sm text-[#0f1f1d] outline-none focus:border-teal-600/50"
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
                    className="h-10 rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white transition hover:bg-black"
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
                  ...(districtFilter ? { district: districtFilter } : {}),
                  ...(taxonomyLeaf ? { taxonomyLeaf } : {}),
                  ...(taxonomyNode ? { taxonomyNode } : {}),
                  ...(leafExact ? { leafExact: "1" } : {}),
                }}
                clearHref={`/panel/talepler?tab=all&category=${encodeURIComponent(categoryFilter)}${cityFilter ? `&city=${encodeURIComponent(cityFilter)}` : ""}${districtFilter ? `&district=${encodeURIComponent(districtFilter)}` : ""}`}
                advancedFiltersEnabled={hasAdvancedFilters}
                showUrgentFilter={hasUrgentPriority}
                savedSearchesEnabled={hasSavedSearches}
                city={cityFilter}
                taxonomyLeaf={taxonomyLeaf}
                taxonomyNode={taxonomyNode}
                leafExact={leafExact}
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
              <span className="text-xs font-medium text-[#0f1f1d]/45">
                İlgi alanlarınız
              </span>
              {interestLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[#0f1f1d]/8 bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#0f1f1d]"
                >
                  {label}
                </span>
              ))}
              <Link
                href={editInterestsHref}
                className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-teal-800 hover:underline"
              >
                <PencilLine className="h-3.5 w-3.5" />
                Değiştir
              </Link>
            </div>
            <ExploreCategoryFilterBar
              interestOptions={interestOptions}
              filters={exploreFilters}
              hiddenFields={{
                ...(districtFilter ? { district: districtFilter } : {}),
                ...(taxonomyLeaf ? { taxonomyLeaf } : {}),
                ...(taxonomyNode ? { taxonomyNode } : {}),
                ...(leafExact ? { leafExact: "1" } : {}),
              }}
              clearHref={clearMatchedFiltersHref}
              advancedFiltersEnabled={hasAdvancedFilters}
              showUrgentFilter={hasUrgentPriority}
              savedSearchesEnabled={hasSavedSearches}
              city={cityFilter}
              taxonomyLeaf={taxonomyLeaf}
              taxonomyNode={taxonomyNode}
                leafExact={leafExact}
            />
            {hasSmartMatching && profileReadiness && !profileReadiness.ready ? (
              <div className="mb-4 rounded-[1.25rem] border border-[#0f1f1d]/8 bg-white/80 px-4 py-3 text-sm text-[#0f1f1d]/75">
                Akıllı eşleştirme için firma profilinizi tamamlayın:{" "}
                {profileReadiness.missing.join(", ")}.{" "}
                <Link
                  href="/panel/firma"
                  className="font-semibold text-teal-800 underline-offset-2 hover:underline"
                >
                  Firma ayarları
                </Link>
              </div>
            ) : null}
            {advancedFiltersAttempted ? (
              <p className="mb-4 rounded-[1.25rem] border border-[#0f1f1d]/8 bg-white/80 px-3 py-2 text-xs text-[#0f1f1d]/70">
                Gelişmiş filtre parametreleri Profesyonel planda geçerlidir; şu an
                uygulanmadı.
              </p>
            ) : null}
            {hasUrgentPriority ? (
              <p className="mb-4 text-xs font-medium text-[#0f1f1d]/45">
                Acil talepler listenizde öncelikli sıralanır.
              </p>
            ) : null}
          </>
        ) : null}

        {tab === "newest" && requests.length > 0 ? (
          <p className="mb-3 text-xs font-medium text-[#0f1f1d]/45">
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
                  ? editInterestsHref
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
                    href={attributedRequestDetailHref({
                      userId: user.id,
                      requestId: request.id,
                      source: "DISCOVERY",
                    })}
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
                    matchReason={hasSmartMatching ? request.matchReason : null}
                    matchReasons={
                      hasSmartMatching ? (request.matchReasons ?? null) : null
                    }
                    matchScore={
                      hasSmartMatching ? (request.matchScore ?? null) : null
                    }
                    emphasizeTime={tab === "newest"}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </PanelExploreHome>
    </>
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
    <div className="rounded-[1.35rem] border border-[rgba(15,118,110,0.14)] bg-white px-6 py-10 text-center">
      <EmptyIllustration variant={variant} />
      <p className="mt-5 text-xl font-semibold tracking-tight text-[#0f1f1d]">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#0f1f1d]/48">
        {body}
      </p>
      <Link
        href={actionHref}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115e59]"
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
