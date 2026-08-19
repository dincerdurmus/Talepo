"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  SAYFAM_CAROUSEL_INTERVAL_MS,
  shouldShowSayfamCarouselControls,
} from "@/lib/panel/sayfam-focus";
import type { SayfamFocusItem } from "@/lib/panel/sayfam-home-types";
import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";

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
  const showControls = shouldShowSayfamCarouselControls(count);
  const labelId = useId();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [resumeKey, setResumeKey] = useState(0);

  const bumpResume = useCallback(() => {
    setResumeKey((current) => current + 1);
  }, []);
  const skipClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    moved: boolean;
  } | null>(null);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const activeIndex = count > 0 ? ((index % count) + count) % count : 0;
  const goNext = useCallback(() => goTo(activeIndex + 1), [goTo, activeIndex]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [goTo, activeIndex]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (paused || hidden || reduceMotion || !showControls) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, SAYFAM_CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, hidden, reduceMotion, showControls, count, resumeKey]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!showControls || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - drag.x) > 8) drag.moved = true;
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) < 48) return;
    skipClickRef.current = true;
    bumpResume();
    if (dx < 0) goNext();
    else goPrev();
  };

  const onSlideClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!skipClickRef.current) return;
    event.preventDefault();
    skipClickRef.current = false;
  };

  if (count === 0) {
    return (
      <div className="talepo-beacon-spotlight talepo-rise rounded-[1.35rem] border border-dashed border-[#0f1f1d]/10 bg-white/80 px-5 py-8 text-center sm:px-8">
        <p className="text-[15px] font-semibold text-[#0f1f1d]">Henüz aktif süreç yok</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#0f1f1d]/48">
          İlk talebinizi yazdığınızda süreçler burada görünür.
        </p>
        <Link
          href="/talep"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0f766e] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#115e59]"
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
      <div
        className="talepo-beacon-spotlight talepo-rise"
        role="region"
        aria-roledescription={showControls ? "carousel" : undefined}
        aria-labelledby={labelId}
        tabIndex={showControls ? 0 : undefined}
        onKeyDown={(event) => {
          if (!showControls) return;
          if (event.key === "ArrowRight") {
            event.preventDefault();
            bumpResume();
            goNext();
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            bumpResume();
            goPrev();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div className="talepo-beacon-spotlight-ring" aria-hidden />
        <p id={labelId} className="sr-only">
          Aktif süreçler
        </p>
        <div className="talepo-beacon-spotlight-viewport">
          <div
            className="talepo-beacon-spotlight-track"
            data-instant={reduceMotion ? "true" : undefined}
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {items.map((item, i) => (
              <Link
                key={item.id}
                href={item.href}
                className="talepo-beacon-spotlight-slide"
                aria-hidden={i !== activeIndex}
                tabIndex={i === activeIndex ? 0 : -1}
                aria-label={`${item.title}, ${item.statusLabel}`}
                onClick={onSlideClick}
              >
                <SpotlightSlide item={item} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {showControls ? (
        <div className="talepo-beacon-carousel-bar">
          <button
            type="button"
            className="talepo-beacon-carousel-nav"
            aria-label="Önceki talep"
            onClick={() => {
              bumpResume();
              goPrev();
            }}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <p className="talepo-beacon-carousel-count" aria-hidden>
              {activeIndex + 1} / {count}
            </p>
            <div
              className="flex items-center"
              role="tablist"
              aria-label="Aktif süreçler"
            >
              {items.map((focus, i) => (
                <button
                  key={focus.id}
                  type="button"
                  role="tab"
                    aria-selected={i === activeIndex}
                    aria-label={`${focus.title} (${i + 1}/${count})`}
                    className={`talepo-beacon-carousel-dot ${
                      i === activeIndex ? "talepo-beacon-carousel-dot--active" : ""
                    }`}
                  onClick={() => {
                    bumpResume();
                    goTo(i);
                  }}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            className="talepo-beacon-carousel-nav"
            aria-label="Sonraki talep"
            onClick={() => {
              bumpResume();
              goNext();
            }}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
