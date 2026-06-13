export default function AutoRiderLoader({ label = "Loading" }) {
  return (
    <span className="inline-flex items-center justify-center gap-2.5">
      <svg
        aria-hidden="true"
        className="h-7 w-12 shrink-0"
        viewBox="0 0 96 56"
        fill="none"
      >
        <path
          d="M10 40c10-15 22-22 36-22 13 0 24 5 40 18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="5 7"
          opacity="0.28"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-24"
            dur="1.15s"
            repeatCount="indefinite"
          />
        </path>
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 -2;0 0"
            dur="0.8s"
            repeatCount="indefinite"
          />
          <path
            d="M25 30c1.6-11.2 9.5-18.5 21-18.5h15c10.5 0 18.6 7.2 20.8 18.5"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M35 29c2.3-7 7.6-11.2 15.3-11.2h10.2c7.1 0 12.3 4.1 15.2 11.2H35Z"
            fill="white"
            opacity="0.58"
          />
          <path
            d="M16 31h65c4.6 0 8 3.7 8 8.2V42H11v-5c0-3.3 2.7-6 6-6Z"
            fill="currentColor"
          />
          <path
            d="M21 34h57"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M62 18l5 23"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.8"
          />
          <circle cx="28" cy="43" r="6" fill="white" opacity="0.95" />
          <circle cx="28" cy="43" r="2.5" fill="currentColor" />
          <circle cx="68" cy="43" r="6" fill="white" opacity="0.95" />
          <circle cx="68" cy="43" r="2.5" fill="currentColor" />
          <path
            d="M13 38h11M77 38h10"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.72"
          />
          <path
            d="M9 30h10"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.45"
          />
        </g>
        <path
          d="M7 47h82"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.2"
        />
      </svg>
      <span>{label}</span>
    </span>
  );
}
