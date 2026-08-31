"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Star, X } from "lucide-react";

import {
  DEAL_REVIEW_BLIND_HINT,
  DEAL_REVIEW_COMMENT_MAX,
  DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE,
  DEAL_REVIEW_WINDOW_HINT,
  type DealReviewDto,
} from "@/lib/offer/deal-review";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="mt-2 flex gap-1 text-amber-500">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className="h-4 w-4"
          fill={rating >= value ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

export function DealReviewPanel({
  dealOutcomeId,
  existingReview,
  oppositeReview = null,
  canCreateReview = true,
  windowExpired = false,
  reviewDeadlineLabel = null,
  compact = false,
}: {
  dealOutcomeId: string;
  existingReview: DealReviewDto | null;
  oppositeReview?: DealReviewDto | null;
  canCreateReview?: boolean;
  windowExpired?: boolean;
  reviewDeadlineLabel?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const panelId = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  const dismissKey = `talepo-review-dismiss:${dealOutcomeId}`;
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(Boolean(existingReview));

  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop değişince form durumunu sıfırla — sig/prop korumalı (PanelShell emsali)
    setDismissed(window.localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissKey, "1");
    }
    setExpanded(false);
    openRef.current?.focus();
  }

  if (submitted || existingReview) {
    if (compact) {
      return (
        <div className="mt-2 rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3.5 py-2.5">
          <p className="text-xs font-semibold text-teal-950">
            Değerlendirmeniz alındı
          </p>
          {existingReview ? <StarRow rating={existingReview.rating} /> : null}
          {oppositeReview ? (
            <div className="mt-2 border-t border-teal-900/8 pt-2">
              <p className="text-[11px] font-medium text-black/40">
                Karşı tarafın değerlendirmesi
              </p>
              <StarRow rating={oppositeReview.rating} />
            </div>
          ) : !windowExpired ? (
            <p className="mt-1 text-[11px] text-black/40">
              {DEAL_REVIEW_BLIND_HINT}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="mt-3 rounded-xl border border-teal-900/10 bg-white px-4 py-3.5">
        <p className="text-sm font-semibold text-teal-950">
          Değerlendirmeniz alındı.
        </p>
        {!oppositeReview && !windowExpired ? (
          <p className="mt-1 text-xs text-black/45">{DEAL_REVIEW_BLIND_HINT}</p>
        ) : null}
        {existingReview ? (
          <>
            <StarRow rating={existingReview.rating} />
            {existingReview.comment ? (
              <p className="mt-2 text-sm leading-6 text-black/65">
                {existingReview.comment}
              </p>
            ) : null}
          </>
        ) : rating > 0 ? (
          <StarRow rating={rating} />
        ) : null}
        {oppositeReview ? (
          <div className="mt-3 border-t border-teal-900/8 pt-3">
            <p className="text-xs font-medium text-black/40">
              Karşı tarafın değerlendirmesi
            </p>
            <StarRow rating={oppositeReview.rating} />
            {oppositeReview.comment ? (
              <p className="mt-2 text-sm leading-6 text-black/65">
                {oppositeReview.comment}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (windowExpired || !canCreateReview) {
    if (compact) return null;
    return (
      <div className="mt-3 rounded-xl border border-teal-900/10 bg-white px-4 py-3.5">
        <p className="text-sm font-semibold text-teal-950">
          {DEAL_REVIEW_WINDOW_EXPIRED_MESSAGE}
        </p>
      </div>
    );
  }

  if (compact && dismissed && !expanded) {
    return (
      <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3 py-2">
        <p className="text-xs font-medium text-teal-950/80">
          Deneyiminizi değerlendirebilirsiniz
        </p>
        <button
          ref={openRef}
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 rounded-lg bg-[#0f1f1d] px-3 py-1.5 text-[11px] font-semibold text-white"
        >
          Aç
        </button>
      </div>
    );
  }

  async function submit() {
    if (submitting || rating < 1) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/deal-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealOutcomeId,
          rating,
          comment: comment.trim() || null,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setMessage(data.message ?? "Kaydedilemedi.");
        return;
      }
      setSubmitted(true);
      router.refresh();
    } catch {
      setMessage("Bağlantı hatası.");
    } finally {
      setSubmitting(false);
    }
  }

  const shellClass = compact
    ? "mt-2 rounded-xl border border-teal-900/10 bg-[#f7fbfa] px-3.5 py-3"
    : "mt-3 rounded-xl border border-teal-900/10 bg-white px-4 py-4";

  return (
    <div id={panelId} className={shellClass}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0f1f1d]">
            Deneyiminizi değerlendirin
          </p>
          <p className="mt-0.5 text-xs text-black/45">{DEAL_REVIEW_WINDOW_HINT}</p>
        </div>
        {compact ? (
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-1 text-teal-900/40 hover:bg-teal-900/5"
            aria-label="Değerlendirme çağrısını kapat"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {reviewDeadlineLabel ? (
        <p className="mt-0.5 text-xs text-black/45">
          Son tarih: {reviewDeadlineLabel}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-black/40">{DEAL_REVIEW_BLIND_HINT}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map((value) => {
          const active = rating >= value;
          return (
            <button
              key={value}
              type="button"
              aria-label={`${value} yıldız`}
              onClick={() => setRating(value)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-teal-900/10 text-amber-500"
            >
              <Star
                className="h-5 w-5"
                fill={active ? "currentColor" : "none"}
              />
            </button>
          );
        })}
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-black/45">Yorum ekleyin</span>
        <textarea
          value={comment}
          maxLength={DEAL_REVIEW_COMMENT_MAX}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-teal-900/10 bg-[#fbfcfc] px-3 py-2 text-sm text-[#0f1f1d] outline-none focus:border-teal-800/30"
          placeholder="İsteğe bağlı, düz metin"
        />
        <span className="mt-1 block text-[11px] text-black/35">
          {comment.length}/{DEAL_REVIEW_COMMENT_MAX}
        </span>
      </label>

      <button
        type="button"
        disabled={submitting || rating < 1}
        onClick={() => void submit()}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          "Değerlendirmeyi gönder"
        )}
      </button>

      {message ? (
        <p className="mt-2 text-xs font-semibold text-[#8b352b]">{message}</p>
      ) : null}
    </div>
  );
}
