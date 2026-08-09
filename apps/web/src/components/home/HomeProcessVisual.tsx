/**
 * Homepage hero marketplace illustration.
 * Comparison-first scene: one need, stacked offers, pick the best.
 */
export function HomeProcessVisual({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none relative ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 640 400"
        className="h-auto w-full"
        role="presentation"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="hv-card" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f0fdfa" />
          </linearGradient>
          <linearGradient id="hv-teal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
          <linearGradient id="hv-amber" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="hv-pick" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <filter id="hv-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="14"
              floodColor="#042f2e"
              floodOpacity="0.3"
            />
          </filter>
          <filter id="hv-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="4"
              stdDeviation="6"
              floodColor="#042f2e"
              floodOpacity="0.18"
            />
          </filter>
          <pattern
            id="hv-dots"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1.5" cy="1.5" r="1.1" fill="#ffffff" fillOpacity="0.07" />
          </pattern>
        </defs>

        {/* Atmosphere */}
        <g opacity="0.95">
          <rect width="640" height="400" fill="url(#hv-dots)" />
          <circle cx="90" cy="50" r="64" fill="#ffffff" fillOpacity="0.05" />
          <circle cx="560" cy="300" r="90" fill="#fbbf24" fillOpacity="0.1" />
          <path
            d="M480 10c40 28 58 78 42 128"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.06"
            strokeWidth="40"
            strokeLinecap="round"
          />
        </g>

        {/* Need bar — single listing cue */}
        <g
          className="talepo-hero-enter"
          style={{ animationDelay: "0.08s" }}
          filter="url(#hv-shadow)"
        >
          <rect
            x="72"
            y="42"
            width="380"
            height="56"
            rx="16"
            fill="url(#hv-card)"
          />
          <rect
            x="72"
            y="42"
            width="8"
            height="56"
            rx="4"
            fill="url(#hv-amber)"
          />
          <circle cx="112" cy="70" r="14" fill="#ecfdf5" />
          <path
            d="M106 70h12M112 64v12"
            stroke="#0f766e"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <rect
            x="140"
            y="58"
            width="168"
            height="9"
            rx="4.5"
            fill="#0f1f1d"
            fillOpacity="0.72"
          />
          <rect
            x="140"
            y="74"
            width="110"
            height="6"
            rx="3"
            fill="#0f1f1d"
            fillOpacity="0.2"
          />
          <rect x="340" y="56" width="88" height="28" rx="10" fill="#ccfbf1" />
          <text
            x="384"
            y="74"
            textAnchor="middle"
            fill="#0f766e"
            fontSize="12"
            fontWeight="700"
            fontFamily="inherit"
          >
            1 talep
          </text>
        </g>

        {/* Comparison board */}
        <g filter="url(#hv-shadow)">
          <rect
            x="72"
            y="118"
            width="380"
            height="214"
            rx="22"
            fill="url(#hv-card)"
          />
          <rect x="72" y="118" width="380" height="40" rx="22" fill="#ecfdf5" />
          <rect x="72" y="140" width="380" height="18" fill="#ecfdf5" />
          <text
            x="96"
            y="144"
            fill="#0f766e"
            fontSize="13"
            fontWeight="700"
            fontFamily="inherit"
            letterSpacing="0.04em"
          >
            Teklifleri karşılaştır
          </text>
          <text
            x="420"
            y="144"
            textAnchor="end"
            fill="#0f766e"
            fillOpacity="0.55"
            fontSize="11"
            fontWeight="600"
            fontFamily="inherit"
          >
            3 firma
          </text>

          {/* Offer row 1 — selected */}
          <g
            className="talepo-hero-enter"
            style={{ animationDelay: "0.18s" }}
          >
            <rect
              x="92"
              y="172"
              width="340"
              height="44"
              rx="12"
              fill="#ecfdf5"
              stroke="#14b8a6"
              strokeWidth="1.75"
            />
            <circle cx="118" cy="194" r="11" fill="url(#hv-pick)" />
            <path
              d="M112 194l4 4 8-9"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="142"
              y="182"
              width="96"
              height="8"
              rx="4"
              fill="#0f766e"
              fillOpacity="0.7"
            />
            <rect
              x="142"
              y="196"
              width="64"
              height="5"
              rx="2.5"
              fill="#0f766e"
              fillOpacity="0.25"
            />
            <text
              x="408"
              y="199"
              textAnchor="end"
              fill="#0f766e"
              fontSize="14"
              fontWeight="700"
              fontFamily="inherit"
            >
              ₺42.900
            </text>
          </g>

          {/* Offer row 2 */}
          <g
            className="talepo-hero-enter talepo-hero-float"
            style={{ animationDelay: "0.28s" }}
          >
            <rect
              x="92"
              y="226"
              width="340"
              height="40"
              rx="12"
              fill="#fff7ed"
              fillOpacity="0.85"
            />
            <circle cx="118" cy="246" r="11" fill="#ffedd5" />
            <circle cx="118" cy="246" r="5" fill="#f97316" />
            <rect
              x="142"
              y="236"
              width="88"
              height="7"
              rx="3.5"
              fill="#c2410c"
              fillOpacity="0.55"
            />
            <rect
              x="142"
              y="249"
              width="52"
              height="5"
              rx="2.5"
              fill="#c2410c"
              fillOpacity="0.2"
            />
            <text
              x="408"
              y="251"
              textAnchor="end"
              fill="#9a3412"
              fontSize="13"
              fontWeight="700"
              fontFamily="inherit"
            >
              ₺48.500
            </text>
          </g>

          {/* Offer row 3 */}
          <g
            className="talepo-hero-enter"
            style={{ animationDelay: "0.38s" }}
          >
            <rect
              x="92"
              y="276"
              width="340"
              height="40"
              rx="12"
              fill="#f8fafc"
            />
            <circle cx="118" cy="296" r="11" fill="#e2e8f0" />
            <circle cx="118" cy="296" r="5" fill="#64748b" />
            <rect
              x="142"
              y="286"
              width="80"
              height="7"
              rx="3.5"
              fill="#0f1f1d"
              fillOpacity="0.45"
            />
            <rect
              x="142"
              y="299"
              width="48"
              height="5"
              rx="2.5"
              fill="#0f1f1d"
              fillOpacity="0.15"
            />
            <text
              x="408"
              y="301"
              textAnchor="end"
              fill="#475569"
              fontSize="13"
              fontWeight="700"
              fontFamily="inherit"
            >
              ₺51.200
            </text>
          </g>
        </g>

        {/* Side trust / pick panel */}
        <g
          className="talepo-hero-enter"
          style={{ animationDelay: "0.32s" }}
          filter="url(#hv-soft)"
        >
          <rect
            x="478"
            y="118"
            width="118"
            height="214"
            rx="22"
            fill="#042f2e"
            fillOpacity="0.28"
          />
          <rect
            x="492"
            y="138"
            width="90"
            height="90"
            rx="20"
            fill="url(#hv-card)"
          />
          <circle
            cx="537"
            cy="176"
            r="26"
            fill="url(#hv-teal)"
            className="talepo-hero-pulse"
          />
          <path
            d="M526 176l7 7 14-15"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="537"
            y="248"
            textAnchor="middle"
            fill="#ffffff"
            fillOpacity="0.92"
            fontSize="12"
            fontWeight="700"
            fontFamily="inherit"
          >
            Seçildi
          </text>

          <rect
            x="492"
            y="268"
            width="90"
            height="44"
            rx="14"
            fill="#ffffff"
            fillOpacity="0.1"
          />
          <path
            d="M514 286v-4a9 9 0 0 1 18 0v4"
            fill="none"
            stroke="#99f6e4"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="512"
            y="286"
            width="22"
            height="16"
            rx="4"
            fill="#99f6e4"
            fillOpacity="0.85"
          />
          <text
            x="537"
            y="322"
            textAnchor="middle"
            fill="#ffffff"
            fillOpacity="0.7"
            fontSize="10"
            fontWeight="600"
            fontFamily="inherit"
          >
            Gizli iletişim
          </text>
        </g>

        {/* Caption pill */}
        <g className="talepo-hero-enter" style={{ animationDelay: "0.45s" }}>
          <rect
            x="148"
            y="350"
            width="344"
            height="34"
            rx="17"
            fill="#042f2e"
            fillOpacity="0.32"
          />
          <text
            x="320"
            y="372"
            textAnchor="middle"
            fill="#ffffff"
            fillOpacity="0.9"
            fontSize="12.5"
            fontWeight="500"
            fontFamily="inherit"
          >
            Tek ilan · Birden fazla teklif · Siz seçin
          </text>
        </g>
      </svg>
    </div>
  );
}
