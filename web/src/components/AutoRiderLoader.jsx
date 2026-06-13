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
            d="M23 31c1.4-10.4 8.6-17 19.5-17h14c8.2 0 15.2 5 17.6 12.8L76 31"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M30 30h38l-3.8-10.5H43c-6.8 0-11.4 3.6-13 10.5Z"
            fill="currentColor"
            opacity="0.18"
          />
          <path
            d="M18 32h60c3.4 0 6 2.7 6 6v3H12v-3c0-3.3 2.7-6 6-6Z"
            fill="currentColor"
          />
          <path
            d="M23 32h50"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.35"
          />
          <circle cx="29" cy="42" r="6" fill="white" opacity="0.95" />
          <circle cx="29" cy="42" r="2.5" fill="currentColor" />
          <circle cx="67" cy="42" r="6" fill="white" opacity="0.95" />
          <circle cx="67" cy="42" r="2.5" fill="currentColor" />
          <path
            d="M46 20h12l3.2 10H42l4-10Z"
            fill="white"
            opacity="0.55"
          />
          <path
            d="M15 37h7M74 37h8"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
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
