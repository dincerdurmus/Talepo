"use client";

import { useState } from "react";

import {
  requestCardMediaAlt,
  resolveRequestCardMedia,
} from "@/lib/panel/request-card-media";
import { getCategoryVisual } from "@/lib/visuals/category-visuals";

type ThumbSize = "sm" | "md" | "lg" | "badge";

const SIZE_CLASS: Record<ThumbSize, string> = {
  sm: "h-[4.5rem] w-[4.5rem] rounded-xl",
  md: "h-[5.25rem] w-[5.25rem] rounded-2xl sm:h-24 sm:w-24",
  lg: "h-24 w-24 rounded-2xl sm:h-28 sm:w-28",
  badge: "h-11 w-11 rounded-xl sm:h-12 sm:w-12",
};

const ICON_SIZE: Record<ThumbSize, string> = {
  sm: "h-6 w-6",
  md: "h-7 w-7 sm:h-8 sm:w-8",
  lg: "h-8 w-8 sm:h-9 sm:w-9",
  badge: "h-5 w-5",
};

type CategoryVisualThumbProps = {
  categorySlug?: string | null;
  categoryName?: string | null;
  coverImageUrl?: string | null;
  /** Used only for real-cover alt text; never invents media. */
  requestTitle?: string | null;
  size?: ThumbSize;
  className?: string;
  /**
   * When true (default), missing cover falls back to Talepo category artwork
   * before the generic icon tile. Opportunity and discovery cards keep this on.
   */
  allowCategoryStockImage?: boolean;
};

/**
 * Listing thumb priority:
 * real Request.coverImageUrl → category artwork → CSS icon placeholder.
 */
export function CategoryVisualThumb({
  categorySlug,
  categoryName,
  coverImageUrl,
  requestTitle,
  size = "md",
  className = "",
  allowCategoryStockImage = true,
}: CategoryVisualThumbProps) {
  const look = getCategoryVisual(categorySlug);
  const Icon = look.icon;
  const label = categoryName || "Kategori";
  const media = resolveRequestCardMedia({ coverImageUrl, categorySlug });
  const resolved =
    media.kind === "cover"
      ? media
      : media.kind === "category" && allowCategoryStockImage
        ? media
        : ({ kind: "icon" } as const);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc =
    resolved.kind === "icon"
      ? null
      : resolved.src && resolved.src !== failedSrc
        ? resolved.src
        : null;
  const showingKind =
    imageSrc == null
      ? "icon"
      : resolved.kind === "cover"
        ? "cover"
        : "category";
  const alt = requestCardMediaAlt(
    showingKind === "icon"
      ? { kind: "icon" }
      : showingKind === "cover"
        ? { kind: "cover", src: imageSrc! }
        : {
            kind: "category",
            src: imageSrc!,
            categorySlug: categorySlug?.trim() || "",
          },
    categoryName,
    requestTitle,
  );

  if (imageSrc) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-[#0b1220] shadow-sm ring-1 ring-black/[0.08] ${SIZE_CLASS[size]} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={alt}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={() => setFailedSrc(imageSrc)}
        />
        <span
          className={`absolute bottom-1.5 left-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 shadow-sm ring-1 ${look.ring}`}
        >
          <Icon className="h-3.5 w-3.5 text-teal-800" strokeWidth={1.75} />
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br shadow-sm ring-1 ${look.thumb} ${look.ring} ${SIZE_CLASS[size]} ${className}`}
      role="img"
      aria-label={alt}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/40 blur-md"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-4 -left-2 h-12 w-12 rounded-full bg-teal-900/[0.04] blur-md"
      />
      <Icon
        className={`relative ${ICON_SIZE[size]} ${look.iconTone}`}
        strokeWidth={1.6}
      />
    </div>
  );
}
