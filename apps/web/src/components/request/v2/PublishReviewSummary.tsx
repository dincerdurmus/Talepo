"use client";

import { useId, useState } from "react";

import {
  signalHelper,
  signalSurface,
} from "@/components/panel/profile/ProfileSignal";
import { isActionableUncertainty } from "@/lib/request-composer/v2/display-format";

export type PublishReviewModel = {
  summaryText: string;
  rawInput: string;
  categoryLabel: string | null;
  categoryUnresolved: boolean;
  preferences: Array<{ label: string; value: string }>;
  location: string | null;
  timing: string | null;
  budget: string | null;
  uncertainItems: Array<{ key: string; label: string; tone: "check" | "unsure" }>;
};

type Props = {
  model: PublishReviewModel;
  /** Real /talep publish — omit on demo preview. */
  onPublish?: () => void;
  publishing?: boolean;
  publishError?: string | null;
  onEdit: () => void;
};

export function PublishReviewSummary({
  model,
  onPublish,
  publishing = false,
  publishError = null,
  onEdit,
}: Props) {
  const baseId = useId();
  const [showRaw, setShowRaw] = useState(false);

  const uncertain = model.uncertainItems.filter((item) =>
    isActionableUncertainty({
      key: item.key,
      tone: item.tone,
      displayValue: "",
    }),
  );

  // Dedupe preference rows that repeat category/summary semantics
  const prefs = model.preferences.filter((p) => {
    const fold = p.value.toLocaleLowerCase("tr-TR");
    if (model.categoryLabel && fold === model.categoryLabel.toLocaleLowerCase("tr-TR")) {
      return false;
    }
    return true;
  });

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className={`mt-3 ${signalSurface} px-3.5 py-4 sm:px-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id={`${baseId}-heading`}
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f766e]/70"
          >
            Talep özeti
          </h2>
          <p className="mt-1 text-sm text-teal-950/55">
            Yayınlamadan önce son kontrol.
          </p>
        </div>
        <button
          type="button"
          className="min-h-10 rounded-lg border border-teal-900/10 bg-white px-3 text-xs font-medium text-teal-950/65"
          onClick={onEdit}
        >
          Bilgileri düzenle
        </button>
      </div>

      <div className="mt-3 rounded-[14px] border border-teal-950/[0.08] bg-white/90 px-3.5 py-3">
        <p className="text-sm leading-6 text-[#0f1f1d]">
          {model.summaryText.trim() || "Özet henüz oluşmadı."}
        </p>
        <button
          type="button"
          className="mt-2 text-xs font-medium text-[#0f766e] underline-offset-2 hover:underline"
          onClick={() => setShowRaw((v) => !v)}
          aria-expanded={showRaw}
        >
          {showRaw ? "Orijinal metni gizle" : "Yazdığınız talep"}
        </button>
        {showRaw ? (
          <p className="mt-2 rounded-xl bg-[#f7faf9] px-3 py-2 text-xs leading-5 text-teal-950/70">
            {model.rawInput}
          </p>
        ) : null}
      </div>

      <dl className="mt-3 grid gap-2">
        <div className="rounded-xl border border-teal-950/[0.06] bg-white/80 px-3 py-2">
          <dt className="text-[11px] text-teal-950/50">Teklif alınacak alan</dt>
          <dd className="text-sm font-medium text-[#0f1f1d]">
            {model.categoryUnresolved
              ? "Talepo ilgili uzmanlık alanlarını da değerlendirecek."
              : model.categoryLabel ?? "Belirtilmedi"}
          </dd>
        </div>
        {model.location ? (
          <div className="rounded-xl border border-teal-950/[0.06] bg-white/80 px-3 py-2">
            <dt className="text-[11px] text-teal-950/50">Konum</dt>
            <dd className="text-sm font-medium text-[#0f1f1d]">
              {model.location}
            </dd>
          </div>
        ) : null}
        {model.timing ? (
          <div className="rounded-xl border border-teal-950/[0.06] bg-white/80 px-3 py-2">
            <dt className="text-[11px] text-teal-950/50">Zaman</dt>
            <dd className="text-sm font-medium text-[#0f1f1d]">
              {model.timing}
            </dd>
          </div>
        ) : null}
        {model.budget ? (
          <div className="rounded-xl border border-teal-950/[0.06] bg-white/80 px-3 py-2">
            <dt className="text-[11px] text-teal-950/50">Bütçe</dt>
            <dd className="text-sm font-medium text-[#0f1f1d]">
              {model.budget}
            </dd>
          </div>
        ) : null}
      </dl>

      {prefs.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-teal-950/[0.06] pt-3">
          <li className={signalHelper}>Önemli tercihler</li>
          {prefs.map((pref) => (
            <li
              key={`${pref.label}-${pref.value}`}
              className="flex flex-wrap gap-x-2 text-sm text-[#0f1f1d]"
            >
              <span className="text-teal-950/50">{pref.label}</span>
              <span className="font-medium">{pref.value}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {uncertain.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2">
          <p className="text-xs font-medium text-amber-950/80">
            Hâlâ emin olmadığımız noktalar
          </p>
          <ul className="mt-1 list-inside list-disc text-xs text-amber-950/70">
            {uncertain.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {publishError ? (
        <p role="alert" className="mt-3 text-sm text-orange-800">
          {publishError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
        {onPublish ? (
          <button
            type="button"
            className="min-h-12 flex-1 rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={publishing}
            onClick={onPublish}
          >
            {publishing ? "Yayınlanıyor…" : "Talebi yayınla"}
          </button>
        ) : null}
        <button
          type="button"
          className="min-h-12 flex-1 rounded-xl border border-teal-900/12 bg-white px-4 text-sm font-medium text-[#0f1f1d]"
          onClick={onEdit}
          disabled={publishing}
        >
          Düzenlemeye dön
        </button>
      </div>
    </section>
  );
}
