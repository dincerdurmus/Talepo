import { getCategoryById } from "@/lib/request-category-engine";

export type PreviewCategoryResolution = {
  categoryId: string;
  categorySlug: string;
  label: string;
  /** True when DB row missing — internal Talepo observations may be empty until first publish */
  previewOnly: boolean;
};

/** Stable synthetic id for preview when Category row does not exist yet */
export function syntheticPreviewCategoryId(slug: string): string {
  return `preview:${slug}`;
}

/**
 * Sync resolver — REQUEST_CATEGORIES source-of-truth, no DB required.
 */
export function resolvePreviewCategorySync(categorySlug: string): PreviewCategoryResolution {
  const category = getCategoryById(categorySlug.trim());
  return {
    categoryId: syntheticPreviewCategoryId(category.id),
    categorySlug: category.id,
    label: category.label,
    previewOnly: true,
  };
}

/**
 * Prefer real DB category id when available (internal observations), else synthetic.
 * Server-only — imports prisma via caller or companion module.
 */
export function mergePreviewCategoryWithDbId(
  sync: PreviewCategoryResolution,
  dbCategoryId: string | null | undefined,
): PreviewCategoryResolution {
  if (dbCategoryId) {
    return { ...sync, categoryId: dbCategoryId, previewOnly: false };
  }
  return sync;
}
