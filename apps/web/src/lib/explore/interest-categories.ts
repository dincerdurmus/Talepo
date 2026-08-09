export const INTEREST_CATEGORIES_COOKIE = "talepo_interest_categories";

export function parseInterestSlugs(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

export function serializeInterestSlugs(slugs: string[]) {
  return [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].slice(0, 12).join(",");
}
