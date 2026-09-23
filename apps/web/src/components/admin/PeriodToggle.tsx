"use client";

type PeriodOption<T extends string | number> = { value: T; label: string };

export function PeriodToggle<T extends string | number>({ value, options, onChange }: { value: T; options: PeriodOption<T>[]; onChange: (value: T) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
      {options.map((option) => (
        <button key={String(option.value)} onClick={() => onChange(option.value)} className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${value === option.value ? "bg-primary font-semibold text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
