import Link from "next/link";
import { Search, X } from "lucide-react";

import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import {
  getExploreFilterDefs,
  getFilterSelectOptions,
  hasActiveAdvancedExploreFilters,
  type ParsedExploreFilters,
} from "@/lib/explore/category-filters";

import { ExploreFilterUpsell } from "./ExploreFilterUpsell";
import { SaveExploreSearchButton } from "./SaveExploreSearchButton";

type InterestOption = {
  slug: string;
  name: string;
};

export function ExploreCategoryFilterBar({
  interestOptions,
  filters,
  /** Extra hidden fields (e.g. tab=all) */
  hiddenFields = {},
  clearHref,
  className = "mb-5",
  advancedFiltersEnabled = false,
  showUrgentFilter = false,
  savedSearchesEnabled = false,
  city,
  taxonomyLeaf,
  taxonomyNode,
  leafExact,
}: {
  interestOptions: InterestOption[];
  filters: ParsedExploreFilters;
  hiddenFields?: Record<string, string>;
  clearHref: string;
  className?: string;
  advancedFiltersEnabled?: boolean;
  /** Show "Sadece acil" when user has urgent priority (Professional+) */
  showUrgentFilter?: boolean;
  /** Enable save-search button (saved_searches) */
  savedSearchesEnabled?: boolean;
  city?: string;
  taxonomyLeaf?: string;
  taxonomyNode?: string;
  leafExact?: boolean;
}) {
  const focus = filters.focus || interestOptions[0]?.slug || "";
  const defs = focus ? getExploreFilterDefs(focus) : [];
  const hasExtra = Boolean(filters.q) || hasActiveAdvancedExploreFilters(filters);
  const showFocusSelect = interestOptions.length > 1;
  const showAdvancedRow = advancedFiltersEnabled;
  const showAdvancedUpsell = !advancedFiltersEnabled && defs.length > 0;

  const activeByParam = new Map(
    filters.fields.map(({ def, value }) => [def.param, value]),
  );

  return (
    <div className={className}>
      <form
        method="get"
        className="rounded-2xl border border-teal-900/10 bg-white/80 p-3 shadow-sm"
      >
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {interestOptions.length > 0 ? (
          <input
            type="hidden"
            name="interest"
            value={interestOptions.map((o) => o.slug).join(",")}
          />
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          {showFocusSelect ? (
            <label className="min-w-[9rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[12rem]">
              Kategori
              <select
                name="focus"
                defaultValue={focus}
                className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
              >
                {interestOptions.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          ) : focus ? (
            <input type="hidden" name="focus" value={focus} />
          ) : null}

          <label className="min-w-[12rem] flex-[2] text-xs font-semibold text-teal-900/55">
            Ara
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-teal-800/40" />
              <input
                name="q"
                defaultValue={filters.q}
                placeholder="Başlık veya açıklama"
                className="h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600/50"
              />
            </span>
          </label>

          {defs.map((def) => {
            const value = activeByParam.get(def.param) ?? "";
            if (def.input === "select") {
              const options = getFilterSelectOptions(focus, def.fieldKey);
              return (
                <label
                  key={def.param}
                  className="min-w-[8rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[11rem]"
                >
                  {def.label}
                  <select
                    name={def.param}
                    defaultValue={value}
                    className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
                  >
                    <option value="">Tümü</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            return (
              <label
                key={def.param}
                className="min-w-[7rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[10rem]"
              >
                {def.label}
                <input
                  name={def.param}
                  type={def.input === "number" ? "number" : "text"}
                  inputMode={def.input === "number" ? "numeric" : undefined}
                  defaultValue={value}
                  placeholder={def.placeholder}
                  className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
                />
              </label>
            );
          })}

          <div className="flex gap-2">
            <button
              type="submit"
              className="h-10 rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115e59]"
            >
              Filtrele
            </button>
            {savedSearchesEnabled ? (
              <SaveExploreSearchButton
                filters={filters}
                categorySlug={focus || undefined}
                city={city}
                taxonomyLeaf={taxonomyLeaf}
                taxonomyNode={taxonomyNode}
                leafExact={leafExact}
                enabled
              />
            ) : null}
            {hasExtra ? (
              <Link
                href={clearHref}
                className="inline-flex h-10 items-center gap-1 rounded-xl border border-teal-900/10 bg-white px-3 text-sm font-semibold text-teal-900/70 hover:bg-teal-50"
              >
                <X className="h-3.5 w-3.5" />
                Temizle
              </Link>
            ) : null}
          </div>
        </div>

        {showAdvancedRow ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-teal-900/8 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
            {showUrgentFilter ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-teal-900/70">
                <input
                  type="checkbox"
                  name="urgent"
                  value="1"
                  defaultChecked={filters.advanced.urgentOnly}
                  className="h-4 w-4 rounded border-teal-900/20 text-teal-700"
                />
                Sadece acil talepler
              </label>
            ) : null}
            <label className="min-w-[7rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[9rem]">
              Min bütçe (₺)
              <TrMoneyInput
                name="budgetMin"
                defaultValue={filters.advanced.budgetMin}
                placeholder="ör. 10.000"
                className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
              />
            </label>
            <label className="min-w-[7rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[9rem]">
              Max bütçe (₺)
              <TrMoneyInput
                name="budgetMax"
                defaultValue={filters.advanced.budgetMax}
                placeholder="ör. 500.000"
                className="mt-1 h-10 w-full rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 text-sm outline-none focus:border-teal-600/50"
              />
            </label>
            <label className="min-w-[8rem] flex-1 text-xs font-semibold text-teal-900/55 sm:max-w-[10rem]">
              Yayın tarihi
              <select
                name="since"
                defaultValue={
                  filters.advanced.sinceDays != null
                    ? String(filters.advanced.sinceDays)
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
          </div>
        ) : null}
      </form>

      {!advancedFiltersEnabled && !showAdvancedUpsell ? <ExploreFilterUpsell /> : null}
      {showAdvancedUpsell ? (
        <ExploreFilterUpsell compact />
      ) : null}
    </div>
  );
}
