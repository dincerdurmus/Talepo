"use client";

/**
 * KATEGORİ ONAY KARTI — SUNUM KATMANI (standart form).
 *
 * Metin, etiketler ve kök listesi kanonik `CategoryConfirmationModel`'den
 * gelir; bu bileşen kategori kuralı kurmaz, cümle uydurmaz. Maira aynı modeli
 * kendi sahnesinde çizer (bkz. `MairaStage`). "Bu değil" sonrası görünüm
 * (`rejected`) sayfanın state'idir ki iki yüzey arasında geçişte kaybolmasın.
 */
import { useId } from "react";

import { signalSurface } from "@/components/panel/profile/ProfileSignal";
import type {
  CategoryConfirmationAction,
  CategoryConfirmationModel,
} from "@/lib/request-composer/v2/category-confirmation";

type Props = {
  model: CategoryConfirmationModel;
  /** "Bu değil" denildi; kök kategori listesi açık. */
  rejected: boolean;
  onAction: (action: CategoryConfirmationAction) => void;
};

export function CategoryConfirmationCard({ model, rejected, onAction }: Props) {
  const baseId = useId();

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      data-testid="category-confirmation-card"
      className={`mt-3 ${signalSurface} px-4 py-4`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]/80">
        {model.eyebrow}
      </p>
      <h2
        id={`${baseId}-title`}
        className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#0f1f1d]"
      >
        {rejected ? model.pickPrompt : model.prompt}
      </h2>
      <p className="mt-1 text-sm leading-6 text-teal-950/55">
        {rejected ? model.pickHelper : model.helper}
      </p>

      {rejected ? (
        <>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {model.rootChoices.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  data-testid={`category-root-${choice.id}`}
                  onClick={() =>
                    onAction({ kind: "pick_root", categoryId: choice.id })
                  }
                  className="flex min-h-[64px] w-full flex-col items-start rounded-xl border border-teal-900/10 bg-[#fbfdfe] px-3.5 py-3 text-left transition hover:border-[#0f766e]/25 hover:bg-[#f7fdfb]"
                >
                  <span className="text-sm font-semibold text-[#0f1f1d]">
                    {choice.label}
                    {choice.current ? (
                      <span className="ml-2 text-xs font-normal text-teal-950/45">
                        {model.currentHint}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-5 text-teal-950/50">
                    {choice.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <button
              type="button"
              data-testid="category-confirmation-back"
              onClick={() => onAction({ kind: "back" })}
              className="min-h-10 rounded-full border border-teal-900/10 bg-white px-3.5 text-xs font-medium text-teal-950/70 hover:border-[#0f766e]/25"
            >
              {model.backLabel}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="category-confirmation-confirm"
            onClick={() => onAction({ kind: "confirm" })}
            className="min-h-11 rounded-full bg-[#0f766e] px-5 text-sm font-semibold text-white transition hover:bg-[#0d6a63]"
          >
            {model.confirmLabel}
          </button>
          <button
            type="button"
            data-testid="category-confirmation-reject"
            onClick={() => onAction({ kind: "reject" })}
            className="min-h-11 rounded-full border border-teal-900/12 bg-white px-5 text-sm font-medium text-[#0f1f1d] transition hover:border-[#0f766e]/30"
          >
            {model.rejectLabel}
          </button>
        </div>
      )}
    </section>
  );
}
