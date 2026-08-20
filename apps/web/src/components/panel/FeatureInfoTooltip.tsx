"use client";

import { Info } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";

import type { FeatureKey } from "@/lib/membership/entitlements";
import { FEATURE_META } from "@/lib/membership/feature-meta";
import { PRO_FEATURE_PRESENTATION } from "@/lib/membership/feature-presentation";
import {
  collisionPaddingForViewport,
  placeCollisionTooltip,
} from "@/lib/panel/collision-popover";

type FeatureInfoTooltipProps = {
  feature?: FeatureKey | keyof typeof PRO_FEATURE_PRESENTATION;
  label?: string;
  description?: string;
};

export function FeatureInfoTooltip({
  feature,
  label,
  description,
}: FeatureInfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    ready: boolean;
  }>({ top: 0, left: 0, ready: false });
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presentation = feature
    ? PRO_FEATURE_PRESENTATION[feature as keyof typeof PRO_FEATURE_PRESENTATION]
    : undefined;
  const meta = feature ? FEATURE_META[feature as FeatureKey] : undefined;

  const title = label ?? presentation?.label ?? meta?.label;
  const body = description ?? presentation?.description ?? meta?.description;

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  const closeTip = useCallback(() => {
    clearHoverTimer();
    setOpen(false);
    setCoords({ top: 0, left: 0, ready: false });
  }, [clearHoverTimer]);

  const openTip = useCallback(() => {
    clearHoverTimer();
    setOpen(true);
  }, [clearHoverTimer]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const triggerBox = trigger.getBoundingClientRect();
    const tipBox = tip.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const padding = collisionPaddingForViewport(viewport.width);
    const next = placeCollisionTooltip({
      trigger: triggerBox,
      menu: {
        width: Math.max(tipBox.width, tip.offsetWidth, 240),
        height: Math.max(tipBox.height, tip.offsetHeight, 72),
      },
      viewport,
      padding,
      gap: 8,
    });
    setCoords((current) => {
      if (
        current.ready &&
        current.top === next.top &&
        current.left === next.left
      ) {
        return current;
      }
      return { top: next.top, left: next.left, ready: true };
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place, title, body]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeTip();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      closeTip();
    }
    function onViewport() {
      place();
    }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
    };
  }, [open, place, closeTip]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  if (!title || !body) return null;

  function openFromHover() {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => openTip(), 80);
  }

  function closeFromHover() {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => closeTip(), 120);
  }

  function onTriggerClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (open) closeTip();
    else openTip();
  }

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onMouseEnter={openFromHover}
      onMouseLeave={closeFromHover}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Bilgi: ${title}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={onTriggerClick}
        onFocus={openTip}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/35 ${
          open
            ? "bg-teal-900/12 text-teal-800"
            : "bg-teal-900/[0.06] text-teal-800/70 hover:bg-teal-900/10 hover:text-teal-800"
        }`}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2.35} aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tipRef}
              id={id}
              role="tooltip"
              onMouseEnter={openFromHover}
              onMouseLeave={closeFromHover}
              className="pointer-events-auto fixed z-[120] w-[min(20rem,calc(100vw-1.5rem))] rounded-[12px] border border-white/10 bg-[#12201e] px-3.5 py-3 text-left shadow-[0_14px_34px_rgba(8,16,14,0.35)]"
              style={{
                top: coords.top,
                left: coords.left,
                visibility: coords.ready ? "visible" : "hidden",
              }}
            >
              <span className="block text-[12px] font-semibold tracking-[-0.01em] text-[#f4fbf9]">
                {title}
              </span>
              <span className="mt-1.5 block text-[12px] leading-5 text-white/72">
                {body}
              </span>
              {presentation?.trustNote ? (
                <span className="mt-2 block border-t border-white/10 pt-2 text-[11px] font-medium leading-4 text-teal-100/75">
                  {presentation.trustNote}
                </span>
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
