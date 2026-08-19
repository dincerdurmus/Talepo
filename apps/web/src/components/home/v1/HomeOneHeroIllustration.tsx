"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Ana Sayfa 1 hero — editorial product illustration.
 * Anonymous by design: no company names, no fake listings.
 * Shows one need → multiple offers → your choice (private until accept).
 */
export function HomeOneHeroIllustration() {
  const uid = useId().replace(/:/g, "");
  const frameRef = useRef<HTMLDivElement>(null);
  const p = `h1-${uid}`;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const shift = Math.min(window.scrollY * 0.045, 20);
        frame.style.transform = `translate3d(0, ${shift}px, 0)`;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className="talepo-home1-hero-parallax relative w-full will-change-transform"
      aria-hidden
    >
      <div className="pointer-events-none absolute -inset-x-6 -inset-y-8 rounded-[2rem] bg-[radial-gradient(ellipse_at_50%_42%,rgba(45,212,191,0.14)_0%,transparent_65%)] blur-3xl" />

      <div className="talepo-home1-hero-illustration relative overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#060a09]/40 p-3 shadow-[0_32px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-4">
        <svg
          viewBox="0 0 720 400"
          className="h-auto w-full"
          role="presentation"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={`${p}-surface`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f8fbfb" />
            </linearGradient>
            <linearGradient id={`${p}-teal`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id={`${p}-ink`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.09)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
            </linearGradient>
            <filter id={`${p}-lift`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#000" floodOpacity="0.35" />
            </filter>
            <filter id={`${p}-soft`} x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#042f2e" floodOpacity="0.2" />
            </filter>
            <filter id={`${p}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern id={`${p}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.75" fill="#fff" fillOpacity="0.055" />
            </pattern>
          </defs>

          {/* Atmosphere */}
          <rect width="720" height="400" fill={`url(#${p}-grid)`} />
          <ellipse cx="120" cy="60" rx="100" ry="70" fill="#14b8a6" fillOpacity="0.07" />
          <ellipse cx="620" cy="320" rx="120" ry="90" fill="#5eead4" fillOpacity="0.05" />

          {/* Flow connector */}
          <path
            d="M 328 78 C 360 78, 360 118, 392 118"
            fill="none"
            stroke="#5eead4"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="5 7"
            className="talepo-hero-flow"
          />

          {/* ── Request ── */}
          <g className="talepo-hero-enter" style={{ animationDelay: "0.06s" }} filter={`url(#${p}-lift)`}>
            <rect x="48" y="48" width="280" height="54" rx="14" fill={`url(#${p}-surface)`} />
            <rect x="48" y="48" width="4" height="54" rx="2" fill={`url(#${p}-teal)`} />
            <circle cx="78" cy="75" r="13" fill="#ecfdf8" />
            <path d="M72 75h12M78 69v12" stroke="#0f766e" strokeWidth="2.2" strokeLinecap="round" />
            <rect x="102" y="64" width="140" height="8" rx="4" fill="#0f1f1d" fillOpacity="0.14" />
            <rect x="102" y="78" width="96" height="6" rx="3" fill="#0f1f1d" fillOpacity="0.07" />
            <rect x="248" y="62" width="64" height="26" rx="9" fill="#ecfdf8" />
            <text
              x="280"
              y="79"
              textAnchor="middle"
              fill="#0f766e"
              fontSize="11"
              fontWeight="600"
              fontFamily="inherit"
              letterSpacing="0.06em"
            >
              1 TALEP
            </text>
          </g>

          {/* ── Comparison surface ── */}
          <g filter={`url(#${p}-lift)`}>
            <rect x="48" y="118" width="448" height="236" rx="16" fill={`url(#${p}-surface)`} />
            <rect x="48" y="118" width="448" height="36" rx="16" fill="#f0fdfa" />
            <rect x="48" y="142" width="448" height="12" fill="#f0fdfa" />
            <text
              x="68"
              y="141"
              fill="#0f766e"
              fontSize="11.5"
              fontWeight="600"
              fontFamily="inherit"
              letterSpacing="0.1em"
            >
              TEKLİFLERİ KARŞILAŞTIR
            </text>
            <text
              x="476"
              y="141"
              textAnchor="end"
              fill="#0f766e"
              fillOpacity="0.45"
              fontSize="10.5"
              fontWeight="500"
              fontFamily="inherit"
              letterSpacing="0.04em"
            >
              3 teklif
            </text>

            {/* Offer 1 — selected */}
            <g className="talepo-hero-enter" style={{ animationDelay: "0.16s" }}>
              <rect
                x="64"
                y="168"
                width="416"
                height="46"
                rx="11"
                fill="#ecfdf8"
                stroke="#14b8a6"
                strokeWidth="1.5"
              />
              <circle cx="88" cy="191" r="10" fill={`url(#${p}-teal)`} className="talepo-hero-pulse" />
              <path
                d="M82 191l4.5 4.5 9-10"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="110" y="180" width="108" height="7" rx="3.5" fill="#0f766e" fillOpacity="0.55" />
              <rect x="110" y="193" width="72" height="5" rx="2.5" fill="#0f766e" fillOpacity="0.18" />
              <text
                x="464"
                y="196"
                textAnchor="end"
                fill="#0f766e"
                fontSize="14"
                fontWeight="600"
                fontFamily="inherit"
              >
                ₺42.900
              </text>
            </g>

            {/* Offer 2 */}
            <g
              className="talepo-hero-enter talepo-hero-float"
              style={{ animationDelay: "0.26s" }}
            >
              <rect x="64" y="222" width="416" height="42" rx="11" fill="#f4f7f6" />
              <circle cx="88" cy="243" r="10" fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
              <rect x="110" y="232" width="96" height="6" rx="3" fill="#0f1f1d" fillOpacity="0.12" />
              <rect x="110" y="244" width="60" height="5" rx="2.5" fill="#0f1f1d" fillOpacity="0.06" />
              <text
                x="464"
                y="247"
                textAnchor="end"
                fill="#0f1f1d"
                fillOpacity="0.38"
                fontSize="13"
                fontWeight="600"
                fontFamily="inherit"
              >
                ₺48.500
              </text>
            </g>

            {/* Offer 3 */}
            <g className="talepo-hero-enter" style={{ animationDelay: "0.36s" }}>
              <rect x="64" y="272" width="416" height="42" rx="11" fill="#fafafa" />
              <circle cx="88" cy="293" r="10" fill="#fff" stroke="#e2e8f0" strokeWidth="1.5" />
              <rect x="110" y="282" width="84" height="6" rx="3" fill="#0f1f1d" fillOpacity="0.08" />
              <rect x="110" y="294" width="52" height="5" rx="2.5" fill="#0f1f1d" fillOpacity="0.04" />
              <text
                x="464"
                y="297"
                textAnchor="end"
                fill="#0f1f1d"
                fillOpacity="0.28"
                fontSize="13"
                fontWeight="600"
                fontFamily="inherit"
              >
                ₺51.200
              </text>
            </g>
          </g>

          {/* ── Floating trust chips ── */}
          <g className="talepo-hero-enter" style={{ animationDelay: "0.3s" }} filter={`url(#${p}-soft)`}>
            <rect x="520" y="156" width="152" height="72" rx="14" fill={`url(#${p}-ink)`} stroke="#fff" strokeOpacity="0.1" />
            <circle cx="556" cy="188" r="22" fill={`url(#${p}-teal)`} className="talepo-hero-pulse" />
            <path
              d="M547 188l6 6 12-13"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text
              x="596"
              y="184"
              fill="#fff"
              fillOpacity="0.88"
              fontSize="12"
              fontWeight="600"
              fontFamily="inherit"
            >
              Seçiminiz
            </text>
            <text
              x="596"
              y="202"
              fill="#fff"
              fillOpacity="0.42"
              fontSize="10"
              fontWeight="500"
              fontFamily="inherit"
            >
              Baskı yok
            </text>
          </g>

          <g className="talepo-hero-enter" style={{ animationDelay: "0.38s" }} filter={`url(#${p}-soft)`}>
            <rect x="520" y="244" width="152" height="56" rx="14" fill={`url(#${p}-ink)`} stroke="#fff" strokeOpacity="0.08" />
            <rect x="540" y="262" width="28" height="20" rx="5" fill="#99f6e4" fillOpacity="0.85" />
            <path
              d="M548 262v-5a6 6 0 0 1 12 0v5"
              fill="none"
              stroke="#99f6e4"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <text
              x="596"
              y="270"
              fill="#fff"
              fillOpacity="0.78"
              fontSize="11"
              fontWeight="600"
              fontFamily="inherit"
            >
              Gizli iletişim
            </text>
            <text
              x="596"
              y="286"
              fill="#fff"
              fillOpacity="0.38"
              fontSize="9.5"
              fontWeight="500"
              fontFamily="inherit"
            >
              Kabul edene kadar
            </text>
          </g>
        </svg>
      </div>

      <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/28 lg:text-left">
        Tek talep · Birden fazla teklif · Siz seçin
      </p>
    </div>
  );
}
