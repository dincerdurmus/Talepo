"use client";

const STEPS = [
  {
    n: "1",
    title: "Anlatın",
    body: "Ne aradığınızı kendi cümlelerinizle yazın.",
  },
  {
    n: "2",
    title: "Talepo anlasın",
    body: "İhtiyacınızı ve önemli detayları çıkarsın.",
  },
  {
    n: "3",
    title: "Birlikte tamamlayın",
    body: "Eksik ama faydalı bilgileri size önersin.",
  },
  {
    n: "4",
    title: "Teklifleri alın",
    body: "Kontrol edin, yayınlayın ve teklifler gelsin.",
  },
] as const;

export function RequestProcessStrip() {
  return (
    <div className="rounded-[1.25rem] border border-teal-900/6 bg-white/55 px-3 py-3 sm:px-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-2">
        {STEPS.map((step, index) => (
          <div key={step.n} className="relative min-w-0">
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden
                className="absolute right-[-6px] top-3 hidden text-teal-800/20 lg:block"
              >
                →
              </span>
            ) : null}
            <div className="flex items-start gap-2 pr-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f0fdfa] text-[11px] font-semibold text-[#0f766e]">
                {step.n}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#0f1f1d]">
                  {step.title}
                </p>
                <p className="mt-0.5 hidden text-[11px] leading-4 text-teal-950/45 sm:block">
                  {step.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
