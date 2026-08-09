import Link from "next/link";
import {
  ArrowRight,
  Baby,
  Boxes,
  Car,
  Cpu,
  HeartPulse,
  Home,
  MapPin,
  Package,
  Printer,
  Sofa,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

type ExploreRequestCardProps = {
  href: string;
  title: string;
  categoryName: string;
  categorySlug?: string | null;
  city?: string | null;
  coverImageUrl?: string | null;
  offerCount: number;
  timeLabel: string;
  isUrgent?: boolean;
  isFeatured?: boolean;
  isFresh?: boolean;
  matchReason?: string | null;
  emphasizeTime?: boolean;
};

const CATEGORY_LOOK: Record<
  string,
  { icon: LucideIcon; chip: string; glow: string; bar: string }
> = {
  printing: {
    icon: Printer,
    chip: "bg-[#ecfdf5] text-[#047857]",
    glow: "from-[#ecfdf5] to-white",
    bar: "bg-emerald-500",
  },
  automotive: {
    icon: Car,
    chip: "bg-[#fff7ed] text-[#c2410c]",
    glow: "from-[#fff7ed] to-white",
    bar: "bg-orange-500",
  },
  machinery: {
    icon: Wrench,
    chip: "bg-[#f1f5f9] text-[#334155]",
    glow: "from-[#f1f5f9] to-white",
    bar: "bg-slate-500",
  },
  furniture: {
    icon: Sofa,
    chip: "bg-[#fef3c7] text-[#b45309]",
    glow: "from-[#fffbeb] to-white",
    bar: "bg-amber-500",
  },
  technology: {
    icon: Cpu,
    chip: "bg-[#e0f2fe] text-[#0369a1]",
    glow: "from-[#e0f2fe] to-white",
    bar: "bg-sky-500",
  },
  "real-estate": {
    icon: Home,
    chip: "bg-[#ccfbf1] text-[#0f766e]",
    glow: "from-[#f0fdfa] to-white",
    bar: "bg-teal-600",
  },
  appliances: {
    icon: Package,
    chip: "bg-[#e0e7ff] text-[#4338ca]",
    glow: "from-[#eef2ff] to-white",
    bar: "bg-indigo-500",
  },
  health: {
    icon: HeartPulse,
    chip: "bg-[#ffe4e6] text-[#be123c]",
    glow: "from-[#fff1f2] to-white",
    bar: "bg-rose-500",
  },
  baby: {
    icon: Baby,
    chip: "bg-[#fce7f3] text-[#be185d]",
    glow: "from-[#fdf2f8] to-white",
    bar: "bg-pink-500",
  },
  "home-kitchen": {
    icon: Boxes,
    chip: "bg-[#ffedd5] text-[#c2410c]",
    glow: "from-[#fff7ed] to-white",
    bar: "bg-orange-400",
  },
  services: {
    icon: Sparkles,
    chip: "bg-[#e6fffa] text-[#0f766e]",
    glow: "from-[#f0fdfa] to-white",
    bar: "bg-teal-500",
  },
};

const FALLBACK = {
  icon: Package,
  chip: "bg-[#ecfdf5] text-teal-800",
  glow: "from-[#f3fbf8] to-white",
  bar: "bg-teal-500",
};

export function ExploreRequestCard({
  href,
  title,
  categoryName,
  categorySlug,
  city,
  coverImageUrl,
  offerCount,
  timeLabel,
  isUrgent,
  isFeatured,
  isFresh,
  matchReason,
  emphasizeTime,
}: ExploreRequestCardProps) {
  const look = (categorySlug && CATEGORY_LOOK[categorySlug]) || FALLBACK;
  const Icon = look.icon;

  return (
    <Link
      href={href}
      className={`group relative flex overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-r ${look.glow} shadow-[0_8px_28px_rgba(15,61,56,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-teal-700/20 hover:shadow-[0_14px_36px_rgba(15,61,56,0.1)]`}
    >
      <span className={`w-1 shrink-0 ${look.bar}`} aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3.5 sm:gap-4 sm:px-4">
        {coverImageUrl ? (
          <div className="relative flex h-[4.5rem] w-[6.75rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0b1220] shadow-sm ring-1 ring-black/[0.08] sm:h-[5.25rem] sm:w-[8rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              alt=""
              className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${look.chip} shadow-sm ring-1 ring-black/[0.04]`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate font-[family-name:var(--font-explore-display)] text-[15px] font-semibold tracking-tight text-[#0f3d38] sm:text-[16px] group-hover:text-teal-900">
              {title}
            </h2>
            {isFresh ? (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                Yeni
              </span>
            ) : null}
            {isUrgent ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-bold text-[#c2410c] ring-1 ring-[#fdba74]/60">
                <Zap className="h-3 w-3" />
                Acil
              </span>
            ) : null}
            {isFeatured ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-700/10 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                <Sparkles className="h-3 w-3" />
                Öne çıkan
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${look.chip}`}
            >
              {categoryName}
            </span>
            {city ? (
              <span className="inline-flex items-center gap-1 font-medium text-[#5a7a74]">
                <MapPin className="h-3 w-3 text-teal-700/70" />
                {city}
              </span>
            ) : null}
            {matchReason ? (
              <span className="font-medium text-teal-700/75">{matchReason}</span>
            ) : null}
          </div>
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          <p className="rounded-xl bg-white/80 px-2.5 py-1 text-xs font-bold tabular-nums text-teal-900 shadow-sm ring-1 ring-teal-900/5">
            {offerCount} teklif
          </p>
          <p
            className={`mt-1.5 text-[11px] font-semibold ${
              emphasizeTime ? "text-emerald-700" : "text-[#7a9a94]"
            }`}
          >
            {timeLabel}
          </p>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white opacity-90 shadow-sm transition group-hover:scale-105 group-hover:opacity-100">
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}
