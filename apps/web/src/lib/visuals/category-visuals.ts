import {
  Baby,
  Boxes,
  Car,
  Cpu,
  HeartPulse,
  Home,
  Package,
  Printer,
  Sofa,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Marketplace category visuals (Armut logic + Sahibinden/Trendyol listing clarity).
 * Keys match RequestCategory.id / Category.slug from the request-category engine.
 */
export type CategoryVisual = {
  icon: LucideIcon;
  /** Soft chip / badge surface (bg + text) */
  chip: string;
  /** Card / panel gradient from-* class */
  glow: string;
  /** Left accent bar */
  bar: string;
  /** Thumbnail panel gradient (from-via-to) */
  thumb: string;
  /** Icon stroke on thumbnail */
  iconTone: string;
  /** Soft ring / border hint */
  ring: string;
  /** Public cover image under /categories/{slug}.png when present */
  image?: string;
};

export const FALLBACK_CATEGORY_VISUAL: CategoryVisual = {
  icon: Package,
  chip: "bg-[#ecfdf5] text-teal-800",
  glow: "from-[#f3fbf8] to-white",
  bar: "bg-teal-500",
  thumb: "from-[#ecfdf5] via-[#f0fdfa] to-[#e7f5f2]",
  iconTone: "text-teal-800",
  ring: "ring-teal-900/10",
};

function categoryImage(slug: string): string {
  return `/categories/${slug}.png`;
}

export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  printing: {
    icon: Printer,
    chip: "bg-[#ecfdf5] text-[#047857]",
    glow: "from-[#ecfdf5] to-white",
    bar: "bg-emerald-500",
    thumb: "from-[#d1fae5] via-[#ecfdf5] to-[#f0fdfa]",
    iconTone: "text-emerald-800",
    ring: "ring-emerald-900/10",
    image: categoryImage("printing"),
  },
  automotive: {
    icon: Car,
    chip: "bg-[#f0f4f3] text-[#134e4a]",
    glow: "from-[#f4f7f6] to-white",
    bar: "bg-teal-700",
    thumb: "from-[#d1e7e3] via-[#e8f2f0] to-[#f4f7f6]",
    iconTone: "text-teal-900",
    ring: "ring-teal-900/12",
    image: categoryImage("automotive"),
  },
  machinery: {
    icon: Wrench,
    chip: "bg-[#eef2f1] text-[#3f5c57]",
    glow: "from-[#f4f7f6] to-white",
    bar: "bg-teal-800",
    thumb: "from-[#d8e4e1] via-[#eef2f1] to-[#f4f7f6]",
    iconTone: "text-[#3f5c57]",
    ring: "ring-teal-900/10",
    image: categoryImage("machinery"),
  },
  furniture: {
    icon: Sofa,
    chip: "bg-[#eef6f4] text-[#115e59]",
    glow: "from-[#f7faf9] to-white",
    bar: "bg-teal-600",
    thumb: "from-[#d5ebe6] via-[#eef6f4] to-[#f7faf9]",
    iconTone: "text-teal-800",
    ring: "ring-teal-800/10",
    image: categoryImage("furniture"),
  },
  technology: {
    icon: Cpu,
    chip: "bg-[#e7f0ee] text-[#0f766e]",
    glow: "from-[#f4f7f6] to-white",
    bar: "bg-teal-600",
    thumb: "from-[#cce5e1] via-[#e7f0ee] to-[#f0f7f5]",
    iconTone: "text-teal-700",
    ring: "ring-teal-700/12",
    image: categoryImage("technology"),
  },
  "real-estate": {
    icon: Home,
    chip: "bg-[#ccfbf1] text-[#0f766e]",
    glow: "from-[#f0fdfa] to-white",
    bar: "bg-teal-600",
    thumb: "from-[#99f6e4] via-[#ccfbf1] to-[#f0fdfa]",
    iconTone: "text-teal-800",
    ring: "ring-teal-600/15",
    image: categoryImage("real-estate"),
  },
  appliances: {
    icon: Package,
    chip: "bg-[#eef6f4] text-[#115e59]",
    glow: "from-[#f4f7f6] to-white",
    bar: "bg-teal-600",
    thumb: "from-[#d5ebe6] via-[#eef6f4] to-[#f4f7f6]",
    iconTone: "text-teal-800",
    ring: "ring-teal-800/10",
    image: categoryImage("appliances"),
  },
  health: {
    icon: HeartPulse,
    chip: "bg-[#f0f4f3] text-[#134e4a]",
    glow: "from-[#f4f7f6] to-white",
    bar: "bg-teal-700",
    thumb: "from-[#d4e5e2] via-[#f0f4f3] to-[#f7faf9]",
    iconTone: "text-teal-900",
    ring: "ring-teal-900/10",
    image: categoryImage("health"),
  },
  baby: {
    icon: Baby,
    chip: "bg-[#eef6f4] text-[#0f766e]",
    glow: "from-[#f7faf9] to-white",
    bar: "bg-teal-500",
    thumb: "from-[#d9f0ea] via-[#eef6f4] to-[#f7faf9]",
    iconTone: "text-teal-700",
    ring: "ring-teal-600/10",
    image: categoryImage("baby"),
  },
  "home-kitchen": {
    icon: Boxes,
    chip: "bg-[#f0f4f3] text-[#3f5c57]",
    glow: "from-[#f4f7f6] to-white",
    bar: "bg-teal-600",
    thumb: "from-[#dce8e5] via-[#f0f4f3] to-[#f4f7f6]",
    iconTone: "text-[#3f5c57]",
    ring: "ring-teal-800/10",
    image: categoryImage("home-kitchen"),
  },
  services: {
    icon: Sparkles,
    chip: "bg-[#e6fffa] text-[#0f766e]",
    glow: "from-[#f0fdfa] to-white",
    bar: "bg-teal-500",
    thumb: "from-[#99f6e4]/70 via-[#e6fffa] to-[#f0fdfa]",
    iconTone: "text-teal-700",
    ring: "ring-teal-500/15",
    image: categoryImage("services"),
  },
};

