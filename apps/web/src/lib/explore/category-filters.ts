import type { Prisma } from "@/generated/prisma/client";

import { REQUEST_CATEGORIES } from "@/lib/request-category-engine";

export type ExploreFilterInput = "text" | "select" | "number";

export type ExploreFilterFieldDef = {
  /** URL query param name */
  param: string;
  label: string;
  /** FormField.key on RequestFieldValue */
  fieldKey: string;
  input: ExploreFilterInput;
  placeholder?: string;
  /** Also match request.title containing the value */
  alsoMatchTitle?: boolean;
};

/** Category-specific filters shown on the explore “Size uygun” flow. */
export const CATEGORY_EXPLORE_FILTERS: Record<string, ExploreFilterFieldDef[]> =
  {
    automotive: [
      {
        param: "brand",
        label: "Marka",
        fieldKey: "brand",
        input: "text",
        placeholder: "ör. Mercedes",
        alsoMatchTitle: true,
      },
      {
        param: "model",
        label: "Model",
        fieldKey: "model",
        input: "text",
        placeholder: "ör. C180",
        alsoMatchTitle: true,
      },
      {
        param: "year",
        label: "Yıl",
        fieldKey: "modelYear",
        input: "number",
        placeholder: "ör. 2013",
        alsoMatchTitle: true,
      },
    ],
    "real-estate": [
      {
        param: "listingType",
        label: "İlan türü",
        fieldKey: "listingType",
        input: "select",
      },
      {
        param: "propertyType",
        label: "Konut türü",
        fieldKey: "propertyType",
        input: "select",
      },
      {
        param: "roomCount",
        label: "Oda",
        fieldKey: "roomCount",
        input: "select",
      },
    ],
    furniture: [
      {
        param: "furnitureType",
        label: "Ürün türü",
        fieldKey: "furnitureType",
        input: "select",
      },
      {
        param: "usageArea",
        label: "Kullanım",
        fieldKey: "usageArea",
        input: "select",
      },
    ],
    printing: [
      {
        param: "material",
        label: "Malzeme",
        fieldKey: "material",
        input: "select",
      },
      {
        param: "printType",
        label: "Baskı türü",
        fieldKey: "printType",
        input: "select",
      },
    ],
    machinery: [
      {
        param: "machineType",
        label: "Makine türü",
        fieldKey: "machineType",
        input: "text",
        placeholder: "ör. CNC",
        alsoMatchTitle: true,
      },
      {
        param: "needType",
        label: "İhtiyaç",
        fieldKey: "needType",
        input: "select",
      },
    ],
    technology: [
      {
        param: "needType",
        label: "İhtiyaç",
        fieldKey: "needType",
        input: "select",
      },
      {
        param: "solutionType",
        label: "Çözüm",
        fieldKey: "solutionType",
        input: "text",
        placeholder: "ör. web uygulaması",
        alsoMatchTitle: true,
      },
      {
        param: "platform",
        label: "Platform",
        fieldKey: "platform",
        input: "select",
      },
    ],
    appliances: [
      {
        param: "applianceType",
        label: "Ürün türü",
        fieldKey: "applianceType",
        input: "select",
      },
      {
        param: "brand",
        label: "Marka",
        fieldKey: "brandPreference",
        input: "text",
        placeholder: "ör. Bosch",
        alsoMatchTitle: true,
      },
    ],
    services: [
      {
        param: "serviceType",
        label: "Hizmet",
        fieldKey: "serviceType",
        input: "text",
        placeholder: "ör. nakliye",
        alsoMatchTitle: true,
      },
    ],
  };

export type AdvancedExploreFilters = {
  urgentOnly: boolean;
  budgetMin: number | null;
  budgetMax: number | null;
  /** Published within the last N days */
  sinceDays: number | null;
};

export type ParsedExploreFilters = {
  q: string;
  /** Category slug whose field filters are active / shown */
  focus: string;
  /** Active field filters for the focused category */
  fields: Array<{ def: ExploreFilterFieldDef; value: string }>;
  advanced: AdvancedExploreFilters;
};

const EMPTY_ADVANCED: AdvancedExploreFilters = {
  urgentOnly: false,
  budgetMin: null,
  budgetMax: null,
  sinceDays: null,
};

