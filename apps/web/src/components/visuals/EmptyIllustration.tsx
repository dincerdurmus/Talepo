import {
  FileText,
  Inbox,
  MessageSquareText,
  Search,
  type LucideIcon,
} from "lucide-react";

import { FALLBACK_CATEGORY_VISUAL } from "@/lib/visuals/category-visuals";

type EmptyVariant = "requests" | "offers" | "search" | "inbox";

const VARIANT_ICON: Record<EmptyVariant, LucideIcon> = {
  requests: FileText,
  offers: MessageSquareText,
  search: Search,
  inbox: Inbox,
};

type EmptyIllustrationProps = {
  variant?: EmptyVariant;
  className?: string;
};

/**
 * Light marketplace empty-state illustration (gradient + icon stack).
 */
export function EmptyIllustration({
  variant = "requests",
  className = "",
}: EmptyIllustrationProps) {
  const Icon = VARIANT_ICON[variant];
  const look = FALLBACK_CATEGORY_VISUAL;

  return (
    <div
      className={`relative mx-auto flex h-20 w-20 items-center justify-center ${className}`}
      aria-hidden
    >
      <span
        className={`absolute inset-0 rounded-[1.35rem] bg-gradient-to-br ${look.thumb} shadow-sm ring-1 ${look.ring}`}
      />
      <span className="absolute -right-1 -top-1 h-8 w-8 rounded-xl bg-white/80 shadow-sm ring-1 ring-teal-900/8" />
      <span className="absolute -bottom-1.5 -left-1.5 h-7 w-7 rounded-lg bg-teal-700/10 ring-1 ring-teal-900/8" />
      <span
        className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${look.chip} shadow-sm`}
      >
        <Icon className={`h-6 w-6 ${look.iconTone}`} strokeWidth={1.6} />
      </span>
    </div>
  );
}