export function getCategoryVisual(
  slug?: string | null,
): CategoryVisual {
  if (slug && CATEGORY_VISUALS[slug]) {
    return CATEGORY_VISUALS[slug];
  }
  return FALLBACK_CATEGORY_VISUAL;
}

/** Short listing summary: prefer AI summary, else description. */
export function listingSummary(
  aiSummary?: string | null,
  description?: string | null,
  maxLen = 120,
): string | null {
  const raw = (aiSummary || description || "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen - 1).trimEnd()}…`;
}

/** Compact budget label for listing cards. */
export function formatListingBudget(
  budgetMin?: number | { toString(): string } | null,
  budgetMax?: number | { toString(): string } | null,
  currency = "TRY",
): string | null {
  const min =
    budgetMin == null
      ? null
      : Number(typeof budgetMin === "number" ? budgetMin : budgetMin.toString());
  const max =
    budgetMax == null
      ? null
      : Number(typeof budgetMax === "number" ? budgetMax : budgetMax.toString());

  if ((min == null || Number.isNaN(min)) && (max == null || Number.isNaN(max))) {
    return null;
  }

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: currency || "TRY",
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${n.toLocaleString("tr-TR")} ${currency || "TRY"}`;
    }
  };

  if (min != null && max != null && !Number.isNaN(min) && !Number.isNaN(max)) {
    if (min === max) return fmt(min);
    return `${fmt(min)} – ${fmt(max)}`;
  }
  if (min != null && !Number.isNaN(min)) return `${fmt(min)}+`;
  if (max != null && !Number.isNaN(max)) return `En fazla ${fmt(max)}`;
  return null;
}
