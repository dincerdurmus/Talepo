"use client";

import { useState } from "react";

import { resolveRequestCardMedia } from "@/lib/panel/request-card-media";

export function ConversationCategoryArt({
  coverImageUrl,
  categorySlug,
  className = "talepo-conversation-art",
}: {
  coverImageUrl?: string | null;
  categorySlug?: string | null;
  className?: string;
}) {
  const media = resolveRequestCardMedia({ coverImageUrl, categorySlug });
  const src = media.kind === "icon" ? null : media.src;
  const [failed, setFailed] = useState(false);

  if (!src || failed) return null;

  return (
    <span className={className} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" onError={() => setFailed(true)} />
    </span>
  );
}
