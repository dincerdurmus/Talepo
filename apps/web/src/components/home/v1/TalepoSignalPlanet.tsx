"use client";

/**
 * Full-bleed React shell for the GetLayers-derived Three.js planet.
 * The request beam, single Türkiye pulse and response rail share one projected
 * anchor, preventing the two-location ambiguity of the earlier scene.
 */
import { useEffect, useRef, useState } from "react";

import type {
  BroadcastPlanetHandle,
  PlanetAnchor,
  PlanetStory,
} from "@/lib/planet/broadcast-scene";

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

const STATUS = [
  "Teklif alındı",
  "Uygun satıcı bulundu",
  "Karşılaştırmaya hazır",
] as const;

export function TalepoSignalPlanet() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beamRef = useRef<SVGLineElement | null>(null);
  const pulseRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const lastAnchorRef = useRef<PlanetAnchor | null>(null);
  const [story, setStory] = useState<PlanetStory>(0);
  const [ready, setReady] = useState(false);
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [failed, setFailed] = useState(
    () => typeof window !== "undefined" && !webglAvailable(),
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || failed) return;

    let handle: BroadcastPlanetHandle | null = null;
    let cancelled = false;
    let visible = true;
    let pageVisible = !document.hidden;
    let io: IntersectionObserver | null = null;
    let introTimer = 0;
    let ro: ResizeObserver | null = null;

    const positionOverlay = (anchor: PlanetAnchor) => {
      lastAnchorRef.current = anchor;
      const wrapRect = wrap.getBoundingClientRect();
      const composer = document.querySelector<HTMLElement>(
        "[data-talepo-composer-anchor='true']",
      );
      const composerRect = composer?.getBoundingClientRect();
      const targetX = anchor.x;
      const targetY = anchor.y;
      const startX = composerRect
        ? composerRect.right - wrapRect.left
        : Math.max(24, targetX - wrapRect.width * 0.36);
      const startY = composerRect
        ? composerRect.top + composerRect.height / 2 - wrapRect.top
        : targetY;

      const beam = beamRef.current;
      if (beam) {
        beam.setAttribute("x1", String(startX));
        beam.setAttribute("y1", String(startY));
        beam.setAttribute("x2", String(targetX));
        beam.setAttribute("y2", String(targetY));
      }

      const pulse = pulseRef.current;
      if (pulse) {
        pulse.style.left = `${targetX}px`;
        pulse.style.top = `${targetY}px`;
        pulse.style.visibility = anchor.visible ? "visible" : "hidden";
      }

      const status = statusRef.current;
      if (status) {
        const compact = wrapRect.width < 640;
        const railWidth = compact ? 174 : 190;
        let left = targetX + (compact ? -70 : 42);
        if (!compact && left + railWidth > wrapRect.width - 18) {
          left = targetX - railWidth - 42;
        }
        left = Math.max(16, Math.min(left, wrapRect.width - railWidth - 16));
        const top = compact
          ? Math.min(targetY + 38, wrapRect.height - 126)
          : Math.max(72, Math.min(targetY - 12, wrapRect.height - 126));
        status.style.left = `${left}px`;
        status.style.top = `${top}px`;
        status.style.visibility = anchor.visible ? "visible" : "hidden";
      }
    };

    const syncPlay = () => {
      if (!handle || reduced) return;
      if (visible && pageVisible) handle.start();
      else handle.stop();
    };
    const onVis = () => {
      pageVisible = !document.hidden;
      syncPlay();
    };
    const onResize = () => {
      handle?.resize();
      if (lastAnchorRef.current) positionOverlay(lastAnchorRef.current);
    };
    const onTyping = () => {
      handle?.triggerBroadcast();
      if (reduced) {
        setStory(4);
        handle?.renderSingleFrame();
      }
    };

    import("@/lib/planet/broadcast-scene")
      .then(({ createBroadcastPlanetScene, planetAssetsConfigured }) => {
        if (cancelled) return;
        if (!planetAssetsConfigured()) {
          /* Lisanslı varlıkların adresi tanımsız — sahne kurulmaz. */
          setFailed(true);
          return;
        }
        handle = createBroadcastPlanetScene({
          canvas,
          container: wrap,
          small: window.innerWidth < 640,
          reducedMotion: reduced,
          onAnchor: positionOverlay,
          onStory: setStory,
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            if (reduced) handle?.renderSingleFrame();
          },
        });

        io = new IntersectionObserver(
          (entries) => {
            visible = entries[0]?.isIntersecting ?? true;
            syncPlay();
          },
          { threshold: 0.05 },
        );
        io.observe(wrap);
        ro = new ResizeObserver(onResize);
        ro.observe(wrap);
        window.addEventListener("resize", onResize);
        document.addEventListener("visibilitychange", onVis);
        window.addEventListener("talepo:home-typing", onTyping);

        if (!reduced) syncPlay();
        else handle.renderSingleFrame();

        introTimer = window.setTimeout(() => {
          if (cancelled) return;
          handle?.triggerBroadcast();
          if (reduced) {
            setStory(4);
            handle?.renderSingleFrame();
          }
        }, 2200);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(introTimer);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("talepo:home-typing", onTyping);
      handle?.dispose();
      handle = null;
    };
    // The WebGL scene intentionally owns one browser lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = story >= 1;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      data-talepo-planet-overlay
      className="relative h-full w-full select-none overflow-hidden"
    >
      {!ready && !failed ? (
        <div
          className="absolute -bottom-[28%] -right-[22%] aspect-square h-[112%] rounded-full opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(45,212,191,0.10), rgba(45,212,191,0.02) 58%, transparent 72%)",
          }}
        />
      ) : null}

      {failed ? (
        <div
          className="absolute -bottom-[30%] -right-[24%] aspect-square h-[116%] rounded-full border border-teal-100/10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 36% 30%, rgba(94,234,212,0.14), rgba(5,17,15,0.96) 62%)",
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        focusable="false"
      >
        <line
          ref={beamRef}
          pathLength="1"
          className={`talepo-planet-beam ${active ? "is-active" : ""}`}
        />
      </svg>

      <div
        ref={pulseRef}
        className={`talepo-planet-pulse pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-100 transition-opacity duration-500 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="absolute inset-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-200/45" />
        <span className="absolute inset-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-200/20" />
      </div>

      <div
        ref={statusRef}
        data-talepo-status-rail
        className={`pointer-events-none absolute w-[174px] rounded-xl border border-teal-100/15 bg-[#04100e]/78 px-3 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.30)] backdrop-blur-md transition-opacity duration-500 sm:w-[190px] ${
          story >= 2 ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute bottom-4 left-[17px] top-4 w-px bg-teal-200/42" />
        <div className="space-y-3">
          {STATUS.map((label, index) => {
            const visibleAt = (index + 2) as PlanetStory;
            return (
              <div
                key={label}
                className={`relative flex min-h-5 items-center pl-6 text-[11px] font-medium tracking-[-0.01em] text-white/82 transition-all duration-500 sm:text-[12px] ${
                  story >= visibleAt
                    ? "translate-y-0 opacity-100"
                    : "translate-y-1 opacity-0"
                }`}
              >
                <span className="absolute left-0 h-[11px] w-[11px] rounded-full border border-teal-100/60 bg-teal-200 shadow-[0_0_16px_rgba(94,234,212,0.68)]" />
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
