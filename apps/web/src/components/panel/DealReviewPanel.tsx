"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Star } from "lucide-react";

import {
  DEAL_REVIEW_BLIND_HINT,
  DEAL_REVIEW_COMMENT_MAX,
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
}: {
  dealOutcomeId: string;
  existingReview: DealReviewDto | null;
  oppositeReview?: DealReviewDto | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(Boolean(existingReview));

  if (submitted) {
    return (
      <div className="mt-3 rounded-xl border border-teal-900/10 bg-white px-4 py-3.5">
        <p className="text-sm font-semibold text-teal-950">
          Değerlendirmeniz alındı.
        </p>
        <p className="mt-1 text-xs text-black/45">{DEAL_REVIEW_BLIND_HINT}</p>
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
        <p className="mt-2 text-xs text-black/40">
          Değerlendirmeler gönderildikten sonra değiştirilemez.
        </p>
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

  return (
    <div className="mt-3 rounded-xl border border-teal-900/10 bg-white px-4 py-4">
      <p className="text-sm font-semibold text-[#0f1f1d]">
        Deneyiminizi değerlendirin
      </p>
      <p className="mt-1 text-xs text-black/45">{DEAL_REVIEW_BLIND_HINT}</p>

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
