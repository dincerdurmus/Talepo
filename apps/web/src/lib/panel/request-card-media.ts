/**
 * Shared request-card media priority for Opportunity Center, Keşfet, and
 * other listing thumbs.
 *
 * 1. Request.coverImageUrl (real request media)
 * 2. Canonical Talepo category artwork from getCategoryVisual (decorative)
 * 3. Generic category icon (no image src)
 *
 * Category artwork is NOT a product/request photo. Deep taxonomy leaves
 * already resolve via Request.category.slug (root browse category) — do not
 * invent a second taxonomy traversal here.
 */

import { primaryRequestCoverImageUrl } from "@/lib/panel/request-cover-image";
import { getCategoryVisual } from "@/lib/visuals/category-visuals";

export type RequestCardMedia =
  | { kind: "cover"; src: string }
  | { kind: "category"; src: string; categorySlug: string }
  | { kind: "icon" };

export function resolveRequestCardMedia(input: {
  coverImageUrl?: string | null;
  categorySlug?: string | null;
}): RequestCardMedia {
  const cover = primaryRequestCoverImageUrl(input.coverImageUrl);
  if (cover) return { kind: "cover", src: cover };

  const slug = input.categorySlug?.trim() || "";
  const artwork = slug ? getCategoryVisual(slug).image?.trim() || null : null;
  if (artwork) {
    return { kind: "category", src: artwork, categorySlug: slug };
  }

  return { kind: "icon" };
}

export function requestCardMediaAlt(
  media: RequestCardMedia,
  categoryName?: string | null,
  requestTitle?: string | null,
): string {
  if (media.kind === "cover") {
    return (requestTitle?.trim() || categoryName?.trim() || "Talep görseli").trim();
  }
  if (media.kind === "category") {
    const name = categoryName?.trim() || media.categorySlug || "Kategori";
    return `${name} kategori görseli`;
  }
  return categoryName?.trim() || "Kategori";
}
