"use client";

type MetricCardProps = { label: string; value: string | number; description?: string };

export function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-white/[.07] bg-black/15 p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-white/35">{label}</p>
        {description ? <span title={description} className="cursor-help text-[11px] text-white/30">ⓘ</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {description ? <p className="mt-1 text-[11px] text-white/30">{description}</p> : null}
    </div>
  );
}
