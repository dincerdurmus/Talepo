"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SayfamFocusItem } from "@/lib/panel/sayfam-home-types";
import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";

const CAROUSEL_MS = 10_000;

function SpotlightSlide({ item }: { item: SayfamFocusItem }) {
  return (
    <>
      <div className="shrink-0">
        <CategoryVisualThumb
          categorySlug={item.categorySlug}
          categoryName={item.categoryName}
          coverImageUrl={item.coverImageUrl}
          requestTitle={item.title}
          size="lg"
          className="talepo-beacon-spotlight-thumb h-[5.5rem] w-[5.5rem] sm:h-[6.25rem] sm:w-[6.25rem]"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0f766e]">
          <span className="talepo-beacon-pulse-dot" aria-hidden />
          {item.statusLabel}
        </p>
        <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#0f1f1d] sm:text-[1.5rem]">
          {item.title}
        </p>
        {item.detailLabel ? (
          <p className="mt-1 text-[14px] text-[#0f1f1d]/48">{item.detailLabel}</p>
        ) : null}
      </div>
      <span className="talepo-beacon-spotlight-cta shrink-0 self-start sm:self-center">
        <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
      </span>
    </>
  );
}

export function PanelSayfamSpotlightCarousel({
  items,
}: {
  items: SayfamFocusItem[];
}) {
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const item = count > 0 ? items[index]! : null;

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (paused || reduceMotion || count <= 1) return;

    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, CAROUSEL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, reduceMotion, count]);

  if (!item) {
    return (
      <div className="talepo-beacon-spotlight talepo-rise rounded-[1.35rem] border border-dashed border-[#0f1f1d]/10 bg-white/80 px-5 py-8 text-center sm:px-8">
        <p className="text-[15px] font-semibold text-[#0f1f1d]">Henüz odak talep yok</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#0f1f1d]/48">
          İlk talebinizi oluşturduğunuzda teklifler ve güncellemeler burada görünür.
        </p>
        <Link
          href="/talep"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0f766e] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#115e59]"
        >
          İlk talebinizi oluşturun
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    );
  }

  return (
    <div
      className="talepo-beacon-spotlight-wrap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <Link
        href={item.href}
        className="talepo-beacon-spotlight talepo-rise group block"
        aria-label={`${item.title}, ${item.statusLabel}`}
      >
        <div className="talepo-beacon-spotlight-ring" aria-hidden />
        <div
          key={item.id}
          className="talepo-beacon-spotlight-slide relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5"
        >
          <SpotlightSlide item={item} />
        </div>
      </Link>

      {count > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-1.5"
            role="tablist"
            aria-label="Odak talepleri"
          >
            {items.map((focus, i) => (
              <button
                key={focus.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${focus.title} (${i + 1}/${count})`}
                className={`talepo-beacon-carousel-dot ${i === index ? "talepo-beacon-carousel-dot--active" : ""}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="talepo-beacon-carousel-nav"
              aria-label="Önceki talep"
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="talepo-beacon-carousel-nav"
              aria-label="Sonraki talep"
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