function parseBudgetParam(raw: string | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseAdvancedExploreFilters(
  params: Record<string, string | undefined>,
): AdvancedExploreFilters {
  const sinceRaw = params.since?.trim() ?? "";
  const sinceDays =
    sinceRaw && /^\d+$/.test(sinceRaw) ? Number(sinceRaw) : null;

  return {
    urgentOnly: params.urgent === "1" || params.urgent === "true",
    budgetMin: parseBudgetParam(params.budgetMin),
    budgetMax: parseBudgetParam(params.budgetMax),
    sinceDays:
      sinceDays != null && sinceDays >= 1 && sinceDays <= 365 ? sinceDays : null,
  };
}

export function getExploreFilterDefs(categorySlug: string): ExploreFilterFieldDef[] {
  return CATEGORY_EXPLORE_FILTERS[categorySlug] ?? [];
}

export function getFilterSelectOptions(
  categorySlug: string,
  fieldKey: string,
): Array<{ label: string; value: string }> {
  const category = REQUEST_CATEGORIES.find((c) => c.id === categorySlug);
  const field = category?.fields.find((f) => f.key === fieldKey);
  return field?.options ?? [];
}

/** Resolve which interest category drives the filter bar. */
export function resolveFilterFocus(
  interestSlugs: string[],
  focusParam: string | undefined,
): string {
  if (interestSlugs.length === 0) return "";
  const focus = focusParam?.trim() ?? "";
  if (focus && interestSlugs.includes(focus)) return focus;
  return interestSlugs[0] ?? "";
}

/**
 * Parse explore filter query params. Only params that belong to the focused
 * category’s filter defs are kept (plus free-text `q`).
 */
export function parseExploreFilters(
  params: Record<string, string | undefined>,
  interestSlugs: string[],
): ParsedExploreFilters {
  const focus = resolveFilterFocus(interestSlugs, params.focus);
  const defs = getExploreFilterDefs(focus);
  const q = params.q?.trim() ?? "";

  const fields: ParsedExploreFilters["fields"] = [];
  for (const def of defs) {
    const raw = params[def.param]?.trim() ?? "";
    if (!raw) continue;
    if (def.input === "number" && !/^\d{2,4}$/.test(raw)) continue;
    fields.push({ def, value: raw });
  }

  return { q, focus, fields, advanced: parseAdvancedExploreFilters(params) };
}

export function hasActiveAdvancedExploreFilters(
  filters: ParsedExploreFilters,
): boolean {
  const { advanced } = filters;
  return (
    advanced.urgentOnly ||
    advanced.budgetMin != null ||
    advanced.budgetMax != null ||
    advanced.sinceDays != null ||
    filters.fields.length > 0
  );
}

export function hasActiveExploreFilters(filters: ParsedExploreFilters): boolean {
  return Boolean(filters.q) || hasActiveAdvancedExploreFilters(filters);
}

/** Strip Professional+ filters when entitlement is missing. */
export function stripAdvancedExploreFilters(
  filters: ParsedExploreFilters,
): ParsedExploreFilters {
  return {
    ...filters,
    fields: [],
    advanced: { ...EMPTY_ADVANCED },
  };
}

function fieldValueWhere(
  def: ExploreFilterFieldDef,
  value: string,
): Prisma.RequestWhereInput {
  const fieldMatch: Prisma.RequestFieldValueWhereInput =
    def.input === "number"
      ? {
          field: { key: def.fieldKey },
          OR: [
            ...(Number.isFinite(Number(value))
              ? [{ numberValue: Number(value) }]
              : []),
            {
              textValue: {
                contains: value,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {
          field: { key: def.fieldKey },
          textValue: {
            contains: value,
            mode: "insensitive" as const,
          },
        };

  const valueClause: Prisma.RequestWhereInput = {
    fieldValues: { some: fieldMatch },
  };

  if (!def.alsoMatchTitle) return valueClause;

  return {
    OR: [
      valueClause,
      { title: { contains: value, mode: "insensitive" as const } },
    ],
  };
}

/**
 * Prisma AND clauses for free-text + category field filters.
 * When field filters are active, caller should also narrow categoryId to focus.
 */
export function buildExploreFilterWhere(
  filters: ParsedExploreFilters,
): Prisma.RequestWhereInput {
  const and: Prisma.RequestWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" as const } },
        {
          description: {
            contains: filters.q,
            mode: "insensitive" as const,
          },
        },
      ],
    });
  }

  for (const { def, value } of filters.fields) {
    and.push(fieldValueWhere(def, value));
  }

  if (filters.advanced.urgentOnly) {
    and.push({ isUrgent: true });
  }

  if (filters.advanced.budgetMin != null) {
    and.push({
      OR: [
        { budgetMax: { gte: filters.advanced.budgetMin } },
        { budgetMin: { gte: filters.advanced.budgetMin } },
      ],
    });
  }

  if (filters.advanced.budgetMax != null) {
    and.push({
      OR: [
        { budgetMin: { lte: filters.advanced.budgetMax } },
        { budgetMax: { lte: filters.advanced.budgetMax } },
      ],
    });
  }

  if (filters.advanced.sinceDays != null) {
    const since = new Date();
    since.setDate(since.getDate() - filters.advanced.sinceDays);
    and.push({
      OR: [
        { publishedAt: { gte: since } },
        { publishedAt: null, createdAt: { gte: since } },
      ],
    });
  }

  if (and.length === 0) return {};
  return { AND: and };
}

/** Append filter params onto an existing URLSearchParams (for tab links). */
export function appendExploreFilterParams(
  q: URLSearchParams,
  filters: ParsedExploreFilters,
  interestSlugs: string[],
) {
  if (interestSlugs.length > 0) {
    q.set("interest", interestSlugs.join(","));
  }
  if (filters.focus && interestSlugs.length > 1) {
    q.set("focus", filters.focus);
  }
  if (filters.q) q.set("q", filters.q);
  for (const { def, value } of filters.fields) {
    q.set(def.param, value);
  }
  if (filters.advanced.urgentOnly) q.set("urgent", "1");
  if (filters.advanced.budgetMin != null) {
    q.set("budgetMin", String(filters.advanced.budgetMin));
  }
  if (filters.advanced.budgetMax != null) {
    q.set("budgetMax", String(filters.advanced.budgetMax));
  }
  if (filters.advanced.sinceDays != null) {
    q.set("since", String(filters.advanced.sinceDays));
  }
}
