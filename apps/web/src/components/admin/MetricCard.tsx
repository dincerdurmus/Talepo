"use client";

type MetricCardProps = { label: string; value: string | number; description?: string };

export function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-muted p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        {description ? <span title={description} className="cursor-help text-[11px] text-muted-foreground">ⓘ</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {description ? <p className="mt-1 text-[11px] text-muted-foreground">{description}</p> : null}
    </div>
  );
}
