export function ExploreBannerArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 148 112"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect
        x="86"
        y="22"
        width="50"
        height="68"
        rx="11"
        fill="#f8fafc"
        stroke="#0f1f1d"
        strokeOpacity="0.12"
        strokeWidth="1.25"
      />
      <rect x="96" y="34" width="22" height="3.5" rx="1.75" fill="#0f1f1d" fillOpacity="0.2" />
      <rect x="96" y="43" width="30" height="3" rx="1.5" fill="#0f1f1d" fillOpacity="0.1" />
      <rect x="96" y="51" width="26" height="3" rx="1.5" fill="#0f1f1d" fillOpacity="0.1" />
      <path
        d="M111 68c-2.8 0-5 2.1-5 4.8 0 3.7 5 7.7 5 7.7s5-4 5-7.7c0-2.7-2.2-4.8-5-4.8z"
        fill="#334155"
      />
      <circle cx="111" cy="72.6" r="1.5" fill="#f8fafc" />

      <circle
        cx="40"
        cy="30"
        r="13.5"
        fill="#e2e8f0"
        stroke="#0f1f1d"
        strokeOpacity="0.14"
        strokeWidth="1.25"
      />
      <path
        d="M16 98c3-22 13.5-34 24-34s21 12 24 34"
        fill="#e8edf2"
        stroke="#0f1f1d"
        strokeOpacity="0.14"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <g transform="rotate(-16 72 64)">
        <rect
          x="58"
          y="50"
          width="28"
          height="36"
          rx="4"
          fill="#fff"
          stroke="#0f1f1d"
          strokeOpacity="0.16"
          strokeWidth="1.25"
        />
        <rect x="64" y="58" width="12" height="2.2" rx="1.1" fill="#0f1f1d" fillOpacity="0.2" />
        <rect x="64" y="64" width="16" height="2" rx="1" fill="#0f1f1d" fillOpacity="0.1" />
        <rect x="64" y="70" width="14" height="2" rx="1" fill="#0f1f1d" fillOpacity="0.1" />
      </g>
    </svg>
  );
}
