import Link from "next/link";
import { Search, X } from "lucide-react";

import {
  getExploreFilterDefs,
  getFilterSelectOptions,
  type ParsedExploreFilters,
} from "@/lib/explore/category-filters";

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
}: {
  interestOptions: InterestOption[];
  filters: ParsedExploreFilters;
  hiddenFields?: Record<string, string>;
  clearHref: string;
  className?: string;
}) {
  const focus = filters.focus || interestOptions[0]?.slug || "";
  const defs = getExploreFilterDefs(focus);
  const hasExtra = Boolean(filters.q) || filters.fields.length > 0;
  const showFocusSelect = interestOptions.length > 1;

  const activeByParam = new Map(
    filters.fields.map(({ def, value }) => [def.param, value]),
  );

  return (
    <form
      method="get"
      className={`rounded-2xl border border-teal-900/10 bg-white/80 p-3 shadow-sm ${className}`}
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
            className="h-10 rounded-xl bg-gradient-to-r from-teal-700 to-teal-600 px-4 text-sm font-semibold text-white shadow-sm"
          >
            Filtrele
          </button>
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
    </form>
  );
}
