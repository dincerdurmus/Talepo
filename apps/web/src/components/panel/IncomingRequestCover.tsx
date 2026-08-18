"use client";

import { useState } from "react";

import {
  requestCardMediaAlt,
  resolveRequestCardMedia,
} from "@/lib/panel/request-card-media";
import { getCategoryVisual } from "@/lib/visuals/category-visuals";

export function IncomingRequestCover({
  coverImageUrl,
  categorySlug,
  categoryName,
  requestTitle,
  compact = false,
}: {
  coverImageUrl?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  requestTitle?: string | null;
  compact?: boolean;
}) {
  const look = getCategoryVisual(categorySlug);
  const Icon = look.icon;
  const media = resolveRequestCardMedia({ coverImageUrl, categorySlug });
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc =
    media.kind === "icon"
      ? null
      : media.src && media.src !== failedSrc
        ? media.src
        : null;
  const showingKind =
    imageSrc == null ? "icon" : media.kind === "cover" ? "cover" : "category";
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

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#efe8dc] ring-1 ring-black/[0.06] ${
        compact ? "aspect-square rounded-xl" : "aspect-[4/3] rounded-2xl"
      }`}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${look.thumb}`}
          role="img"
          aria-label={alt}
        >
          <Icon
            className={`${compact ? "h-5 w-5" : "h-10 w-10"} ${look.iconTone}`}
            strokeWidth={1.5}
          />
        </div>
      )}
    </div>
  );
}
