"use client";

import { useId, useState } from "react";

import {
  signalHelper,
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
      className="mt-3 overflow-hidden rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white shadow-[0_28px_80px_rgba(11,37,34,0.08)]"
    >
      {/* Koyu beacon başlık şeridi — "son kontrol" anı belirgin olsun */}
      <div className="talepo-beacon-hero relative flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
        <div className="relative">
          <h2
            id={`${baseId}-heading`}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/90"
          >
            Talep özeti
          </h2>
          <p className="mt-0.5 text-sm font-medium text-white">
            Yayınlamadan önce son kontrol
          </p>
        </div>
        <button
          type="button"
          className="relative min-h-10 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white/85 transition hover:bg-white/[0.12]"
          onClick={onEdit}
        >
          Bilgileri düzenle
        </button>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="rounded-xl border-l-[3px] border-[#0f766e] bg-[#f7faf9] px-3.5 py-3">
          <p className="text-[15px] font-medium leading-7 text-[#0f1f1d]">
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
            <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[#0f1f1d]/70">
              {model.rawInput}
            </p>
          ) : null}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#e3f1f2] px-3 py-2.5">
            <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">
              Teklif alınacak alan
            </dt>
            <dd className="mt-0.5 text-sm font-semibold text-[#0f1f1d]">
              {model.categoryUnresolved
                ? "İlgili uzmanlık alanları değerlendirilecek"
                : model.categoryLabel ?? "Belirtilmedi"}
            </dd>
          </div>
          {model.location ? (
            <div className="rounded-xl bg-[#f4f7f6] px-3 py-2.5">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#0f1f1d]/45">
                Konum
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-[#0f1f1d]">
                {model.location}
              </dd>
            </div>
          ) : null}
          {model.budget ? (
            <div className="rounded-xl bg-[#f4f7f6] px-3 py-2.5">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#0f1f1d]/45">
                Bütçe
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[#0f1f1d]">
                {model.budget}
              </dd>
            </div>
          ) : null}
          {model.timing ? (
            <div className="rounded-xl bg-[#f4f7f6] px-3 py-2.5">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#0f1f1d]/45">
                Zaman
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-[#0f1f1d]">
                {model.timing}
              </dd>
            </div>
          ) : null}
        </dl>

        {prefs.length > 0 ? (
          <div className="mt-3">
            <p className={signalHelper}>Önemli tercihler</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {prefs.map((pref) => (
                <li
                  key={`${pref.label}-${pref.value}`}
                  className="inline-flex items-baseline gap-1.5 rounded-full border border-[#0f1f1d]/8 bg-white px-3 py-1.5 text-[13px]"
                >
                  <span className="text-[#0f1f1d]/50">{pref.label}</span>
                  <span className="font-semibold text-[#0f1f1d]">
                    {pref.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
              className="min-h-12 flex-1 rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,118,110,0.25)] transition hover:bg-[#115e59] disabled:opacity-60"
              disabled={publishing}
              onClick={onPublish}
            >
              {publishing ? "Yayınlanıyor…" : "Talebi yayınla"}
            </button>
          ) : null}
          <button
            type="button"
            className="min-h-12 flex-1 rounded-xl border border-[#0f1f1d]/10 bg-white px-4 text-sm font-medium text-[#0f1f1d]"
            onClick={onEdit}
            disabled={publishing}
          >
            Düzenlemeye dön
          </button>
        </div>
      </div>
    </section>
  );
}
