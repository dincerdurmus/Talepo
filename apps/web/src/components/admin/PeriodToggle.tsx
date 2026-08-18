"use client";

type PeriodOption<T extends string | number> = { value: T; label: string };

export function PeriodToggle<T extends string | number>({ value, options, onChange }: { value: T; options: PeriodOption<T>[]; onChange: (value: T) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/10 p-1">
      {options.map((option) => (
        <button key={String(option.value)} onClick={() => onChange(option.value)} className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${value === option.value ? "bg-emerald-300 font-semibold text-[#071310] shadow-sm" : "text-white/45 hover:bg-white/[.07] hover:text-white/80"}`}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
