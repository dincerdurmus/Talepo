import { getBuiltInCategoryById, UNKNOWN_REQUEST_CATEGORY, type RequestCategory } from "./request-category-engine";

export type PublicCategory = { slug: string; name: string; description: string | null };

/** The database owns availability; built-in definitions only supply question schemas. */
export function publicCategoryDefinition(row: PublicCategory): RequestCategory {
  const builtIn = getBuiltInCategoryById(row.slug);
  return {
    ...(builtIn ?? UNKNOWN_REQUEST_CATEGORY),
    id: row.slug, label: row.name, description: row.description ?? builtIn?.description ?? "",
    keywords: builtIn?.keywords ?? [row.name],
  };
}
