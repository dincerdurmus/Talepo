export function MyRequestsBannerFlow() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 28"
      className="talepo-my-requests-flow h-7 w-[13.75rem]"
    >
      <line
        x1="22"
        y1="9"
        x2="198"
        y2="9"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
      <circle cx="22" cy="9" r="3.25" fill="currentColor" fillOpacity="0.58" />
      <circle cx="110" cy="9" r="3.25" fill="currentColor" fillOpacity="0.4" />
      <circle cx="198" cy="9" r="3.25" fill="currentColor" fillOpacity="0.28" />
      <text
        x="22"
        y="25"
        textAnchor="middle"
        fill="currentColor"
        fillOpacity="0.62"
        fontSize="8"
        fontWeight="600"
      >
        Taslak
      </text>
      <text
        x="110"
        y="25"
        textAnchor="middle"
        fill="currentColor"
        fillOpacity="0.62"
        fontSize="8"
        fontWeight="600"
      >
        Yayında
      </text>
      <text
        x="198"
        y="25"
        textAnchor="middle"
        fill="currentColor"
        fillOpacity="0.62"
        fontSize="8"
        fontWeight="600"
      >
        Sonuç
      </text>
    </svg>
  );
}
