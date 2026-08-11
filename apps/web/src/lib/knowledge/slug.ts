/** Stable subcategory slugs from Turkish REQUEST_CATEGORIES labels. */

export function foldLabel(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

export function subcategorySlug(label: string): string {
  return foldLabel(label)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function profileId(
  categoryId: string,
  subcategoryLabelOrSlug?: string | null,
): string {
  if (!subcategoryLabelOrSlug?.trim()) return categoryId;
  let raw = subcategoryLabelOrSlug.trim();
  // Allow full ids like "automotive/yedek-parca"; do NOT treat "/" inside
  // Turkish labels (e.g. "Fırın / Ocak") as a path separator.
  const prefix = `${categoryId}/`;
  if (raw.startsWith(prefix)) raw = raw.slice(prefix.length);
  return `${categoryId}/${subcategorySlug(raw)}`;
}
